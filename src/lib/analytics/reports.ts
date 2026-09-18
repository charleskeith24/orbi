/**
 * Weekly Report (spec §33) and Monthly Review (spec §34) data.
 * Both are empty-safe: every "best" field is null and every list empty when nothing was published.
 */
import { addDays, differenceInCalendarDays, endOfMonth, startOfMonth, subMonths, subWeeks } from "date-fns"
import { startOfWeek, weekRange } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, Database, PlatformId, WinnerMetric } from "@/lib/types"
import {
  comparePeriods,
  followerGrowthSeries,
  groupByFormat,
  groupByHookCategory,
  groupByPillar,
  groupByPlatform,
  groupByTopic,
  periodTotals,
  scopedRows,
  type FormatAggregate,
  type GroupAggregate,
  type GrowthPoint,
  type PeriodDeltas,
  type PeriodTotals,
  type PillarAggregate,
  type PlatformAggregate,
  type TopicAggregate,
} from "./aggregates"
import { funnelMix, pillarMix, type FunnelMix, type PillarMix } from "./balance"
import { postingWeeks, type PostingWeek } from "./consistency"
import { aggregateMessages } from "./messages"
import { isWinnerTier, performanceValue, type TieredRow } from "./performance"
import { calendarDays, compareNullableDesc, compareText, NO_KEY, toISORange, type DateRange, type ISORange } from "./shared"

export interface ReportHighlight {
  key: string
  label: string
  value: number
  /** What `value` measures, e.g. "avg. views". */
  metricLabel: string
  posts: number
}

/** A post's ranking value under the winner metric (composite → its tier ratio). */
export function reportRankValue(row: TieredRow, metric: WinnerMetric): number | null {
  return metric === "composite" ? row.ratio : performanceValue(row, metric)
}

/** Measured rows, best first by the winner metric (ties → views). */
export function rankRows(rows: TieredRow[], metric: WinnerMetric): TieredRow[] {
  return rows
    .filter((r) => r.metric)
    .sort(
      (a, b) =>
        compareNullableDesc(reportRankValue(a, metric), reportRankValue(b, metric)) || b.views - a.views || compareText(a.id, b.id)
    )
}

type LabeledAggregate = GroupAggregate & { label: string }

/** `label` is a key of `aggregateMessages`. */
const GROUP_PICKERS: Record<
  Exclude<WinnerMetric, "composite">,
  { label: keyof typeof aggregateMessages.en; pick: (g: GroupAggregate) => number | null }
> = {
  views: { label: "metric_views", pick: (g) => g.avgViews },
  engagement_rate: { label: "metric_engagement_rate", pick: (g) => g.engagementRate },
  engagements: { label: "metric_engagements", pick: (g) => g.avgEngagements },
  leads: { label: "metric_leads", pick: (g) => g.leadsPerPost },
}

/**
 * Best measured group under the winner metric (composite → avg. tier ratio, falling back to avg. views); unassigned
 * groups excluded. `metricLabel` is in `lang` (default English).
 */
export function bestGroup(groups: LabeledAggregate[], metric: WinnerMetric, lang: UiLang = "en"): ReportHighlight | null {
  const t = translator(aggregateMessages, lang)
  const candidates = groups.filter((g) => g.measured > 0 && g.key !== NO_KEY)
  const picker =
    metric !== "composite"
      ? GROUP_PICKERS[metric]
      : candidates.some((g) => g.avgRatio !== null)
        ? { label: "metric_baseline" as const, pick: (g: GroupAggregate) => g.avgRatio }
        : GROUP_PICKERS.views
  let best: { group: LabeledAggregate; value: number } | null = null
  for (const group of candidates) {
    const value = picker.pick(group)
    if (value === null) continue
    if (!best || value > best.value || (value === best.value && group.posts > best.group.posts)) best = { group, value }
  }
  return best
    ? { key: best.group.key, label: best.group.label, value: best.value, metricLabel: t(picker.label), posts: best.group.posts }
    : null
}

function asOfDate(range: DateRange, now?: Date): Date {
  return now && now < range.end ? now : range.end
}

/**
 * Last day of `previous` to compare against: its end once `range` is complete, otherwise the same number
 * of days into `previous` as `asOf` is into `range` (like-for-like, so a partial week isn't compared with a full one).
 */
function comparableEnd(range: DateRange, previous: DateRange, asOf: Date): Date {
  if (asOf.getTime() >= range.end.getTime()) return previous.end
  const end = addDays(previous.start, calendarDays(range.start, asOf))
  return end < previous.end ? end : previous.end
}

