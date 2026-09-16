/**
 * GET /api/cron/reminders end to end with mocked web-push and a fake Supabase service client:
 * bearer-secret checks, configuration states, sending, idempotency and cleanup of gone devices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, unknown>

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  createClientArgs: [] as unknown[][],
  sendNotification: vi.fn(),
}))

vi.mock("@/lib/supabase/config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
  isSupabaseConfigured: true,
}))

vi.mock("web-push", () => ({ default: { sendNotification: mocks.sendNotification } }))

/** Just enough of supabase-js for the reminder store: select/in/eq/or/order/range, update, delete, rpc. */
vi.mock("@supabase/supabase-js", () => {
  function builder(table: string) {
    const filters: ((row: Row) => boolean)[] = []
    let mode: "select" | "update" | "delete" = "select"
    let patch: Row = {}
    let range: [number, number] | null = null
    const api = {
      select: () => api,
      in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), api),
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), api),
      or: () => api,
      order: () => api,
      range: (from: number, to: number) => ((range = [from, to]), api),
      update: (values: Row) => ((mode = "update"), (patch = values), api),
      delete: () => ((mode = "delete"), api),
      then(resolve: (value: { data: unknown; error: { message: string } | null }) => void) {
        if (mocks.tables[table] === null) return resolve({ data: null, error: { message: "connection refused" } })
        const rows = mocks.tables[table] ?? []
        const matching = rows.filter((row) => filters.every((f) => f(row)))
        if (mode === "update") for (const row of matching) Object.assign(row, patch)
        if (mode === "delete") mocks.tables[table] = rows.filter((row) => !matching.includes(row))
        const data = range ? matching.slice(range[0], range[1] + 1) : matching
        resolve({ data: mode === "select" ? data.map((row) => ({ ...row })) : null, error: null })
      },
    }
    return api
  }
  return {
    createClient: (...args: unknown[]) => {
      mocks.createClientArgs.push(args)
      return {
        from: builder,
        rpc: async (name: string, params: { p_subscription_id: string; p_key: string }) => {
          const row = (mocks.tables.push_subscriptions ?? []).find((r) => r.id === params.p_subscription_id)
          const keys = (row?.sent_keys as string[] | undefined) ?? []
          if (name === "claim_push_reminder") {
            if (!row || keys.includes(params.p_key)) return { data: false, error: null }
            row.sent_keys = [...keys, params.p_key]
            return { data: true, error: null }
          }
          if (row) row.sent_keys = keys.filter((k) => k !== params.p_key)
          return { data: null, error: null }
        },
      }
    },
  }
})

const { GET, POST } = await import("./route")

const ENV = {
  CRON_SECRET: "cron-secret-123",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BPublicKey",
  VAPID_PRIVATE_KEY: "private",
  VAPID_SUBJECT: "mailto:creator@example.com",
}

