/** getAccessRequestState(): what the public /signup page shows. */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeSupabase } from "../testing/fake-supabase"

const state = vi.hoisted(() => ({
  configured: true,
  secret: true,
  fake: null as unknown as import("../testing/fake-supabase").FakeSupabase,
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

const { getAccessRequestState } = await import("./settings")

beforeEach(() => {
  state.configured = true
  state.secret = true
  state.fake = new FakeSupabase()
})

describe("getAccessRequestState", () => {
  it("follows the admin's switch", async () => {
    expect(await getAccessRequestState()).toBe("open")
    state.fake.tables.platform_settings[0].access_open = false
    expect(await getAccessRequestState()).toBe("closed")
  })

  it("is local without Supabase and not_configured without the secret key", async () => {
    state.secret = false
    expect(await getAccessRequestState()).toBe("not_configured")
    state.configured = false
    expect(await getAccessRequestState()).toBe("local")
  })

  it("counts a failed read as open (the endpoint still enforces the setting)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    state.fake.fail("select:platform_settings")
    expect(await getAccessRequestState()).toBe("open")
    log.mockRestore()
  })
})
