/**
 * The Supabase schema on a real Postgres engine (PGlite, in memory).
 *
 * schema-parity.test.ts reads the migration text; this file runs it. Every migration applies on a stub
 * of Supabase's auth schema, the demo workspace goes in through Postgres' own types, CHECKs and foreign
 * keys, deletes are compared with relations.ts, updated_at triggers are exercised and row-level
 * security is checked with the real `authenticated` and `anon` roles.
 *
 * Data-driven (TABLE_NAMES, REFERENCES, the migration files), so new tables are picked up as they land.
 * What it can't prove: PostgREST, Supabase Auth and hosted-project settings — see docs/SUPABASE.md.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { TABLE_NAMES } from "@/lib/data/defaults"
import { planDelete } from "@/lib/data/relations"
import { createDemoDatabase } from "@/lib/data/seed"
import { rekeyWorkspace } from "@/lib/supabase/rekey"
import {
  canonicalRows,
  columnTypes,
  createAuthUser,
  createSupabaseTestDb,
  ident,
  insertJson,
  readMigrations,
  selectJson,
  setRequestRole,
  snapshotTables,
  withRole,
} from "@/lib/supabase/testing/pglite"
import { applyPlan, databaseEnforcedPart, deleteCases, fillEmptyTables, patchWorkspace, rowsOf } from "@/lib/supabase/testing/workspace"
import type { Database } from "@/lib/types"

const A = "a0000000-0000-4000-8000-00000000000a"
const B = "b0000000-0000-4000-8000-00000000000b"
const NOW = new Date("2026-09-10T09:00:00.000Z")
/** The demo workspace, plus one all-defaults row in any table it leaves empty (e.g. the AI log). */
const DEMO: Database = fillEmptyTables(createDemoDatabase(A, NOW), A, NOW).db
const { cases: DELETE_CASES, missing: UNEXERCISED } = deleteCases(DEMO)
const OMIT_ON_COMPARE = ["updated_at"]

// PGlite is CPU-heavy WASM: under the full parallel suite a single test can take several seconds.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

let db: PGlite
let migrations: string[]
let types: Map<string, Map<string, string>>

beforeAll(async () => {
  ;({ db, migrations } = await createSupabaseTestDb())
  types = await columnTypes(db)
  await createAuthUser(db, { id: A, email: "a@example.com", fullName: "Ana Reyes" })
  await createAuthUser(db, { id: B, email: "b@example.com" })
}, 180_000)

afterAll(async () => {
  await db?.close()
})

let demoInserted: Promise<void> | null = null
/** Inserts the demo workspace for A once, as A (RLS on), table by table in TABLE_NAMES order. */
function ensureDemo(): Promise<void> {
  demoInserted ??= withRole(db, "authenticated", A, async (tx) => {
    for (const table of TABLE_NAMES) {
      try {
        await insertJson(tx, table, rowsOf(DEMO, table))
      } catch (error) {
        throw new Error(`Inserting ${table} failed: ${(error as Error).message}`)
      }
    }
  })
  return demoInserted
}

const count = async (q: Pick<PGlite, "query">, table: string, where = "", params: unknown[] = []) =>
  (await q.query<{ n: number }>(`select count(*)::int as n from public.${ident(table)} ${where}`, params)).rows[0].n

describe("migrations on a real Postgres engine", () => {
  it("apply cleanly, one file at a time in name order, on a stub of Supabase's auth schema", () => {
    expect(migrations).toEqual(readMigrations().map((m) => m.file))
    expect(migrations[0]).toBe("20260910000000_init.sql")
  })

  it("create every workspace table, with row-level security on every table in public", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'"
    )
    expect(rows.map((r) => r.relname)).toEqual(expect.arrayContaining([...TABLE_NAMES, "users"]))
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([])
  })

  it("give authenticated the API privileges and anon none (Supabase grants both by default; the migrations revoke anon)", async () => {
    const problems: string[] = []
    // Every table in public — workspace tables and server-only tables from later migrations alike.
    const { rows: tables } = await db.query<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1"
    )
    const workspace = new Set<string>([...TABLE_NAMES, "users"])
    for (const table of tables.map((t) => t.relname)) {
      const { rows } = await db.query<{ role: string; privilege: string; granted: boolean }>(
        // public.users grants UPDATE per column (the profile columns, never email or id — 20260920000000_profiles.sql).
        `select r.role, p.privilege,
                case when $1 = 'public.users' and p.privilege = 'update' then has_any_column_privilege(r.role, $1, 'update')
                     else has_table_privilege(r.role, $1, p.privilege) end as granted
           from unnest(array['anon', 'authenticated']) as r(role),
                unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p(privilege)`,
        [`public.${table}`]
      )
      for (const { role, privilege, granted } of rows) {
        if (role === "anon" && granted) problems.push(`${table}: anon has ${privilege}`)
        const needed = !workspace.has(table) ? [] : ["select", "insert", "update", ...(table === "users" ? [] : ["delete"])]
        if (role === "authenticated" && needed.includes(privilege) && !granted) problems.push(`${table}: authenticated lacks ${privilege}`)
      }
    }
    expect(problems).toEqual([])
  })

  it("don't let an account delete its public.users profile (no delete grant, no delete policy)", async () => {
    const attempt = withRole(db, "authenticated", A, async (tx) => {
      const result = await tx.query("delete from public.users where id = $1", [A])
      await tx.rollback()
      return result.affectedRows
    })
    // New projects have no DELETE grant at all; older ones grant it by default and row-level security stops it.
    await attempt.then(
      (deleted) => expect(deleted).toBe(0),
      (error: unknown) => expect(String(error)).toMatch(/permission denied for table users/)
    )
    expect(await db.query("select id from public.users where id = $1", [A]).then((r) => r.rows)).toHaveLength(1)
  })
})

