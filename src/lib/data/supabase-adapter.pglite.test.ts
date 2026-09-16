/**
 * The real Supabase adapter against real Postgres. supabase-adapter.ts runs unchanged on a stand-in
 * for supabase-js / PostgREST (testing/postgrest-fake.ts) that executes every request on PGlite the
 * way PostgREST does: as the signed-in user under RLS, rows in and out as JSON.
 *
 * Covers load / insert / update / remove / replaceAll, every relations.ts rule end to end (including
 * the array and tag-link cleanup only the adapter can do), failure recovery, and local → cloud moves.
 */
import type { PGlite, Transaction } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { buildRow, TABLE_NAMES } from "@/lib/data/defaults"
import { LOCAL_USER_ID } from "@/lib/data/local-adapter"
import { planDelete } from "@/lib/data/relations"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import { createSupabaseAdapter, type ReplaceProgress } from "@/lib/data/supabase-adapter"
import { prepareForAccount } from "@/lib/supabase/move-local"
import {
  canonicalRows,
  columnTypes,
  createAuthUser,
  createSupabaseTestDb,
  ident,
  setRequestRole,
  snapshotTables,
  type JsonRow,
} from "@/lib/supabase/testing/pglite"
import { createFakeSupabase, type FakeSupabaseOptions } from "@/lib/supabase/testing/postgrest-fake"
import { applyPlan, deleteCases, fillEmptyTables, patchWorkspace, rowsOf } from "@/lib/supabase/testing/workspace"
import type { Database } from "@/lib/types"

const USERS = {
  A: "a0000000-0000-4000-8000-00000000000a",
  B: "b0000000-0000-4000-8000-00000000000b",
  C: "c0000000-0000-4000-8000-00000000000c",
  D: "d0000000-0000-4000-8000-00000000000d",
  E: "e0000000-0000-4000-8000-00000000000e",
}
const { A, B, C, D, E } = USERS
const NOW = new Date("2026-09-10T09:00:00.000Z")
const DEMO: Database = fillEmptyTables(createDemoDatabase(A, NOW), A, NOW).db
const { cases: DELETE_CASES } = deleteCases(DEMO)

// PGlite is CPU-heavy WASM: under the full parallel suite a single test can take several seconds.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

let db: PGlite
let types: Map<string, Map<string, string>>

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  types = await columnTypes(db)
  for (const [name, id] of Object.entries(USERS)) await createAuthUser(db, { id, email: `${name.toLowerCase()}@example.com` })
}, 180_000)

afterAll(async () => {
  await db?.close()
})

function adapterFor(userId: string, options?: FakeSupabaseOptions, q: PGlite | Transaction = db) {
  const fake = createFakeSupabase(q, userId, options)
  return { adapter: createSupabaseAdapter(fake.client, userId), ...fake }
}

function expectSameWorkspace(actual: Database | Record<string, JsonRow[]>, expected: Database, omit: string[] = []) {
  for (const t of TABLE_NAMES) {
    expect(canonicalRows(rowsOf(actual as Database, t), types.get(t), omit), t).toEqual(canonicalRows(rowsOf(expected, t), types.get(t), omit))
  }
}

let demoImport: Promise<ReplaceProgress[]> | null = null
/** Account A holds the demo workspace, written once through adapter.replaceAll. */
function ensureDemo(): Promise<ReplaceProgress[]> {
  demoImport ??= (async () => {
    const { adapter } = adapterFor(A)
    const progress: ReplaceProgress[] = []
    const stop = adapter.trackReplace((p) => progress.push(p))
    try {
      await adapter.replaceAll(DEMO)
    } finally {
      stop()
    }
    return progress
  })()
  return demoImport
}

/** Runs `fn` in a transaction that is rolled back afterwards; the adapter's requests become savepoints. */
async function inRolledBackTransaction<T>(userId: string, fn: (ctx: ReturnType<typeof adapterFor> & { tx: Transaction }) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await fn({ ...adapterFor(userId, { nested: true }, tx), tx })
    await tx.rollback()
    return result
  })
}