const call = (authorization?: string, method: "GET" | "POST" = "GET") =>
  (method === "GET" ? GET : POST)(
    new Request("http://localhost:3000/api/cron/reminders", { method, headers: authorization ? { Authorization: authorization } : {} })
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-16T00:05:00.000Z")) // Wed 08:05 in Manila
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value)
  mocks.createClientArgs = []
  mocks.sendNotification.mockReset()
  mocks.sendNotification.mockResolvedValue({ statusCode: 201 })
  mocks.tables = {
    push_subscriptions: [
      { id: "sub-1", user_id: "user-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1", created_at: "2026-09-01T00:00:00Z", failure_count: 0, sent_keys: [] },
      { id: "sub-2", user_id: "user-1", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2", created_at: "2026-09-01T00:00:00Z", failure_count: 0, sent_keys: [] },
      { id: "sub-3", user_id: "user-2", endpoint: "https://push.example/3", p256dh: "p3", auth: "a3", created_at: "2026-09-01T00:00:00Z", failure_count: 0, sent_keys: [] },
    ],
    app_settings: [
      {
        user_id: "user-1", timezone: "Asia/Manila", week_starts_on: 1, weekly_post_target: 5, ui_language: "tl",
        reminders_daily_enabled: true, reminders_daily_time: "08:00", reminders_slot_enabled: false, reminders_slot_lead_minutes: 30,
        reminders_review_enabled: false, reminders_review_day: 0, reminders_review_time: "18:00",
      },
      {
        user_id: "user-2", timezone: "Asia/Manila", week_starts_on: 1, weekly_post_target: 5, ui_language: "en",
        reminders_daily_enabled: false, reminders_daily_time: "08:00", reminders_slot_enabled: false, reminders_slot_lead_minutes: 30,
        reminders_review_enabled: false, reminders_review_day: 0, reminders_review_time: "18:00",
      },
    ],
    content_calendar: [],
    content_items: [
      { id: "i1", user_id: "user-1", title: "Carousel", stage: "scheduled", scheduled_at: "2026-09-16T10:00:00.000Z", due_date: null, published_at: null },
      { id: "i2", user_id: "user-2", title: "Other", stage: "scheduled", scheduled_at: "2026-09-16T10:00:00.000Z", due_date: null, published_at: null },
    ],
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("GET /api/cron/reminders — authorization", () => {
  it("rejects a missing header", async () => {
    const response = await call()
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(mocks.createClientArgs).toEqual([])
  })

  it("rejects a wrong secret and a non-bearer scheme", async () => {
    expect((await call("Bearer nope")).status).toBe(401)
    expect((await call(`Basic ${ENV.CRON_SECRET}`)).status).toBe(401)
    expect((await call(`Bearer ${ENV.CRON_SECRET}x`)).status).toBe(401)
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it("rejects everything while CRON_SECRET is unset, even an empty bearer", async () => {
    vi.stubEnv("CRON_SECRET", "")
    for (const header of [undefined, "Bearer ", "Bearer undefined", `Bearer ${ENV.CRON_SECRET}`]) {
      const response = await call(header)
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ error: "not_configured" })
    }
    expect(mocks.createClientArgs).toEqual([])
  })
})

describe("GET /api/cron/reminders — configuration", () => {
  it("says what is missing without touching the database", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "")
    let response = await call(`Bearer ${ENV.CRON_SECRET}`)
    expect(response.status).toBe(503)
    expect((await response.json()).message).toMatch(/SUPABASE_SECRET_KEY/)

    vi.stubEnv("SUPABASE_SECRET_KEY", ENV.SUPABASE_SECRET_KEY)
    vi.stubEnv("VAPID_PRIVATE_KEY", "")
    response = await call(`Bearer ${ENV.CRON_SECRET}`)
    expect(response.status).toBe(503)
    expect((await response.json()).message).toMatch(/VAPID/)
    expect(mocks.createClientArgs).toEqual([])
  })
})

describe("GET /api/cron/reminders — sending", () => {
  it("sends due reminders with the service key, VAPID details and the workspace language", async () => {
    const response = await call(`Bearer ${ENV.CRON_SECRET}`)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({
      ok: true,
      ranAt: "2026-09-16T00:05:00.000Z",
      subscriptions: 3,
      users: 2,
      due: 2,
      sent: 2,
      skipped: 0,
      failed: 0,
      removed: 0,
    })
    expect(mocks.createClientArgs[0].slice(0, 2)).toEqual(["https://project.supabase.co", "sb_secret_test"])
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2)
    const [subscription, payload, options] = mocks.sendNotification.mock.calls[0]
    expect(subscription).toEqual({ endpoint: "https://push.example/1", keys: { p256dh: "p1", auth: "a1" } })
    expect(JSON.parse(payload)).toEqual({ title: "Today sa Orbi", body: "1 post naka-schedule", url: "/today", tag: "orbi-daily:2026-09-16" })
    expect(options).toMatchObject({
      vapidDetails: { publicKey: "BPublicKey", privateKey: "private", subject: "mailto:creator@example.com" },
      TTL: 10500,
      urgency: "normal",
    })
    expect(mocks.tables.push_subscriptions[0]).toMatchObject({ sent_keys: ["daily:2026-09-16"], last_sent_at: "2026-09-16T00:05:00.000Z", failure_count: 0 })
  })

  it("is idempotent: a second run (GET or POST) sends nothing again", async () => {
    await call(`Bearer ${ENV.CRON_SECRET}`)
    const again = await call(`Bearer ${ENV.CRON_SECRET}`, "POST")
    expect(await again.json()).toMatchObject({ due: 2, sent: 0, skipped: 2 })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2)
  })

  it("deletes devices the push service reports gone and records other failures", async () => {
    mocks.sendNotification.mockImplementation(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint.endsWith("/1")) throw Object.assign(new Error("Received unexpected response code"), { statusCode: 410 })
      throw Object.assign(new Error("Service unavailable"), { statusCode: 503 })
    })
    const response = await call(`Bearer ${ENV.CRON_SECRET}`)
    expect(await response.json()).toMatchObject({ sent: 0, failed: 2, removed: 1 })
    expect(mocks.tables.push_subscriptions.map((r) => r.id)).toEqual(["sub-2", "sub-3"])
    expect(mocks.tables.push_subscriptions[0]).toMatchObject({ sent_keys: [], failure_count: 1, last_error: "503 Service unavailable" })
  })

  it("reports a failing database as a 500 that is safe to retry", async () => {
    mocks.tables.push_subscriptions = null as unknown as Row[]
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await call(`Bearer ${ENV.CRON_SECRET}`)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: "server_error" })
    spy.mockRestore()
  })
})
