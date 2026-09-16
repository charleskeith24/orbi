/**
 * Gives a whole workspace fresh row ids and rewrites every reference to them: foreign keys, array
 * references, polymorphic ids (tag links, AI log entries, idea sources) and ids nested inside JSON
 * (review stats, AI input/output).
 *
 * Why: in Postgres a row id is a primary key shared by every account. Workspaces started in a browser
 * all use the same local owner id, so their Starter Kit rows get the same ids on the same calendar day,
 * and a backup file can be imported into more than one account. Either would fail with
 * "duplicate key value violates unique constraint …_pkey". Fresh ids make any workspace importable.
 *
 * Every string that exactly equals a row id is treated as a reference to it (ids are UUIDs, so user
 * text never matches by accident); `user_id` is left for the caller to set.
 */
import { TABLE_NAMES } from "@/lib/data/defaults"
import type { Database, ID, TableName } from "@/lib/types"
import { uid } from "@/lib/utils"

export interface RekeyResult {
  db: Database
  /** Old id → new id, for every row. */
  idMap: Map<ID, ID>
}

export function rekeyWorkspace(db: Database, newId: () => ID = uid): RekeyResult {
  const idMap = new Map<ID, ID>()
  for (const table of TABLE_NAMES) {
    for (const row of (db[table] ?? []) as { id: ID }[]) {
      if (typeof row.id === "string" && !idMap.has(row.id)) idMap.set(row.id, newId())
    }
  }

  const remap = (value: unknown): unknown => {
    if (typeof value === "string") return idMap.get(value) ?? value
    if (Array.isArray(value)) return value.map(remap)
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, remap(v)]))
    }
    return value
  }

  const out = {} as Record<TableName, unknown[]>
  for (const table of TABLE_NAMES) {
    out[table] = ((db[table] ?? []) as unknown as Record<string, unknown>[]).map((row) => {
      const next: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) next[key] = key === "user_id" ? value : remap(value)
      return next
    })
  }
  return { db: out as unknown as Database, idMap }
}