describe("the demo workspace in Postgres", () => {
  it("inserts table by table in TABLE_NAMES order, as its owner with RLS on", async () => {
    await ensureDemo()
    const counts = Object.fromEntries(await Promise.all(TABLE_NAMES.map(async (t) => [t, await count(db, t)] as const)))
    expect(counts).toEqual(Object.fromEntries(TABLE_NAMES.map((t) => [t, rowsOf(DEMO, t).length])))
  })

  it.each(TABLE_NAMES)("%s: reads back exactly as written (types, arrays, JSON, dates, fractions)", async (table) => {
    await ensureDemo()
    const stored = await selectJson(db, table)
    expect(canonicalRows(stored, types.get(table))).toEqual(canonicalRows(rowsOf(DEMO, table), types.get(table)))
  })
})

describe("relations.ts rules in Postgres", () => {
  it("every reference is exercised by a parent row that really has a child", () => {
    expect(UNEXERCISED).toEqual([])
  })

  it.each(DELETE_CASES)("$name: Postgres leaves exactly what planDelete predicts (minus the app's array/tag cleanup)", async ({ table, id, setup }) => {
    await ensureDemo()
    const base = patchWorkspace(DEMO, setup)
    const plan = planDelete(base, table, [id])
    const expected = applyPlan(base, databaseEnforcedPart(base, plan))

    const actual = await db.transaction(async (tx) => {
      if (setup) {
        const columns = Object.keys(setup.patch).map(ident)
        await tx.query(
          `update public.${ident(setup.table)} as t set ${columns.map((c) => `${c} = p.${c}`).join(", ")}
             from json_populate_record(null::public.${ident(setup.table)}, $1::json) as p where t.id = $2`,
          [JSON.stringify(setup.patch), setup.id]
        )
      }
      await setRequestRole(tx, "authenticated", A)
      const deleted = await tx.query(`delete from public.${ident(table)} where id = $1`, [id])
      expect(deleted.affectedRows).toBe(1)
      const snapshot = await snapshotTables(tx, TABLE_NAMES)
      await tx.rollback()
      return snapshot
    })

    for (const t of TABLE_NAMES) {
      expect(canonicalRows(actual[t], types.get(t), OMIT_ON_COMPARE), t).toEqual(canonicalRows(rowsOf(expected, t), types.get(t), OMIT_ON_COMPARE))
    }
  })
})

describe("updated_at triggers", () => {
  it.each([...TABLE_NAMES, "users"])("%s: an UPDATE stamps updated_at with the transaction time", async (table) => {
    await ensureDemo()
    await db.transaction(async (tx) => {
      await setRequestRole(tx, "authenticated", A)
      const target = (await tx.query<{ id: string; created_at: Date }>(`select id, created_at from public.${ident(table)} limit 1`)).rows[0]
      expect(target, `no ${table} row to update`).toBeDefined()
      const now = (await tx.query<{ now: Date }>("select now() as now")).rows[0].now
      const { rows } = await tx.query<{ updated_at: Date; created_at: Date }>(
        `update public.${ident(table)} set updated_at = '2000-01-01T00:00:00Z' where id = $1 returning updated_at, created_at`,
        [target.id]
      )
      expect(rows[0].updated_at.getTime()).toBe(now.getTime())
      expect(rows[0].created_at.getTime()).toBe(target.created_at.getTime())
      await tx.rollback()
    })
  })
})

