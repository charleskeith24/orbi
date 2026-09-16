import type { SupabaseClient } from "@supabase/supabase-js"
import type { DataAdapter } from "@/lib/data/adapter"
import { normalizeDatabase, TABLE_DEFAULTS, TABLE_NAMES } from "@/lib/data/defaults"
import type { ContentItem, Database, ID, TableName } from "@/lib/types"

const PAGE_SIZE = 1000
const WRITE_CHUNK = 500
const META_COLUMNS = ["id", "user_id", "created_at", "updated_at"]

/** The columns each workspace table has in Postgres (kept equal to TABLE_DEFAULTS by the parity test). */
const COLUMNS = Object.fromEntries(
  TABLE_NAMES.map((t) => [t, new Set([...Object.keys(TABLE_DEFAULTS[t]), ...META_COLUMNS])])
) as Record<TableName, Set<string>>

type Record_ = Record<string, unknown>

export interface ReplaceProgress {
  /** `clearing` the account, `saving` the new rows, or `restoring` the previous rows after a failure. */
  phase: "clearing" | "saving" | "restoring"
  table: TableName | null
  /** Rows saved so far, out of `total`. */
  done: number
  total: number
}

export interface SupabaseDataAdapter extends DataAdapter {
  readonly mode: "supabase"
  /** Receives progress from every `replaceAll` while subscribed (import, local → cloud). Returns an unsubscribe. */
  trackReplace(listener: (progress: ReplaceProgress) => void): () => void
}

/** A failed read or write. `code` is the Postgres / PostgREST code when there is one (e.g. `23505`). */
export class SupabaseDataError extends Error {
  readonly code: string | null
  constructor(message: string, code: string | null = null) {
    super(message)
    this.name = "SupabaseDataError"
    this.code = code
  }
}

