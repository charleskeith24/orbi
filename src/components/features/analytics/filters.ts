/**
 * The one filter row that scopes every analytics view: date range, platforms and pillars.
 * Filters live in the URL so views can be linked, shared and drilled into (pure — safe in tests).
 */
import { endOfDay, startOfDay } from "date-fns"
import { previousPeriod, trailingDays, type DateRange } from "@/lib/analytics"
import { PLATFORM_IDS } from "@/lib/constants"
import { formatDate, parseDate, toISODate } from "@/lib/dates"
import type { ISODate, PlatformId } from "@/lib/types"
import { uniq } from "@/lib/utils"

export type RangePreset = "7" | "30" | "90" | "180" | "all" | "custom"

export interface RangeOption {
  id: RangePreset
  label: string
  description: string
}

export const RANGE_OPTIONS: readonly RangeOption[] = [
  { id: "7", label: "7D", description: "Last 7 days" },
  { id: "30", label: "30D", description: "Last 30 days" },
  { id: "90", label: "90D", description: "Last 90 days" },
  { id: "180", label: "180D", description: "Last 180 days" },
  { id: "all", label: "All", description: "All time" },
  { id: "custom", label: "Custom", description: "Custom date range" },
]

const PRESET_DAYS: Partial<Record<RangePreset, number>> = { "7": 7, "30": 30, "90": 90, "180": 180 }

/** Pillar filter value for posts without a pillar. */
export const NO_PILLAR = "none"

export interface AnalyticsFilters {
  range: RangePreset
  /** Custom range only. */
  from: ISODate | null
  to: ISODate | null
  platforms: PlatformId[]
  /** Pillar ids, plus NO_PILLAR. */
  pillars: string[]
}

export interface FilterDefaults {
  range: Exclude<RangePreset, "custom">
  /** Offer the "All time" preset. */
  allowAll: boolean
}

/** Anything with URLSearchParams' `get` (ReadonlyURLSearchParams included). */
export interface ParamReader {
  get(name: string): string | null
}

export function setParam(params: URLSearchParams, key: string, value: string | null | undefined): void {
  if (value === null || value === undefined || value === "") params.delete(key)
  else params.set(key, value)
}

/** Comma-separated list param → unique, trimmed, non-empty values. */
export function readListParam(params: ParamReader, key: string): string[] {
  const raw = params.get(key)
  if (!raw) return []
  return uniq(
    raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  )
}

/** 'YYYY-MM-DD' that names a real calendar day, else null. */
export function validISODate(value: string | null | undefined): ISODate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = parseDate(value)
  return date && toISODate(date) === value ? value : null
}

export function rangeOptions(allowAll: boolean): RangeOption[] {
  return RANGE_OPTIONS.filter((o) => allowAll || o.id !== "all")
}

function isRangePreset(value: string | null, allowAll: boolean): value is RangePreset {
  return rangeOptions(allowAll).some((o) => o.id === value)
}

function isPlatform(value: string): value is PlatformId {
  return (PLATFORM_IDS as string[]).includes(value)
}

export function parseFilters(params: ParamReader, defaults: FilterDefaults): AnalyticsFilters {
  const raw = params.get("range")
  let range: RangePreset = isRangePreset(raw, defaults.allowAll) ? raw : defaults.range
  const from = validISODate(params.get("from"))
  const to = validISODate(params.get("to"))
  if (range === "custom" && !from) range = defaults.range
  return {
    range,
    from: range === "custom" ? from : null,
    to: range === "custom" ? to : null,
    platforms: readListParam(params, "platform").filter(isPlatform),
    pillars: readListParam(params, "pillar"),
  }
}

/** Writes the filters into `params`; the default range is left out of the URL. */
export function writeFilters(params: URLSearchParams, filters: AnalyticsFilters, defaults: FilterDefaults): void {
  setParam(params, "range", filters.range === defaults.range ? null : filters.range)
  setParam(params, "from", filters.range === "custom" ? filters.from : null)
  setParam(params, "to", filters.range === "custom" ? filters.to : null)
  setParam(params, "platform", filters.platforms.join(","))
  setParam(params, "pillar", filters.pillars.join(","))
}

export function defaultFilters(defaults: FilterDefaults): AnalyticsFilters {
  return { range: defaults.range, from: null, to: null, platforms: [], pillars: [] }
}

export function isDefaultFilters(filters: AnalyticsFilters, defaults: FilterDefaults): boolean {
  return filters.range === defaults.range && !filters.platforms.length && !filters.pillars.length
}

/** Window the filters select; null = all time. A reversed custom range is swapped. */
export function resolveFilterRange(filters: AnalyticsFilters, now: Date): DateRange | null {
  if (filters.range === "all") return null
  if (filters.range === "custom") {
    const from = parseDate(filters.from)
    const to = parseDate(filters.to) ?? now
    if (!from) return trailingDays(now, 30)
    const [a, b] = from.getTime() <= to.getTime() ? [from, to] : [to, from]
    return { start: startOfDay(a), end: endOfDay(b) }
  }
  return trailingDays(now, PRESET_DAYS[filters.range] ?? 30)
}

/** The equally long window just before `range` (for deltas); null for all time. */
export function comparisonRange(range: DateRange | null): DateRange | null {
  return range ? previousPeriod(range.start, range.end) : null
}

/** "Aug 13 – Sep 11, 2026" · "Dec 20, 2025 – Jan 5, 2026" · "All time". */
export function describeRange(range: DateRange | null): string {
  if (!range) return "All time"
  const sameYear = range.start.getFullYear() === range.end.getFullYear()
  const start = formatDate(range.start, sameYear ? "MMM d" : "MMM d, yyyy")
  return `${start} – ${formatDate(range.end, "MMM d, yyyy")}`
}

/** A URL for `pathname` carrying `filters` (written against the target page's defaults) plus extra params. */
export function hrefWithFilters(
  pathname: string,
  filters: AnalyticsFilters,
  targetDefaults: FilterDefaults,
  extra: Record<string, string | null | undefined> = {}
): string {
  const params = new URLSearchParams()
  writeFilters(params, filters, targetDefaults)
  for (const [key, value] of Object.entries(extra)) setParam(params, key, value)
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export const OVERVIEW_DEFAULTS: FilterDefaults = { range: "30", allowAll: false }
export const POSTS_DEFAULTS: FilterDefaults = { range: "all", allowAll: true }
