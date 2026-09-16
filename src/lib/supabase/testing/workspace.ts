/**
 * Test-only helpers for comparing Postgres with the in-memory rules in `relations.ts`.
 */
import { buildRow, TABLE_NAMES } from "@/lib/data/defaults"
import { REFERENCES, TAGGABLE_TABLES, type DeletePlan } from "@/lib/data/relations"
import type { Database, ID, TableName } from "@/lib/types"
import type { JsonRow } from "./pglite"

export function rowsOf(db: Database, table: TableName): JsonRow[] {
  return (db[table] ?? []) as unknown as JsonRow[]
}

/**
 * Adds one all-defaults row to every table the workspace leaves empty (the demo has no AI log, and
 * new tables may land before their demo rows), so every table and reference is still exercised.
 * Returns the tables that were filled.
 */
export function fillEmptyTables(db: Database, userId: string, now: Date): { db: Database; filled: TableName[] } {
  const filled = TABLE_NAMES.filter((t) => rowsOf(db, t).length === 0)
  const out = { ...db } as unknown as Record<TableName, unknown[]>
  for (const t of filled) out[t] = [buildRow(t, {}, userId, now)]
  return { db: out as unknown as Database, filled }
}

/** The workspace after a delete, exactly as the store applies a plan in memory. */
export function applyPlan(db: Database, plan: DeletePlan): Database {
  const out = { ...db } as unknown as Record<TableName, JsonRow[]>
  for (const [table, patches] of plan.patches) {
    out[table] = rowsOf(db, table).map((row) => (patches.has(row.id as ID) ? { ...row, ...patches.get(row.id as ID) } : row))
  }
  for (const [table, ids] of plan.deletes) {
    out[table] = (out[table] ?? rowsOf(db, table)).filter((row) => !ids.has(row.id as ID))
  }
  return out as unknown as Database
}

/**
 * The part of a plan Postgres enforces by itself (foreign keys and the converted_item_id trigger).
 * Array references and polymorphic tag links are the app's job: the Supabase adapter sends them.
 */
export function databaseEnforcedPart(db: Database, plan: DeletePlan): DeletePlan {
  const deletes = new Map(plan.deletes)
  const links = plan.deletes.get("content_tags")
  if (links) {
    const deletedTags = plan.deletes.get("tags") ?? new Set<ID>()
    const viaTag = db.content_tags.filter((l) => links.has(l.id) && deletedTags.has(l.tag_id)).map((l) => l.id)
    if (viaTag.length) deletes.set("content_tags", new Set(viaTag))
    else deletes.delete("content_tags")
  }
  const patches = new Map<TableName, Map<ID, Record<string, unknown>>>()
  for (const [table, rows] of plan.patches) {
    const kept = new Map<ID, Record<string, unknown>>()
    for (const [id, patch] of rows) {
      const scalar = Object.fromEntries(Object.entries(patch).filter(([, value]) => !Array.isArray(value)))
      if (Object.keys(scalar).length) kept.set(id, scalar)
    }
    if (kept.size) patches.set(table, kept)
  }
  return { deletes, patches }
}

export interface RowPatch {
  table: TableName
  id: ID
  patch: Record<string, unknown>
}

export interface DeleteCase {
  name: string
  table: TableName
  id: ID
  /** Points a child at the parent first when the demo has no child through this reference. */
  setup: RowPatch | null
}

export function patchWorkspace(db: Database, setup: RowPatch | null): Database {
  if (!setup) return db
  return {
    ...db,
    [setup.table]: rowsOf(db, setup.table).map((row) => (row.id === setup.id ? { ...row, ...setup.patch } : row)),
  } as Database
}

/**
 * One delete per relations.ts reference (and per taggable table for the polymorphic tag links), each
 * on a parent row that really has a child through that reference. Data-driven: new references and
 * tables are picked up automatically. `missing` lists references the workspace can't exercise.
 */
export function deleteCases(db: Database): { cases: DeleteCase[]; missing: string[] } {
  const cases: DeleteCase[] = []
  const missing: string[] = []
  for (const [parentName, refs] of Object.entries(REFERENCES)) {
    const parent = parentName as TableName
    const parents = rowsOf(db, parent)
    for (const ref of refs ?? []) {
      const name = `${parent} → ${ref.table}.${ref.column} (${ref.onDelete})`
      const children = rowsOf(db, ref.table)
      const pointsAt = (row: JsonRow, id: unknown) =>
        ref.onDelete === "array_remove" ? Array.isArray(row[ref.column]) && (row[ref.column] as unknown[]).includes(id) : row[ref.column] === id
      const withChild = parents.find((p) => children.some((c) => c.id !== p.id && pointsAt(c, p.id)))
      if (withChild) {
        cases.push({ name, table: parent, id: withChild.id as ID, setup: null })
        continue
      }
      const target = parents[0]
      const child = children.find((c) => c.id !== target?.id)
      if (!target || !child) {
        missing.push(name)
        continue
      }
      const current = Array.isArray(child[ref.column]) ? (child[ref.column] as unknown[]) : []
      const value = ref.onDelete === "array_remove" ? [...current, target.id] : target.id
      cases.push({ name, table: parent, id: target.id as ID, setup: { table: ref.table, id: child.id as ID, patch: { [ref.column]: value } } })
    }
  }
  for (const table of TAGGABLE_TABLES) {
    const name = `${table} → content_tags.entity_id (polymorphic)`
    const ids = new Set(rowsOf(db, table).map((r) => r.id))
    const link = db.content_tags.find((l) => l.entity_type === table && ids.has(l.entity_id))
    if (link) {
      cases.push({ name, table, id: link.entity_id, setup: null })
      continue
    }
    const target = rowsOf(db, table)[0]
    const anyLink = db.content_tags[0]
    if (!target || !anyLink) {
      missing.push(name)
      continue
    }
    cases.push({ name, table, id: target.id as ID, setup: { table: "content_tags", id: anyLink.id, patch: { entity_type: table, entity_id: target.id } } })
  }
  return { cases, missing }
}
