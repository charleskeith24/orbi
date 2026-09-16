/**
 * Local → cloud: moving the workspace this browser keeps in local mode (`pbos:workspace:v2`) into the
 * signed-in account. The local copy is never modified here; after a successful move a marker records
 * it so the offer isn't repeated. UI: features/settings/data-move-local.tsx.
 */
import { normalizeDatabase, TABLE_NAMES } from "@/lib/data/defaults"
import { LOCAL_STORAGE_KEY, LOCAL_USER_ID } from "@/lib/data/local-adapter"
import { createStarterDatabase } from "@/lib/data/starter"
import { rekeyWorkspace } from "@/lib/supabase/rekey"
import type { Database, ID, TableName } from "@/lib/types"

/** Set after a successful move: `{ userId, movedAt, savedAt }` of the local snapshot that was moved. */
export const MOVED_MARKER_KEY = `${LOCAL_STORAGE_KEY}:moved`
/** `…:<userId>` = "1" once the one-time prompt was shown to that account in this browser. */
export const PROMPTED_KEY_PREFIX = "pbos:move-local:prompted:"

export interface WorkspaceSummary {
  rows: number
  /** Rows outside the Starter Kit library: ideas, content, analytics, stories, personas… */
  ownRows: number
  onboarded: boolean
  brandName: string
}

export interface LocalSnapshot extends WorkspaceSummary {
  db: Database
  savedAt: string | null
}

export interface MovedMarker {
  userId: string
  movedAt: string
  savedAt: string | null
}

let starterTables: Set<TableName> | null = null
/** Tables a brand-new workspace already fills (formats, angles, hook templates, goals, schedule, tags, settings). */
function libraryTables(): Set<TableName> {
  if (!starterTables) {
    const starter = createStarterDatabase(LOCAL_USER_ID, new Date(2026, 0, 1))
    starterTables = new Set(TABLE_NAMES.filter((t) => starter[t].length > 0))
  }
  return starterTables
}

export function summarizeWorkspace(db: Database): WorkspaceSummary {
  const library = libraryTables()
  let rows = 0
  let ownRows = 0
  for (const t of TABLE_NAMES) {
    const n = db[t]?.length ?? 0
    rows += n
    if (!library.has(t)) ownRows += n
  }
  const brand = db.brand_profiles[0]
  return {
    rows,
    ownRows,
    onboarded: Boolean(brand?.onboarding_completed),
    brandName: (brand?.brand_name || brand?.name || "").trim(),
  }
}

/** Worth moving: the brand was set up, or anything beyond the Starter Kit exists. */
export function hasWorkToMove(summary: WorkspaceSummary): boolean {
  return summary.onboarded || summary.ownRows > 0
}

/** An account that holds nothing of its own yet: at most the Starter Kit and blank brand/settings rows. */
export function isEmptyWorkspace(summary: WorkspaceSummary): boolean {
  return !summary.onboarded && summary.ownRows === 0
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The local snapshot as saved by the local adapter, or null when missing or unreadable. */
export function parseLocalSnapshot(raw: string | null): LocalSnapshot | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || !isRecord(parsed.db)) return null
  const tables: Partial<Record<TableName, unknown[]>> = {}
  for (const t of TABLE_NAMES) {
    const rows = parsed.db[t]
    if (Array.isArray(rows)) tables[t] = rows.filter(isRecord)
  }
  const db = normalizeDatabase(tables as Partial<Database>)
  return { db, savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null, ...summarizeWorkspace(db) }
}

/**
 * A workspace (this browser's, or a backup file) ready to go into an account: fresh ids with every
 * reference rewritten (see rekey.ts — every local workspace shares Starter Kit ids, and a file can be
 * imported into more than one account), owned by `userId`, every field complete.
 */
export function prepareForAccount(db: Database, userId: string, newId?: () => ID): Database {
  const out = normalizeDatabase(rekeyWorkspace(db, newId).db)
  for (const t of TABLE_NAMES) for (const row of out[t] as { user_id: string }[]) row.user_id = userId
  return out
}

/** The move has already happened for this exact local snapshot. */
export function alreadyMoved(marker: MovedMarker | null, snapshot: LocalSnapshot): boolean {
  return Boolean(marker && marker.savedAt === snapshot.savedAt)
}

/* ------------------------------- Browser storage ------------------------------- */

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function readLocalSnapshot(): LocalSnapshot | null {
  try {
    return parseLocalSnapshot(storage()?.getItem(LOCAL_STORAGE_KEY) ?? null)
  } catch {
    return null
  }
}

export function parseMovedMarker(raw: string | null): MovedMarker | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null")
    if (!isRecord(value) || typeof value.userId !== "string" || typeof value.movedAt !== "string") return null
    return { userId: value.userId, movedAt: value.movedAt, savedAt: typeof value.savedAt === "string" ? value.savedAt : null }
  } catch {
    return null
  }
}

export function readMovedMarker(): MovedMarker | null {
  try {
    return parseMovedMarker(storage()?.getItem(MOVED_MARKER_KEY) ?? null)
  } catch {
    return null
  }
}

export function writeMovedMarker(marker: MovedMarker): void {
  try {
    storage()?.setItem(MOVED_MARKER_KEY, JSON.stringify(marker))
  } catch {
    // Storage full or blocked: the offer may show again, which is harmless.
  }
}

/** Deletes this browser's local workspace (and the moved marker). The account's copy is untouched. */
export function removeLocalCopy(): void {
  const s = storage()
  s?.removeItem(LOCAL_STORAGE_KEY)
  s?.removeItem(MOVED_MARKER_KEY)
}

export function wasPrompted(userId: string): boolean {
  try {
    return storage()?.getItem(`${PROMPTED_KEY_PREFIX}${userId}`) === "1"
  } catch {
    return true
  }
}

export function markPrompted(userId: string): void {
  try {
    storage()?.setItem(`${PROMPTED_KEY_PREFIX}${userId}`, "1")
  } catch {
    // Without storage the prompt can't be remembered; Settings → Data still offers the move.
  }
}
