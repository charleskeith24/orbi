/** POST /api/access-requests (the public waitlist form) with an in-memory Supabase. */
import { beforeEach, describe, expect, it, vi } from "vitest"
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
vi.mock("@/lib/supabase/admin", () => ({
  isSecretKeyConfigured: () => state.secret,
  createSupabaseAdminClient: () => state.fake.serviceClient(),
}))

const { POST } = await import("./route")
const { ACCESS_REQUESTS_PER_HOUR } = await import("@/lib/admin/server/requests")

const SITE = "http://localhost:3000"
const VALID = { name: "Ana Santos", email: "Ana@Example.com", about: "Food vlogs in Cebu", link: "https://tiktok.com/@ana", consent: true, website: "" }

function post(body: unknown, headers: Record<string, string> = { Origin: SITE }) {
  return POST(
    new Request(`${SITE}/api/access-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  state.configured = true
  state.secret = true
  state.fake = new FakeSupabase()
})

const stored = () => state.fake.tables.access_requests

describe("POST /api/access-requests", () => {
  it("stores a new request (email lower-cased) and thanks the visitor", async () => {
    const response = await post(VALID)
    expect(response.status).toBe(201)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ ok: true })
    expect(stored()).toEqual([
      expect.objectContaining({ email: "ana@example.com", name: "Ana Santos", about: "Food vlogs in Cebu", link: "https://tiktok.com/@ana", status: "pending" }),
    ])
    expect(state.fake.callsTo("rpc:submit_access_request")).toEqual([
      [{ p_email: "ana@example.com", p_name: "Ana Santos", p_about: "Food vlogs in Cebu", p_link: "https://tiktok.com/@ana", p_max_per_hour: ACCESS_REQUESTS_PER_HOUR }],
    ])
  })

  it("answers a repeat request exactly like a new one, without storing it twice", async () => {
    const first = await post(VALID)
    const second = await post({ ...VALID, email: "ANA@example.com", name: "Ana again" })
    expect([first.status, second.status]).toEqual([201, 201])
    expect(await second.json()).toEqual(await first.json())
    expect(stored()).toHaveLength(1)
  })

  it("answers the same for an email that already has an account, without storing anything", async () => {
    state.fake.addUser({ email: "member@example.com" })
    const response = await post({ ...VALID, email: "member@example.com" })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(stored()).toEqual([])
  })

  it("accepts a filled honeypot silently and stores nothing", async () => {
    const response = await post({ ...VALID, website: "https://spam.example" })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(stored()).toEqual([])
    expect(state.fake.callsTo("rpc:submit_access_request")).toEqual([])
  })

  it("answers 429 rate_limited once the hourly limit is reached", async () => {
    for (let i = 0; i < ACCESS_REQUESTS_PER_HOUR; i++) {
      expect((await post({ ...VALID, email: `person${i}@example.com` })).status).toBe(201)
    }
    const response = await post({ ...VALID, email: "one-too-many@example.com" })
    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ error: "rate_limited" })
    expect(stored()).toHaveLength(ACCESS_REQUESTS_PER_HOUR)
  })

  it("answers 403 closed while the admin has requests switched off", async () => {
    state.fake.tables.platform_settings[0].access_open = false
    const response = await post(VALID)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "closed" })
    expect(stored()).toEqual([])
  })

  it("requires a same-origin Origin header", async () => {
    for (const headers of [{}, { Origin: "https://evil.example" }, { Origin: "null" }] as Record<string, string>[]) {
      const response = await post(VALID, headers)
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ error: "bad_origin" })
    }
    expect(stored()).toEqual([])
  })

  it("validates with the form's schema and names the fields", async () => {
    const response = await post({ name: "", email: "not-an-email", about: "x".repeat(301), link: "ftp://x", consent: false })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "invalid",
      fields: { name: "name_required", email: "email_invalid", about: "about_too_long", link: "link_invalid", consent: "consent_required" },
    })
    expect((await post("{not json")).status).toBe(400)
    expect((await post({ ...VALID, about: "x".repeat(6000) })).status).toBe(400)
    expect(stored()).toEqual([])
  })

  it("is not available in local mode or without the secret key (501)", async () => {
    state.configured = false
    expect(await (await post(VALID)).json()).toMatchObject({ error: "not_configured" })
    state.configured = true
    state.secret = false
    const response = await post(VALID)
    expect(response.status).toBe(501)
    expect(await response.json()).toMatchObject({ error: "not_configured" })
  })

  it("hides database errors behind a 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.fake.fail("rpc:submit_access_request", { message: 'duplicate key value violates unique constraint "access_requests_pending_email_key"' })
    const response = await post(VALID)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("server_error")
    expect(JSON.stringify(body)).not.toMatch(/access_requests/)
    log.mockRestore()
  })
})
