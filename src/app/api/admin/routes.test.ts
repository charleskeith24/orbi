/**
 * Every /api/admin/* handler against an in-memory Supabase (src/lib/admin/testing/fake-supabase.ts):
 * the guard on every route, each route's behaviour and error codes, the self and last-admin guards, one audit
 * row per change, and no content in any response.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FakeSupabase } from "@/lib/admin/testing/fake-supabase"

const state = vi.hoisted(() => ({
  configured: true,
  secret: true,
  fake: null as unknown as import("@/lib/admin/testing/fake-supabase").FakeSupabase,
}))

vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return state.configured
  },
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
}))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.fake.sessionClient() }))
vi.mock("@/lib/supabase/admin", () => ({
  isSecretKeyConfigured: () => state.secret,
  createSupabaseAdminClient: () => state.fake.serviceClient(),
}))

const overview = await import("./overview/route")
const requests = await import("./requests/route")
const approve = await import("./requests/[id]/approve/route")
const reject = await import("./requests/[id]/reject/route")
const users = await import("./users/route")
const invite = await import("./users/invite/route")
const user = await import("./users/[id]/route")
const resend = await import("./users/[id]/resend-invite/route")
const disable = await import("./users/[id]/disable/route")
const enable = await import("./users/[id]/enable/route")
const reset = await import("./users/[id]/reset-password/route")
const adminRole = await import("./users/[id]/admin/route")
const feedback = await import("./feedback/route")
const audit = await import("./audit/route")
const settings = await import("./settings/route")
const { USERS_PAGE_SIZE } = await import("@/lib/admin/server/users")

const SITE = "http://localhost:3000"
const NOW = new Date("2026-09-18T10:00:00.000Z")
const ADMIN = "a0000000-0000-4000-8000-0000000000a1"
const ADMIN2 = "a0000000-0000-4000-8000-0000000000a2"
const CREATOR = "b0000000-0000-4000-8000-0000000000b1"
const INVITED = "c0000000-0000-4000-8000-0000000000c1"
const BANNED = "d0000000-0000-4000-8000-0000000000d1"
const REQ_PENDING = "e0000000-0000-4000-8000-0000000000e1"
const REQ_OLD = "e0000000-0000-4000-8000-0000000000e2"
const MISSING = "f0000000-0000-4000-8000-0000000000f1"

/** Route params as every handler accepts them (static routes ignore `id`). */
type Params = Record<string, string> & { id: string }
type Handler = (request: Request, context?: { params: Promise<Params> }) => Promise<Response>

interface CallOptions {
  body?: unknown
  origin?: string | null
  params?: Record<string, string>
  query?: string
}

