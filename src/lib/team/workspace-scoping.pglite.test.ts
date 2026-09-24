/**
 * The Supabase adapter's workspace scoping, on real Postgres with real row-level security.
 *
 * The whole point of team workspaces is that a person in two workspaces never loads or writes the wrong
 * one's rows. RLS alone can't do that — it happily returns both — so the adapter names the workspace in
 * every request. These tests prove it: two full workspaces, one account that is an editor in one and a
 * viewer in the other, and the adapter run unchanged through the PostgREST stand-in.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { TABLE_NAMES } from "@/lib/data/defaults"
import { createDemoDatabase } from "@/lib/data/seed"
import { createSupabaseAdapter, SupabaseDataError } from "@/lib/data/supabase-adapter"
import { createAuthUser, createSupabaseTestDb, insertJson, type JsonRow } from "@/lib/supabase/testing/pglite"
import { createFakeSupabase } from "@/lib/supabase/testing/postgrest-fake"
import { fillEmptyTables, rowsOf } from "@/lib/supabase/testing/workspace"
import type { WorkspaceAccess } from "@/lib/team/permissions"
import type { Database } from "@/lib/types"

vi.setConfig({ testTimeout: 120_000, hookTimeout: 240_000 })

const MIKA = "a0000000-0000-4000-8000-00000000aa01"
const JUN = "b0000000-0000-4000-8000-00000000bb01"
const ANA = "c0000000-0000-4000-8000-00000000cc01"
const NOW = new Date("2026-09-10T09:00:00.000Z")

const EDITOR: WorkspaceAccess = { role: "editor", moneyAccess: false }
const EDITOR_MONEY: WorkspaceAccess = { role: "editor", moneyAccess: true }
const VIEWER: WorkspaceAccess = { role: "viewer", moneyAccess: false }

let db: PGlite

/** An adapter for `userId` working in `ownerId`'s workspace (omit both for their own). */
function adapterFor(userId: string, workspace?: { ownerId: string; access: WorkspaceAccess }) {
  const fake = createFakeSupabase(db, userId)
  return { adapter: createSupabaseAdapter(fake.client, userId, workspace), ...fake }
}

async function seedWorkspace(ownerId: string): Promise<Database> {
  const workspace = fillEmptyTables(createDemoDatabase(ownerId, NOW), ownerId, NOW).db
  for (const table of TABLE_NAMES) {
    const rows = rowsOf(workspace, table).map((r) => ({ ...r, user_id: ownerId }) as JsonRow)
    if (rows.length) await insertJson(db, table, rows)
  }
  return workspace
}

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  for (const [id, email] of [
    [MIKA, "mika@example.com"],
    [JUN, "jun@example.com"],
    [ANA, "ana@example.com"],
  ]) {
    await createAuthUser(db, { id, email })
  }
  await seedWorkspace(MIKA)
  await seedWorkspace(ANA)
  // Jun edits Mika's workspace and only views Ana's — a member of two workspaces at once.
  await db.query(
    `insert into public.workspace_members (owner_id, user_id, role, money_access) values ($1, $3, 'editor', false), ($2, $3, 'viewer', false)`,
    [MIKA, ANA, JUN]
  )
  // Jun has his own account settings (his own workspace is still empty otherwise).
  await insertJson(db, "app_settings", [{ user_id: JUN, ui_language: "tl", simple_mode: false }])
}, 240_000)

afterAll(async () => {
  await db?.close()
})

const ownersIn = (workspace: Database) => new Set(TABLE_NAMES.flatMap((t) => rowsOf(workspace, t).map((r) => (r as { user_id: string }).user_id)))

