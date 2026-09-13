/**
 * Metric snapshots → per-item numbers and rates (spec §25).
 * Analytics always use the latest snapshot per item.
 *
 * Rows are memoised by table-array identity: the store replaces a table's array on every write,
 * and lengths are compared too so builders that append in place still get fresh results.
 */
import { endOfDay } from "date-fns"
import type {
  ContentItem,
  ContentMetric,
  Database,
  ExperimentMetric,
  FunnelStage,
  Hook,
  HookCategory,
  ID,
  ISODate,
  PlatformId,
  RateKey,
} from "@/lib/types"
import { ratio } from "@/lib/utils"
import { calendarDays, compareText, dayKey, finiteOr0, isPublishedItem, publishedAtOf } from "./shared"

/** The counters rates are computed from — a snapshot or a sum of snapshots. */
export type MetricCounts = Pick<
  ContentMetric,
  "views" | "reach" | "likes" | "comments" | "shares" | "saves" | "followers_gained" | "profile_visits" | "link_clicks" | "leads"
>

/** Derived rates in percent (0–100); null when the denominator is 0. */
export type MetricRates = Record<RateKey, number | null>

export const RATE_KEYS: readonly RateKey[] = [
  "engagement_rate",
  "share_rate",
  "save_rate",
  "lead_conversion_rate",
  "follower_conversion_rate",
]

export function isRateKey(key: string): key is RateKey {
  return (RATE_KEYS as readonly string[]).includes(key)
}

function isNewerSnapshot(a: ContentMetric, b: ContentMetric): boolean {
  if (a.recorded_at !== b.recorded_at) return a.recorded_at > b.recorded_at
  if (a.updated_at !== b.updated_at) return a.updated_at > b.updated_at
  return a.created_at > b.created_at
}

const latestCache = new WeakMap<ContentMetric[], { length: number; latest: Map<ID, ContentMetric> }>()

/** Memoised latest-snapshot map. Internal: shared instance, never mutate. */
export function sharedLatestMetrics(db: Pick<Database, "content_metrics">): Map<ID, ContentMetric> {
  const metrics = db.content_metrics
  const hit = latestCache.get(metrics)
  if (hit && hit.length === metrics.length) return hit.latest
  const latest = new Map<ID, ContentMetric>()
  for (const m of metrics) {
    const current = latest.get(m.content_item_id)
    if (!current || isNewerSnapshot(m, current)) latest.set(m.content_item_id, m)
  }
  latestCache.set(metrics, { length: metrics.length, latest })
  return latest
}

/** Latest snapshot per item: greatest `recorded_at`, ties broken by `updated_at`. */
export function latestMetricsByItem(db: Pick<Database, "content_metrics">): Map<ID, ContentMetric> {
  return new Map(sharedLatestMetrics(db))
}

/** likes + comments + shares + saves (0 for a missing snapshot). */
export function engagementsOf(m: Pick<ContentMetric, "likes" | "comments" | "shares" | "saves"> | null | undefined): number {
  if (!m) return 0
  return finiteOr0(m.likes) + finiteOr0(m.comments) + finiteOr0(m.shares) + finiteOr0(m.saves)
}

/** Rate denominator: reach when > 0, otherwise views (0 when both are 0). */
export function rateBase(m: Pick<ContentMetric, "reach" | "views">): number {
  const reach = finiteOr0(m.reach)
  return reach > 0 ? reach : Math.max(0, finiteOr0(m.views))
}

/**
 * Rates in % (null on a zero denominator), matching the RATE_FIELDS formulas shown in the UI:
 * ER = engagements ÷ base · share/save rate = shares|saves ÷ base (base = reach || views) ·
 * lead conversion = leads ÷ (link clicks || profile visits) · follower conversion = followers gained ÷ profile visits.
 */
export function computeRates(m: MetricCounts | null | undefined): MetricRates {
  if (!m) {
    return { engagement_rate: null, share_rate: null, save_rate: null, lead_conversion_rate: null, follower_conversion_rate: null }
  }
  const base = rateBase(m)
  const clicks = finiteOr0(m.link_clicks)
  const visits = finiteOr0(m.profile_visits)
  return {
    engagement_rate: ratio(engagementsOf(m), base),
    share_rate: ratio(finiteOr0(m.shares), base),
    save_rate: ratio(finiteOr0(m.saves), base),
    lead_conversion_rate: ratio(finiteOr0(m.leads), clicks > 0 ? clicks : visits),
    follower_conversion_rate: ratio(finiteOr0(m.followers_gained), visits),
  }
}