/* --------------------------------- Weekly ---------------------------------- */

export interface WeeklyReport {
  range: ISORange
  previousRange: ISORange
  published: number
  target: number
  /** published ÷ target × 100 (not capped). */
  consistencyPct: number
  totals: PeriodTotals
  /** The previous week — only its first N days while this week is in progress (see `start`/`end`). */
  previousTotals: PeriodTotals
  /** % change vs the previous week, like-for-like while in progress (null when the previous value was 0). */
  deltas: PeriodDeltas
  bestPost: TieredRow | null
  /** Lowest-ranked measured post; null with fewer than 2 measured posts. */
  worstPost: TieredRow | null
  bestPlatform: ReportHighlight | null
  bestPillar: ReportHighlight | null
  bestTopic: ReportHighlight | null
  bestFormat: ReportHighlight | null
  /** Best hook style (category). */
  bestHook: ReportHighlight | null
  /** This week's published mix vs targets. */
  contentMix: { pillars: PillarMix; funnel: FunnelMix }
  topPosts: TieredRow[]
  /** Posts this week tiered Winner or Breakout. */
  winners: number
  rankedBy: WinnerMetric
}

/**
 * The week containing `weekStart` (settings.week_starts_on): totals, deltas vs the previous week,
 * best/worst post and best platform/pillar/topic/format/hook style ranked by settings.winner_metric.
 * `now` (optional) caps a week still in progress; its deltas then compare the same days of last week.
 * Generated labels ("No pillar", metric labels, mix warnings) are in `lang` (default English).
 */
export function weeklyReport(db: Database, weekStart: Date, settings: AppSettings, now?: Date, lang: UiLang = "en"): WeeklyReport {
  const range = weekRange(weekStart, settings.week_starts_on)
  const previous = weekRange(subWeeks(range.start, 1), settings.week_starts_on)
  const asOf = asOfDate(range, now)
  const metric = settings.winner_metric
  const rows = scopedRows(db, asOf, { start: range.start, end: range.end, settings })
  const ranked = rankRows(rows, metric)
  const totals = periodTotals(db, range.start, asOf)
  const previousTotals = periodTotals(db, previous.start, comparableEnd(range, previous, asOf))
  const target = Math.max(0, Math.round(settings.weekly_post_target))
  const mixOptions = { start: range.start, end: range.end, upcomingDays: 0, lang }
  return {
    range: toISORange(range),
    previousRange: toISORange(previous),
    published: rows.length,
    target,
    consistencyPct: target ? Math.round((rows.length / target) * 100) : 100,
    totals,
    previousTotals,
    deltas: comparePeriods(totals, previousTotals),
    bestPost: ranked[0] ?? null,
    worstPost: ranked.length >= 2 ? ranked[ranked.length - 1] : null,
    bestPlatform: bestGroup(groupByPlatform(rows), metric, lang),
    bestPillar: bestGroup(groupByPillar(db, rows, lang), metric, lang),
    bestTopic: bestGroup(groupByTopic(db, rows), metric, lang),
    bestFormat: bestGroup(groupByFormat(db, rows, lang), metric, lang),
    bestHook: bestGroup(groupByHookCategory(rows, lang), metric, lang),
    contentMix: {
      pillars: pillarMix(db, asOf, settings, mixOptions),
      funnel: funnelMix(db, asOf, settings, mixOptions),
    },
    topPosts: ranked.slice(0, 5),
    winners: rows.filter((r) => isWinnerTier(r.tier)).length,
    rankedBy: metric,
  }
}

/* --------------------------------- Monthly --------------------------------- */

export interface LeadSplit {
  key: string
  label: string
  leads: number
  sales: number
}