function fail(table: string, action: string, error: { message: string; code?: string | null }): never {
  throw new SupabaseDataError(`${action} ${table} failed: ${error.message}`, error.code || null)
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Keeps only columns the table has. A row saved by an older app version can carry a field that no
 * longer exists, and PostgREST rejects the whole request for one unknown key (PGRST204).
 */
function toColumns(table: TableName, row: Record_): Record_ {
  const columns = COLUMNS[table]
  const out: Record_ = {}
  for (const [key, value] of Object.entries(row)) if (value !== undefined && columns.has(key)) out[key] = value
  return out
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
export function createSupabaseAdapter(client: SupabaseClient, userId: string): SupabaseDataAdapter {
  const listeners = new Set<(progress: ReplaceProgress) => void>()

  async function fetchAll(table: TableName): Promise<Record_[]> {
    const rows: Record_[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order("created_at", { ascending: true })
        // Rows imported together share created_at; a unique tiebreaker keeps pages from overlapping.
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) fail(table, "Loading", error)
      rows.push(...((data ?? []) as Record_[]))
      if (!data || data.length < PAGE_SIZE) break
    }
    return rows
  }

  async function fetchWorkspace(): Promise<Record<TableName, Record_[]>> {
    const entries = await Promise.all(TABLE_NAMES.map(async (t) => [t, await fetchAll(t)] as const))
    return Object.fromEntries(entries) as Record<TableName, Record_[]>
  }

  /** `raw` rows came from Postgres (a restore) and are written back untouched. */
  async function insertRows(table: TableName, rows: Record_[], options: { raw?: boolean; onChunk?: (count: number) => void } = {}) {
    const ordered = table === "content_items" ? (parentsFirst(rows as unknown as ContentItem[]) as unknown as Record_[]) : rows
    for (let i = 0; i < ordered.length; i += WRITE_CHUNK) {
      const chunk = ordered
        .slice(i, i + WRITE_CHUNK)
        .map((r) => (options.raw ? { ...r, user_id: userId } : { ...toColumns(table, r), user_id: userId }))
      const { error } = await client.from(table).insert(chunk)
      if (error) fail(table, "Saving", error)
      options.onChunk?.(chunk.length)
    }
  }

  async function deleteIds(table: TableName, ids: ID[]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await client.from(table).delete().in("id", ids.slice(i, i + 200))
      if (error) fail(table, "Deleting from", error)
    }
  }

  /** Children first, so no foreign key ever points at a row that is already gone. */
  async function clearAccount() {
    for (const t of [...TABLE_NAMES].reverse()) {
      const { error } = await client.from(t).delete().eq("user_id", userId)
      if (error) fail(t, "Clearing", error)
    }
  }

  return {
    mode: "supabase",
    async load() {
      const db = normalizeDatabase((await fetchWorkspace()) as unknown as Partial<Database>)
      return { db, userId, isFirstRun: db.brand_profiles.length === 0 }
    },
    async insert(table, rows) {
      if (rows.length) await insertRows(table, rows as unknown as Record_[])
    },
    async update(table, id, patch) {
      const values = toColumns(table, patch)
      delete values.id
      delete values.user_id
      if (!Object.keys(values).length) return
      const { data, error } = await client.from(table).update(values).eq("id", id).select("id")
      if (error) fail(table, "Updating", error)
      // PostgREST reports success for an update that matched nothing — say so instead of losing the edit.
      if (!data?.length) {
        throw new SupabaseDataError(`Updating ${table} failed: the row no longer exists (deleted on another device?). Reload to see the latest.`, "not_found")
      }
    },
    async remove(table, ids, plan) {
      for (const [t, patches] of plan.patches) {
        for (const [id, patch] of patches) {
          const arrayPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => Array.isArray(v)))
          if (Object.keys(arrayPatch).length) {
            const { error } = await client.from(t).update(arrayPatch).eq("id", id)
            if (error) fail(t, "Updating", error)
          }
        }
      }
      const tagLinks = plan.deletes.get("content_tags")
      if (table !== "content_tags" && tagLinks?.size) await deleteIds("content_tags", [...tagLinks])
      await deleteIds(table, ids)
    },
    /**
     * Replaces the account's workspace. PostgREST can't wrap many requests in one transaction, so the
     * current rows are read first and written back if any step fails — a dropped connection or a row
     * Postgres rejects never leaves the account half-empty.
     */
    async replaceAll(db) {
      const total = TABLE_NAMES.reduce((sum, t) => sum + db[t].length, 0)
      let done = 0
      const report = (phase: ReplaceProgress["phase"], table: TableName | null) => {
        for (const listener of listeners) listener({ phase, table, done, total })
      }

      report("clearing", null)
      const previous = await fetchWorkspace()
      try {
        await clearAccount()
        for (const t of TABLE_NAMES) {
          const rows = db[t] as unknown as Record_[]
          if (!rows.length) continue
          report("saving", t)
          await insertRows(t, rows, {
            onChunk: (count) => {
              done += count
              report("saving", t)
            },
          })
        }
      } catch (error) {
        const code = error instanceof SupabaseDataError ? error.code : null
        report("restoring", null)
        try {
          await clearAccount()
          for (const t of TABLE_NAMES) if (previous[t].length) await insertRows(t, previous[t], { raw: true })
        } catch (restoreError) {
          throw new SupabaseDataError(
            `${messageOf(error)} Restoring the previous workspace failed too (${messageOf(restoreError)}). Export this workspace from Settings → Data before you reload.`,
            code
          )
        }
        throw new SupabaseDataError(`${messageOf(error)} Nothing was changed — your previous workspace is back.`, code)
      }
    },
    trackReplace(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Narrowing helper for code that holds a plain `DataAdapter`. */
export function isSupabaseAdapter(adapter: DataAdapter | null | undefined): adapter is SupabaseDataAdapter {
  return adapter?.mode === "supabase" && typeof (adapter as Partial<SupabaseDataAdapter>).trackReplace === "function"
}
