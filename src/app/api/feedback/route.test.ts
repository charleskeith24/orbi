import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  configured: true,
  user: { id: "user-1" } as { id: string } | null,
  inserts: [] as { table: string; rows: unknown }[],
  result: { data: { id: "fb-1", created_at: "2026-09-14T10:00:00.000Z" } as unknown, error: null as { message: string } | null },
  getUser: vi.fn(),
}))

vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return mocks.configured
  },
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
}))

// A fake server client: auth.getUser() + from(table).insert(rows).select().single().
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      insert: (rows: unknown) => {
        mocks.inserts.push({ table, rows })
        return { select: () => ({ single: async () => mocks.result }) }
      },
    }),
  }),
}))

const { POST } = await import("./route")

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  mocks.configured = true
  mocks.user = { id: "user-1" }
  mocks.inserts = []
  mocks.result = { data: { id: "fb-1", created_at: "2026-09-14T10:00:00.000Z" }, error: null }
  mocks.getUser.mockReset()
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.user } }))
})

describe("POST /api/feedback", () => {
  it("is not available in local mode (no Supabase)", async () => {
    mocks.configured = false
    const response = await post({ kind: "bug", message: "x" })
    expect(response.status).toBe(501)
    expect(await response.json()).toMatchObject({ error: "not_configured" })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it("requires a signed-in user", async () => {
    mocks.user = null
    const response = await post({ kind: "bug", message: "x" })
    expect(response.status).toBe(401)
    expect(mocks.inserts).toEqual([])
  })

  it("saves the feedback for the signed-in user", async () => {
    const response = await post(
      { kind: "bug", message: "  The Save button does nothing  ", page: "/ideas?open=abc", ui_language: "tl", viewport: "mobile" },
      { "User-Agent": "Mozilla/5.0 (iPhone)" }
    )
    expect(response.status).toBe(201)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ id: "fb-1", created_at: "2026-09-14T10:00:00.000Z" })
    expect(mocks.inserts).toEqual([
      {
        table: "feedback",
        rows: {
          kind: "bug",
          message: "The Save button does nothing",
          page: "/ideas",
          ui_language: "tl",
          viewport: "mobile",
          user_id: "user-1",
          user_agent: "Mozilla/5.0 (iPhone)",
          app_version: expect.any(String),
        },
      },
    ])
  })

  it("rejects invalid JSON, unknown kinds and empty messages", async () => {
    expect((await post("{not json")).status).toBe(400)
    const kind = await post({ kind: "rant", message: "x" })
    expect(kind.status).toBe(400)
    expect(await kind.json()).toMatchObject({ error: "invalid_request", field: "kind" })
    const empty = await post({ kind: "idea", message: "   " })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toMatchObject({ field: "message" })
    expect(mocks.inserts).toEqual([])
  })

  it("rejects oversized bodies", async () => {
    const response = await post({ kind: "idea", message: "x".repeat(25_000) })
    expect(response.status).toBe(413)
  })

  it("reports a failed insert without leaking database details", async () => {
    mocks.result = { data: null, error: { message: 'new row violates row-level security policy for table "feedback"' } }
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await post({ kind: "idea", message: "Add dark mode to the media kit" })
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({ error: "save_failed" })
    expect(JSON.stringify(body)).not.toMatch(/row-level/)
    errorLog.mockRestore()
  })
})
