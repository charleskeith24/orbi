/**
 * Scoping and shaping of performance rows for the analytics views: filter-row scoping, KPI totals,
 * bucketed series, the posting-time heatmap and the tier distribution (pure — safe in tests).
 * Row-level numbers come from @/lib/analytics; this module only groups them.
 */
import { aggregateRows, inRange, type DateRange, type GroupAggregate, type PerformanceRow, type TieredRow } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import type { ISODate, PerformanceTier } from "@/lib/types"
import { ratio } from "@/lib/utils"
import { NO_PILLAR } from "./filters"

export interface ScopeFilters {
  platforms: readonly string[]
  pillars: readonly string[]
}

/** Rows published inside `range` (null = all time) on the selected platforms and pillars. */
export function scopeRows<R extends PerformanceRow>(rows: R[], filters: ScopeFilters, range: DateRange | null): R[] {
  const platforms = new Set(filters.platforms)
  const pillars = new Set(filters.pillars)
  return rows.filter(
    (r) =>
      inRange(r.publishedAt, range) &&
      (!platforms.size || platforms.has(r.platform)) &&
      (!pillars.size || pillars.has(r.pillarId ?? NO_PILLAR))
  )
}

/* --------------------------------- Totals --------------------------------- */

export interface KpiTotals extends GroupAggregate {
  /** Σ shares ÷ Σ reach (falling back to views) × 100. */
  shareRate: number | null
  saveRate: number | null
  /** Σ leads ÷ Σ link clicks (or profile visits) × 100. */
  leadConversion: number | null
  /** Σ followers gained ÷ Σ profile visits × 100. */
  followerConversion: number | null
}

/** Period totals with the RATE_FIELDS formulas applied to the sums. */
export function kpiTotals(rows: TieredRow[]): KpiTotals {
  const agg = aggregateRows(rows)
  let base = 0
  for (const r of rows) base += r.base
  return {
    ...agg,
    shareRate: ratio(agg.shares, base),
    saveRate: ratio(agg.saves, base),
    leadConversion: ratio(agg.leads, agg.linkClicks > 0 ? agg.linkClicks : agg.profileVisits),
    followerConversion: ratio(agg.followersGained, agg.profileVisits),
  }
}

/* --------------------------------- Series --------------------------------- */

export type Bucket = "day" | "week"

export interface BucketPoint {
  /** First day of the period. */
  date: ISODate
  /** Last day of the period. */
  end: ISODate
  /** Calendar days in the period (1 or 7; the first period of a window can be shorter). */
  days: number
  posts: number
  measured: number
  views: number
  reach: number
  engagements: number
  followers: number
  leads: number
  saves: number
  shares: number
  /** Followers gained from the first bucket up to and including this one. */
  cumulativeFollowers: number
}

/** Daily buckets for short windows, weekly otherwise. */
export function bucketFor(range: DateRange | null): Bucket {
  if (!range) return "week"
  const days = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000)
  return days <= 14 ? "day" : "week"
}

const DAY_MS = 86_400_000

/** Local calendar day → day number (DST-safe). */
function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

function fromDayNumber(n: number): Date {
  const utc = new Date(n * DAY_MS)
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
}

/**
 * Zero-filled daily or 7-day periods counted back from the window's last day, so the latest period is
 * always complete (a calendar week in progress would read as a false drop). Each row is summed at its
 * publish date. A shorter leading period is dropped once 2+ full periods exist; its followers still seed
 * the running total, so the last point equals the window's followers gained. All time: first → last post.
 */
