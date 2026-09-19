import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AdminApiError } from "./errors"
import { createAdminFixture, FIXTURE_PAGE_SIZE, FIXTURE_SELF } from "./fixture-api"
import { DEV_ADMIN_KEY, isAdminFixtureEnabled, loadAdminFixture } from "./dev-fixture"
import { MfaError } from "./mfa-client"

const NOW = Date.parse("2026-09-18T09:00:00Z")
const make = () => createAdminFixture({ now: () => NOW, latencyMs: 0 })

describe("admin fixture — sample data", () => {
  it("labels every person and message as a sample", async () => {
    const { api } = make()
    const users = [...(await api.listUsers()).items, ...(await api.listUsers({ page: 2 })).items]
    expect(users.length).toBeGreaterThan(FIXTURE_PAGE_SIZE)
    for (const row of users) {
      expect(row.email).toMatch(/\.sample@example\.com$/)
      if (row.name) expect(row.name).toMatch(/sample/i)
    }
    for (const request of await api.listRequests()) expect(request.email).toMatch(/sample@example\.com$/)
    for (const entry of (await api.listFeedback()).items) expect(entry.message).toMatch(/^Sample feedback/)
    expect(users.filter((u) => u.is_self)).toEqual([expect.objectContaining({ email: FIXTURE_SELF.email, is_admin: true })])
  })

  it("computes the overview from its own rows", async () => {
    const { api } = make()
    const overview = await api.overview()
    const all = [...(await api.listUsers()).items, ...(await api.listUsers({ page: 2 })).items]
    expect(overview.users_total).toBe(all.length)
    expect(overview.pending_requests).toBe((await api.listRequests("pending")).length)
    expect(overview.active_7d).toBeLessThanOrEqual(overview.active_30d)
    expect(overview.funnel.map((s) => s.step)).toEqual(["start", "about", "who", "pick"])
  })

  it("lists requests pending first and filters by status", async () => {
    const { api } = make()
    const rows = await api.listRequests()
    const firstDecided = rows.findIndex((r) => r.status !== "pending")
    expect(rows.slice(firstDecided).every((r) => r.status !== "pending")).toBe(true)
    expect((await api.listRequests("rejected")).every((r) => r.status === "rejected")).toBe(true)
  })

  it("searches, filters and pages users", async () => {
    const { api } = make()
    expect((await api.listUsers({ query: "BEA" })).items.map((u) => u.email)).toEqual(["bea.sample@example.com"])
    expect((await api.listUsers({ status: "invited" })).items.every((u) => u.status === "invited")).toBe(true)
    const first = await api.listUsers({ page: 1 })
    expect(first).toMatchObject({ page: 1, has_more: true })
    expect(first.items).toHaveLength(FIXTURE_PAGE_SIZE)
    expect(await api.listUsers({ page: 2 })).toMatchObject({ page: 2, has_more: false })
  })
})

