/**
 * Building blocks shared by the analytics modules: fast date parsing, date windows, publish dates,
 * settings fallback, rounding and light text similarity. Pure — no store access.
 */
import { endOfDay, startOfDay, subDays } from "date-fns"
import { BUFFER_STAGES, PUBLISHED_STAGES } from "@/lib/constants"
import { buildRow } from "@/lib/data/defaults"
import { parseDate } from "@/lib/dates"
import type { AppSettings, ContentItem, Database, ISODate } from "@/lib/types"

/** Inclusive window: `start` is a local midnight, `end` the last millisecond of the final day. */
export interface DateRange {
  start: Date
  end: Date
}

export interface ISORange {
  start: ISODate
  end: ISODate
}

/** Window selector — explicit `start` (+ optional `end`), or the trailing `days` ending at `end ?? now`. */
export interface RangeOptions {
  days?: number
  start?: Date
  end?: Date
}

/** Group key for rows without a pillar / format / hook style / funnel stage. */
export const NO_KEY = "none"

/* ---------------------------------- Dates ---------------------------------- */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/

/**
 * parseDate with a fast path for the shapes the app stores ('YYYY-MM-DD' → local midnight,
 * ISO timestamps → Date, sub-millisecond digits dropped); anything else falls back to parseDate.
 */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const day = DATE_ONLY.exec(value)
  if (day) {
    const y = Number(day[1])
    const m = Number(day[2]) - 1
    const d = Number(day[3])
    const date = new Date(y, m, d)
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null
  }
  const time = DATE_TIME.exec(value)
  if (time) {
    const date = new Date(`${time[1]}${time[2] ? time[2].slice(0, 4) : ""}${time[3] ?? ""}`)
    if (!Number.isNaN(date.getTime())) return date
  }
  return parseDate(value)
}

