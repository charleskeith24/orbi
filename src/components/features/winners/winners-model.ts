/**
 * Winning Content Library model (spec §27): joins winner rows with the idea, angle, format and brief
 * behind them, plus filters, sorting, library stats and the plain-language detection rule.
 * Pure functions — callers memoise.
 */
import type { TieredRow } from "@/lib/analytics"
import { PLATFORMS, WINNER_METRIC_MAP } from "@/lib/constants"
import { translate, translator, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, Database, PerformanceTier, WinnerMetric } from "@/lib/types"
import { countBy, formatNumber, formatPercent, matchesQuery } from "@/lib/utils"
import { winnerRuleMessages } from "./messages"

/* --------------------------------- Period --------------------------------- */

export type WinnerPeriod = "30" | "90" | "180" | "365" | "all"

export const PERIOD_OPTIONS: { value: WinnerPeriod; label: string }[] = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All time" },
]

/** PERIOD_OPTIONS with labels in `lang`. */
export function periodOptions(lang: UiLang = "en"): { value: WinnerPeriod; label: string }[] {
  return PERIOD_OPTIONS.map((o) => ({ ...o, label: translate(winnerRuleMessages, lang, `period_${o.value}`) }))
}

/** RangeOptions for getWinners / resolveRange ({} = all time). */
export function periodRange(period: WinnerPeriod): { days?: number } {
  return period === "all" ? {} : { days: Number(period) }
}

/* --------------------------------- Entries -------------------------------- */

export interface WinnerEntry {
  row: TieredRow
  /** Core topic of the source idea ('' when the post didn't start from an idea). */
  topic: string
  angle: string
  format: string
  /** CTA from the post's Content Brief. */
  cta: string
  /** Repurposed content items created from this post. */
  childCount: number
  /** Ideas saved from this winner (source "winner"). */
  ideaCount: number
}

export function buildWinnerEntries(db: Database, rows: TieredRow[]): WinnerEntry[] {
  if (!rows.length) return []
  const topics = new Map(db.content_ideas.map((i) => [i.id, i.core_topic.trim()]))
  const angles = new Map(db.angles.map((a) => [a.id, a.name]))
  const formats = new Map(db.content_formats.map((f) => [f.id, f.name]))
  const ctas = new Map(db.content_briefs.map((b) => [b.content_item_id, b.cta.trim()]))
  const children = countBy(
    db.content_items.filter((i) => i.parent_id !== null),
    (i) => i.parent_id ?? ""
  )
  const ideas = countBy(
    db.content_ideas.filter((i) => i.source === "winner" && i.source_ref_id !== null),
    (i) => i.source_ref_id ?? ""
  )
  return rows.map((row) => ({
    row,
    topic: (row.item.idea_id ? topics.get(row.item.idea_id) : undefined) ?? "",
    angle: (row.angleId ? angles.get(row.angleId) : undefined) ?? "",
    format: (row.formatId ? formats.get(row.formatId) : undefined) ?? "",
    cta: ctas.get(row.id) ?? "",
    childCount: children[row.id] ?? 0,
    ideaCount: ideas[row.id] ?? 0,
  }))
}

/* --------------------------------- Filters -------------------------------- */

export type TierFilter = "breakout" | "winner" | "pinned"

export const TIER_FILTERS: { value: TierFilter; label: string }[] = [
  { value: "breakout", label: "Breakout" },
  { value: "winner", label: "Winner" },
  { value: "pinned", label: "Pinned" },
]

/** TIER_FILTERS with labels in `lang`. */
export function tierFilters(lang: UiLang = "en"): { value: TierFilter; label: string }[] {
  return TIER_FILTERS.map((o) => ({ ...o, label: translate(winnerRuleMessages, lang, `tier_${o.value}`) }))
}

/** Facet value for posts without a pillar. */
export const NO_PILLAR = "none"

export interface WinnerFilters {
  query: string
  /** TierFilter values, OR-ed ("pinned" = manually pinned, whatever the tier). */
  tiers: string[]
  platforms: string[]
  pillars: string[]
}

export function matchesTierFilter(entry: WinnerEntry, tiers: string[]): boolean {
  if (!tiers.length) return true
  return tiers.some((t) => (t === "pinned" ? entry.row.item.pinned_winner : entry.row.tier === t))
}

export function filterWinners(entries: WinnerEntry[], filters: WinnerFilters): WinnerEntry[] {
  return entries.filter(
    (e) =>
      matchesTierFilter(e, filters.tiers) &&
      (!filters.platforms.length || filters.platforms.includes(e.row.platform)) &&
      (!filters.pillars.length || filters.pillars.includes(e.row.pillarId ?? NO_PILLAR)) &&
      matchesQuery(filters.query, e.row.item.title, e.row.item.hook, e.topic, e.angle, e.format, e.cta)
  )
}

export type WinnerSort = "ratio" | "views" | "recent"

export const SORT_OPTIONS: { value: WinnerSort; label: string }[] = [
  { value: "ratio", label: "Highest multiple" },
  { value: "views", label: "Most views" },
  { value: "recent", label: "Newest first" },
]

/** SORT_OPTIONS with labels in `lang`. */
export function sortOptions(lang: UiLang = "en"): { value: WinnerSort; label: string }[] {
  return SORT_OPTIONS.map((o) => ({ ...o, label: translate(winnerRuleMessages, lang, `sort_${o.value}`) }))
}