describe("load", () => {
  it("names the workspace in every select, so a member of two never mixes rows", async () => {
    const { adapter, requests } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    const { db: loaded, ownerId, access } = await adapter.load()
    expect(ownerId).toBe(MIKA)
    expect(access).toEqual(EDITOR)
    expect([...ownersIn(loaded)]).toEqual([MIKA])
    expect(loaded.content_items.length).toBeGreaterThan(0)
    // Every table was asked for by workspace (the stand-in records one request per select).
    expect(requests.filter((r) => r.method === "select").length).toBeGreaterThanOrEqual(TABLE_NAMES.length - 3)
  })

  it("loads the other workspace, from the same account, without a trace of the first", async () => {
    const { adapter } = adapterFor(JUN, { ownerId: ANA, access: VIEWER })
    const { db: loaded } = await adapter.load()
    expect([...ownersIn(loaded)]).toEqual([ANA])
    expect(loaded.content_items.length).toBeGreaterThan(0)
  })

  it("loads the owner's own workspace when no workspace is named", async () => {
    const { adapter } = adapterFor(MIKA)
    const { db: loaded, ownerId, access } = await adapter.load()
    expect(ownerId).toBe(MIKA)
    expect(access).toEqual({ role: "owner", moneyAccess: true })
    expect([...ownersIn(loaded)]).toEqual([MIKA])
  })

  it("leaves Money empty for a member without Money access, and never asks for it", async () => {
    const { adapter, requests } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    const { db: loaded } = await adapter.load()
    expect(loaded.brand_deals).toEqual([])
    expect(loaded.income_entries).toEqual([])
    expect(loaded.rate_cards).toEqual([])
    expect(requests.filter((r) => ["brand_deals", "income_entries", "rate_cards"].includes(r.table))).toEqual([])
  })

  it("loads Money once the owner grants access", async () => {
    await db.query("update public.workspace_members set money_access = true where owner_id = $1 and user_id = $2", [MIKA, JUN])
    try {
      const { adapter } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR_MONEY })
      const { db: loaded } = await adapter.load()
      expect(loaded.brand_deals.length).toBeGreaterThan(0)
      expect(loaded.brand_deals.every((d) => d.user_id === MIKA)).toBe(true)
    } finally {
      await db.query("update public.workspace_members set money_access = false where owner_id = $1 and user_id = $2", [MIKA, JUN])
    }
  })

  it("never reports a first run in someone else's workspace", async () => {
    const EMPTY = "d0000000-0000-4000-8000-00000000dd01"
    await createAuthUser(db, { id: EMPTY, email: "empty@example.com" })
    await db.query(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'editor')`, [EMPTY, JUN])
    const { adapter } = adapterFor(JUN, { ownerId: EMPTY, access: EDITOR })
    const { db: loaded, isFirstRun } = await adapter.load()
    expect(loaded.brand_profiles).toEqual([])
    expect(isFirstRun).toBe(false)
    // The owner of that same empty workspace does see a first run.
    expect((await adapterFor(EMPTY).adapter.load()).isFirstRun).toBe(true)
    await db.query("delete from public.workspace_members where owner_id = $1", [EMPTY])
  })
})

describe("insert", () => {
  it("stamps the active workspace's owner, not the signed-in account", async () => {
    const { adapter } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    const id = crypto.randomUUID()
    // `user_id` deliberately wrong on the way in: the adapter must overwrite it.
    await adapter.insert("content_ideas", [{ id, title: "From the VA", user_id: JUN } as never])
    const { rows } = await db.query<{ user_id: string }>("select user_id from public.content_ideas where id = $1", [id])
    expect(rows).toEqual([{ user_id: MIKA }])
    await db.query("delete from public.content_ideas where id = $1", [id])
  })

  it("refuses a write the role can't make before it reaches the database", async () => {
    const { adapter, requests } = adapterFor(JUN, { ownerId: ANA, access: VIEWER })
    await expect(adapter.insert("content_ideas", [{ title: "No" } as never])).rejects.toThrow(SupabaseDataError)
    await expect(adapter.insert("content_ideas", [{ title: "No" } as never])).rejects.toMatchObject({ code: "forbidden" })
    expect(requests).toEqual([])
  })

  it("refuses an editor's write to a table only the owner may change", async () => {
    const { adapter } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    await expect(adapter.insert("content_pillars", [{ name: "Mine" } as never])).rejects.toMatchObject({ code: "forbidden" })
    await expect(adapter.insert("brand_deals", [{ brand_name: "X" } as never])).rejects.toMatchObject({ code: "forbidden" })
  })

  it("still lets Postgres be the real guard when the client is wrong about the role", async () => {
    // A tampered client that claims to be an editor is still only a viewer to Postgres.
    const { adapter } = adapterFor(JUN, { ownerId: ANA, access: EDITOR })
    await expect(adapter.insert("content_ideas", [{ title: "Sneaky" } as never])).rejects.toThrow(/row-level security|Saving content_ideas failed/)
  })
})

describe("update and delete", () => {
  it("lets an editor change a content row of the workspace they are in", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.content_ideas where user_id = $1 limit 1", [MIKA])
    const { adapter } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    await adapter.update("content_ideas", rows[0].id, { title: "Reviewed by the VA" })
    const after = await db.query<{ title: string }>("select title from public.content_ideas where id = $1", [rows[0].id])
    expect(after.rows[0].title).toBe("Reviewed by the VA")
  })

  it("refuses a viewer's update and delete without a request", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.content_ideas where user_id = $1 limit 1", [ANA])
    const { adapter, requests } = adapterFor(JUN, { ownerId: ANA, access: VIEWER })
    await expect(adapter.update("content_ideas", rows[0].id, { title: "no" })).rejects.toMatchObject({ code: "forbidden" })
    await expect(adapter.remove("content_ideas", [rows[0].id], { deletes: new Map(), patches: new Map() })).rejects.toMatchObject({
      code: "forbidden",
    })
    expect(requests).toEqual([])
  })

  it("refuses to replace a workspace that isn't yours", async () => {
    const { adapter } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    await expect(adapter.replaceAll(createDemoDatabase(MIKA, NOW))).rejects.toMatchObject({ code: "forbidden" })
  })
})

describe("personal preferences", () => {
  it("come from the member's own row and go back to it, never to the owner's", async () => {
    await db.query("update public.app_settings set ui_language = 'en', simple_mode = true where user_id = $1", [MIKA])
    expect((await db.query("update public.app_settings set ui_language = 'tl', simple_mode = false where user_id = $1", [JUN])).affectedRows).toBe(1)

    const { adapter } = adapterFor(JUN, { ownerId: MIKA, access: EDITOR })
    const { db: loaded, personal } = await adapter.load()
    expect(personal).toEqual({ ui_language: "tl", simple_mode: false })
    // Mika's workspace, experienced in Jun's language.
    expect(loaded.app_settings[0].ui_language).toBe("tl")
    expect(loaded.app_settings[0].simple_mode).toBe(false)
    expect(loaded.app_settings[0].user_id).toBe(MIKA)

    // Jun switches to English while in Mika's workspace.
    await adapter.update("app_settings", loaded.app_settings[0].id, { ui_language: "en", weekly_post_target: 99 })
    const mika = await db.query<{ ui_language: string; weekly_post_target: number }>(
      "select ui_language, weekly_post_target from public.app_settings where user_id = $1",
      [MIKA]
    )
    const jun = await db.query<{ ui_language: string }>("select ui_language from public.app_settings where user_id = $1", [JUN])
    expect(jun.rows[0].ui_language).toBe("en")
    // The owner's row is untouched — language and the workspace setting the member tried to smuggle in.
    expect(mika.rows[0].ui_language).toBe("en")
    expect(mika.rows[0].weekly_post_target).not.toBe(99)
  })

  it("are the owner's own settings row in their own workspace", async () => {
    const { adapter } = adapterFor(MIKA)
    const { personal, db: loaded } = await adapter.load()
    expect(personal).toBeNull()
    await adapter.update("app_settings", loaded.app_settings[0].id, { weekly_post_target: 7 })
    const after = await db.query<{ weekly_post_target: number }>("select weekly_post_target from public.app_settings where user_id = $1", [MIKA])
    expect(Number(after.rows[0].weekly_post_target)).toBe(7)
  })

  it("creates a settings row for a member who has none yet", async () => {
    const FRESH = "e0000000-0000-4000-8000-00000000ee01"
    await createAuthUser(db, { id: FRESH, email: "fresh@example.com" })
    await db.query(`insert into public.workspace_members (owner_id, user_id, role) values ($1, $2, 'editor')`, [MIKA, FRESH])
    const { adapter } = adapterFor(FRESH, { ownerId: MIKA, access: EDITOR })
    const { personal } = await adapter.load()
    expect(personal).toBeNull()
    await adapter.savePersonal!({ ui_language: "tl" })
    const { rows } = await db.query<{ ui_language: string }>("select ui_language from public.app_settings where user_id = $1", [FRESH])
    expect(rows).toEqual([{ ui_language: "tl" }])
  })
})
