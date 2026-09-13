import type { SupabaseClient } from "@supabase/supabase-js"
import type { DataAdapter } from "@/lib/data/adapter"
import { normalizeDatabase, TABLE_NAMES } from "@/lib/data/defaults"
import type { ContentItem, Database, ID, Row, TableName } from "@/lib/types"

const PAGE_SIZE = 1000
const WRITE_CHUNK = 500

function fail(table: string, action: string, message: string): never {
  throw new Error(`${action} ${table} failed: ${message}`)
}

/** Items whose parent is in the same batch must be inserted after the parent. */
function parentsFirst(rows: ContentItem[]): ContentItem[] {
  const ids = new Set(rows.map((r) => r.id))
  const placed = new Set<ID>()
  const out: ContentItem[] = []
  let remaining = rows
  while (remaining.length) {
    const next: ContentItem[] = []
    for (const row of remaining) {
      if (!row.parent_id || !ids.has(row.parent_id) || placed.has(row.parent_id)) {
        out.push(row)
        placed.add(row.id)
      } else next.push(row)
    }
    if (next.length === remaining.length) return [...out, ...next] // cycle guard
    remaining = next
  }
  return out
}

/**
 * Postgres-backed adapter. Row-level security scopes every query to the signed-in
 * user, so selects need no explicit user filter. Foreign keys handle
 * ON DELETE CASCADE / SET NULL; this adapter only sends the effects Postgres
 * can't express (array-reference cleanup and polymorphic tag links).
 */
export function createSupabaseAdapter(client: SupabaseClient, userId: string): DataAdapter {
  async function fetchAll(table: TableName): Promise<unknown[]> {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) fail(table, "Loading", error.message)
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) break
    }
    return rows
  }

  async function insertRows(table: TableName, rows: Row<TableName>[]) {
    const ordered = table === "content_items" ? parentsFirst(rows as ContentItem[]) : rows
    for (let i = 0; i < ordered.length; i += WRITE_CHUNK) {
      const chunk = ordered.slice(i, i + WRITE_CHUNK).map((r) => ({ ...r, user_id: userId }))
      const { error } = await client.from(table).insert(chunk)
      if (error) fail(table, "Saving", error.message)
    }
  }

  async function deleteIds(table: TableName, ids: ID[]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await client.from(table).delete().in("id", ids.slice(i, i + 200))
      if (error) fail(table, "Deleting from", error.message)
    }
  }

  return {
    mode: "supabase",
    async load() {
      const entries = await Promise.all(TABLE_NAMES.map(async (t) => [t, await fetchAll(t)] as const))
      const db = normalizeDatabase(Object.fromEntries(entries) as Partial<Database>)
      return { db, userId, isFirstRun: db.brand_profiles.length === 0 }
    },
    async insert(table, rows) {
      if (rows.length) await insertRows(table, rows as Row<TableName>[])
    },
    async update(table, id, patch) {
      const { error } = await client.from(table).update(patch).eq("id", id)
      if (error) fail(table, "Updating", error.message)
    },
    async remove(table, ids, plan) {
      for (const [t, patches] of plan.patches) {
        for (const [id, patch] of patches) {
          const arrayPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => Array.isArray(v)))
          if (Object.keys(arrayPatch).length) {
            const { error } = await client.from(t).update(arrayPatch).eq("id", id)
            if (error) fail(t, "Updating", error.message)
          }
        }
      }
      const tagLinks = plan.deletes.get("content_tags")
      if (table !== "content_tags" && tagLinks?.size) await deleteIds("content_tags", [...tagLinks])
      await deleteIds(table, ids)
    },
    async replaceAll(db) {
      for (const t of [...TABLE_NAMES].reverse()) {
        const { error } = await client.from(t).delete().eq("user_id", userId)
        if (error) fail(t, "Clearing", error.message)
      }
      for (const t of TABLE_NAMES) {
        const rows = db[t] as Row<TableName>[]
        if (rows.length) await insertRows(t, rows)
      }
    },
  }
}