describe("row-level security", () => {
  it("another account sees none of the rows and can't change or delete them", async () => {
    await ensureDemo()
    const leaks: string[] = []
    await withRole(db, "authenticated", B, async (tx) => {
      for (const table of TABLE_NAMES) {
        if ((await count(tx, table)) !== 0) leaks.push(`${table}: visible`)
        const victim = rowsOf(DEMO, table)[0]
        if (!victim) continue
        const updated = await tx.query(`update public.${ident(table)} set created_at = created_at where id = $1`, [victim.id])
        if (updated.affectedRows) leaks.push(`${table}: updated`)
        const deleted = await tx.query(`delete from public.${ident(table)} where id = $1`, [victim.id])
        if (deleted.affectedRows) leaks.push(`${table}: deleted`)
      }
      expect((await selectJson(tx, "users")).map((u) => u.id)).toEqual([B])
      await tx.rollback()
    })
    expect(leaks).toEqual([])
    for (const table of TABLE_NAMES) expect(await count(db, table, "where user_id = $1", [A]), table).toBe(rowsOf(DEMO, table).length)
  })

  it("the owner sees all of its rows", async () => {
    await ensureDemo()
    await withRole(db, "authenticated", A, async (tx) => {
      for (const table of TABLE_NAMES) expect(await count(tx, table), table).toBe(rowsOf(DEMO, table).length)
      expect((await selectJson(tx, "users")).map((u) => u.id)).toEqual([A])
    })
  })

  it("new rows default to the caller's id, and rows for another account are rejected", async () => {
    const mine = await withRole(db, "authenticated", B, async (tx) => {
      const { rows } = await tx.query<{ user_id: string }>("insert into public.tags (name) values ('mine') returning user_id")
      await tx.rollback()
      return rows[0].user_id
    })
    expect(mine).toBe(B)
    await expect(
      withRole(db, "authenticated", B, (tx) => insertJson(tx, "tags", [{ name: "planted", user_id: A }]))
    ).rejects.toThrow(/row-level security/)
    await expect(
      withRole(db, "authenticated", B, async (tx) => {
        const { rows } = await tx.query<{ id: string }>("insert into public.tags (name) values ('handover') returning id")
        await tx.query("update public.tags set user_id = $1 where id = $2", [A, rows[0].id])
      })
    ).rejects.toThrow(/row-level security/)
  })

  it("anon can't read or write any workspace table", async () => {
    for (const table of [...TABLE_NAMES, "users"]) {
      await expect(withRole(db, "anon", null, (tx) => tx.query(`select 1 from public.${ident(table)} limit 1`)), table).rejects.toThrow(
        /permission denied/
      )
    }
    await expect(withRole(db, "anon", null, (tx) => tx.query("insert into public.tags (name) values ('x')"))).rejects.toThrow(/permission denied/)
  })

  it("keeps unique keys per account: one brand profile and one settings row each, tag names case-insensitive", async () => {
    await ensureDemo()
    const tagName = DEMO.tags[0].name
    // Another account may reuse a tag name.
    await withRole(db, "authenticated", B, async (tx) => {
      await tx.query("insert into public.tags (name) values ($1)", [tagName])
      await tx.rollback()
    })
    await expect(withRole(db, "authenticated", A, (tx) => tx.query("insert into public.tags (name) values ($1)", [tagName.toUpperCase()]))).rejects.toThrow(
      /duplicate key/
    )
    await expect(withRole(db, "authenticated", A, (tx) => tx.query("insert into public.brand_profiles default values"))).rejects.toThrow(/duplicate key/)
    await expect(withRole(db, "authenticated", A, (tx) => tx.query("insert into public.app_settings default values"))).rejects.toThrow(/duplicate key/)
  })

  it("row ids are primary keys across all accounts: a workspace needs fresh ids to go into a second account", async () => {
    await ensureDemo()
    const sameIds = rowsOf(DEMO, "content_goals").map((row) => ({ ...row, user_id: B }))
    await expect(withRole(db, "authenticated", B, (tx) => insertJson(tx, "content_goals", sameIds))).rejects.toThrow(
      /duplicate key value violates unique constraint "content_goals_pkey"/
    )

    const { db: copy } = rekeyWorkspace(DEMO)
    await withRole(db, "authenticated", B, async (tx) => {
      for (const table of TABLE_NAMES) await insertJson(tx, table, rowsOf(copy, table).map((row) => ({ ...row, user_id: B })))
      for (const table of TABLE_NAMES) expect(await count(tx, table), table).toBe(rowsOf(DEMO, table).length)
      await tx.rollback()
    })
  })
})

describe("auth users", () => {
  it("sign-up creates the public.users profile, and email changes sync to it", async () => {
    const [profile] = await selectJson(db, "users", "where id = $1", [A])
    expect(profile).toMatchObject({ email: "a@example.com", full_name: "Ana Reyes", avatar_url: null })
    await db.transaction(async (tx) => {
      await tx.query("update auth.users set email = 'ana@example.com' where id = $1", [A])
      const [synced] = await selectJson(tx, "users", "where id = $1", [A])
      expect(synced.email).toBe("ana@example.com")
      await tx.rollback()
    })
  })

  it("deleting an account removes every row it owns and nothing else", async () => {
    await ensureDemo()
    await db.transaction(async (tx) => {
      await setRequestRole(tx, "authenticated", B)
      await tx.query("insert into public.tags (name) values ('b stays')")
      await tx.exec("reset role")
      await tx.query("delete from auth.users where id = $1", [A])
      const left: string[] = []
      for (const table of TABLE_NAMES) if (await count(tx, table, "where user_id = $1", [A])) left.push(table)
      expect(left).toEqual([])
      expect(await count(tx, "users", "where id = $1", [A])).toBe(0)
      expect(await count(tx, "tags", "where user_id = $1", [B])).toBe(1)
      expect(await count(tx, "users", "where id = $1", [B])).toBe(1)
      await tx.rollback()
    })
  })
})