async function call(handler: Handler, method: string, path: string, options: CallOptions = {}) {
  const origin = options.origin === undefined ? SITE : options.origin
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin) headers.Origin = origin
  const response = await handler(
    new Request(`${SITE}${path}${options.query ?? ""}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body),
    }),
    { params: Promise.resolve((options.params ?? {}) as Params) }
  )
  expect(response.headers.get("cache-control"), `${method} ${path}`).toBe("no-store")
  return { status: response.status, body: await response.json() }
}

const auditRows = () => state.fake.tables.admin_audit_log
const authUser = (id: string) => state.fake.authUsers.find((u) => u.id === id)

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  // The handlers read the clock (new Date()); pin it.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  state.configured = true
  state.secret = true
  const fake = new FakeSupabase(() => NOW)
  state.fake = fake
  fake.addUser({ id: ADMIN, email: "owner@example.com", full_name: "Olive Owner", admin: true, mfa: true, created_at: "2026-09-01T00:00:00.000Z", last_sign_in_at: "2026-09-18T09:00:00.000Z" })
  fake.addUser({ id: ADMIN2, email: "second@example.com", admin: true, mfa: true, created_at: "2026-09-02T00:00:00.000Z", last_sign_in_at: "2026-09-01T00:00:00.000Z" })
  fake.addUser({ id: CREATOR, email: "cris@example.com", full_name: "Cris Creator", created_at: "2026-09-03T00:00:00.000Z", last_sign_in_at: "2026-09-15T00:00:00.000Z" })
  fake.addUser({ id: INVITED, email: "invited@example.com", created_at: "2026-09-04T00:00:00.000Z", invited_at: "2026-09-04T00:00:00.000Z", last_sign_in_at: null, email_confirmed_at: null })
  fake.addUser({ id: BANNED, email: "banned@example.com", created_at: "2026-09-05T00:00:00.000Z", last_sign_in_at: "2026-08-01T00:00:00.000Z", banned_until: "2126-01-01T00:00:00.000Z" })
  // Cris's workspace: content the admin must never see, only count.
  fake.tables.content_ideas.push({ id: "i1", user_id: CREATOR, title: "SECRET idea title" }, { id: "i2", user_id: CREATOR, title: "Another SECRET" })
  fake.tables.content_items.push(
    { id: "c1", user_id: CREATOR, title: "SECRET draft", stage: "scripting" },
    { id: "c2", user_id: CREATOR, title: "SECRET live", stage: "published" },
    { id: "c3", user_id: CREATOR, title: "SECRET again", stage: "repurpose" }
  )
  fake.tables.brand_profiles.push({ id: "bp1", user_id: CREATOR, onboarding_completed: true, who_am_i: "SECRET bio" })
  fake.tables.access_requests.push(
    { id: REQ_OLD, email: "old@example.com", name: "Old", about: "", link: "", status: "rejected", created_at: "2026-09-10T00:00:00.000Z", decided_at: "2026-09-11T00:00:00.000Z", decided_by: ADMIN, decided_by_email: "owner@example.com" },
    { id: REQ_PENDING, email: "ana@example.com", name: "Ana", about: "Food vlogs", link: "https://tiktok.com/@ana", status: "pending", created_at: "2026-09-17T00:00:00.000Z", decided_at: null, decided_by: null, decided_by_email: null }
  )
  fake.tables.feedback.push(
    { id: "fb1", user_id: CREATOR, kind: "bug", message: "Save does nothing", page: "/ideas", ui_language: "tl", viewport: "mobile", created_at: "2026-09-17T08:00:00.000Z" },
    { id: "fb2", user_id: ADMIN2, kind: "praise", message: "Love it", page: "/", ui_language: "en", viewport: "desktop", created_at: "2026-09-01T08:00:00.000Z" }
  )
  fake.tables.usage_events.push(
    { user_id: CREATOR, name: "onboarding_step_viewed", props: { step: "start", index: 0 } },
    { user_id: CREATOR, name: "onboarding_step_completed", props: { step: "start", index: 0 } },
    { user_id: INVITED, name: "onboarding_step_viewed", props: { step: "start", index: 0 } },
    { user_id: CREATOR, name: "onboarding_step_viewed", props: { step: "about", index: 1 } }
  )
  fake.signIn(ADMIN, "aal2")
})

/* ------------------------------ the guard ------------------------------ */

const ROUTES: [string, Handler, string, Record<string, string>?][] = [
  ["GET", overview.GET, "/api/admin/overview"],
  ["GET", requests.GET, "/api/admin/requests"],
  ["POST", approve.POST, "/api/admin/requests/x/approve", { id: REQ_PENDING }],
  ["POST", reject.POST, "/api/admin/requests/x/reject", { id: REQ_PENDING }],
  ["GET", users.GET, "/api/admin/users"],
  ["POST", invite.POST, "/api/admin/users/invite"],
  ["POST", resend.POST, "/api/admin/users/x/resend-invite", { id: INVITED }],
  ["POST", disable.POST, "/api/admin/users/x/disable", { id: CREATOR }],
  ["POST", enable.POST, "/api/admin/users/x/enable", { id: BANNED }],
  ["POST", reset.POST, "/api/admin/users/x/reset-password", { id: CREATOR }],
  ["DELETE", user.DELETE, "/api/admin/users/x", { id: CREATOR }],
  ["POST", adminRole.POST, "/api/admin/users/x/admin", { id: CREATOR }],
  ["DELETE", adminRole.DELETE, "/api/admin/users/x/admin", { id: ADMIN2 }],
  ["GET", feedback.GET, "/api/admin/feedback"],
  ["GET", audit.GET, "/api/admin/audit"],
  ["GET", settings.GET, "/api/admin/settings"],
  ["PATCH", settings.PATCH, "/api/admin/settings"],
]

describe("every admin route is behind requireAdmin", () => {
  it.each(ROUTES)("%s %s", async (method, handler, path, params) => {
    const body = { email: "new@example.com", confirm_email: "cris@example.com", access_open: false }
    const snapshot = JSON.stringify(state.fake.tables)
    const expectDenied = async (status: number, error: string, origin: string | null = SITE) => {
      const result = await call(handler, method, path, { params, body: method === "GET" ? undefined : body, origin })
      expect(result, `${method} ${path}`).toMatchObject({ status, body: { error, message: expect.any(String) } })
    }

    state.configured = false
    await expectDenied(501, "not_configured")
    state.configured = true

    state.fake.signIn(null)
    await expectDenied(401, "unauthorized")

    state.fake.signIn(CREATOR, "aal2")
    await expectDenied(404, "not_found")

    state.fake.signIn(ADMIN, "aal1")
    await expectDenied(403, "mfa_required")

    state.fake.signIn(ADMIN, "aal2")
    state.secret = false
    await expectDenied(501, "not_configured")
    state.secret = true

    if (method !== "GET") {
      await expectDenied(403, "bad_origin", null)
      await expectDenied(403, "bad_origin", "https://evil.example")
    }

    // Nothing changed and no email went out.
    expect(JSON.stringify(state.fake.tables)).toBe(snapshot)
    expect(state.fake.calls.filter((c) => c.name.startsWith("auth:") && c.name !== "auth:listUsers" && c.name !== "auth:getUserById")).toEqual([])
  })
})

/* ------------------------------ overview ------------------------------- */

describe("GET /api/admin/overview", () => {
  it("counts accounts, activity, setup, requests, feedback and the funnel", async () => {
    const { status, body } = await call(overview.GET, "GET", "/api/admin/overview")
    expect(status).toBe(200)
    expect(body).toEqual({
      users_total: 5,
      active_7d: 2,
      active_30d: 3,
      onboarding_completed: 1,
      pending_requests: 1,
      feedback_7d: 1,
      funnel: [
        { step: "start", index: 0, viewed: 2, completed: 1 },
        { step: "about", index: 1, viewed: 1, completed: 0 },
      ],
      access_open: true,
    })
    expect(JSON.stringify(body)).not.toMatch(/SECRET/)
  })

  it("hides database errors behind a 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.fake.fail("rpc:admin_onboarding_funnel", { message: 'relation "public.usage_events" does not exist' })
    const { status, body } = await call(overview.GET, "GET", "/api/admin/overview")
    expect(status).toBe(500)
    expect(body.error).toBe("server_error")
    expect(JSON.stringify(body)).not.toMatch(/usage_events/)
    log.mockRestore()
  })
})

/* ------------------------------ requests ------------------------------- */

describe("GET /api/admin/requests", () => {
  it("lists requests newest first, optionally by status", async () => {
    const all = await call(requests.GET, "GET", "/api/admin/requests")
    expect(all.body.map((r: { id: string }) => r.id)).toEqual([REQ_PENDING, REQ_OLD])
    expect(all.body[0]).toEqual({
      id: REQ_PENDING,
      email: "ana@example.com",
      name: "Ana",
      about: "Food vlogs",
      link: "https://tiktok.com/@ana",
      status: "pending",
      created_at: "2026-09-17T00:00:00.000Z",
      decided_at: null,
      decided_by_email: null,
    })
    const pending = await call(requests.GET, "GET", "/api/admin/requests", { query: "?status=pending" })
    expect(pending.body.map((r: { id: string }) => r.id)).toEqual([REQ_PENDING])
    expect((await call(requests.GET, "GET", "/api/admin/requests", { query: "?status=" })).body).toHaveLength(2)
    expect(await call(requests.GET, "GET", "/api/admin/requests", { query: "?status=maybe" })).toMatchObject({ status: 400, body: { error: "invalid" } })
  })
})

describe("POST /api/admin/requests/:id/approve", () => {
  it("invites the person, marks the request approved and writes one audit row", async () => {
    const { status, body } = await call(approve.POST, "POST", "/api/admin/requests/x/approve", { params: { id: REQ_PENDING } })
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: REQ_PENDING, status: "approved", decided_at: NOW.toISOString(), decided_by_email: "owner@example.com" })
    expect(state.fake.callsTo("auth:inviteUserByEmail")).toEqual([["ana@example.com", { redirectTo: `${SITE}/auth/callback?next=%2Fset-password` }]])
    const invited = state.fake.authUsers.find((u) => u.email === "ana@example.com")!
    expect(auditRows()).toEqual([
      expect.objectContaining({
        admin_id: ADMIN,
        admin_email: "owner@example.com",
        action: "request_approved",
        target_user_id: invited.id,
        target_email: "ana@example.com",
        details: { request_id: REQ_PENDING },
      }),
    ])
    expect(state.fake.tables.access_requests.find((r) => r.id === REQ_PENDING)).toMatchObject({ decided_by: ADMIN })
  })

  it("answers 404 for unknown or malformed ids and 409 when already decided, without sending email", async () => {
    expect(await call(approve.POST, "POST", "/x", { params: { id: MISSING } })).toMatchObject({ status: 404, body: { error: "not_found" } })
    expect(await call(approve.POST, "POST", "/x", { params: { id: "not-a-uuid" } })).toMatchObject({ status: 404, body: { error: "not_found" } })
    expect(await call(approve.POST, "POST", "/x", { params: { id: REQ_OLD } })).toMatchObject({ status: 409, body: { error: "conflict" } })
    expect(state.fake.callsTo("auth:inviteUserByEmail")).toEqual([])
    expect(auditRows()).toEqual([])
  })

  it("answers 409 when the email already has an account, leaving the request pending", async () => {
    state.fake.addUser({ email: "ana@example.com" })
    expect(await call(approve.POST, "POST", "/x", { params: { id: REQ_PENDING } })).toMatchObject({
      status: 409,
      body: { error: "conflict", message: "This email already has an account." },
    })
    expect(state.fake.tables.access_requests.find((r) => r.id === REQ_PENDING)?.status).toBe("pending")
    expect(auditRows()).toEqual([])
  })

  it("answers 429 when Supabase's email limit is reached", async () => {
    state.fake.fail("auth:inviteUserByEmail", { message: "email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" })
    expect(await call(approve.POST, "POST", "/x", { params: { id: REQ_PENDING } })).toMatchObject({ status: 429, body: { error: "rate_limited" } })
    expect(state.fake.tables.access_requests.find((r) => r.id === REQ_PENDING)?.status).toBe("pending")
  })

  it("answers 409 when another admin decided it at the same moment", async () => {
    state.fake.before("update:access_requests", () => {
      state.fake.tables.access_requests.find((r) => r.id === REQ_PENDING)!.status = "rejected"
    })
    expect(await call(approve.POST, "POST", "/x", { params: { id: REQ_PENDING } })).toMatchObject({ status: 409, body: { error: "conflict" } })
    expect(auditRows()).toEqual([])
  })
})

describe("POST /api/admin/requests/:id/reject", () => {
  it("marks the request rejected without sending email, and writes one audit row", async () => {
    const { status, body } = await call(reject.POST, "POST", "/x", { params: { id: REQ_PENDING } })
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: REQ_PENDING, status: "rejected", decided_by_email: "owner@example.com" })
    expect(state.fake.callsTo("auth:inviteUserByEmail")).toEqual([])
    expect(auditRows()).toEqual([
      expect.objectContaining({ action: "request_rejected", target_email: "ana@example.com", target_user_id: null, details: { request_id: REQ_PENDING } }),
    ])
  })

  it("answers 404 and 409 like approve", async () => {
    expect(await call(reject.POST, "POST", "/x", { params: { id: MISSING } })).toMatchObject({ status: 404 })
    expect(await call(reject.POST, "POST", "/x", { params: { id: REQ_OLD } })).toMatchObject({ status: 409, body: { error: "conflict" } })
  })
})

/* -------------------------------- users -------------------------------- */

describe("GET /api/admin/users", () => {
  it("lists accounts newest first with status, flags and counts — never content", async () => {
    const { status, body } = await call(users.GET, "GET", "/api/admin/users")
    expect(status).toBe(200)
    expect(body.page).toBe(1)
    expect(body.has_more).toBe(false)
    expect(body.items.map((r: { email: string }) => r.email)).toEqual([
      "banned@example.com",
      "invited@example.com",
      "cris@example.com",
      "second@example.com",
      "owner@example.com",
    ])
    const byId = Object.fromEntries(body.items.map((r: { id: string }) => [r.id, r]))
    expect(byId[CREATOR]).toEqual({
      id: CREATOR,
      email: "cris@example.com",
      name: "Cris Creator",
      status: "active",
      is_admin: false,
      is_self: false,
      mfa_enabled: false,
      created_at: "2026-09-03T00:00:00.000Z",
      invited_at: null,
      last_sign_in_at: "2026-09-15T00:00:00.000Z",
      onboarding_completed: true,
      counts: { ideas: 2, content_items: 3, published: 2 },
    })
    expect(byId[ADMIN]).toMatchObject({ is_admin: true, is_self: true, mfa_enabled: true, status: "active" })
    expect(byId[INVITED]).toMatchObject({ status: "invited", invited_at: "2026-09-04T00:00:00.000Z", last_sign_in_at: null })
    expect(byId[BANNED]).toMatchObject({ status: "disabled" })
    expect(JSON.stringify(body)).not.toMatch(/SECRET/)
    expect(state.fake.callsTo("rpc:admin_user_stats")[0][0]).toMatchObject({ p_published_stages: ["published", "repurpose"] })
  })

  it("searches email and name, filters by status and pages", async () => {
    const search = async (query: string) =>
      (await call(users.GET, "GET", "/api/admin/users", { query })).body.items.map((r: { email: string }) => r.email)
    expect(await search("?query=CRIS")).toEqual(["cris@example.com"])
    expect(await search("?query=olive")).toEqual(["owner@example.com"])
    expect(await search("?status=invited")).toEqual(["invited@example.com"])
    expect(await search("?status=disabled&query=banned")).toEqual(["banned@example.com"])
    expect(await search("?query=nobody")).toEqual([])

    for (let i = 0; i < USERS_PAGE_SIZE; i++) state.fake.addUser({ email: `tester${String(i).padStart(2, "0")}@example.com`, created_at: "2026-08-01T00:00:00.000Z" })
    const first = await call(users.GET, "GET", "/api/admin/users")
    expect(first.body).toMatchObject({ page: 1, has_more: true })
    expect(first.body.items).toHaveLength(USERS_PAGE_SIZE)
    const second = await call(users.GET, "GET", "/api/admin/users", { query: "?page=2" })
    expect(second.body).toMatchObject({ page: 2, has_more: false })
    expect(second.body.items).toHaveLength(5)
  })

  it("rejects a bad status or page", async () => {
    expect(await call(users.GET, "GET", "/x", { query: "?status=gone" })).toMatchObject({ status: 400, body: { error: "invalid" } })
    expect(await call(users.GET, "GET", "/x", { query: "?page=0" })).toMatchObject({ status: 400, body: { error: "invalid" } })
    expect(await call(users.GET, "GET", "/x", { query: "?page=abc" })).toMatchObject({ status: 400, body: { error: "invalid" } })
  })
})

describe("POST /api/admin/users/invite", () => {
  it("invites someone directly (201) and approves their waiting request", async () => {
    const { status, body } = await call(invite.POST, "POST", "/x", { body: { email: "  Ana@Example.com " } })
    expect(status).toBe(201)
    expect(body).toMatchObject({ email: "ana@example.com", status: "invited", is_admin: false, counts: { ideas: 0, content_items: 0, published: 0 } })
    expect(state.fake.callsTo("auth:inviteUserByEmail")).toEqual([["ana@example.com", { redirectTo: `${SITE}/auth/callback?next=%2Fset-password` }]])
    expect(state.fake.tables.access_requests.find((r) => r.id === REQ_PENDING)).toMatchObject({ status: "approved", decided_by: ADMIN })
    expect(auditRows()).toEqual([
      expect.objectContaining({ action: "user_invited", target_user_id: body.id, target_email: "ana@example.com", details: { request_id: REQ_PENDING } }),
    ])
  })

  it("answers 400 for a bad email and 409 for an existing account", async () => {
    expect(await call(invite.POST, "POST", "/x", { body: { email: "nope" } })).toMatchObject({ status: 400, body: { error: "invalid" } })
    expect(await call(invite.POST, "POST", "/x", { body: {} })).toMatchObject({ status: 400 })
    expect(await call(invite.POST, "POST", "/x", { body: "{bad json" })).toMatchObject({ status: 400 })
    expect(await call(invite.POST, "POST", "/x", { body: { email: "cris@example.com" } })).toMatchObject({ status: 409, body: { error: "conflict" } })
    expect(auditRows()).toEqual([])
  })
})

describe("POST /api/admin/users/:id/resend-invite", () => {
  it("re-sends the invite while the account is invited", async () => {
    expect(await call(resend.POST, "POST", "/x", { params: { id: INVITED } })).toEqual({ status: 200, body: { ok: true } })
    expect(state.fake.callsTo("auth:inviteUserByEmail")).toEqual([["invited@example.com", { redirectTo: `${SITE}/auth/callback?next=%2Fset-password` }]])
    expect(auditRows()).toEqual([expect.objectContaining({ action: "invite_resent", target_user_id: INVITED, target_email: "invited@example.com" })])
  })

  it("answers 409 for accounts that already signed in, 404 for unknown ones", async () => {
    expect(await call(resend.POST, "POST", "/x", { params: { id: CREATOR } })).toMatchObject({ status: 409, body: { error: "conflict" } })
    expect(await call(resend.POST, "POST", "/x", { params: { id: MISSING } })).toMatchObject({ status: 404, body: { error: "not_found" } })
    expect(state.fake.callsTo("auth:inviteUserByEmail")).toEqual([])
  })
})

describe("POST /api/admin/users/:id/disable and /enable", () => {
  it("bans and un-bans an account, one audit row each", async () => {
    const disabled = await call(disable.POST, "POST", "/x", { params: { id: CREATOR } })
    expect(disabled).toMatchObject({ status: 200, body: { id: CREATOR, status: "disabled" } })
    expect(state.fake.callsTo("auth:updateUserById")).toEqual([[CREATOR, { ban_duration: "876000h" }]])

    const enabled = await call(enable.POST, "POST", "/x", { params: { id: CREATOR } })
    expect(enabled).toMatchObject({ status: 200, body: { id: CREATOR, status: "active" } })
    expect(state.fake.callsTo("auth:updateUserById")[1]).toEqual([CREATOR, { ban_duration: "none" }])
    expect(auditRows().map((r) => [r.action, r.target_email, r.details])).toEqual([
      ["user_disabled", "cris@example.com", { from: "active", to: "disabled" }],
      ["user_enabled", "cris@example.com", { from: "disabled", to: "active" }],
    ])
  })

  it("leaves an account that's already in that state alone (no audit row)", async () => {
    expect(await call(disable.POST, "POST", "/x", { params: { id: BANNED } })).toMatchObject({ status: 200, body: { status: "disabled" } })
    expect(await call(enable.POST, "POST", "/x", { params: { id: CREATOR } })).toMatchObject({ status: 200, body: { status: "active" } })
    expect(state.fake.callsTo("auth:updateUserById")).toEqual([])
    expect(auditRows()).toEqual([])
  })

  it("never lets an admin disable themselves (409 self_action)", async () => {
    expect(await call(disable.POST, "POST", "/x", { params: { id: ADMIN } })).toMatchObject({ status: 409, body: { error: "self_action" } })
    expect(state.fake.callsTo("auth:updateUserById")).toEqual([])
  })

  it("never disables the last admin (409 last_admin)", async () => {
    // The caller's own admin role is removed at the same moment by someone else.
    state.fake.before("select:admin_users", () => {
      state.fake.tables.admin_users = state.fake.tables.admin_users.filter((r) => r.user_id !== ADMIN)
    })
    expect(await call(disable.POST, "POST", "/x", { params: { id: ADMIN2 } })).toMatchObject({ status: 409, body: { error: "last_admin" } })
    expect(state.fake.callsTo("auth:updateUserById")).toEqual([])
  })

  it("answers 404 for unknown accounts", async () => {
    expect(await call(disable.POST, "POST", "/x", { params: { id: MISSING } })).toMatchObject({ status: 404 })
    expect(await call(enable.POST, "POST", "/x", { params: { id: "x" } })).toMatchObject({ status: 404 })
  })
})

describe("POST /api/admin/users/:id/reset-password", () => {
  it("sends the recovery email and writes one audit row", async () => {
    expect(await call(reset.POST, "POST", "/x", { params: { id: CREATOR } })).toEqual({ status: 200, body: { ok: true } })
    expect(state.fake.callsTo("auth:resetPasswordForEmail")).toEqual([["cris@example.com", { redirectTo: `${SITE}/auth/callback?next=%2Fset-password` }]])
    expect(auditRows()).toEqual([expect.objectContaining({ action: "password_reset_sent", target_user_id: CREATOR })])
  })

  it("answers 409 for disabled accounts and open invites", async () => {
    expect(await call(reset.POST, "POST", "/x", { params: { id: BANNED } })).toMatchObject({ status: 409, body: { error: "conflict" } })
    expect(await call(reset.POST, "POST", "/x", { params: { id: INVITED } })).toMatchObject({ status: 409, body: { error: "conflict" } })
    expect(state.fake.callsTo("auth:resetPasswordForEmail")).toEqual([])
  })
})

describe("DELETE /api/admin/users/:id", () => {
  it("deletes the account after the email is repeated; the workspace cascades", async () => {
    expect(await call(user.DELETE, "DELETE", "/x", { params: { id: CREATOR }, body: { confirm_email: " Cris@Example.com " } })).toEqual({
      status: 200,
      body: { ok: true },
    })
    expect(authUser(CREATOR)).toBeUndefined()
    expect(state.fake.tables.content_ideas).toEqual([])
    expect(state.fake.tables.feedback.map((r) => r.id)).toEqual(["fb2"])
    expect(auditRows()).toEqual([
      expect.objectContaining({ action: "user_deleted", target_user_id: CREATOR, target_email: "cris@example.com", details: { status: "active", was_admin: false } }),
    ])
  })

  it("answers 400 when the confirmation doesn't match", async () => {
    for (const body of [{ confirm_email: "someone@example.com" }, {}, undefined]) {
      expect(await call(user.DELETE, "DELETE", "/x", { params: { id: CREATOR }, body })).toMatchObject({ status: 400, body: { error: "invalid" } })
    }
    expect(authUser(CREATOR)).toBeDefined()
  })

  it("never lets an admin delete themselves, or the last admin", async () => {
    expect(await call(user.DELETE, "DELETE", "/x", { params: { id: ADMIN }, body: { confirm_email: "owner@example.com" } })).toMatchObject({
      status: 409,
      body: { error: "self_action" },
    })
    state.fake.before("select:admin_users", () => {
      state.fake.tables.admin_users = state.fake.tables.admin_users.filter((r) => r.user_id !== ADMIN)
    })
    expect(await call(user.DELETE, "DELETE", "/x", { params: { id: ADMIN2 }, body: { confirm_email: "second@example.com" } })).toMatchObject({
      status: 409,
      body: { error: "last_admin" },
    })
    expect(state.fake.callsTo("auth:deleteUser")).toEqual([])
    expect(auditRows()).toEqual([])
  })

  it("deletes another admin (the role goes with the account)", async () => {
    expect(await call(user.DELETE, "DELETE", "/x", { params: { id: ADMIN2 }, body: { confirm_email: "second@example.com" } })).toMatchObject({ status: 200 })
    expect(state.fake.tables.admin_users.map((r) => r.user_id)).toEqual([ADMIN])
    expect(auditRows()[0]).toMatchObject({ details: { status: "active", was_admin: true } })
  })

  it("answers 404 for unknown accounts", async () => {
    expect(await call(user.DELETE, "DELETE", "/x", { params: { id: MISSING }, body: { confirm_email: "x@example.com" } })).toMatchObject({ status: 404 })
  })
})

describe("POST|DELETE /api/admin/users/:id/admin", () => {
  it("grants the admin role once, with one audit row", async () => {
    const granted = await call(adminRole.POST, "POST", "/x", { params: { id: CREATOR } })
    expect(granted).toMatchObject({ status: 200, body: { id: CREATOR, is_admin: true } })
    expect(state.fake.tables.admin_users).toContainEqual(expect.objectContaining({ user_id: CREATOR, granted_by: ADMIN }))
    expect(await call(adminRole.POST, "POST", "/x", { params: { id: CREATOR } })).toMatchObject({ status: 200, body: { is_admin: true } })
    expect(auditRows().map((r) => r.action)).toEqual(["admin_granted"])
  })

  it("revokes another admin through revoke_admin, with one audit row", async () => {
    const revoked = await call(adminRole.DELETE, "DELETE", "/x", { params: { id: ADMIN2 } })
    expect(revoked).toMatchObject({ status: 200, body: { id: ADMIN2, is_admin: false } })
    expect(state.fake.callsTo("rpc:revoke_admin")).toEqual([[{ p_user_id: ADMIN2 }]])
    expect(auditRows()).toEqual([expect.objectContaining({ action: "admin_revoked", target_user_id: ADMIN2, target_email: "second@example.com" })])
    // Not an admin any more: unchanged, no second audit row.
    expect(await call(adminRole.DELETE, "DELETE", "/x", { params: { id: ADMIN2 } })).toMatchObject({ status: 200, body: { is_admin: false } })
    expect(auditRows()).toHaveLength(1)
  })

  it("never lets an admin remove their own role (409 self_action)", async () => {
    expect(await call(adminRole.DELETE, "DELETE", "/x", { params: { id: ADMIN } })).toMatchObject({ status: 409, body: { error: "self_action" } })
    expect(state.fake.callsTo("rpc:revoke_admin")).toEqual([])
  })

  it("never removes the last admin (409 last_admin, decided in the database)", async () => {
    state.fake.before("rpc:revoke_admin", () => {
      state.fake.tables.admin_users = state.fake.tables.admin_users.filter((r) => r.user_id !== ADMIN)
    })
    expect(await call(adminRole.DELETE, "DELETE", "/x", { params: { id: ADMIN2 } })).toMatchObject({ status: 409, body: { error: "last_admin" } })
    expect(state.fake.tables.admin_users.map((r) => r.user_id)).toEqual([ADMIN2])
    expect(auditRows()).toEqual([])
  })

  it("answers 404 for unknown accounts", async () => {
    expect(await call(adminRole.POST, "POST", "/x", { params: { id: MISSING } })).toMatchObject({ status: 404 })
    expect(await call(adminRole.DELETE, "DELETE", "/x", { params: { id: MISSING } })).toMatchObject({ status: 404 })
  })
})

/* ---------------------------- feedback, audit --------------------------- */

describe("GET /api/admin/feedback", () => {
  it("lists feedback newest first with the sender's email", async () => {
    const { status, body } = await call(feedback.GET, "GET", "/api/admin/feedback")
    expect(status).toBe(200)
    expect(body).toEqual({
      items: [
        { id: "fb1", kind: "bug", message: "Save does nothing", page: "/ideas", ui_language: "tl", viewport: "mobile", created_at: "2026-09-17T08:00:00.000Z", user_email: "cris@example.com" },
        { id: "fb2", kind: "praise", message: "Love it", page: "/", ui_language: "en", viewport: "desktop", created_at: "2026-09-01T08:00:00.000Z", user_email: "second@example.com" },
      ],
      page: 1,
      has_more: false,
    })
  })

  it("pages by 50", async () => {
    for (let i = 0; i < 60; i++) {
      state.fake.tables.feedback.push({ id: `x${i}`, user_id: CREATOR, kind: "idea", message: `m${i}`, page: "/", ui_language: "en", viewport: "", created_at: "2026-08-01T00:00:00.000Z" })
    }
    expect((await call(feedback.GET, "GET", "/x")).body).toMatchObject({ page: 1, has_more: true })
    const second = await call(feedback.GET, "GET", "/x", { query: "?page=2" })
    expect(second.body.items).toHaveLength(12)
    expect(second.body.has_more).toBe(false)
    expect(await call(feedback.GET, "GET", "/x", { query: "?page=-1" })).toMatchObject({ status: 400, body: { error: "invalid" } })
  })
})

describe("GET /api/admin/audit", () => {
  it("lists admin actions newest first, content-free", async () => {
    await call(reject.POST, "POST", "/x", { params: { id: REQ_PENDING } })
    state.fake.tables.admin_audit_log[0].created_at = "2026-09-18T09:00:00.000Z"
    await call(settings.PATCH, "PATCH", "/x", { body: { access_open: false } })
    const { status, body } = await call(audit.GET, "GET", "/api/admin/audit")
    expect(status).toBe(200)
    expect(body.page).toBe(1)
    expect(body.has_more).toBe(false)
    expect(body.items).toEqual([
      {
        id: expect.any(String),
        action: "settings_updated",
        admin_email: "owner@example.com",
        target_email: null,
        details: { setting: "access_open", from: true, to: false },
        created_at: NOW.toISOString(),
      },
      {
        id: expect.any(String),
        action: "request_rejected",
        admin_email: "owner@example.com",
        target_email: "ana@example.com",
        details: { request_id: REQ_PENDING },
        created_at: "2026-09-18T09:00:00.000Z",
      },
    ])
  })
})

/* ------------------------------- settings ------------------------------- */

describe("GET|PATCH /api/admin/settings", () => {
  it("reads and switches access_open, auditing only real changes", async () => {
    expect(await call(settings.GET, "GET", "/x")).toEqual({ status: 200, body: { access_open: true } })
    expect(await call(settings.PATCH, "PATCH", "/x", { body: { access_open: false } })).toEqual({ status: 200, body: { access_open: false } })
    expect(state.fake.tables.platform_settings[0].access_open).toBe(false)
    expect(await call(settings.PATCH, "PATCH", "/x", { body: { access_open: false } })).toEqual({ status: 200, body: { access_open: false } })
    expect(await call(settings.PATCH, "PATCH", "/x", { body: {} })).toEqual({ status: 200, body: { access_open: false } })
    expect(auditRows().map((r) => [r.action, r.details])).toEqual([["settings_updated", { setting: "access_open", from: true, to: false }]])
  })

  it("rejects anything but a boolean access_open", async () => {
    for (const body of [{ access_open: "no" }, { access_open: false, role: "admin" }, "[1]", "{bad"]) {
      expect(await call(settings.PATCH, "PATCH", "/x", { body })).toMatchObject({ status: 400, body: { error: "invalid" } })
    }
    expect(state.fake.tables.platform_settings[0].access_open).toBe(true)
  })
})

/* --------------------------- audit guarantees --------------------------- */

describe("audit log guarantees", () => {
  it("writes exactly one content-free row per successful change", async () => {
    const steps: [Handler, string, CallOptions][] = [
      [approve.POST, "POST", { params: { id: REQ_PENDING } }],
      [invite.POST, "POST", { body: { email: "new@example.com" } }],
      [resend.POST, "POST", { params: { id: INVITED } }],
      [disable.POST, "POST", { params: { id: CREATOR } }],
      [enable.POST, "POST", { params: { id: CREATOR } }],
      [reset.POST, "POST", { params: { id: CREATOR } }],
      [adminRole.POST, "POST", { params: { id: CREATOR } }],
      [adminRole.DELETE, "DELETE", { params: { id: CREATOR } }],
      [settings.PATCH, "PATCH", { body: { access_open: false } }],
      [user.DELETE, "DELETE", { params: { id: CREATOR }, body: { confirm_email: "cris@example.com" } }],
    ]
    for (const [index, [handler, method, options]] of steps.entries()) {
      const { status } = await call(handler, method, "/x", options)
      expect(status, `step ${index}`).toBeLessThan(300)
      expect(auditRows(), `step ${index}`).toHaveLength(index + 1)
    }
    expect(auditRows().map((r) => r.action)).toEqual([
      "request_approved",
      "user_invited",
      "invite_resent",
      "user_disabled",
      "user_enabled",
      "password_reset_sent",
      "admin_granted",
      "admin_revoked",
      "settings_updated",
      "user_deleted",
    ])
    const details = JSON.stringify(auditRows().map((r) => r.details))
    expect(details).not.toMatch(/SECRET|Food vlogs|Save does nothing/)
    for (const row of auditRows()) {
      for (const value of Object.values(row.details as Record<string, unknown>)) expect(["string", "number", "boolean"]).toContain(typeof value)
    }
  })

  it("still reports success when the audit insert fails (the action can't be undone)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.fake.fail("insert:admin_audit_log")
    expect(await call(reject.POST, "POST", "/x", { params: { id: REQ_PENDING } })).toMatchObject({ status: 200, body: { status: "rejected" } })
    expect(log).toHaveBeenCalledWith("[admin] audit insert failed", "request_rejected", "boom")
    log.mockRestore()
  })
})
