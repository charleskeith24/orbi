/**
 * supabase/migrations/20260921000000_team.sql on a real Postgres engine (PGlite), on top of every earlier
 * migration and the stub of Supabase's auth schema (src/lib/supabase/testing/pglite.ts).
 *
 * This is the proof that team workspaces don't leak. It walks the whole RLS matrix — owner, editor,
 * viewer, an editor with Money access, a viewer with Money access and a non-member — across all 33
 * workspace tables, for select, insert, update and delete, and then the membership rules: members can't
 * escalate, removing a member revokes access at once, deleting the owner's account cascades memberships,
 * and invites never reveal who has an account.
 *
 * Reading the matrix: an insert is "denied" only when Postgres raises a row-level-security error (42501).
 * A unique or foreign-key violation means RLS let the row through, which is what the matrix is about —
 * the attempt runs in a transaction that is rolled back either way. NOT NULL and CHECK constraints are
 * evaluated BEFORE the RLS WITH CHECK, so every attempted insert is a copy of a real row of that
 * workspace with a fresh id: valid in every way except for who is inserting it.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { TABLE_NAMES } from "@/lib/data/defaults"
import { createDemoDatabase } from "@/lib/data/seed"
import { createAuthUser, createSupabaseTestDb, ident, insertJson, setRequestRole } from "@/lib/supabase/testing/pglite"
import { fillEmptyTables, rowsOf } from "@/lib/supabase/testing/workspace"
import type { Database, TableName } from "@/lib/types"

vi.setConfig({ testTimeout: 120_000, hookTimeout: 240_000 })

/** MIKA owns workspace 1; OUTSIDER owns workspace 2 and is in neither of Mika's roles. */
const MIKA = "a0000000-0000-4000-8000-0000000000a1"
const EDITOR = "b0000000-0000-4000-8000-0000000000b1"
const VIEWER = "c0000000-0000-4000-8000-0000000000c1"
const MONEY_EDITOR = "d0000000-0000-4000-8000-0000000000d1"
const MONEY_VIEWER = "e0000000-0000-4000-8000-0000000000e1"
const OUTSIDER = "f0000000-0000-4000-8000-0000000000f1"
/** Never invited anywhere; used for "an account with no team at all". */
const LONER = "a1000000-0000-4000-8000-0000000000a2"

const ACCOUNTS: [string, string][] = [
  [MIKA, "mika@example.com"],
  [EDITOR, "jun@example.com"],
  [VIEWER, "ana@example.com"],
  [MONEY_EDITOR, "bea@example.com"],
  [MONEY_VIEWER, "carlo@example.com"],
  [OUTSIDER, "outsider@example.com"],
  [LONER, "loner@example.com"],
]

const NOW = new Date("2026-09-10T09:00:00.000Z")

/** Owner writes, every member reads (Brand HQ, goals, platforms, pillars, audience, formats, settings). */
const OWNER_TABLES: TableName[] = [
  "brand_profiles",
  "app_settings",
  "content_goals",
  "content_platforms",
  "content_pillars",
  "content_formats",
  "audience_personas",
  "audience_problems",
  "audience_questions",
]
/** Owner and editor write, every member reads (the content work). */
const EDITOR_TABLES: TableName[] = [
  "angles",
  "hooks",
  "tags",
  "content_campaigns",
  "content_series",
  "content_ideas",
  "content_items",
  "content_briefs",
  "content_scripts",
  "content_calendar",
  "content_metrics",
  "content_experiments",
  "content_repurposing",
  "stories",
  "research_items",
  "content_tags",
  "weekly_reviews",
  "monthly_reviews",
  "ai_generations",
  "engagement_logs",
  "collabs",
]
/** Money: invisible without Money access. */
const MONEY_TABLES: TableName[] = ["brand_deals", "income_entries", "rate_cards"]

const FUNCTIONS = [
  "workspace_role",
  "can_edit_workspace",
  "has_money_access",
  "workspace_label",
  "invite_to_workspace",
  "my_workspace_invites",
  "respond_to_invite",
  "set_workspace_member",
  "remove_workspace_member",
  "leave_workspace",
  "my_workspaces",
] as const

