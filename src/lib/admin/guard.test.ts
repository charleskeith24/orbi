/** requireAdmin / withAdmin (API guard), getAdminGate (page gate) and the same-origin check — every branch. */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeSupabase } from "./testing/fake-supabase"

const state = vi.hoisted(() => ({
  configured: true,
  secret: true,
  fake: null as unknown as import("./testing/fake-supabase").FakeSupabase,
  serverClientError: null as Error | null,
}))

vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return state.configured
  },
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_test",
}))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (state.serverClientError) throw state.serverClientError
    return state.fake.sessionClient()
  },
}))
vi.mock("@/lib/supabase/admin", () => ({
  isSecretKeyConfigured: () => state.secret,
  createSupabaseAdminClient: () => state.fake.serviceClient(),
}))

const { requireAdmin, withAdmin } = await import("./guard")
const { getAdminGate } = await import("./gate")
const { AdminError, sameOrigin } = await import("./server/http")

const ADMIN = "a0000000-0000-4000-8000-0000000000a1"
const USER = "b0000000-0000-4000-8000-0000000000b1"
const SITE = "http://localhost:3000"

function request(method = "GET", headers: Record<string, string> = {}) {
  return new Request(`${SITE}/api/admin/overview`, { method, headers })
}

beforeEach(() => {
  state.configured = true
  state.secret = true
  state.serverClientError = null
  state.fake = new FakeSupabase()
  state.fake.addUser({ id: ADMIN, email: "owner@example.com", admin: true, mfa: true })
  state.fake.addUser({ id: USER, email: "creator@example.com" })
  state.fake.signIn(ADMIN, "aal2")
})

async function denied(result: Awaited<ReturnType<typeof requireAdmin>>) {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error("expected a denial")
  expect(result.response.headers.get("cache-control")).toBe("no-store")
  return { status: result.response.status, body: (await result.response.json()) as { error: string; message: string } }
}

describe("requireAdmin", () => {
  it("answers 501 not_configured in local mode without touching Supabase", async () => {
    state.configured = false
    const spy = vi.spyOn(state.fake, "sessionClient")
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 501, body: { error: "not_configured" } })
    expect(spy).not.toHaveBeenCalled()
  })

  it("refuses mutations without a same-origin Origin header (403 bad_origin), before any session check", async () => {
    const spy = vi.spyOn(state.fake, "sessionClient")
    const cases: Record<string, string>[] = [{}, { Origin: "https://evil.example" }, { Origin: "null" }, { Origin: "http://localhost:3001" }]
    for (const headers of cases) {
      expect(await denied(await requireAdmin(request("POST", headers)))).toMatchObject({ status: 403, body: { error: "bad_origin" } })
      expect(await denied(await requireAdmin(request("DELETE", headers)))).toMatchObject({ status: 403, body: { error: "bad_origin" } })
      expect(await denied(await requireAdmin(request("PATCH", headers)))).toMatchObject({ status: 403, body: { error: "bad_origin" } })
    }
    expect(spy).not.toHaveBeenCalled()
    expect((await requireAdmin(request("POST", { Origin: SITE }))).ok).toBe(true)
  })

  it("lets reads through without an Origin header", async () => {
    expect((await requireAdmin(request("GET"))).ok).toBe(true)
  })

  it("answers 401 unauthorized without a valid session", async () => {
    state.fake.signIn(null)
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 401, body: { error: "unauthorized" } })
    state.fake.signIn(ADMIN)
    state.fake.fail("auth:getUser", { message: "invalid JWT", status: 401 })
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 401, body: { error: "unauthorized" } })
  })

  it("answers 404 not_found to signed-in non-admins, so the area isn't revealed", async () => {
    state.fake.signIn(USER, "aal2")
    const { status, body } = await denied(await requireAdmin(request()))
    expect(status).toBe(404)
    expect(body).toEqual({ error: "not_found", message: "Not found." })
  })

  it("fails closed (404) when the is_admin() check errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.fake.fail("rpc:is_admin", { message: "function public.is_admin() does not exist" })
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 404, body: { error: "not_found" } })
    log.mockRestore()
  })

  it("answers 403 mfa_required to an admin whose session isn't AAL2", async () => {
    state.fake.signIn(ADMIN, "aal1")
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 403, body: { error: "mfa_required" } })
    state.fake.signIn(ADMIN, "aal2")
    state.fake.fail("auth:getAuthenticatorAssuranceLevel")
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 403, body: { error: "mfa_required" } })
  })

  it("answers 501 not_configured to an admin when the server has no secret key", async () => {
    state.secret = false
    expect(await denied(await requireAdmin(request()))).toMatchObject({ status: 501, body: { error: "not_configured" } })
  })

  it("hands the handler the admin, both clients and this site's origin", async () => {
    const result = await requireAdmin(request("POST", { Origin: SITE }))
    if (!result.ok) throw new Error("expected ok")
    expect(result.ctx.admin).toEqual({ id: ADMIN, email: "owner@example.com" })
    expect(result.ctx.origin).toBe(SITE)
    expect(result.ctx.service).toBeTruthy()
    expect(result.ctx.supabase).toBeTruthy()
  })
})

