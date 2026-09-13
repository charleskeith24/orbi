/**
 * Winner detection (spec §26) and the Winning Content Library (spec §27).
 * Each measured post is compared with the mean of the previous `winner_window`
 * measured posts on the same platform.
 */
import type { AppSettings, Database, ID, PerformanceTier, PlatformId, WinnerMetric } from "@/lib/types"
import { average, groupBy } from "@/lib/utils"
import { sharedPerformanceRows, type PerformanceRow } from "./metrics"
import { compareNullableDesc, compareText, inRange, resolveRange, trailingDays, type RangeOptions } from "./shared"

export interface TierInfo {
  tier: PerformanceTier
  /** value ÷ baseline; null when the sample is below `winner_min_sample` or the baseline is 0. */
  ratio: number | null
  /** The post's comparison value (composite: its performance index, 1 = average). */
  value: number | null
  /** Mean comparison value of the window (composite: 1). */
  baseline: number | null
  /** Posts in the comparison window. */
  sampleSize: number
}

export type TieredRow = PerformanceRow & TierInfo

export const NO_TIER: Readonly<TierInfo> = Object.freeze({
  tier: "normal",
  ratio: null,
  value: null,
  baseline: null,
  sampleSize: 0,
})

type TierSettings = Pick<AppSettings, "winner_metric" | "winner_window" | "winner_min_sample" | "tier_good" | "tier_winner" | "tier_breakout">

const COMPOSITE_COMPONENTS = ["views", "engagement_rate", "shares", "saves", "leads"] as const
type CompositeComponent = (typeof COMPOSITE_COMPONENTS)[number]

/** Per-component means of a comparison window (composite winner metric). */
export type CompositeBaselines = Partial<Record<CompositeComponent, number>>

function componentValue(row: PerformanceRow, component: CompositeComponent): number | null {
  if (!row.metric) return null
  switch (component) {
    case "views":
      return row.views
    case "engagement_rate":
      return row.rates.engagement_rate
    case "shares":
      return row.shares
    case "saves":
      return row.saves
    case "leads":
      return row.leads
  }
}

/** Mean of views, engagement rate, shares, saves and leads across `rows` (null values skipped). */
export function compositeBaselines(rows: PerformanceRow[]): CompositeBaselines {
  const out: CompositeBaselines = {}
  for (const c of COMPOSITE_COMPONENTS) {
    const mean = average(rows.map((r) => componentValue(r, c)).filter((v): v is number => v !== null))
    if (mean !== null) out[c] = mean
  }
  return out
}

/**
 * Comparison value: views | engagement_rate | engagements | leads of the latest snapshot;
 * composite = mean(item ÷ baseline) over views, ER, shares, saves, leads, skipping components whose baseline is 0.
 */
export function performanceValue(row: PerformanceRow, winnerMetric: WinnerMetric, baselines?: CompositeBaselines): number | null {
  if (!row.metric) return null
  switch (winnerMetric) {
    case "views":
      return row.views
    case "engagement_rate":
      return row.rates.engagement_rate
    case "engagements":
      return row.engagements
    case "leads":
      return row.leads
    case "composite": {
      if (!baselines) return null
      const ratios: number[] = []
      for (const c of COMPOSITE_COMPONENTS) {
        const base = baselines[c]
        const value = componentValue(row, c)
        if (base !== undefined && base > 0 && value !== null) ratios.push(value / base)
      }
      return average(ratios)
    }
  }
}

/** ratio ≥ tier_breakout → breakout; ≥ tier_winner → winner; ≥ tier_good → good; else normal. */
export function tierForRatio(ratio: number | null, settings: Pick<AppSettings, "tier_good" | "tier_winner" | "tier_breakout">): PerformanceTier {
  if (ratio === null || !Number.isFinite(ratio)) return "normal"
  if (ratio >= settings.tier_breakout) return "breakout"
  if (ratio >= settings.tier_winner) return "winner"
  if (ratio >= settings.tier_good) return "good"
  return "normal"
}

export function isWinnerTier(tier: PerformanceTier): boolean {
  return tier === "winner" || tier === "breakout"
}

function finalize(value: number | null, baseline: number | null, sampleSize: number, minSample: number, settings: TierSettings): TierInfo {
  if (value === null || baseline === null || baseline <= 0 || sampleSize < minSample) {
    return { tier: "normal", ratio: null, value, baseline, sampleSize }
  }
  const ratio = value / baseline
  return { tier: tierForRatio(ratio, settings), ratio, value, baseline, sampleSize }
}

function chronological(a: PerformanceRow, b: PerformanceRow): number {
  return (
    a.publishedAt.getTime() - b.publishedAt.getTime() ||
    compareText(a.item.created_at, b.item.created_at) ||
    compareText(a.id, b.id)
  )
}