let db: PGlite
/** One valid row of Mika's workspace per table, as jsonb — the template every insert attempt copies. */
const templates = new Map<TableName, Record<string, unknown>>()
/** An id of a row of Mika's workspace per table, for the update and delete attempts. */
const rowIds = new Map<TableName, string>()

/** Runs one statement in its own transaction as `role` with PostgREST-like JWT claims, and commits. */
async function as<T = Record<string, unknown>>(role: "anon" | "authenticated" | "service_role", userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await setRequestRole(tx, role, userId)
    return (await tx.query<T>(sql, params)).rows
  })
}
const user = <T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) => as<T>("authenticated", userId, sql, params)
/** The migration owner (the SQL editor): bypasses RLS, for seeding and assertions only. */
const root = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

const ROLLBACK = Symbol("rollback")

interface Attempt {
  ok: boolean
  affected: number
  /** SQLSTATE when the statement failed. */
  code: string
  message: string
}

/** Runs one write as `userId` and rolls it back, reporting what Postgres said. */
async function attempt(userId: string, sql: string, params: unknown[] = []): Promise<Attempt> {
  let out: Attempt = { ok: false, affected: 0, code: "", message: "" }
  try {
    await db.transaction(async (tx) => {
      await setRequestRole(tx, "authenticated", userId)
      try {
        const result = await tx.query(sql, params)
        out = { ok: true, affected: result.affectedRows ?? 0, code: "", message: "" }
      } catch (error) {
        const e = error as { code?: string; message?: string }
        out = { ok: false, affected: 0, code: e.code ?? "", message: e.message ?? String(error) }
      }
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  return out
}

const isRlsDenial = (a: Attempt) => !a.ok && (a.code === "42501" || /row-level security/i.test(a.message))

/** True when RLS let the insert through (it may still have failed on a unique key — that is not RLS). */
async function canInsert(userId: string, table: TableName, ownerId: string): Promise<boolean> {
  const row = { ...templates.get(table)!, id: crypto.randomUUID(), user_id: ownerId }
  const a = await attempt(
    userId,
    `insert into public.${ident(table)} select * from json_populate_record(null::public.${ident(table)}, $1::json)`,
    [JSON.stringify(row)]
  )
  if (isRlsDenial(a)) return false
  if (!a.ok && !/duplicate key|violates foreign key|violates check/i.test(a.message)) {
    throw new Error(`${table}: unexpected insert failure for ${userId}: ${a.code} ${a.message}`)
  }
  return true
}

async function canUpdate(userId: string, table: TableName): Promise<boolean> {
  const a = await attempt(userId, `update public.${ident(table)} set updated_at = now() where id = $1`, [rowIds.get(table)])
  if (isRlsDenial(a)) return false
  if (!a.ok) throw new Error(`${table}: unexpected update failure for ${userId}: ${a.code} ${a.message}`)
  return a.affected === 1
}

async function canDelete(userId: string, table: TableName): Promise<boolean> {
  const a = await attempt(userId, `delete from public.${ident(table)} where id = $1`, [rowIds.get(table)])
  if (isRlsDenial(a)) return false
  if (!a.ok) throw new Error(`${table}: unexpected delete failure for ${userId}: ${a.code} ${a.message}`)
  return a.affected === 1
}

async function visibleRows(userId: string, table: TableName, ownerId: string): Promise<number> {
  const [row] = await user<{ n: number }>(userId, `select count(*)::int as n from public.${ident(table)} where user_id = $1`, [ownerId])
  return row.n
}

/** Seeds one complete, valid workspace (the demo, plus an all-defaults row for tables it leaves empty). */
async function seedWorkspace(ownerId: string): Promise<Database> {
  const db_ = fillEmptyTables(createDemoDatabase(ownerId, NOW), ownerId, NOW).db
  for (const table of TABLE_NAMES) {
    const rows = rowsOf(db_, table).map((r) => ({ ...r, user_id: ownerId }))
    if (rows.length) await insertJson(db, table, rows)
  }
  return db_
}

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  for (const [id, email] of ACCOUNTS) await createAuthUser(db, { id, email })

  await seedWorkspace(MIKA)
  await seedWorkspace(OUTSIDER)

  // Mika's team. (Written as the table owner: the functions are exercised in their own describe block.)
  await root(
    `insert into public.workspace_members (owner_id, user_id, role, money_access) values
       ($1, $2, 'editor', false), ($1, $3, 'viewer', false), ($1, $4, 'editor', true), ($1, $5, 'viewer', true)`,
    [MIKA, EDITOR, VIEWER, MONEY_EDITOR, MONEY_VIEWER]
  )
  // The editor is also a viewer in the outsider's workspace: a member of two workspaces at once.
  await root(`insert into public.workspace_members (owner_id, user_id, role, money_access) values ($1, $2, 'viewer', false)`, [OUTSIDER, EDITOR])

  for (const table of TABLE_NAMES) {
    const [row] = await root<{ row: Record<string, unknown>; id: string }>(
      `select to_jsonb(x) as row, x.id::text as id from public.${ident(table)} x where x.user_id = $1 order by x.created_at, x.id limit 1`,
      [MIKA]
    )
    if (!row) throw new Error(`No seeded row for ${table}`)
    templates.set(table, row.row)
    rowIds.set(table, row.id)
  }
}, 240_000)

afterAll(async () => {
  await db?.close()
})

/* ------------------------------ The SQL objects ----------------------------- */

describe("team tables and functions", () => {
  it("creates workspace_members and workspace_invites with row-level security on", async () => {
    const rows = await root<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = any($1) order by 1`,
      [["workspace_invites", "workspace_members"]]
    )
    expect(rows).toEqual([
      { relname: "workspace_invites", relrowsecurity: true },
      { relname: "workspace_members", relrowsecurity: true },
    ])
  })

  it("creates every team function as security definer with an empty search_path", async () => {
    const rows = await root<{ proname: string; prosecdef: boolean; config: string[] | null }>(
      `select p.proname, p.prosecdef, p.proconfig as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = any($1) order by 1`,
      [[...FUNCTIONS]]
    )
    expect(rows.map((r) => r.proname)).toEqual([...FUNCTIONS].sort())
    for (const row of rows) {
      expect(row.prosecdef, row.proname).toBe(true)
      expect(row.config, row.proname).toContain('search_path=""')
    }
  })

  it("gives nobody but signed-in users any access to membership, and never a write grant", async () => {
    const grants = await root<{ grantee: string; privilege_type: string; table_name: string }>(
      `select grantee, privilege_type, table_name from information_schema.role_table_grants
        where table_schema = 'public' and table_name in ('workspace_members', 'workspace_invites')
          and grantee in ('anon', 'authenticated', 'service_role') order by 1, 2, 3`
    )
    const of = (table: string, grantee: string) =>
      grants.filter((g) => g.table_name === table && g.grantee === grantee).map((g) => g.privilege_type.toLowerCase()).sort()
    // Membership is read-only even for the owner: every change goes through a function.
    expect(of("workspace_members", "authenticated")).toEqual(["select"])
    expect(of("workspace_members", "anon")).toEqual([])
    expect(of("workspace_members", "service_role")).toEqual([])
    // Invites: the owner reads and cancels their own; creating and answering go through functions.
    expect(of("workspace_invites", "authenticated")).toEqual(["delete", "select"])
    expect(of("workspace_invites", "anon")).toEqual([])
    expect(of("workspace_invites", "service_role")).toEqual([])
  })

  it("keeps the three table groups equal to TABLE_NAMES, each table in exactly one", () => {
    const all = [...OWNER_TABLES, ...EDITOR_TABLES, ...MONEY_TABLES]
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual([...TABLE_NAMES].sort())
  })

  it("replaces the per-user policies of the init migration on every workspace table", async () => {
    const rows = await root<{ tablename: string; policyname: string; cmd: string }>(
      `select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename = any($1) order by 1, 3`,
      [[...TABLE_NAMES]]
    )
    const byTable = new Map<string, { policyname: string; cmd: string }[]>()
    for (const row of rows) byTable.set(row.tablename, [...(byTable.get(row.tablename) ?? []), row])
    for (const table of TABLE_NAMES) {
      const found = byTable.get(table) ?? []
      expect(found.map((p) => p.cmd).sort(), table).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"])
      for (const p of found) expect(p.policyname, table).toMatch(/^Workspace (members|writers) can /)
    }
  })
})

/* --------------------------------- The matrix -------------------------------- */

/** Who may do what in Mika's workspace. `null` = every table in that group. */
const MATRIX: { who: string; label: string; read: TableName[]; write: TableName[] }[] = [
  { who: MIKA, label: "the owner", read: [...OWNER_TABLES, ...EDITOR_TABLES, ...MONEY_TABLES], write: [...OWNER_TABLES, ...EDITOR_TABLES, ...MONEY_TABLES] },
  { who: EDITOR, label: "an editor", read: [...OWNER_TABLES, ...EDITOR_TABLES], write: [...EDITOR_TABLES] },
  { who: MONEY_EDITOR, label: "an editor with Money access", read: [...OWNER_TABLES, ...EDITOR_TABLES, ...MONEY_TABLES], write: [...EDITOR_TABLES, ...MONEY_TABLES] },
  { who: VIEWER, label: "a viewer", read: [...OWNER_TABLES, ...EDITOR_TABLES], write: [] },
  { who: MONEY_VIEWER, label: "a viewer with Money access", read: [...OWNER_TABLES, ...EDITOR_TABLES, ...MONEY_TABLES], write: [] },
  { who: OUTSIDER, label: "a non-member", read: [], write: [] },
  { who: LONER, label: "an account with no team", read: [], write: [] },
]

describe.each(MATRIX)("$label in Mika's workspace", ({ who, read, write }) => {
  const canRead = new Set(read)
  const canWrite = new Set(write)

  it.each(TABLE_NAMES)("select %s", async (table) => {
    const rows = await visibleRows(who, table, MIKA)
    if (canRead.has(table)) expect(rows).toBeGreaterThan(0)
    else expect(rows).toBe(0)
  })

  it.each(TABLE_NAMES)("insert into %s", async (table) => {
    expect(await canInsert(who, table, MIKA)).toBe(canWrite.has(table))
  })

  it.each(TABLE_NAMES)("update %s", async (table) => {
    expect(await canUpdate(who, table)).toBe(canWrite.has(table))
  })

  it.each(TABLE_NAMES)("delete from %s", async (table) => {
    expect(await canDelete(who, table)).toBe(canWrite.has(table))
  })
})

describe("the rule helpers", () => {
  it("report the role of the caller, never of anyone else", async () => {
    const roleOf = async (userId: string, owner: string) =>
      (await user<{ r: string | null }>(userId, "select public.workspace_role($1) as r", [owner]))[0].r
    expect(await roleOf(MIKA, MIKA)).toBe("owner")
    expect(await roleOf(EDITOR, MIKA)).toBe("editor")
    expect(await roleOf(VIEWER, MIKA)).toBe("viewer")
    expect(await roleOf(OUTSIDER, MIKA)).toBeNull()
    expect(await roleOf(MIKA, OUTSIDER)).toBeNull()
    expect(await roleOf(EDITOR, OUTSIDER)).toBe("viewer")
  })

  it("grant Money access to the owner always, and to a member only when it was turned on", async () => {
    const moneyOf = async (userId: string, owner: string) =>
      (await user<{ m: boolean }>(userId, "select public.has_money_access($1) as m", [owner]))[0].m
    expect(await moneyOf(MIKA, MIKA)).toBe(true)
    expect(await moneyOf(EDITOR, MIKA)).toBe(false)
    expect(await moneyOf(MONEY_EDITOR, MIKA)).toBe(true)
    expect(await moneyOf(MONEY_VIEWER, MIKA)).toBe(true)
    expect(await moneyOf(OUTSIDER, MIKA)).toBe(false)
  })

  it("are not callable by anon or by the server's secret key", async () => {
    for (const role of ["anon", "service_role"] as const) {
      await expect(as(role, null, "select public.workspace_role($1)", [MIKA]), role).rejects.toThrow(/permission denied/)
      await expect(as(role, null, "select public.has_money_access($1)", [MIKA]), role).rejects.toThrow(/permission denied/)
      await expect(as(role, null, "select * from public.my_workspaces()"), role).rejects.toThrow(/permission denied/)
    }
  })

  it("answer null and false for a signed-in user with no team", async () => {
    const [row] = await user<{ r: string | null; m: boolean }>(LONER, "select public.workspace_role($1) as r, public.has_money_access($1) as m", [MIKA])
    expect(row).toEqual({ r: null, m: false })
  })
})

/* -------------------------- Two workspaces at once -------------------------- */

describe("a member of two workspaces", () => {
  it("sees both workspaces' rows in one unfiltered select — which is why the adapter filters by owner", async () => {
    const [row] = await user<{ n: number; owners: number }>(
      EDITOR,
      "select count(*)::int as n, count(distinct user_id)::int as owners from public.content_items"
    )
    expect(row.owners).toBe(2)
    expect(row.n).toBeGreaterThan(0)
  })

  it("sees only one workspace once the select is scoped the way the adapter scopes it", async () => {
    const [row] = await user<{ n: number; owners: number }>(
      EDITOR,
      "select count(*)::int as n, count(distinct user_id)::int as owners from public.content_items where user_id = $1",
      [MIKA]
    )
    expect(row.owners).toBe(1)
    expect(row.n).toBeGreaterThan(0)
  })

  it("can write the workspace they edit and not the one they only view", async () => {
    expect(await canInsert(EDITOR, "content_ideas", MIKA)).toBe(true)
    const theirs = { ...templates.get("content_ideas")!, id: crypto.randomUUID(), user_id: OUTSIDER }
    const a = await attempt(
      EDITOR,
      "insert into public.content_ideas select * from json_populate_record(null::public.content_ideas, $1::json)",
      [JSON.stringify(theirs)]
    )
    expect(isRlsDenial(a)).toBe(true)
  })

  it("cannot stamp someone else's workspace onto a row of the one they edit", async () => {
    // An editor moving a row of Mika's workspace into the outsider's workspace fails both WITH CHECKs.
    const a = await attempt(EDITOR, "update public.content_ideas set user_id = $1 where id = $2", [OUTSIDER, rowIds.get("content_ideas")])
    expect(isRlsDenial(a)).toBe(true)
  })
})

/* ---------------------------- Membership and roles --------------------------- */

describe("membership", () => {
  it("lets the owner see their whole team and a member see only their own row", async () => {
    const mine = await user(MIKA, "select user_id from public.workspace_members where owner_id = $1", [MIKA])
    expect(mine).toHaveLength(4)
    const theirs = await user<{ owner_id: string; user_id: string }>(EDITOR, "select owner_id, user_id from public.workspace_members")
    expect(theirs.map((r) => `${r.owner_id}:${r.user_id}`).sort()).toEqual([`${MIKA}:${EDITOR}`, `${OUTSIDER}:${EDITOR}`].sort())
    expect(await user(OUTSIDER, "select * from public.workspace_members where owner_id = $1", [MIKA])).toEqual([])
  })

  it("gives a member no way to write a membership row at all", async () => {
    for (const sql of [
      `insert into public.workspace_members (owner_id, user_id, role) values ('${MIKA}', '${LONER}', 'editor')`,
      `update public.workspace_members set role = 'editor' where owner_id = '${MIKA}' and user_id = '${VIEWER}'`,
      `update public.workspace_members set money_access = true where owner_id = '${MIKA}' and user_id = '${EDITOR}'`,
      `delete from public.workspace_members where owner_id = '${MIKA}' and user_id = '${VIEWER}'`,
    ]) {
      const a = await attempt(VIEWER, sql)
      expect(a.ok, sql).toBe(false)
      // No grant at all: Postgres refuses before RLS is even consulted.
      expect(a.code, sql).toBe("42501")
    }
  })

  it("refuses to make anyone the owner of a workspace through a membership row", async () => {
    // No account may insert membership at all — not even the owner of the workspace.
    const a = await attempt(MIKA, `insert into public.workspace_members (owner_id, user_id, role) values ($1, $1, 'editor')`, [MIKA])
    expect(a.ok).toBe(false)
    expect(a.code).toBe("42501")
    // And the table itself refuses the row, so no function can create it either.
    await expect(root(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $1, 'editor')`, [MIKA])).rejects.toThrow(
      /workspace_members_not_owner_check/
    )
    await expect(root(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'owner')`, [MIKA, LONER])).rejects.toThrow(
      /workspace_members_role_check/
    )
  })

  it("lets only the owner change a role, through set_workspace_member", async () => {
    // A member calling it changes nothing: auth.uid() is always the owner_id it looks for.
    await expect(user(VIEWER, "select public.set_workspace_member($1, 'editor', true)", [VIEWER])).rejects.toThrow(/not_member/)
    await expect(user(VIEWER, "select public.set_workspace_member($1, 'editor', true)", [EDITOR])).rejects.toThrow(/not_member/)
    const before = await root<{ role: string }>("select role from public.workspace_members where owner_id = $1 and user_id = $2", [MIKA, VIEWER])
    expect(before[0].role).toBe("viewer")

    await user(MIKA, "select public.set_workspace_member($1, 'editor', true)", [VIEWER])
    const after = await root<{ role: string; money_access: boolean }>(
      "select role, money_access from public.workspace_members where owner_id = $1 and user_id = $2",
      [MIKA, VIEWER]
    )
    expect(after[0]).toEqual({ role: "editor", money_access: true })
    // Back to a viewer without Money, for the rest of the suite.
    await user(MIKA, "select public.set_workspace_member($1, 'viewer', false)", [VIEWER])
    await expect(user(MIKA, "select public.set_workspace_member($1, 'owner', false)", [VIEWER])).rejects.toThrow(/invalid_role/)
    await expect(user(MIKA, "select public.set_workspace_member($1, 'editor', false)", [LONER])).rejects.toThrow(/not_member/)
  })

  it("revokes access the moment a member is removed", async () => {
    await root(`insert into public.workspace_members (owner_id, user_id, role, money_access) values ($1, $2, 'editor', true)`, [MIKA, LONER])
    expect(await visibleRows(LONER, "content_items", MIKA)).toBeGreaterThan(0)
    expect(await visibleRows(LONER, "brand_deals", MIKA)).toBeGreaterThan(0)

    await user(MIKA, "select public.remove_workspace_member($1)", [LONER])
    expect(await visibleRows(LONER, "content_items", MIKA)).toBe(0)
    expect(await visibleRows(LONER, "brand_deals", MIKA)).toBe(0)
    expect(await canInsert(LONER, "content_ideas", MIKA)).toBe(false)
    await expect(user(MIKA, "select public.remove_workspace_member($1)", [LONER])).rejects.toThrow(/not_member/)
  })

  it("lets a member leave, and nobody leave for someone else", async () => {
    await root(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'viewer')`, [MIKA, LONER])
    await expect(user(OUTSIDER, "select public.leave_workspace($1)", [MIKA])).rejects.toThrow(/not_member/)
    await user(LONER, "select public.leave_workspace($1)", [MIKA])
    expect(await visibleRows(LONER, "content_items", MIKA)).toBe(0)
  })

  it("lists a member's workspaces with the owner's label and their own role", async () => {
    const rows = await user<{ owner_id: string; workspace_name: string; role: string; money_access: boolean }>(
      EDITOR,
      "select owner_id, workspace_name, role, money_access from public.my_workspaces()"
    )
    expect(rows).toHaveLength(2)
    const mika = rows.find((r) => r.owner_id === MIKA)
    expect(mika?.role).toBe("editor")
    expect(mika?.workspace_name).toBeTruthy()
    expect(mika?.workspace_name).not.toContain("@")
    // The owner of a workspace is not a member of it.
    expect(await user(MIKA, "select * from public.my_workspaces()")).toEqual([])
  })

  it("cascades memberships when the owner's account is deleted", async () => {
    const GHOST = "b1000000-0000-4000-8000-0000000000b2"
    await createAuthUser(db, { id: GHOST, email: "ghost@example.com" })
    await root(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'editor'), ($2, $1, 'viewer')`, [GHOST, MIKA])
    expect(await root(`select 1 from public.workspace_members where owner_id = $1 or user_id = $1`, [GHOST])).toHaveLength(2)
    await root("delete from auth.users where id = $1", [GHOST])
    expect(await root(`select 1 from public.workspace_members where owner_id = $1 or user_id = $1`, [GHOST])).toEqual([])
  })
})

/* --------------------------------- Invites ---------------------------------- */

describe("invites", () => {
  const pending = async (ownerId: string) =>
    root<{ email: string; role: string; money_access: boolean }>(
      "select email, role, money_access from public.workspace_invites where owner_id = $1 order by email",
      [ownerId]
    )
  const members = async (ownerId: string) => (await root<{ n: number }>("select count(*)::int as n from public.workspace_members where owner_id = $1", [ownerId]))[0].n
  const clearInvites = () => root("delete from public.workspace_invites where owner_id = $1", [MIKA])

  beforeAll(async () => {
    // The matrix is done with: leave Mika with two members so the 5-seat limit can be exercised.
    await root("delete from public.workspace_members where owner_id = $1 and user_id = any($2)", [MIKA, [MONEY_EDITOR, MONEY_VIEWER]])
  })

  it("stores an invite for an email whether or not it has an account", async () => {
    await clearInvites()
    await user(MIKA, "select public.invite_to_workspace('LONER@Example.com ', 'editor', true)")
    await user(MIKA, "select public.invite_to_workspace('nobody@example.com', 'viewer', false)")
    expect(await pending(MIKA)).toEqual([
      { email: "loner@example.com", role: "editor", money_access: true },
      { email: "nobody@example.com", role: "viewer", money_access: false },
    ])
  })

  it("re-invites by updating the role instead of taking a second seat", async () => {
    await user(MIKA, "select public.invite_to_workspace('loner@example.com', 'viewer', false)")
    const rows = await pending(MIKA)
    expect(rows.filter((r) => r.email === "loner@example.com")).toEqual([{ email: "loner@example.com", role: "viewer", money_access: false }])
    expect(rows).toHaveLength(2)
  })

  it("refuses an invalid email, an invalid role and inviting yourself", async () => {
    await expect(user(MIKA, "select public.invite_to_workspace('not-an-email', 'editor', false)")).rejects.toThrow(/invalid_email/)
    await expect(user(MIKA, "select public.invite_to_workspace('a@b.co', 'owner', false)")).rejects.toThrow(/invalid_role/)
    await expect(user(MIKA, "select public.invite_to_workspace('MIKA@example.com', 'editor', false)")).rejects.toThrow(/self_invite/)
  })

  it("counts members and pending invites against the same 5-seat beta limit", async () => {
    await clearInvites()
    const seats = 5 - (await members(MIKA))
    for (let i = 0; i < seats; i++) await user(MIKA, `select public.invite_to_workspace('seat${i}@example.com', 'viewer', false)`)
    expect(await pending(MIKA)).toHaveLength(seats)
    await expect(user(MIKA, "select public.invite_to_workspace('one-too-many@example.com', 'viewer', false)")).rejects.toThrow(/workspace_full/)
    // Re-inviting an email that already holds a seat still works.
    await user(MIKA, "select public.invite_to_workspace('seat0@example.com', 'editor', true)")
    expect(await pending(MIKA)).toHaveLength(seats)
  })

  it("shows an invitee only their own invites, with the workspace label and never an email", async () => {
    await clearInvites()
    await user(MIKA, "select public.invite_to_workspace('loner@example.com', 'editor', true)")
    const mine = await user<{ owner_id: string; workspace_name: string; role: string; money_access: boolean }>(
      LONER,
      "select owner_id, workspace_name, role, money_access from public.my_workspace_invites()"
    )
    expect(mine).toEqual([{ owner_id: MIKA, workspace_name: expect.any(String), role: "editor", money_access: true }])
    expect(mine[0].workspace_name).not.toContain("@")
    // Nobody else learns that loner@example.com was invited.
    expect(await user(OUTSIDER, "select * from public.my_workspace_invites()")).toEqual([])
    expect(await user(VIEWER, "select * from public.my_workspace_invites()")).toEqual([])
    // And nobody but the owner can read the invite rows themselves.
    expect(await user(LONER, "select * from public.workspace_invites")).toEqual([])
    expect(await user(OUTSIDER, "select * from public.workspace_invites")).toEqual([])
  })

  it("accepts an invite with the role the owner chose, and only for the invited email", async () => {
    await expect(user(OUTSIDER, "select public.respond_to_invite($1, true)", [MIKA])).rejects.toThrow(/not_found/)
    const [row] = await user<{ respond_to_invite: string }>(LONER, "select public.respond_to_invite($1, true)", [MIKA])
    expect(row.respond_to_invite).toBe("accepted")
    expect(await pending(MIKA)).toEqual([])
    const [member] = await root<{ role: string; money_access: boolean }>(
      "select role, money_access from public.workspace_members where owner_id = $1 and user_id = $2",
      [MIKA, LONER]
    )
    expect(member).toEqual({ role: "editor", money_access: true })
    expect(await visibleRows(LONER, "brand_deals", MIKA)).toBeGreaterThan(0)
  })

  it("declines without joining, and removes the invite", async () => {
    await user(MIKA, "select public.remove_workspace_member($1)", [LONER])
    await user(MIKA, "select public.invite_to_workspace('loner@example.com', 'viewer', false)")
    const [row] = await user<{ respond_to_invite: string }>(LONER, "select public.respond_to_invite($1, false)", [MIKA])
    expect(row.respond_to_invite).toBe("declined")
    expect(await pending(MIKA)).toEqual([])
    expect(await visibleRows(LONER, "content_items", MIKA)).toBe(0)
  })

  it("lets the owner cancel a pending invite and nobody else touch it", async () => {
    await user(MIKA, "select public.invite_to_workspace('loner@example.com', 'viewer', false)")
    const a = await attempt(LONER, "delete from public.workspace_invites where owner_id = $1", [MIKA])
    expect(a.affected).toBe(0)
    await user(MIKA, "delete from public.workspace_invites where owner_id = $1", [MIKA])
    expect(await user(LONER, "select * from public.my_workspace_invites()")).toEqual([])
  })

  it("refuses to accept into a workspace that filled up while the invite waited", async () => {
    await clearInvites()
    for (const id of [MONEY_EDITOR, MONEY_VIEWER, OUTSIDER]) {
      await root(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'viewer') on conflict do nothing`, [MIKA, id])
    }
    expect(await members(MIKA)).toBe(5)
    await root(`insert into public.workspace_invites (owner_id, email, role) values ($1, 'loner@example.com', 'viewer')`, [MIKA])
    await expect(user(LONER, "select public.respond_to_invite($1, true)", [MIKA])).rejects.toThrow(/workspace_full/)
    await root("delete from public.workspace_members where owner_id = $1 and user_id = any($2)", [MIKA, [MONEY_EDITOR, MONEY_VIEWER, OUTSIDER]])
    await clearInvites()
  })

  it("refuses to join an eleventh workspace", async () => {
    const owners: string[] = []
    for (let i = 0; i < 10; i++) {
      const id = `aa000000-0000-4000-8000-0000000000${(10 + i).toString().padStart(2, "0")}`
      await createAuthUser(db, { id, email: `owner${i}@example.com` })
      await root(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'viewer')`, [id, LONER])
      owners.push(id)
    }
    await root(`insert into public.workspace_invites (owner_id, email, role) values ($1, 'loner@example.com', 'viewer')`, [MIKA])
    await expect(user(LONER, "select public.respond_to_invite($1, true)", [MIKA])).rejects.toThrow(/too_many_workspaces/)
    await root("delete from public.workspace_members where user_id = $1 and owner_id = any($2)", [LONER, owners])
    await clearInvites()
  })
})

/* ------------------------- Profiles across a workspace ---------------------- */

describe("profiles", () => {
  it("makes the owner and their members connected, in the one place that rule lives", async () => {
    const sees = async (userId: string, other: string) =>
      (await user<{ v: boolean }>(userId, "select public.can_see_profile($1) as v", [other]))[0].v
    expect(await sees(MIKA, EDITOR)).toBe(true)
    expect(await sees(EDITOR, MIKA)).toBe(true)
    // Two members of the same workspace.
    expect(await sees(EDITOR, VIEWER)).toBe(true)
    // Somebody who shares nothing.
    expect(await sees(EDITOR, LONER)).toBe(false)
    expect(await sees(LONER, MIKA)).toBe(false)
  })

  it("returns a teammate's profile through get_profiles, and never their email", async () => {
    await root("update public.users set full_name = 'Mika Reyes', headline = 'Food creator' where id = $1", [MIKA])
    const [row] = await user<{ id: string; display_name: string; headline: string }>(
      EDITOR,
      "select id, display_name, headline from public.get_profiles($1)",
      [[MIKA]]
    )
    expect(row).toEqual({ id: MIKA, display_name: "Mika Reyes", headline: "Food creator" })
    // get_profiles() has no email column at all, so no caller can ever reach one.
    const [shape] = await root<{ args: string }>(
      "select pg_get_function_result(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_profiles'"
    )
    expect(shape.args).not.toMatch(/email/)
    // Nobody who shares nothing gets a row.
    expect(await user(LONER, "select * from public.get_profiles($1)", [[MIKA]])).toEqual([])
  })
})