describe("withAdmin", () => {
  it("runs the handler with awaited params once the guard passes", async () => {
    const handler = withAdmin<{ id: string }>(async (ctx, _request, params) => Response.json({ admin: ctx.admin.id, id: params.id }))
    const response = await handler(request(), { params: Promise.resolve({ id: "abc" }) })
    expect(await response.json()).toEqual({ admin: ADMIN, id: "abc" })
  })

  it("returns the guard's denial without running the handler", async () => {
    state.fake.signIn(USER)
    const inner = vi.fn()
    const response = await withAdmin(inner)(request())
    expect(response.status).toBe(404)
    expect(inner).not.toHaveBeenCalled()
  })

  it("maps AdminError to its code and hides unexpected errors behind a 500", async () => {
    const invalid = await withAdmin(async () => {
      throw new AdminError("invalid", "page must be a positive whole number.")
    })(request())
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: "invalid", message: "page must be a positive whole number." })

    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const crash = await withAdmin(async () => {
      throw new Error('relation "public.secret_table" does not exist')
    })(request())
    expect(crash.status).toBe(500)
    expect(crash.headers.get("cache-control")).toBe("no-store")
    const body = await crash.json()
    expect(body.error).toBe("server_error")
    expect(JSON.stringify(body)).not.toMatch(/secret_table/)
    log.mockRestore()
  })
})

describe("getAdminGate", () => {
  it("is local without Supabase", async () => {
    state.configured = false
    expect(await getAdminGate()).toEqual({ status: "local" })
  })

  it("is signed_out without a valid session, or when the session can't be read", async () => {
    state.fake.signIn(null)
    expect(await getAdminGate()).toEqual({ status: "signed_out" })
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.serverClientError = new Error("cookies() unavailable")
    expect(await getAdminGate()).toEqual({ status: "signed_out" })
    log.mockRestore()
  })

  it("is not_admin for a signed-in creator", async () => {
    state.fake.signIn(USER, "aal2")
    expect(await getAdminGate()).toEqual({ status: "not_admin" })
  })

  it("is needs_mfa for an admin at AAL1, telling enrollment from challenge", async () => {
    state.fake.signIn(ADMIN, "aal1")
    expect(await getAdminGate()).toEqual({ status: "needs_mfa", has_factor: true, email: "owner@example.com" })
    state.fake.authUsers.find((u) => u.id === ADMIN)!.factors = []
    expect(await getAdminGate()).toEqual({ status: "needs_mfa", has_factor: false, email: "owner@example.com" })
  })

  it("is ok for an admin with 2-step verification", async () => {
    expect(await getAdminGate()).toEqual({ status: "ok", admin: { id: ADMIN, email: "owner@example.com" } })
  })
})

describe("sameOrigin", () => {
  const req = (origin: string | null, headers: Record<string, string> = {}, url = `${SITE}/api/x`) =>
    new Request(url, { method: "POST", headers: { ...(origin ? { Origin: origin } : {}), ...headers } })

  it("accepts this site's origin and returns it", () => {
    expect(sameOrigin(req(SITE))).toBe(SITE)
    expect(sameOrigin(req("https://orbi.example", { "x-forwarded-host": "orbi.example" }, "http://internal:3000/api/x"))).toBe("https://orbi.example")
    expect(sameOrigin(req("https://orbi.example", { host: "orbi.example" }, "http://internal:3000/api/x"))).toBe("https://orbi.example")
  })

  it("refuses missing, opaque, foreign, look-alike and non-web origins", () => {
    for (const origin of [null, "null", "https://evil.example", "http://localhost:3000.evil.example", "http://localhost", "file:///x", "not a url"]) {
      expect(sameOrigin(req(origin)), String(origin)).toBeNull()
    }
  })
})
