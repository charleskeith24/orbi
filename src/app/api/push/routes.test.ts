/** /api/push/{status,subscribe,unsubscribe,test} with a fake session client and mocked web-push. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  configured: true,
  user: { id: "user-1" } as { id: string } | null,
  rpc: vi.fn(),
  deletes: [] as { filters: [string, unknown][]; count?: string }[],
  subscriptions: [] as Record<string, unknown>[],
  settings: { ui_language: "en" } as Record<string, unknown> | null,
  sendNotification: vi.fn(),
}))

vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return mocks.configured
  },
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
}))

vi.mock("web-push", () => ({ default: { sendNotification: mocks.sendNotification } }))

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    rpc: mocks.rpc,
    from: (table: string) => {
      const filters: [string, unknown][] = []
      let deleting: { count?: string } | null = null
      const api = {
        select: () => api,
        delete: (options?: { count?: string }) => ((deleting = options ?? {}), api),
        eq: (column: string, value: unknown) => (filters.push([column, value]), api),
        limit: () => api,
        maybeSingle: async () => ({ data: mocks.settings, error: null }),
        then(resolve: (value: unknown) => void) {
          if (deleting) {
            mocks.deletes.push({ filters, ...deleting })
            resolve({ error: null, count: 1 })
            return
          }
          const rows = table === "push_subscriptions" ? mocks.subscriptions.filter((row) => filters.every(([c, v]) => row[c] === v)) : []
          resolve({ data: rows, error: null })
        },
      }
      return api
    },
  }),
}))

const status = await import("./status/route")
const subscribe = await import("./subscribe/route")
const unsubscribe = await import("./unsubscribe/route")
const test = await import("./test/route")

const post = (handler: (request: Request) => Promise<Response>, body: unknown) =>
  handler(
    new Request("http://localhost:3000/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Android)" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

const SUBSCRIPTION = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", expirationTime: null, keys: { p256dh: "BNcRdreALRFX", auth: "tBHItJI5svbpez7KI4CCXg" } }

beforeEach(() => {
  mocks.configured = true
  mocks.user = { id: "user-1" }
  mocks.rpc.mockReset()
  mocks.rpc.mockResolvedValue({ data: "sub-1", error: null })
  mocks.deletes = []
  mocks.settings = { ui_language: "en" }
  mocks.subscriptions = [
    { id: "sub-1", user_id: "user-1", endpoint: SUBSCRIPTION.endpoint, p256dh: "p", auth: "a", created_at: "2026-09-01T00:00:00Z", failure_count: 0 },
    { id: "sub-2", user_id: "user-1", endpoint: "https://web.push.apple.com/xyz", p256dh: "p", auth: "a", created_at: "2026-09-01T00:00:00Z", failure_count: 0 },
  ]
  mocks.sendNotification.mockReset()
  mocks.sendNotification.mockResolvedValue({ statusCode: 201 })
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublic")
  vi.stubEnv("VAPID_PRIVATE_KEY", "private")
  vi.stubEnv("VAPID_SUBJECT", "mailto:me@example.com")
  vi.stubEnv("SUPABASE_SECRET_KEY", "")
  vi.stubEnv("CRON_SECRET", "")
})

afterEach(() => vi.unstubAllEnvs())

describe("GET /api/push/status", () => {
  it("reports push configured but the scheduler missing its secrets", async () => {
    expect(await (await status.GET()).json()).toEqual({ online: true, push: true, scheduler: false, publicKey: "BPublic" })
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret")
    vi.stubEnv("CRON_SECRET", "c")
    expect(await (await status.GET()).json()).toMatchObject({ scheduler: true })
  })

  it("reports nothing configured without VAPID keys", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "")
    expect(await (await status.GET()).json()).toMatchObject({ push: false, publicKey: null })
  })
})

describe("POST /api/push/subscribe", () => {
  it("needs the online version, VAPID keys and a session", async () => {
    mocks.configured = false
    expect((await post(subscribe.POST, SUBSCRIPTION)).status).toBe(501)
    mocks.configured = true
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "")
    expect((await post(subscribe.POST, SUBSCRIPTION)).status).toBe(501)
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublic")
    mocks.user = null
    expect((await post(subscribe.POST, SUBSCRIPTION)).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("saves the subscription through save_push_subscription", async () => {
    const response = await post(subscribe.POST, SUBSCRIPTION)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: "sub-1" })
    expect(mocks.rpc).toHaveBeenCalledWith("save_push_subscription", {
      p_endpoint: SUBSCRIPTION.endpoint,
      p_p256dh: SUBSCRIPTION.keys.p256dh,
      p_auth: SUBSCRIPTION.keys.auth,
      p_user_agent: "Mozilla/5.0 (Android)",
    })
  })

  it("rejects invalid bodies", async () => {
    for (const body of ["not json", { endpoint: "http://insecure.example/x", keys: SUBSCRIPTION.keys }, { endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: "bad key!", auth: "x" } }, { endpoint: SUBSCRIPTION.endpoint }]) {
      expect((await post(subscribe.POST, body)).status).toBe(400)
    }
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("hides database errors behind a 500", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect((await post(subscribe.POST, SUBSCRIPTION)).status).toBe(500)
    spy.mockRestore()
  })
})

describe("POST /api/push/unsubscribe", () => {
  it("deletes only the caller's row for that endpoint", async () => {
    const response = await post(unsubscribe.POST, { endpoint: SUBSCRIPTION.endpoint })
    expect(await response.json()).toEqual({ removed: 1 })
    expect(mocks.deletes).toEqual([{ count: "exact", filters: [["user_id", "user-1"], ["endpoint", SUBSCRIPTION.endpoint]] }])
  })

  it("requires a session and a valid endpoint", async () => {
    expect((await post(unsubscribe.POST, {})).status).toBe(400)
    mocks.user = null
    expect((await post(unsubscribe.POST, { endpoint: SUBSCRIPTION.endpoint })).status).toBe(401)
    expect(mocks.deletes).toEqual([])
  })
})

describe("POST /api/push/test", () => {
  it("sends a translated test notification to this device only", async () => {
    mocks.settings = { ui_language: "tl" }
    const response = await post(test.POST, { endpoint: SUBSCRIPTION.endpoint })
    expect(await response.json()).toEqual({ sent: 1, failed: 0, removed: 0 })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
    const [target, payload] = mocks.sendNotification.mock.calls[0]
    expect(target.endpoint).toBe(SUBSCRIPTION.endpoint)
    expect(JSON.parse(payload)).toEqual({ title: "Naka-on ang Orbi reminders", body: expect.any(String), url: "/settings?tab=reminders", tag: "orbi-test" })
  })

  it("sends to every device without an endpoint and removes gone ones", async () => {
    mocks.sendNotification.mockImplementationOnce(async () => {
      throw Object.assign(new Error("gone"), { statusCode: 404 })
    })
    const response = await post(test.POST, {})
    expect(await response.json()).toEqual({ sent: 1, failed: 1, removed: 1 })
    expect(mocks.deletes).toEqual([{ filters: [["id", "sub-1"]] }])
  })

  it("answers 404 without a subscription and 501 without VAPID keys", async () => {
    mocks.subscriptions = []
    expect((await post(test.POST, {})).status).toBe(404)
    vi.stubEnv("VAPID_SUBJECT", "not-a-contact")
    expect((await post(test.POST, {})).status).toBe(501)
  })
})
