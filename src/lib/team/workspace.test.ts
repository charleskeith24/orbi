import { describe, expect, it } from "vitest"
import {
  ACTIVE_WORKSPACE_KEY,
  type KeyStore,
  isPersonalOnly,
  isPersonalSetting,
  personalPart,
  PERSONAL_SETTING_FIELDS,
  readActiveWorkspace,
  resolveActiveWorkspace,
  writeActiveWorkspace,
  type WorkspaceMembership,
} from "@/lib/team/workspace"

const ME = "00000000-0000-4000-8000-000000000001"
const MIKA = "00000000-0000-4000-8000-000000000002"
const ANA = "00000000-0000-4000-8000-000000000003"

const membership = (ownerId: string, over: Partial<WorkspaceMembership> = {}): WorkspaceMembership => ({
  owner_id: ownerId,
  workspace_name: "Kapihan",
  role: "editor",
  money_access: false,
  joined_at: "2026-09-01T00:00:00.000Z",
  ...over,
})

describe("personal preferences", () => {
  it("are the preferences that follow the person, not the workspace", () => {
    expect([...PERSONAL_SETTING_FIELDS]).toEqual(["ui_language", "simple_mode"])
    expect(isPersonalSetting("ui_language")).toBe(true)
    expect(isPersonalSetting("simple_mode")).toBe(true)
    // Reminders go to the workspace owner only, so they are not personal overrides.
    expect(isPersonalSetting("reminders_daily_enabled")).toBe(false)
    expect(isPersonalSetting("weekly_post_target")).toBe(false)
    expect(isPersonalSetting("currency")).toBe(false)
  })

  it("keep only the personal part of a patch", () => {
    expect(personalPart({ ui_language: "tl", weekly_post_target: 9, currency: "USD" })).toEqual({ ui_language: "tl" })
    expect(personalPart({ weekly_post_target: 9 })).toEqual({})
  })

  it("recognise a patch a member may save to their own row", () => {
    expect(isPersonalOnly({ ui_language: "en" })).toBe(true)
    expect(isPersonalOnly({ simple_mode: false, updated_at: "now" })).toBe(true)
    expect(isPersonalOnly({ ui_language: "en", weekly_post_target: 3 })).toBe(false)
    expect(isPersonalOnly({ updated_at: "now" })).toBe(false)
    expect(isPersonalOnly({})).toBe(false)
  })
})

function memoryStore(initial: Record<string, string> = {}): KeyStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe("the active workspace", () => {
  it("remembers the choice per device and forgets it for your own workspace", () => {
    const storage = memoryStore()
    expect(readActiveWorkspace(storage)).toBeNull()
    writeActiveWorkspace(MIKA, storage)
    expect(storage.data.get(ACTIVE_WORKSPACE_KEY)).toBe(MIKA)
    expect(readActiveWorkspace(storage)).toBe(MIKA)
    writeActiveWorkspace(null, storage)
    expect(readActiveWorkspace(storage)).toBeNull()
  })

  it("ignores anything that isn't a workspace id", () => {
    expect(readActiveWorkspace(memoryStore({ [ACTIVE_WORKSPACE_KEY]: "not-a-uuid" }))).toBeNull()
  })

  it("opens your own workspace where there is no storage at all (server, private mode)", () => {
    expect(readActiveWorkspace(null)).toBeNull()
    expect(() => writeActiveWorkspace(MIKA, null)).not.toThrow()
    expect(readActiveWorkspace()).toBeNull()
  })

  it("opens your own workspace with full access by default", () => {
    expect(resolveActiveWorkspace(ME, null, [])).toEqual({
      target: { ownerId: ME, access: { role: "owner", moneyAccess: true } },
      changed: false,
    })
    expect(resolveActiveWorkspace(ME, ME, [])).toEqual({
      target: { ownerId: ME, access: { role: "owner", moneyAccess: true } },
      changed: false,
    })
  })

  it("opens the remembered workspace with the role the membership says", () => {
    const memberships = [membership(MIKA, { role: "viewer", money_access: true }), membership(ANA)]
    expect(resolveActiveWorkspace(ME, MIKA, memberships)).toEqual({
      target: { ownerId: MIKA, access: { role: "viewer", moneyAccess: true } },
      changed: false,
    })
    expect(resolveActiveWorkspace(ME, ANA, memberships)).toEqual({
      target: { ownerId: ANA, access: { role: "editor", moneyAccess: false } },
      changed: false,
    })
  })

  it("falls back to your own workspace, and says so, once you're no longer a member", () => {
    expect(resolveActiveWorkspace(ME, MIKA, [membership(ANA)])).toEqual({
      target: { ownerId: ME, access: { role: "owner", moneyAccess: true } },
      changed: true,
    })
  })
})
