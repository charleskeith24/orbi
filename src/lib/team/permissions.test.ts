/**
 * The permission helper against the RLS matrix it mirrors.
 *
 * Two halves:
 * 1. the same table-by-table, role-by-role matrix that `team-migration.pglite.test.ts` runs against real
 *    Postgres, asserted here against `can()` — so a UI that trusts the helper can never offer a control
 *    the database would refuse (and vice versa: a control it hides that the database would allow);
 * 2. the three table groups read back out of `20260921000000_team.sql`, so the lists can't drift apart.
 */
import { describe, expect, it } from "vitest"
import { TABLE_NAMES } from "@/lib/data/defaults"
import {
  canManageWorkspace,
  canRead,
  canSeeMoney,
  canWrite,
  can,
  denialReason,
  EDITOR_TABLES,
  isGuest,
  isMoneyTable,
  MONEY_TABLES,
  OWNER_ACCESS,
  OWNER_ONLY_TABLES,
  TEAM_LIMITS,
  type WorkspaceAccess,
} from "@/lib/team/permissions"
import { readTeamPolicyExpressions, readTeamTableGroups, TEAM_SQL } from "@/lib/team/testing/team-sql"
import type { TableName } from "@/lib/types"

const OWNER: WorkspaceAccess = { role: "owner", moneyAccess: true }
const EDITOR: WorkspaceAccess = { role: "editor", moneyAccess: false }
const EDITOR_MONEY: WorkspaceAccess = { role: "editor", moneyAccess: true }
const VIEWER: WorkspaceAccess = { role: "viewer", moneyAccess: false }
const VIEWER_MONEY: WorkspaceAccess = { role: "viewer", moneyAccess: true }

const CASES: { label: string; access: WorkspaceAccess; read: readonly TableName[]; write: readonly TableName[] }[] = [
  { label: "the owner", access: OWNER, read: TABLE_NAMES, write: TABLE_NAMES },
  { label: "an editor", access: EDITOR, read: [...OWNER_ONLY_TABLES, ...EDITOR_TABLES], write: EDITOR_TABLES },
  { label: "an editor with Money access", access: EDITOR_MONEY, read: TABLE_NAMES, write: [...EDITOR_TABLES, ...MONEY_TABLES] },
  { label: "a viewer", access: VIEWER, read: [...OWNER_ONLY_TABLES, ...EDITOR_TABLES], write: [] },
  { label: "a viewer with Money access", access: VIEWER_MONEY, read: TABLE_NAMES, write: [] },
]

describe.each(CASES)("$label", ({ access, read, write }) => {
  const mayRead = new Set(read)
  const mayWrite = new Set(write)

  it.each(TABLE_NAMES)("reads %s as the policies do", (table) => {
    expect(canRead(table, access)).toBe(mayRead.has(table))
    expect(can("read", table, access)).toBe(canRead(table, access))
  })

  it.each(TABLE_NAMES)("writes %s as the policies do", (table) => {
    expect(canWrite(table, access)).toBe(mayWrite.has(table))
    expect(can("write", table, access)).toBe(canWrite(table, access))
  })

  it("never allows a write it doesn't allow a read of", () => {
    for (const table of TABLE_NAMES) if (canWrite(table, access)) expect(canRead(table, access)).toBe(true)
  })
})

describe("roles", () => {
  it("treats your own workspace and local mode as full access", () => {
    expect(OWNER_ACCESS).toEqual({ role: "owner", moneyAccess: true })
    for (const table of TABLE_NAMES) {
      expect(canRead(table, OWNER_ACCESS)).toBe(true)
      expect(canWrite(table, OWNER_ACCESS)).toBe(true)
    }
    expect(isGuest(OWNER_ACCESS)).toBe(false)
    expect(canManageWorkspace(OWNER_ACCESS)).toBe(true)
  })

  it("makes every member a guest, and only the owner a manager", () => {
    for (const access of [EDITOR, EDITOR_MONEY, VIEWER, VIEWER_MONEY]) {
      expect(isGuest(access)).toBe(true)
      expect(canManageWorkspace(access)).toBe(false)
    }
  })

  it("hides Money until the owner grants access", () => {
    expect(canSeeMoney(EDITOR)).toBe(false)
    expect(canSeeMoney(VIEWER)).toBe(false)
    expect(canSeeMoney(EDITOR_MONEY)).toBe(true)
    expect(canSeeMoney(VIEWER_MONEY)).toBe(true)
    expect(canSeeMoney(OWNER)).toBe(true)
  })

  it("explains why a control is disabled", () => {
    expect(denialReason("content_ideas", OWNER)).toBeNull()
    expect(denialReason("content_ideas", EDITOR)).toBeNull()
    expect(denialReason("content_ideas", VIEWER)).toBe("viewer")
    expect(denialReason("brand_profiles", EDITOR)).toBe("owner_only")
    expect(denialReason("content_pillars", EDITOR)).toBe("owner_only")
    expect(denialReason("brand_deals", EDITOR)).toBe("no_money")
    expect(denialReason("brand_deals", VIEWER)).toBe("no_money")
    expect(denialReason("brand_deals", VIEWER_MONEY)).toBe("viewer")
  })

  it("keeps Money to the three money tables", () => {
    expect(TABLE_NAMES.filter(isMoneyTable)).toEqual(["brand_deals", "income_entries", "rate_cards"])
  })
})

describe("the lists match supabase/migrations/20260921000000_team.sql", () => {
  const groups = readTeamTableGroups()

  it("places every workspace table in exactly one group", () => {
    const all = [...groups.owner, ...groups.editor, ...groups.money]
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual([...TABLE_NAMES].sort())
  })

  it("uses the same three groups as the SQL", () => {
    expect(groups.owner).toEqual([...OWNER_ONLY_TABLES])
    expect(groups.editor).toEqual([...EDITOR_TABLES])
    expect(groups.money).toEqual([...MONEY_TABLES])
  })

  it("builds each group's policies from the helper the group's rule needs", () => {
    const e = readTeamPolicyExpressions()
    // Every member reads the owner's and the editor's tables.
    expect(e.ownerRead).toBe("public.workspace_role(user_id) is not null")
    expect(e.editorRead).toBe("public.workspace_role(user_id) is not null")
    // Only the owner writes their own Brand HQ, audience, pillars and settings.
    expect(e.ownerWrite).toBe("(select auth.uid()) = user_id")
    // The owner and editors write the content work.
    expect(e.editorWrite).toBe("public.can_edit_workspace(user_id)")
    // Money needs access to read, and access plus a writing role to write.
    expect(e.moneyRead).toBe("public.has_money_access(user_id)")
    expect(e.moneyWrite).toBe("public.has_money_access(user_id) and public.can_edit_workspace(user_id)")
  })

  it("keeps the beta limits the team functions enforce", () => {
    expect(TEAM_LIMITS.members).toBe(5)
    expect(TEAM_LIMITS.workspacesJoined).toBe(10)
    // The seat limit is checked in invite_to_workspace() and again in respond_to_invite().
    const seatChecks = [...TEAM_SQL.matchAll(/>=\s*(\d+)\s*then\s*\n\s*raise exception '(workspace_full|too_many_workspaces)'/g)]
    expect(seatChecks.map((m) => `${m[2]}:${m[1]}`).sort()).toEqual([
      `too_many_workspaces:${TEAM_LIMITS.workspacesJoined}`,
      `workspace_full:${TEAM_LIMITS.members}`,
      `workspace_full:${TEAM_LIMITS.members}`,
    ])
  })
})
