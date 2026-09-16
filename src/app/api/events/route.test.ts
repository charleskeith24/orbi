import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  configured: true,
  user: { id: "user-1" } as { id: string } | null,
  inserts: [] as { table: string; rows: unknown }[],
  error: null as { message: string } | null,
  getUser: vi.fn(),
}))

vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return mocks.configured
  },
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
}))

// A fake server client: auth.getUser() + an awaitable from(table).insert(rows).
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      insert: (rows: unknown) => {
        mocks.inserts.push({ table, rows })
        return Promise.resolve({ data: null, error: mocks.error })
      },
    }),
  }),
}))

const { POST } = await import("./route")

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
}

const recent = () => new Date(Date.now() - 60_000).toISOString()

beforeEach(() => {
  mocks.configured = true
  mocks.user = { id: "user-1" }
  mocks.inserts = []
  mocks.error = null
  mocks.getUser.mockReset()
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.user } }))
})

describe("POST /api/events", () => {
  it("is not available in local mode", async () => {
    mocks.configured = false
    expect((await post({ events: [] })).status).toBe(501)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it("requires a signed-in user", async () => {
    mocks.user = null
    expect((await post({ events: [{ name: "page_viewed" }] })).status).toBe(401)
    expect(mocks.inserts).toEqual([])
  })

  it("stores valid events for the signed-in user, content-free", async () => {
    const occurred_at = recent()
    const response = await post({
      events: [
        { name: "page_viewed", props: { module: "ideas" }, path: "/ideas?open=secret", session_id: "s1", occurred_at },
        { name: "idea_captured", props: { source: "quick_capture", title: "How I paid off my debt" }, path: "/today", session_id: "s1", occurred_at },
        { name: "typed_text", props: { text: "private" } },
        { name: "content_created", props: { platform: "tiktok", stage: "brief", from_idea: true }, path: "/studio/5f0c2b1e-8a4d-4c3b-9e7f-1a2b3c4d5e6f", session_id: "s1", occurred_at },
      ],
    })
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: 3, dropped: 1 })
    expect(mocks.inserts).toHaveLength(1)
    expect(mocks.inserts[0].table).toBe("usage_events")
    expect(mocks.inserts[0].rows).toEqual([
      { name: "page_viewed", props: { module: "ideas" }, path: "/ideas", session_id: "s1", occurred_at, user_id: "user-1" },
      { name: "idea_captured", props: { source: "quick_capture" }, path: "/today", session_id: "s1", occurred_at, user_id: "user-1" },
      { name: "content_created", props: { platform: "tiktok", stage: "brief", from_idea: true }, path: "/studio/[id]", session_id: "s1", occurred_at, user_id: "user-1" },
    ])
    expect(JSON.stringify(mocks.inserts)).not.toMatch(/debt|secret|private/)
  })

  it("does not touch the database when every event is dropped", async () => {
    const response = await post({ events: [{ name: "nope" }, "page_viewed", null] })
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: 0, dropped: 3 })
    expect(mocks.inserts).toEqual([])
  })

  it("rejects malformed bodies and oversized batches", async () => {
    expect((await post("{oops")).status).toBe(400)
    expect((await post({ items: [] })).status).toBe(400)
    expect((await post([{ name: "page_viewed" }])).status).toBe(400)
    const many = Array.from({ length: 51 }, () => ({ name: "page_viewed" }))
    expect((await post({ events: many })).status).toBe(413)
    expect(mocks.inserts).toEqual([])
  })

  it("reports a failed insert", async () => {
    mocks.error = { message: "boom" }
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await post({ events: [{ name: "page_viewed", props: { module: "home" } }] })
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: "save_failed" })
    errorLog.mockRestore()
  })
})