export interface MonthlyReport {
  range: ISORange
  previousRange: ISORange
  totals: PeriodTotals
  /** The previous month — only its first N days while this month is in progress (see `start`/`end`). */
  previousTotals: PeriodTotals
  /** % change vs the previous month, like-for-like while in progress (null when the previous value was 0). */
  deltas: PeriodDeltas
  audienceGrowth: { total: number; byPlatform: { platform: PlatformId; label: string; followersGained: number }[] }
  totalReach: number
  totalContent: number
  bestContent: TieredRow | null
  top10: TieredRow[]
  platformPerformance: PlatformAggregate[]
  pillarPerformance: PillarAggregate[]
  topicPerformance: TopicAggregate[]
  formatPerformance: FormatAggregate[]
  /** Daily followers gained (by publish date) with a running total, up to `now` for a month in progress. */
  followerGrowthSeries: GrowthPoint[]
  leadGeneration: { total: number; byPillar: LeadSplit[]; byPlatform: LeadSplit[] }
  /** Conversion (BOFU) content and what it produced. */
  businessOpportunities: { posts: number; leads: number; sales: number; linkClicks: number; topPosts: TieredRow[] }
  /** Weeks overlapping the month. */
  consistency: { weeks: PostingWeek[]; weeksHit: number; weeksConsistent: number; weeksTotal: number }
  winners: number
  rankedBy: WinnerMetric
}

function leadSplit(groups: LabeledAggregate[]): LeadSplit[] {
  return groups
    .filter((g) => g.leads > 0 || g.sales > 0)
    .map((g) => ({ key: g.key, label: g.label, leads: g.leads, sales: g.sales }))
    .sort((a, b) => b.leads - a.leads || b.sales - a.sales || a.label.localeCompare(b.label))
}

/**
 * The calendar month containing `monthStart`: audience growth, reach, best/top-10 content,
 * platform/pillar/topic/format performance, follower growth, lead generation, BOFU outcomes,
 * weekly consistency and deltas vs the previous month. `now` (optional) caps a month in progress;
 * its deltas then compare the same number of days of last month. Generated labels are in `lang` (default English).
 */
export function monthlyReport(db: Database, monthStart: Date, settings: AppSettings, now?: Date, lang: UiLang = "en"): MonthlyReport {
  const range: DateRange = { start: startOfMonth(monthStart), end: endOfMonth(monthStart) }
  const previousStart = startOfMonth(subMonths(range.start, 1))
  const previous: DateRange = { start: previousStart, end: endOfMonth(previousStart) }
  const asOf = asOfDate(range, now)
  const metric = settings.winner_metric
  const weekStartsOn = settings.week_starts_on

  const rows = scopedRows(db, asOf, { start: range.start, end: range.end, settings })
  const ranked = rankRows(rows, metric)
  const totals = periodTotals(db, range.start, asOf)
  const previousTotals = periodTotals(db, previous.start, comparableEnd(range, previous, asOf))
  const platforms = groupByPlatform(rows)
  const pillars = groupByPillar(db, rows, lang)
  const bofu = rows.filter((r) => r.funnelStage === "bofu")

  const firstWeek = startOfWeek(range.start, weekStartsOn)
  const weekCount = Math.round(differenceInCalendarDays(startOfWeek(range.end, weekStartsOn), firstWeek) / 7) + 1
  const weeks = postingWeeks(db, settings, firstWeek, weekCount, now ?? asOf)

  return {
    range: toISORange(range),
    previousRange: toISORange(previous),
    totals,
    previousTotals,
    deltas: comparePeriods(totals, previousTotals),
    audienceGrowth: {
      total: totals.followers,
      byPlatform: platforms
        .map((p) => ({ platform: p.platform, label: p.label, followersGained: p.followersGained }))
        .sort((a, b) => b.followersGained - a.followersGained),
    },
    totalReach: totals.reach,
    totalContent: rows.length,
    bestContent: ranked[0] ?? null,
    top10: ranked.slice(0, 10),
    platformPerformance: platforms,
    pillarPerformance: pillars,
    topicPerformance: groupByTopic(db, rows),
    formatPerformance: groupByFormat(db, rows, lang),
    followerGrowthSeries: followerGrowthSeries(db, asOf, { start: range.start, end: asOf, bucket: "day" }),
    leadGeneration: { total: totals.leads, byPillar: leadSplit(pillars), byPlatform: leadSplit(platforms) },
    businessOpportunities: {
      posts: bofu.length,
      leads: bofu.reduce((acc, r) => acc + r.leads, 0),
      sales: bofu.reduce((acc, r) => acc + r.sales, 0),
      linkClicks: bofu.reduce((acc, r) => acc + r.linkClicks, 0),
      topPosts: rankRows(bofu, "leads").slice(0, 5),
    },
    consistency: {
      weeks,
      weeksHit: weeks.filter((w) => w.hit).length,
      weeksConsistent: weeks.filter((w) => w.consistent).length,
      weeksTotal: weeks.length,
    },
    winners: rows.filter((r) => isWinnerTier(r.tier)).length,
    rankedBy: metric,
  }
}