/** Tier every measured row in `rows` (see computeTiers); unmeasured rows are left out of the map. */
export function tiersForRows(rows: PerformanceRow[], settings: TierSettings): Map<ID, TierInfo> {
  const out = new Map<ID, TierInfo>()
  const windowSize = Math.max(1, Math.round(settings.winner_window))
  // A minimum sample above the window size could never be met; cap it so tiers still get assigned.
  const minSample = Math.min(windowSize, Math.max(1, Math.round(settings.winner_min_sample)))
  const metric = settings.winner_metric
  const byPlatform = groupBy(
    rows.filter((r) => r.metric !== null),
    (r) => r.platform
  )

  for (const list of Object.values(byPlatform)) {
    list.sort(chronological)
    if (metric === "composite") {
      list.forEach((row, i) => {
        const window = list.slice(Math.max(0, i - windowSize), i)
        const value = window.length ? performanceValue(row, "composite", compositeBaselines(window)) : null
        out.set(row.id, finalize(value, value === null ? null : 1, window.length, minSample, settings))
      })
      continue
    }
    // Only posts with a defined comparison value enter later windows.
    const history: number[] = []
    for (const row of list) {
      const value = performanceValue(row, metric)
      const window = history.slice(-windowSize)
      out.set(row.id, finalize(value, average(window), window.length, minSample, settings))
      if (value !== null) history.push(value)
    }
  }
  return out
}

interface TierCacheEntry {
  tiers: Map<ID, TierInfo>
  rows: TieredRow[]
}

const tierCache = new WeakMap<PerformanceRow[], Map<string, TierCacheEntry>>()

function tierEntry(db: Database, settings: TierSettings, now: Date): TierCacheEntry {
  const rows = sharedPerformanceRows(db, now)
  let byKey = tierCache.get(rows)
  if (!byKey) {
    byKey = new Map()
    tierCache.set(rows, byKey)
  }
  const key = [
    settings.winner_metric,
    settings.winner_window,
    settings.winner_min_sample,
    settings.tier_good,
    settings.tier_winner,
    settings.tier_breakout,
  ].join("|")
  let entry = byKey.get(key)
  if (!entry) {
    const tiers = tiersForRows(rows, settings)
    entry = { tiers, rows: rows.map((r) => ({ ...r, ...(tiers.get(r.id) ?? NO_TIER) })) }
    byKey.set(key, entry)
  }
  return entry
}

/** Memoised tieredRows. Internal: shared array, never mutate. */
export function sharedTieredRows(db: Database, settings: TierSettings, now: Date): TieredRow[] {
  return tierEntry(db, settings, now).rows
}

/**
 * Tier per measured published item: baseline = mean comparison value of the previous `winner_window`
 * measured posts on the same platform; ratio = value ÷ baseline; fewer than `winner_min_sample`
 * (capped at `winner_window`) comparison posts → normal with ratio null.
 */
export function computeTiers(db: Database, settings: AppSettings, now: Date): Map<ID, TierInfo> {
  return new Map(tierEntry(db, settings, now).tiers)
}

/** Every published row with its tier info (unmeasured rows get NO_TIER), newest first. */
export function tieredRows(db: Database, settings: AppSettings, now: Date): TieredRow[] {
  return sharedTieredRows(db, settings, now).slice()
}

/** Items with at least one repurposed child (a content item with parent_id, or a created content_repurposing row). */
export function repurposedSourceIds(db: Database): Set<ID> {
  const out = new Set<ID>()
  for (const item of db.content_items) if (item.parent_id) out.add(item.parent_id)
  for (const r of db.content_repurposing) if (r.target_item_id) out.add(r.source_item_id)
  return out
}

function byRatioDesc(a: TieredRow, b: TieredRow): number {
  return compareNullableDesc(a.ratio, b.ratio) || b.views - a.views || compareText(a.id, b.id)
}

/** Winning Content Library: published items tiered Winner/Breakout or pinned, sorted by ratio desc (optionally windowed by publish date). */
export function getWinners(db: Database, settings: AppSettings, now: Date, options: RangeOptions = {}): TieredRow[] {
  const range = resolveRange(now, options)
  return sharedTieredRows(db, settings, now)
    .filter((r) => (isWinnerTier(r.tier) || r.item.pinned_winner) && inRange(r.publishedAt, range))
    .sort(byRatioDesc)
}

export type TopPerformerSort = WinnerMetric | "ratio"

export interface TopPerformerOptions {
  /** Trailing window by publish date (default 30). */
  days?: number
  /** Default 5. */
  limit?: number
  /** Ranking value (default settings.winner_metric; composite and "ratio" rank by tier ratio). */
  by?: TopPerformerSort
  platform?: PlatformId
}

/** Dashboard "Top Performing Content": measured posts from the last `days`, ranked by `by` desc (ties → views). */
export function topPerformers(db: Database, settings: AppSettings, now: Date, options: TopPerformerOptions = {}): TieredRow[] {
  const range = trailingDays(now, options.days ?? 30)
  const by = options.by ?? settings.winner_metric
  const score = (r: TieredRow) => (by === "ratio" || by === "composite" ? r.ratio : performanceValue(r, by))
  return sharedTieredRows(db, settings, now)
    .filter((r) => r.metric && inRange(r.publishedAt, range) && (!options.platform || r.platform === options.platform))
    .sort((a, b) => compareNullableDesc(score(a), score(b)) || b.views - a.views || compareText(a.id, b.id))
    .slice(0, Math.max(0, options.limit ?? 5))
}