describe("Supabase adapter on Postgres", () => {
  it("load(): a new account starts empty and is flagged as a first run", async () => {
    const { db: loaded, userId, isFirstRun } = await adapterFor(C).adapter.load()
    expect(userId).toBe(C)
    expect(isFirstRun).toBe(true)
    expect(TABLE_NAMES.filter((t) => loaded[t].length)).toEqual([])
  })

  it("replaceAll(): writes the whole workspace in TABLE_NAMES order, and load() reads it back unchanged", async () => {
    await ensureDemo()
    const { adapter, requests } = adapterFor(A)
    const { db: loaded, isFirstRun } = await adapter.load()
    expect(isFirstRun).toBe(false)
    expectSameWorkspace(loaded, DEMO)
    expect(requests.every((r) => r.method === "select")).toBe(true)
  })

  it("replaceAll(): reports progress row by row up to the total", async () => {
    const progress = await ensureDemo()
    const total = TABLE_NAMES.reduce((n, t) => n + DEMO[t].length, 0)
    expect(progress[0]).toMatchObject({ phase: "clearing", done: 0, total })
    expect(progress.at(-1)).toMatchObject({ phase: "saving", done: total, total })
    const saved = progress.filter((p) => p.phase === "saving")
    expect(saved.map((p) => p.done)).toEqual([...saved.map((p) => p.done)].sort((a, b) => a - b))
    const tables = [...new Set(saved.map((p) => p.table))]
    expect(tables).toEqual(TABLE_NAMES.filter((t) => DEMO[t].length))
  })

  it("load(): reads past one page even when rows share created_at", async () => {
    const createdAt = new Date("2026-09-01T00:00:00.000Z")
    const rows = Array.from({ length: 1100 }, () => buildRow("engagement_logs", { notes: "bulk" }, D, createdAt))
    const { adapter } = adapterFor(D)
    await adapter.insert("engagement_logs", rows)
    const { db: loaded } = await adapter.load()
    const ids = loaded.engagement_logs.map((r) => r.id)
    expect(ids).toHaveLength(1100)
    expect(new Set(ids).size).toBe(1100)
  })

  it("update(): saves the patch, and fails loudly when no row matches instead of losing the edit", async () => {
    await ensureDemo()
    const idea = DEMO.content_ideas[0]
    await inRolledBackTransaction(A, async ({ adapter }) => {
      await adapter.update("content_ideas", idea.id, { title: "Renamed in the cloud", updated_at: NOW.toISOString() })
      const { db: loaded } = await adapter.load()
      expect(loaded.content_ideas.find((r) => r.id === idea.id)?.title).toBe("Renamed in the cloud")
      await expect(adapter.update("content_ideas", "f0000000-0000-4000-8000-00000000000f", { title: "gone" })).rejects.toThrow(/no longer exists/)
    })
    // Another account's row is invisible under RLS, so it can't be edited either.
    await inRolledBackTransaction(B, async ({ adapter }) => {
      await expect(adapter.update("content_ideas", idea.id, { title: "hijack" })).rejects.toThrow(/no longer exists/)
    })
  })

  it("insert(): drops fields the schema doesn't have (rows saved by an older app version)", async () => {
    await inRolledBackTransaction(E, async ({ adapter, client }) => {
      const row = { ...buildRow("tags", { name: "legacy" }, E, NOW), legacy_color: "red" }
      // What the unfiltered row does to PostgREST:
      const { error } = await client.from("tags").insert([row])
      expect(error?.code).toBe("PGRST204")
      await adapter.insert("tags", [row])
      const { db: loaded } = await adapter.load()
      expect(loaded.tags.map((t) => t.name)).toEqual(["legacy"])
    })
  })

  it.each(DELETE_CASES)("remove(): $name — Postgres ends up exactly like the in-memory store", async ({ table, id, setup }) => {
    await ensureDemo()
    const base = patchWorkspace(DEMO, setup)
    const plan = planDelete(base, table, [id])
    const expected = applyPlan(base, plan)
    const actual = await inRolledBackTransaction(A, async ({ adapter, tx }) => {
      if (setup) {
        const columns = Object.keys(setup.patch).map(ident)
        await tx.query(
          `update public.${ident(setup.table)} as t set ${columns.map((c) => `${c} = p.${c}`).join(", ")}
             from json_populate_record(null::public.${ident(setup.table)}, $1::json) as p where t.id = $2`,
          [JSON.stringify(setup.patch), setup.id]
        )
      }
      await adapter.remove(table, [id], plan)
      await setRequestRole(tx, "authenticated", A)
      return snapshotTables(tx, TABLE_NAMES)
    })
    expectSameWorkspace(actual, expected, ["updated_at"])
  })

  it("replaceAll(): a row Postgres rejects part-way puts the previous workspace back", async () => {
    await ensureDemo()
    const bad = structuredClone(DEMO)
    bad.content_metrics[bad.content_metrics.length - 1].views = 1.5 // integer column
    await expect(adapterFor(A).adapter.replaceAll(bad)).rejects.toThrow(/invalid input syntax for type integer[\s\S]*Nothing was changed/)
    expectSameWorkspace((await adapterFor(A).adapter.load()).db, DEMO)
  })

  it("replaceAll(): a dropped connection part-way puts the previous workspace back", async () => {
    await ensureDemo()
    let dropped = false
    const { adapter } = adapterFor(A, {
      intercept: (r) => {
        if (dropped || r.method !== "insert" || r.table !== "content_items") return null
        dropped = true
        return { code: "", message: "TypeError: fetch failed", details: null, hint: null }
      },
    })
    await expect(adapter.replaceAll(DEMO)).rejects.toThrow(/fetch failed[\s\S]*Nothing was changed/)
    expectSameWorkspace((await adapterFor(A).adapter.load()).db, DEMO)
  })

  it("replaceAll(): when the connection stays down, the error says the restore failed and what to do", async () => {
    await ensureDemo()
    await db.transaction(async (tx) => {
      const offline = { code: "", message: "TypeError: fetch failed", details: null, hint: null }
      const { adapter } = adapterFor(A, { nested: true, intercept: (r) => (r.method === "insert" && r.table === "content_items" ? offline : null) }, tx)
      await expect(adapter.replaceAll(DEMO)).rejects.toThrow(/Restoring the previous workspace failed too[\s\S]*Export this workspace/)
      await tx.rollback()
    })
  })
})