/** Local calendar day as 'YYYY-MM-DD' (same output as toISODate, much cheaper). */
export function dayKey(date: Date): ISODate {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${date.getFullYear()}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`
}

/** Whole local calendar days from `from` to `to` (= differenceInCalendarDays(to, from)). */
export function calendarDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / 86_400_000)
}

/** Local midnight starting `date`'s week (= startOfWeek). */
export function localWeekStart(date: Date, weekStartsOn: 0 | 1): Date {
  const back = (date.getDay() - weekStartsOn + 7) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back)
}

/* ------------------------------- Content dates ----------------------------- */

/** Published = stage Published or Repurpose (the stage is the source of truth, not the timestamp). */
export function isPublishedItem(item: Pick<ContentItem, "stage">): boolean {
  return PUBLISHED_STAGES.includes(item.stage)
}

interface CachedTime {
  raw: string | null
  ms: number
}

const timeCache = new WeakMap<object, Record<string, CachedTime>>()

/**
 * Timestamp (ms; NaN when empty/invalid) of a row's date field, memoised per row object and raw value.
 * Unchanged rows keep their identity across store updates, so each date string is parsed once.
 */
export function timeOf<K extends string>(row: { [P in K]: string | null }, field: K): number {
  let entry = timeCache.get(row)
  if (!entry) {
    entry = {}
    timeCache.set(row, entry)
  }
  const raw = row[field]
  const hit = entry[field]
  if (hit && hit.raw === raw) return hit.ms
  const ms = toDate(raw)?.getTime() ?? Number.NaN
  entry[field] = { raw, ms }
  return ms
}

const msToDate = (ms: number): Date | null => (Number.isNaN(ms) ? null : new Date(ms))

/** Calendar placement in ms: published_at → scheduled_at → due_date; NaN when undated. */
export function plannedMs(item: Pick<ContentItem, "published_at" | "scheduled_at" | "due_date">): number {
  const published = timeOf(item, "published_at")
  if (!Number.isNaN(published)) return published
  const scheduled = timeOf(item, "scheduled_at")
  return Number.isNaN(scheduled) ? timeOf(item, "due_date") : scheduled
}

/** Go-live time in ms of a published item: planned date, falling back to created_at. */
export function publishedMs(item: ContentItem): number {
  const planned = plannedMs(item)
  return Number.isNaN(planned) ? timeOf(item, "created_at") : planned
}

/** Calendar placement: published_at → scheduled_at → due_date (= contentItemDate). */
export function plannedDateOf(item: Pick<ContentItem, "published_at" | "scheduled_at" | "due_date">): Date | null {
  return msToDate(plannedMs(item))
}

/** Go-live date of a published item: published_at → scheduled_at → due_date → created_at. */
export function publishedAtOf(item: ContentItem): Date | null {
  return msToDate(publishedMs(item))
}

/**
 * Not published and either scheduled before `now`, or past its production deadline (due before today)
 * while still in production — Ready to Post / Scheduled items have already met their deadline.
 */
export function isOverdue(item: ContentItem, now: Date, todayStart: Date = startOfDay(now)): boolean {
  if (isPublishedItem(item)) return false
  if (timeOf(item, "scheduled_at") < now.getTime()) return true
  return !BUFFER_STAGES.includes(item.stage) && timeOf(item, "due_date") < todayStart.getTime()
}

/* --------------------------------- Windows --------------------------------- */

/** The last `days` calendar days ending with `anchor`'s day, both ends inclusive. */
export function trailingDays(anchor: Date, days: number): DateRange {
  return { start: startOfDay(subDays(anchor, Math.max(1, Math.round(days)) - 1)), end: endOfDay(anchor) }
}

/** RangeOptions → window; null means all time (no `start`, no `days`, no default). */
export function resolveRange(now: Date, options: RangeOptions = {}, defaultDays?: number): DateRange | null {
  if (options.start) return { start: startOfDay(options.start), end: endOfDay(options.end ?? now) }
  const days = options.days ?? defaultDays
  return days ? trailingDays(options.end ?? now, days) : null
}

/** start ≤ date ≤ end; a null range matches every date. */
export function inRange(date: Date | null, range: DateRange | null): boolean {
  if (!date) return false
  if (!range) return true
  const t = date.getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

export function toISORange(range: DateRange): ISORange {
  return { start: dayKey(range.start), end: dayKey(range.end) }
}

/* ---------------------------------- Misc ----------------------------------- */

let fallbackSettings: AppSettings | null = null

/** Explicit settings → the workspace singleton → table defaults. */
export function resolveSettings(db: Database, settings?: AppSettings): AppSettings {
  if (settings) return settings
  if (db.app_settings[0]) return db.app_settings[0]
  fallbackSettings ??= buildRow("app_settings", {}, "", new Date(0))
  return fallbackSettings
}

export function roundTo(value: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function finiteOr0(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Descending comparator that sorts nulls last. */
export function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

/** Code-point comparison for tie-breaks (localeCompare is slow in large sorts). */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 1.83 → "1.8x". */
export function formatMultiple(value: number): string {
  return `${roundTo(value, 1).toFixed(1)}x`
}

const STOPWORDS = new Set(
  (
    "the and for you your with that this from are was were how what why when who whom have has had but not can " +
    "will would about into its our out get got one all more most just like they them their then than there here " +
    "over only also very too any some such each every which while being been does did doing don dont i'm its it's " +
    "ang mga para ako ikaw yung lang hindi natin namin kayo sila"
  ).split(" ")
)

/** Lower-cased content words (≥ 3 chars, stopwords removed) used for near-duplicate checks. */
export function tokenize(text: string): Set<string> {
  const out = new Set<string>()
  for (const word of text.toLowerCase().split(/[^a-z0-9À-ɏ']+/)) {
    const w = word.replace(/^'+|'+$/g, "")
    if (w.length >= 3 && !STOPWORDS.has(w)) out.add(w)
  }
  return out
}

/** |A ∩ B| ÷ |A ∪ B|; 0 when either set is empty. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / (a.size + b.size - shared)
}