/** One value off a snapshot — raw field, derived rate or "engagements"; null without a snapshot or value. */
export function metricValue(m: ContentMetric | null | undefined, key: ExperimentMetric): number | null {
  if (!m) return null
  if (key === "engagements") return engagementsOf(m)
  if (isRateKey(key)) return computeRates(m)[key]
  const value = m[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** A published item joined with its latest snapshot — the building block of every table and chart. */
export interface PerformanceRow {
  id: ID
  item: ContentItem
  /** Latest snapshot; null when no analytics were logged (all counters are then 0). */
  metric: ContentMetric | null
  views: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagements: number
  /** Rate denominator (reach, falling back to views). */
  base: number
  leads: number
  sales: number
  followersGained: number
  profileVisits: number
  linkClicks: number
  watchTimeSeconds: number | null
  /** Average retention / % watched (0–100). */
  retention: number | null
  rates: MetricRates
  pillarId: ID | null
  formatId: ID | null
  angleId: ID | null
  hookId: ID | null
  hookCategory: HookCategory | null
  funnelStage: FunnelStage | null
  campaignId: ID | null
  platform: PlatformId
  publishedAt: Date
  /** Calendar days since publishing (0 = today). */
  ageDays: number
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Build one row; `hookCategories` resolves the category of `hook_id` when the item has none. */
export function toPerformanceRow(
  item: ContentItem,
  metric: ContentMetric | null,
  publishedAt: Date,
  now: Date,
  hookCategories?: Map<ID, HookCategory>
): PerformanceRow {
  const m = metric
  return {
    id: item.id,
    item,
    metric: m,
    views: finiteOr0(m?.views),
    reach: finiteOr0(m?.reach),
    likes: finiteOr0(m?.likes),
    comments: finiteOr0(m?.comments),
    shares: finiteOr0(m?.shares),
    saves: finiteOr0(m?.saves),
    engagements: engagementsOf(m),
    base: m ? rateBase(m) : 0,
    leads: finiteOr0(m?.leads),
    sales: finiteOr0(m?.sales),
    followersGained: finiteOr0(m?.followers_gained),
    profileVisits: finiteOr0(m?.profile_visits),
    linkClicks: finiteOr0(m?.link_clicks),
    watchTimeSeconds: nullableNumber(m?.watch_time_seconds),
    retention: nullableNumber(m?.avg_retention),
    rates: computeRates(m),
    pillarId: item.pillar_id,
    formatId: item.format_id,
    angleId: item.angle_id,
    hookId: item.hook_id,
    hookCategory: item.hook_category ?? (item.hook_id ? (hookCategories?.get(item.hook_id) ?? null) : null),
    funnelStage: item.funnel_stage,
    campaignId: item.campaign_id,
    platform: item.platform,
    publishedAt,
    ageDays: Math.max(0, calendarDays(publishedAt, now)),
  }
}

function buildPerformanceRows(db: Database, now: Date): PerformanceRow[] {
  const latest = sharedLatestMetrics(db)
  const hookCategories = new Map(db.hooks.map((h) => [h.id, h.category]))
  const cutoff = endOfDay(now).getTime()
  const rows: PerformanceRow[] = []
  for (const item of db.content_items) {
    if (!isPublishedItem(item)) continue
    const publishedAt = publishedAtOf(item)
    if (!publishedAt || publishedAt.getTime() > cutoff) continue
    rows.push(toPerformanceRow(item, latest.get(item.id) ?? null, publishedAt, now, hookCategories))
  }
  return rows.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || compareText(a.id, b.id))
}

interface RowsCache {
  itemsLength: number
  metrics: ContentMetric[]
  metricsLength: number
  hooks: Hook[]
  hooksLength: number
  /** Rows depend on `now` only through its calendar day (cutoff + ageDays). */
  byDay: Map<ISODate, PerformanceRow[]>
}

const rowsCache = new WeakMap<ContentItem[], RowsCache>()
const MAX_CACHED_DAYS = 8

/** Memoised itemPerformanceRows for `now`'s day. Internal: shared array, never mutate. */
export function sharedPerformanceRows(db: Database, now: Date): PerformanceRow[] {
  const items = db.content_items
  let cache = rowsCache.get(items)
  if (
    !cache ||
    cache.itemsLength !== items.length ||
    cache.metrics !== db.content_metrics ||
    cache.metricsLength !== db.content_metrics.length ||
    cache.hooks !== db.hooks ||
    cache.hooksLength !== db.hooks.length
  ) {
    cache = {
      itemsLength: items.length,
      metrics: db.content_metrics,
      metricsLength: db.content_metrics.length,
      hooks: db.hooks,
      hooksLength: db.hooks.length,
      byDay: new Map(),
    }
    rowsCache.set(items, cache)
  }
  const day = dayKey(now)
  let rows = cache.byDay.get(day)
  if (!rows) {
    rows = buildPerformanceRows(db, now)
    if (cache.byDay.size >= MAX_CACHED_DAYS) {
      const oldest = cache.byDay.keys().next().value
      if (oldest !== undefined) cache.byDay.delete(oldest)
    }
    cache.byDay.set(day, rows)
  }
  return rows
}

/** One row per published item whose publish date is on or before `now`'s day, newest first. */
export function itemPerformanceRows(db: Database, now: Date): PerformanceRow[] {
  return sharedPerformanceRows(db, now).slice()
}
