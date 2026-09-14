/**
 * Workspace backup files (pure): build the export payload and validate an import before it is
 * allowed anywhere near `replaceWorkspace`.
 */
import type { DataMode } from "@/lib/data/adapter"
import { TABLE_DEFAULTS, TABLE_NAMES } from "@/lib/data/defaults"
import { toISODate } from "@/lib/dates"
import type { Database, TableName } from "@/lib/types"
import { truncate } from "@/lib/utils"

export const WORKSPACE_FORMAT = "personal-brand-os/workspace"
export const WORKSPACE_VERSION = 1

export interface WorkspaceExport {
  format: typeof WORKSPACE_FORMAT
  version: typeof WORKSPACE_VERSION
  app: string
  exported_at: string
  mode: DataMode
  counts: Record<TableName, number>
  db: Database
}

export function workspaceCounts(db: Partial<Database>): Record<TableName, number> {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, db[t]?.length ?? 0])) as Record<TableName, number>
}

export function totalRows(counts: Record<TableName, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

export function buildWorkspaceExport(db: Database, mode: DataMode, now: Date): WorkspaceExport {
  return {
    format: WORKSPACE_FORMAT,
    version: WORKSPACE_VERSION,
    app: "Personal Brand Content OS",
    exported_at: now.toISOString(),
    mode,
    counts: workspaceCounts(db),
    db,
  }
}

export function exportFilename(now: Date): string {
  return `personal-brand-os-workspace-${toISODate(now)}.json`
}

export type WorkspaceParseResult =
  | {
      ok: true
      db: Partial<Database>
      counts: Record<TableName, number>
      totalRows: number
      exportedAt: string | null
      warnings: string[]
    }
  | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WRAPPER_KEYS = new Set(["format", "version", "app", "exported_at", "mode", "counts", "userId", "savedAt"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const KIND_LABEL = { string: "text", number: "a number", boolean: "true or false", array: "a list", object: "an object" } as const
type Kind = keyof typeof KIND_LABEL

function kindOf(value: unknown): Kind | null {
  if (Array.isArray(value)) return "array"
  if (value === null) return null
  const t = typeof value
  return t === "string" || t === "number" || t === "boolean" || t === "object" ? t : null
}

/** Checks each present field against the type of its default (fields whose default is null are free-form). */
function rowShapeError(table: TableName, row: Record<string, unknown>): string | null {
  const defaults = TABLE_DEFAULTS[table] as Record<string, unknown>
  for (const [field, fallback] of Object.entries(defaults)) {
    const expected = kindOf(fallback)
    const value = row[field]
    if (expected === null || value === undefined) continue
    const actual = kindOf(value)
    if (actual !== expected || (actual === "number" && !Number.isFinite(value))) return `“${field}” should be ${KIND_LABEL[expected]}`
  }
  return null
}

/** Parse and validate a workspace export (our own format, the local-storage snapshot, or a bare table map). */
export function parseWorkspaceFile(text: string, options: { requireUuids?: boolean } = {}): WorkspaceParseResult {
  const fail = (error: string): WorkspaceParseResult => ({ ok: false, error })
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail("This file isn't valid JSON.")
  }
  if (!isRecord(data)) return fail("This file doesn't contain a workspace.")
  if (typeof data.format === "string" && data.format !== WORKSPACE_FORMAT) {
    return fail(`This is a “${truncate(data.format, 40)}” file, not an Orbi workspace export.`)
  }
  if (typeof data.version === "number" && data.version > WORKSPACE_VERSION) {
    return fail(`It was exported by a newer version of the app (format v${data.version}). Update the app, then import it.`)
  }

  const source = isRecord(data.db) ? data.db : data
  const known = new Set<string>(TABLE_NAMES)
  const warnings: string[] = []
  const db: Partial<Record<TableName, unknown[]>> = {}
  let tables = 0

  for (const [key, value] of Object.entries(source)) {
    if (!known.has(key)) {
      if (!(source === data && WRAPPER_KEYS.has(key))) warnings.push(`Ignored an unknown section “${truncate(key, 40)}”.`)
      continue
    }
    const table = key as TableName
    if (!Array.isArray(value)) return fail(`“${table}” should be a list of rows.`)
    const ids = new Set<string>()
    for (let i = 0; i < value.length; i++) {
      const row: unknown = value[i]
      if (!isRecord(row)) return fail(`Row ${i + 1} in “${table}” isn't an object.`)
      const id = row.id
      if (typeof id !== "string" || !id.trim()) return fail(`Row ${i + 1} in “${table}” has no id.`)
      if (ids.has(id)) return fail(`“${table}” contains the id ${truncate(id, 40)} twice.`)
      if (options.requireUuids && !UUID.test(id)) {
        return fail(`Supabase needs UUID ids, but “${table}” has the id “${truncate(id, 40)}”.`)
      }
      const shape = rowShapeError(table, row)
      if (shape) return fail(`Row ${i + 1} in “${table}”: ${shape}.`)
      ids.add(id)
    }
    db[table] = value
    tables++
  }

  if (!tables) return fail("No workspace tables were found in this file.")
  const parsed = db as Partial<Database>
  if (!parsed.brand_profiles?.length) warnings.push("There's no brand profile in this file — onboarding will start after the import.")
  const counts = workspaceCounts(parsed)
  const exportedAt = typeof data.exported_at === "string" ? data.exported_at : typeof data.savedAt === "string" ? data.savedAt : null
  return { ok: true, db: parsed, counts, totalRows: totalRows(counts), exportedAt, warnings }
}

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
