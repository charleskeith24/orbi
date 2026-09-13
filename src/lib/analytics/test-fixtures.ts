/**
 * Hand-built fixtures for the analytics test suites (not exported from the analytics index).
 * All dates are local-time so the suites pass in any timezone.
 */
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import { toISODate } from "@/lib/dates"
import type { AppSettings, ContentItem, ContentMetric, Database, InsertRow, ISODateTime, Row, TableName } from "@/lib/types"

export const USER_ID = "user-test"

/** Thursday 10 Sep 2026, 12:00 local time. */
export const NOW = new Date(2026, 8, 10, 12, 0, 0, 0)

/** Local date `n` days before `from`, at `hour`:00 (negative n = in the future). */
export function daysAgo(n: number, hour = 10, from: Date = NOW): Date {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** Local date for a calendar day at `hour`:00 (month is 1-based). */
export function on(year: number, month: number, day: number, hour = 10): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0)
}

export function makeDb(settings: InsertRow<"app_settings"> = {}): Database {
  const db = emptyDatabase()
  db.app_settings = [buildRow("app_settings", settings, USER_ID, NOW)]
  db.brand_profiles = [buildRow("brand_profiles", {}, USER_ID, NOW)]
  return db
}

export function settingsOf(db: Database): AppSettings {
  return db.app_settings[0]
}

let sequence = 0

/** Insert a complete row (defaults filled) with a readable id; `meta` sets timestamps. */
export function add<T extends TableName>(
  db: Database,
  table: T,
  values: InsertRow<T> = {} as InsertRow<T>,
  meta: { created_at?: ISODateTime; updated_at?: ISODateTime } = {}
): Row<T> {
  const id = (values as { id?: string }).id ?? `${table}-${++sequence}`
  const row = buildRow(table, { ...values, ...meta, id } as InsertRow<T>, USER_ID, NOW)
  ;(db[table] as unknown as Row<T>[]).push(row)
  return row
}

export type MetricInput = Partial<Omit<ContentMetric, "id" | "user_id" | "created_at" | "updated_at" | "content_item_id" | "platform">>

export function addMetric(db: Database, item: ContentItem, values: MetricInput = {}, updatedAt?: ISODateTime): ContentMetric {
  return add(
    db,
    "content_metrics",
    { content_item_id: item.id, platform: item.platform, recorded_at: toISODate(NOW), ...values },
    updatedAt ? { updated_at: updatedAt } : {}
  )
}

/** A published item `n` days ago (10:00 local), with a snapshot when `metrics` is given. */
export function addPublished(db: Database, n: number, values: InsertRow<"content_items"> = {}, metrics?: MetricInput): ContentItem {
  const item = add(db, "content_items", { stage: "published", published_at: daysAgo(n).toISOString(), ...values })
  if (metrics) addMetric(db, item, metrics)
  return item
}

export const ids = (rows: { id: string }[]) => rows.map((r) => r.id)