function byRatio(a: WinnerEntry, b: WinnerEntry): number {
  return (b.row.ratio ?? -1) - (a.row.ratio ?? -1) || b.row.views - a.row.views || a.row.id.localeCompare(b.row.id)
}

export function sortWinners(entries: WinnerEntry[], sort: WinnerSort): WinnerEntry[] {
  const list = entries.slice()
  if (sort === "views") list.sort((a, b) => b.row.views - a.row.views || byRatio(a, b))
  else if (sort === "recent") list.sort((a, b) => b.row.publishedAt.getTime() - a.row.publishedAt.getTime() || byRatio(a, b))
  else list.sort(byRatio)
  return list
}

/* ---------------------------------- Stats --------------------------------- */

export interface LibraryStats {
  total: number
  breakouts: number
  winners: number
  /** Pinned posts below the Winner threshold. */
  pinnedOnly: number
  best: WinnerEntry | null
  notRepurposed: number
  /** Measured posts published in the period. */
  measured: number
  /** Winner + Breakout share of measured posts (%); null without measured posts. */
  winRate: number | null
}

export function libraryStats(entries: WinnerEntry[], measured: number): LibraryStats {
  let breakouts = 0
  let winners = 0
  let pinnedOnly = 0
  let notRepurposed = 0
  let best: WinnerEntry | null = null
  for (const e of entries) {
    if (e.row.tier === "breakout") breakouts++
    else if (e.row.tier === "winner") winners++
    else pinnedOnly++
    if (!e.childCount) notRepurposed++
    if (e.row.ratio !== null && (best === null || (best.row.ratio ?? 0) < e.row.ratio)) best = e
  }
  return {
    total: entries.length,
    breakouts,
    winners,
    pinnedOnly,
    best,
    notRepurposed,
    measured,
    winRate: measured ? ((breakouts + winners) / measured) * 100 : null,
  }
}

/* ------------------------------ Detection rule ----------------------------- */

type RuleSettings = Pick<
  AppSettings,
  "winner_metric" | "winner_window" | "winner_min_sample" | "tier_good" | "tier_winner" | "tier_breakout"
>

/** Threshold multiple as typed in Settings: 1.5 → "1.5×", 2 → "2×". */
export function formatTimes(value: number): string {
  return `${Number(value.toFixed(2))}×`
}

/** A post's measured multiple: 2.43 → "2.4×". */
export function formatRatio(ratio: number | null): string {
  return ratio === null ? "—" : `${ratio.toFixed(1)}×`
}

export function winnerMetricNoun(metric: WinnerMetric): string {
  return metric === "composite" ? "performance" : (WINNER_METRIC_MAP[metric]?.label ?? metric).toLowerCase()
}

function windowSize(settings: Pick<AppSettings, "winner_window">): number {
  return Math.max(1, Math.round(settings.winner_window))
}

/** Earlier posts needed before a tier is assigned (the minimum sample, capped at the window). */
export function minComparisonPosts(settings: Pick<AppSettings, "winner_window" | "winner_min_sample">): number {
  return Math.min(windowSize(settings), Math.max(1, Math.round(settings.winner_min_sample)))
}

/** "Compared with the average views of the last 20 posts on the same platform". */
export function detectionBasis(settings: Pick<AppSettings, "winner_metric" | "winner_window">, lang: UiLang = "en"): string {
  const t = translator(winnerRuleMessages, lang)
  const size = windowSize(settings)
  const posts = size === 1 ? t("basis_previous_post") : t("basis_last_posts", { count: size })
  if (settings.winner_metric === "composite") return t("basis_composite", { posts })
  return t("basis_metric", { metric: winnerMetricNoun(settings.winner_metric), posts })
}

export function thresholdSteps(settings: RuleSettings): { tier: PerformanceTier; label: string }[] {
  return [
    { tier: "good", label: `Good ≥ ${formatTimes(settings.tier_good)}` },
    { tier: "winner", label: `Winner ≥ ${formatTimes(settings.tier_winner)}` },
    { tier: "breakout", label: `Breakout ≥ ${formatTimes(settings.tier_breakout)}` },
  ]
}

export function formatWinnerValue(metric: WinnerMetric, value: number | null): string {
  if (value === null) return "—"
  if (metric === "engagement_rate") return formatPercent(value)
  if (metric === "composite") return value.toFixed(2)
  return formatNumber(value)
}

/** One sentence on how a post's tier was computed (value vs baseline, sample size) — or why it has none. In `lang` (default English). */
export function tierExplanation(row: TieredRow, settings: RuleSettings, lang: UiLang = "en"): string {
  const t = translator(winnerRuleMessages, lang)
  const platform = PLATFORMS[row.platform].label
  if (!row.metric) return t("explain_no_metrics", { platform })
  const count = formatNumber(row.sampleSize)
  if (row.ratio === null) {
    const min = minComparisonPosts(settings)
    if (row.sampleSize < min) return t.plural("explain_few", row.sampleSize, { count, platform, min })
    return t("explain_zero", { platform })
  }
  if (settings.winner_metric === "composite") {
    return t.plural("explain_composite", row.sampleSize, { count, platform, value: formatWinnerValue("composite", row.value) })
  }
  const metric = settings.winner_metric
  return t.plural("explain_metric", row.sampleSize, {
    count,
    platform,
    value: formatWinnerValue(metric, row.value),
    metric: winnerMetricNoun(metric),
    baseline: formatWinnerValue(metric, row.baseline),
  })
}