describe("local → cloud", () => {
  it("every browser's local workspace has the same Starter Kit ids, so a second account needs fresh ids", async () => {
    const day = new Date(2026, 8, 10, 12)
    const browser1 = createStarterDatabase(LOCAL_USER_ID, day)
    const browser2 = createStarterDatabase(LOCAL_USER_ID, day)
    expect(browser2.content_formats.map((r) => r.id)).toEqual(browser1.content_formats.map((r) => r.id))

    await adapterFor(B).adapter.replaceAll(browser1)
    // As-is, browser 2's workspace collides with B's rows on primary keys — and C is left as it was.
    await expect(adapterFor(C).adapter.replaceAll(browser2)).rejects.toThrow(/_pkey[\s\S]*Nothing was changed/)
    const afterFailure = (await adapterFor(C).adapter.load()).db
    expect(TABLE_NAMES.filter((t) => afterFailure[t].length)).toEqual([])

    const prepared = prepareForAccount(browser2, C)
    await adapterFor(C).adapter.replaceAll(prepared)
    expectSameWorkspace((await adapterFor(C).adapter.load()).db, prepared)
  })

  it("moves a complete workspace (every table and reference) into an empty account", async () => {
    const local = fillEmptyTables(createDemoDatabase(LOCAL_USER_ID, NOW), LOCAL_USER_ID, NOW).db
    const prepared = prepareForAccount(local, E)
    const { adapter } = adapterFor(E)
    await adapter.replaceAll(prepared)
    const { db: loaded } = await adapter.load()
    expectSameWorkspace(loaded, prepared)
    expect(loaded.brand_profiles[0].onboarding_completed).toBe(local.brand_profiles[0].onboarding_completed)
  })
})