describe("admin fixture — mutations and guards", () => {
  it("approving invites the person and writes the audit log", async () => {
    const { api } = make()
    const [pending] = await api.listRequests("pending")
    const approved = await api.approveRequest(pending.id)
    expect(approved).toMatchObject({ status: "approved", decided_by_email: FIXTURE_SELF.email })
    expect((await api.listUsers({ query: pending.email })).items[0]).toMatchObject({ status: "invited" })
    expect((await api.listAudit()).items[0]).toMatchObject({ action: "request_approved", target_email: pending.email })
    await expect(api.approveRequest(pending.id)).rejects.toMatchObject({ code: "conflict" })
  })

  it("never lets an admin act on their own account", async () => {
    const { api } = make()
    for (const action of [api.disableUser, api.revokeAdmin]) {
      await expect(action(FIXTURE_SELF.id)).rejects.toMatchObject({ code: "self_action", status: 409 })
    }
    await expect(api.deleteUser(FIXTURE_SELF.id, FIXTURE_SELF.email)).rejects.toMatchObject({ code: "self_action" })
  })

  it("keeps the last admin", async () => {
    const { api } = make()
    const other = (await api.listUsers({ query: "mika" })).items[0]
    await api.revokeAdmin(other.id)
    const bea = (await api.listUsers({ query: "bea" })).items[0]
    await api.grantAdmin(bea.id)
    await api.revokeAdmin(bea.id)
    // Only the signed-in admin is left — and they can't remove themselves either.
    await expect(api.revokeAdmin(FIXTURE_SELF.id)).rejects.toBeInstanceOf(AdminApiError)
  })

  it("requires the typed email to delete, and only resends invites to invited people", async () => {
    const { api } = make()
    const bea = (await api.listUsers({ query: "bea" })).items[0]
    await expect(api.deleteUser(bea.id, "someone@example.com")).rejects.toMatchObject({ code: "invalid" })
    await expect(api.resendInvite(bea.id)).rejects.toMatchObject({ code: "conflict" })
    await api.deleteUser(bea.id, " BEA.sample@example.com ")
    expect((await api.listUsers({ query: "bea" })).items).toEqual([])
    await expect(api.disableUser(bea.id)).rejects.toMatchObject({ code: "not_found", status: 404 })
  })

  it("disables, enables and invites with audit details", async () => {
    const { api } = make()
    const gio = (await api.listUsers({ query: "gio" })).items[0]
    expect(await api.disableUser(gio.id)).toMatchObject({ status: "disabled" })
    expect((await api.listAudit()).items[0]).toMatchObject({ action: "user_disabled", details: { from: "active", to: "disabled" } })
    expect(await api.enableUser(gio.id)).toMatchObject({ status: "active" })
    await expect(api.inviteUser("not-an-email")).rejects.toMatchObject({ code: "invalid" })
    await expect(api.inviteUser("gio.sample@example.com")).rejects.toMatchObject({ code: "conflict" })
    expect(await api.inviteUser("New.Person@Example.com")).toMatchObject({ email: "new.person@example.com", status: "invited" })
  })

  it("returns copies, so callers can't mutate its state", async () => {
    const { api } = make()
    const page = await api.listUsers()
    page.items[0].email = "changed@example.com"
    expect((await api.listUsers()).items[0].email).not.toBe("changed@example.com")
  })

  it("toggles access_open once and logs it", async () => {
    const { api } = make()
    expect(await api.updateSettings({ access_open: false })).toEqual({ access_open: false })
    await api.updateSettings({ access_open: false })
    const logged = (await api.listAudit()).items.filter((e) => e.action === "settings_updated" && e.created_at === new Date(NOW).toISOString())
    expect(logged).toHaveLength(1)
    expect((await api.overview()).access_open).toBe(false)
  })
})

describe("admin fixture — 2-step verification", () => {
  it("enrolls with any 6 digits except 000000", async () => {
    const { mfa } = make()
    const before = await mfa.listFactors()
    const enrollment = await mfa.enroll()
    expect(enrollment.qrCode).toMatch(/^data:image\/svg\+xml/)
    await expect(mfa.verify(enrollment.factorId, "000000")).rejects.toBeInstanceOf(MfaError)
    await mfa.verify(enrollment.factorId, "123456")
    expect(await mfa.listFactors()).toHaveLength(before.length + 1)
    await mfa.unenroll(enrollment.factorId)
    expect(await mfa.listFactors()).toHaveLength(before.length)
  })
})

describe("dev fixture switch", () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("is on only with the flag, outside production", () => {
    expect(isAdminFixtureEnabled()).toBe(false)
    store.set(DEV_ADMIN_KEY, "fixture")
    expect(isAdminFixtureEnabled()).toBe(true)
    store.set(DEV_ADMIN_KEY, "yes")
    expect(isAdminFixtureEnabled()).toBe(false)
  })

  it("is impossible in production", async () => {
    store.set(DEV_ADMIN_KEY, "fixture")
    vi.stubEnv("NODE_ENV", "production")
    expect(isAdminFixtureEnabled()).toBe(false)
    expect(loadAdminFixture()).toBeNull()
    expect(() => createAdminFixture()).toThrow(/development-only/)
  })
})