export function bucketSeries(rows: PerformanceRow[], range: DateRange | null, bucket: Bucket): BucketPoint[] {
  let first: number
  let last: number
  if (range) {
    first = dayNumber(range.start)
    last = dayNumber(range.end)
  } else {
    if (!rows.length) return []
    first = rows.reduce((min, r) => Math.min(min, dayNumber(r.publishedAt)), Infinity)
    last = rows.reduce((max, r) => Math.max(max, dayNumber(r.publishedAt)), -Infinity)
  }
  if (last < first) return []
  const size = bucket === "week" ? 7 : 1
  const count = Math.ceil((last - first + 1) / size)
  const points: BucketPoint[] = []
  for (let k = count - 1; k >= 0; k--) {
    const end = last - k * size
    const start = Math.max(first, end - size + 1)
    points.push({
      date: toISODate(fromDayNumber(start)),
      end: toISODate(fromDayNumber(end)),
      days: end - start + 1,
      posts: 0,
      measured: 0,
      views: 0,
      reach: 0,
      engagements: 0,
      followers: 0,
      leads: 0,
      saves: 0,
      shares: 0,
      cumulativeFollowers: 0,
    })
  }
  for (const r of rows) {
    const day = dayNumber(r.publishedAt)
    if (day < first || day > last) continue
    const point = points[count - 1 - Math.floor((last - day) / size)]
    point.posts++
    if (r.metric) point.measured++
    point.views += r.views
    point.reach += r.reach
    point.engagements += r.engagements
    point.followers += r.followersGained
    point.leads += r.leads
    point.saves += r.saves
    point.shares += r.shares
  }
  let running = 0
  let out = points
  if (size > 1 && points.length > 2 && points[0].days < size) {
    running = points[0].followers
    out = points.slice(1)
  }
  for (const point of out) {
    running += point.followers
    point.cumulativeFollowers = running
  }
  return out
}

/* ------------------------------ Posting times ------------------------------ */

export interface SlotStat {
  /** 0 = Sunday … 6 = Saturday. */
  day: number
  hour: number
  posts: number
  avgViews: number
}

export interface PostingHeatmapData {
  /** Weekdays in display order (starting on the configured week start). */
  days: number[]
  /** Contiguous hour span covering every measured post (at least 6 columns). */
  hours: number[]
  slots: SlotStat[]
  /** Highest average views among slots with 2+ posts (any slot when none has 2). */
  best: SlotStat | null
  measured: number
}

const MIN_HOUR_COLUMNS = 6

/** Average views by publish weekday × hour (local time) over measured posts. */
export function postingHeatmap(rows: PerformanceRow[], weekStartsOn: 0 | 1): PostingHeatmapData {
  const days = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7)
  const measured = rows.filter((r) => r.metric)
  if (!measured.length) return { days, hours: [], slots: [], best: null, measured: 0 }

  const acc = new Map<string, { day: number; hour: number; posts: number; views: number }>()
  let lo = 23
  let hi = 0
  for (const r of measured) {
    const day = r.publishedAt.getDay()
    const hour = r.publishedAt.getHours()
    lo = Math.min(lo, hour)
    hi = Math.max(hi, hour)
    const key = `${day}-${hour}`
    const slot = acc.get(key)
    if (slot) {
      slot.posts++
      slot.views += r.views
    } else acc.set(key, { day, hour, posts: 1, views: r.views })
  }
  while (hi - lo + 1 < MIN_HOUR_COLUMNS && (lo > 0 || hi < 23)) {
    if (lo > 0) lo--
    if (hi - lo + 1 < MIN_HOUR_COLUMNS && hi < 23) hi++
  }
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const order = new Map(days.map((d, i) => [d, i]))
  const slots = [...acc.values()]
    .map((s) => ({ day: s.day, hour: s.hour, posts: s.posts, avgViews: s.views / s.posts }))
    .sort((a, b) => (order.get(a.day) ?? 0) - (order.get(b.day) ?? 0) || a.hour - b.hour)
  const pool = slots.some((s) => s.posts >= 2) ? slots.filter((s) => s.posts >= 2) : slots
  const best = pool.reduce<SlotStat | null>((top, s) => (!top || s.avgViews > top.avgViews ? s : top), null)
  return { days, hours, slots, best, measured: measured.length }
}

/* ---------------------------------- Tiers ---------------------------------- */

/** Strongest first, so the ordinal ramp's darkest step is Breakout. */
export const TIERS_DESC: PerformanceTier[] = ["breakout", "winner", "good", "normal"]

export interface TierSummary {
  /** Tiered posts per tier (Normal excludes posts without a ratio). */
  counts: Record<PerformanceTier, number>
  tiered: number
  /** Measured, but too little platform history for a ratio. */
  untiered: number
  unmeasured: number
}

export function tierSummary(rows: TieredRow[]): TierSummary {
  const counts: Record<PerformanceTier, number> = { breakout: 0, winner: 0, good: 0, normal: 0 }
  let untiered = 0
  let unmeasured = 0
  for (const r of rows) {
    if (!r.metric) unmeasured++
    else if (r.ratio === null) untiered++
    else counts[r.tier]++
  }
  return { counts, tiered: counts.breakout + counts.winner + counts.good + counts.normal, untiered, unmeasured }
}
