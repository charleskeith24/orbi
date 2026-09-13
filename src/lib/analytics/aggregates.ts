/**
 * Group-level performance (pillar, platform, format, hook, angle, funnel, topic, campaign),
 * time series and period totals. Metrics are the latest snapshot per item,
 * attributed to the item's publish date.
 */
import { addDays, addWeeks, differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES, HOOK_CATEGORIES, PLATFORMS } from "@/lib/constants"
import type {
  AppSettings,
  CategoricalColor,
  ContentAngle,
  ContentCampaign,
  ContentFormat,
  ContentItem,
  ContentPillar,
  Database,
  FunnelStage,
  Hook,
  HookCategory,
  ID,
  ISODate,
  MetricKey,
  PlatformId,
} from "@/lib/types"
import { average, ratio as percentOf, uniq } from "@/lib/utils"
import { sharedPerformanceRows, type PerformanceRow } from "./metrics"
import { sharedTieredRows, type TierInfo, type TieredRow } from "./performance"
import {
  compareNullableDesc,
  compareText,
  dayKey,
  finiteOr0,
  inRange,
  localWeekStart,
  NO_KEY,
  resolveRange,
  resolveSettings,
  roundTo,
  toDate,
  trailingDays,
  type DateRange,
  type RangeOptions,
} from "./shared"

/* ------------------------------- Aggregation ------------------------------- */

export interface GroupAggregate {
  key: string
  /** Published posts in the group. */
  posts: number
  /** Posts with at least one analytics snapshot — the denominator of every average. */
  measured: number
  views: number
  reach: number
  engagements: number
  likes: number
  comments: number
  shares: number
  saves: number
  leads: number
  sales: number
  followersGained: number
  profileVisits: number
  linkClicks: number
  avgViews: number | null
  avgEngagements: number | null
  /** Σ engagements ÷ Σ (reach, falling back to views) × 100. */
  engagementRate: number | null
  leadsPerPost: number | null
  avgRetention: number | null
  /** Mean winner-detection ratio (rows that carry one). */
  avgRatio: number | null
  /** Posts tiered Winner or Breakout (rows that carry a tier). */
  winners: number
}

type AggregatableRow = PerformanceRow & Partial<Pick<TierInfo, "tier" | "ratio">>

/** Totals for a set of rows; averages divide by measured posts; engagementRate = Σ engagements ÷ Σ base. */
export function aggregateRows(rows: AggregatableRow[], key = "all"): GroupAggregate {
  let measured = 0
  let views = 0
  let reach = 0
  let engagements = 0
  let base = 0
  let likes = 0
  let comments = 0
  let shares = 0
  let saves = 0
  let leads = 0
  let sales = 0
  let followersGained = 0
  let profileVisits = 0
  let linkClicks = 0
  let winners = 0
  const retention: number[] = []
  const ratios: number[] = []
  for (const r of rows) {
    if (r.metric) measured++
    views += r.views
    reach += r.reach
    engagements += r.engagements
    base += r.base
    likes += r.likes
    comments += r.comments
    shares += r.shares
    saves += r.saves
    leads += r.leads
    sales += r.sales
    followersGained += r.followersGained
    profileVisits += r.profileVisits
    linkClicks += r.linkClicks
    if (r.retention !== null) retention.push(r.retention)
    if (typeof r.ratio === "number") ratios.push(r.ratio)
    if (r.tier === "winner" || r.tier === "breakout") winners++
  }
  return {
    key,
    posts: rows.length,
    measured,
    views,
    reach,
    engagements,
    likes,
    comments,
    shares,
    saves,
    leads,
    sales,
    followersGained,
    profileVisits,
    linkClicks,
    avgViews: measured ? views / measured : null,
    avgEngagements: measured ? engagements / measured : null,
    engagementRate: percentOf(engagements, base),
    leadsPerPost: measured ? leads / measured : null,
    avgRetention: average(retention),
    avgRatio: average(ratios),
    winners,
  }
}

function byViewsDesc(a: GroupAggregate, b: GroupAggregate): number {
  return b.views - a.views || b.posts - a.posts || compareText(a.key, b.key)
}

/** Aggregate per key (a row may join several groups; null/empty keys are skipped); sorted by total views desc. */
export function aggregateGroups<R extends AggregatableRow>(
  rows: R[],
  keyFn: (row: R) => string | string[] | null | undefined
): GroupAggregate[] {
  const groups = new Map<string, R[]>()
  for (const row of rows) {
    const k = keyFn(row)
    const keys = Array.isArray(k) ? uniq(k.filter(Boolean)) : k ? [k] : []
    for (const key of keys) {
      const list = groups.get(key)
      if (list) list.push(row)
      else groups.set(key, [row])
    }
  }
  return [...groups].map(([key, list]) => aggregateRows(list, key)).sort(byViewsDesc)
}

export interface AggregateOptions extends RangeOptions {
  /** Used for tier ratios; defaults to the workspace settings row. */
  settings?: AppSettings
  platform?: PlatformId
}

/** Tiered published rows inside the window (all time when no `days`/`start` is given). */
export function scopedRows(db: Database, now: Date, options: AggregateOptions = {}): TieredRow[] {
  const range = resolveRange(now, options)
  return sharedTieredRows(db, resolveSettings(db, options.settings), now).filter(
    (r) => inRange(r.publishedAt, range) && (!options.platform || r.platform === options.platform)
  )
}

/* ------------------------------- Dimensions -------------------------------- */

export interface PillarAggregate extends GroupAggregate {
  pillar: ContentPillar | null
  label: string
  color: CategoricalColor | null
}

export interface PlatformAggregate extends GroupAggregate {
  platform: PlatformId
  label: string
}

export interface FormatAggregate extends GroupAggregate {
  format: ContentFormat | null
  label: string
}

export interface HookCategoryAggregate extends GroupAggregate {
  category: HookCategory | null
  label: string
}

export interface HookAggregate extends GroupAggregate {
  hook: Hook
  label: string
}

export interface AngleAggregate extends GroupAggregate {
  angle: ContentAngle
  label: string
}

export interface FunnelAggregate extends GroupAggregate {
  stage: FunnelStage | null
  label: string
}

export interface TopicAggregate extends GroupAggregate {
  label: string
  /** Where the topic came from: the idea's core topic, the item's tags, or its pillar. */
  source: TopicSource
}

function byAvgViewsDesc(a: GroupAggregate, b: GroupAggregate): number {
  return compareNullableDesc(a.avgViews, b.avgViews) || b.posts - a.posts || compareText(a.key, b.key)
}

/** Per pillar: every active pillar (in sort order, zero rows included), pillars with posts, then "No pillar". */
export function groupByPillar(db: Database, rows: TieredRow[]): PillarAggregate[] {
  const groups = new Map(aggregateGroups(rows, (r) => r.pillarId).map((g) => [g.key, g]))
  const pillars = [...db.content_pillars].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const known = new Set(pillars.map((p) => p.id))
  const out: PillarAggregate[] = []
  for (const pillar of pillars) {
    const g = groups.get(pillar.id)
    if (!g && !pillar.is_active) continue
    out.push({ ...(g ?? aggregateRows([], pillar.id)), pillar, label: pillar.name, color: pillar.color })
  }
  const orphans = rows.filter((r) => !r.pillarId || !known.has(r.pillarId))
  if (orphans.length) out.push({ ...aggregateRows(orphans, NO_KEY), pillar: null, label: "No pillar", color: null })
  return out
}

/** Per platform with at least one post, sorted by total views desc. */
export function groupByPlatform(rows: TieredRow[]): PlatformAggregate[] {
  return aggregateGroups(rows, (r) => r.platform).map((g) => {
    const platform = g.key as PlatformId
    return { ...g, platform, label: PLATFORMS[platform]?.label ?? g.key }
  })
}

/** Per content format (plus "No format"), sorted by total views desc. */
export function groupByFormat(db: Database, rows: TieredRow[]): FormatAggregate[] {
  const formats = new Map(db.content_formats.map((f) => [f.id, f]))
  return aggregateGroups(rows, (r) => (r.formatId && formats.has(r.formatId) ? r.formatId : NO_KEY)).map((g) => {
    const format = formats.get(g.key) ?? null
    return { ...g, format, label: format?.name ?? "No format" }
  })
}

/** Per hook style (spec §13), sorted by average views desc. */
export function groupByHookCategory(rows: TieredRow[]): HookCategoryAggregate[] {
  return aggregateGroups(rows, (r) => r.hookCategory ?? NO_KEY)
    .map((g) => {
      const category = g.key === NO_KEY ? null : (g.key as HookCategory)
      return { ...g, category, label: category ? (HOOK_CATEGORIES[category]?.label ?? category) : "No hook style" }
    })
    .sort(byAvgViewsDesc)
}

/** Per Hook Library entry (items linked via hook_id), sorted by average views desc. */
export function groupByHook(db: Database, rows: TieredRow[]): HookAggregate[] {
  const hooks = new Map(db.hooks.map((h) => [h.id, h]))
  const out: HookAggregate[] = []
  for (const g of aggregateGroups(rows, (r) => (r.hookId && hooks.has(r.hookId) ? r.hookId : null))) {
    const hook = hooks.get(g.key)
    if (hook) out.push({ ...g, hook, label: hook.text })
  }
  return out.sort(byAvgViewsDesc)
}

/** Per Angle Library entry, sorted by average views desc. */
export function groupByAngle(db: Database, rows: TieredRow[]): AngleAggregate[] {
  const angles = new Map(db.angles.map((a) => [a.id, a]))
  const out: AngleAggregate[] = []
  for (const g of aggregateGroups(rows, (r) => (r.angleId && angles.has(r.angleId) ? r.angleId : null))) {
    const angle = angles.get(g.key)
    if (angle) out.push({ ...g, angle, label: angle.name })
  }
  return out.sort(byAvgViewsDesc)
}

/** TOFU, MOFU, BOFU (always present, in funnel order) then "Unassigned" when any post lacks a stage. */
export function groupByFunnel(rows: TieredRow[]): FunnelAggregate[] {
  const groups = new Map(aggregateGroups(rows, (r) => r.funnelStage ?? NO_KEY).map((g) => [g.key, g]))
  const out: FunnelAggregate[] = FUNNEL_STAGE_IDS.map((stage) => ({
    ...(groups.get(stage) ?? aggregateRows([], stage)),
    stage,
    label: FUNNEL_STAGES[stage].label,
  }))
  const none = groups.get(NO_KEY)
  if (none) out.push({ ...none, stage: null, label: "Unassigned" })
  return out
}

export type TopicSource = "idea" | "tag" | "pillar"

export interface TopicRef {
  key: string
  label: string
  source: TopicSource
}

const normalizeTopic = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ")

/** Topics per item: the idea's core topic → the item's tag names (one topic each) → its pillar name. */
export function itemTopics(db: Database): Map<ID, TopicRef[]> {
  const ideas = new Map(db.content_ideas.map((i) => [i.id, i]))
  const pillars = new Map(db.content_pillars.map((p) => [p.id, p]))
  const tagNames = new Map(db.tags.map((t) => [t.id, t.name]))
  const tagsByItem = new Map<ID, string[]>()
  for (const link of db.content_tags) {
    if (link.entity_type !== "content_items") continue
    const name = tagNames.get(link.tag_id)
    if (!name) continue
    const list = tagsByItem.get(link.entity_id)
    if (list) list.push(name)
    else tagsByItem.set(link.entity_id, [name])
  }
  const out = new Map<ID, TopicRef[]>()
  for (const item of db.content_items) {
    const coreTopic = (item.idea_id ? ideas.get(item.idea_id)?.core_topic : "")?.trim() ?? ""
    const tags = tagsByItem.get(item.id)
    const pillar = item.pillar_id ? pillars.get(item.pillar_id) : undefined
    let refs: TopicRef[] = []
    if (coreTopic) refs = [{ key: normalizeTopic(coreTopic), label: coreTopic, source: "idea" }]
    else if (tags?.length) refs = uniq(tags).map((t) => ({ key: normalizeTopic(t), label: t, source: "tag" as const }))
    else if (pillar) refs = [{ key: normalizeTopic(pillar.name), label: pillar.name, source: "pillar" }]
    out.set(item.id, refs)
  }
  return out
}

/** Per topic (see itemTopics), sorted by total views desc. */
export function groupByTopic(db: Database, rows: TieredRow[]): TopicAggregate[] {
  const topics = itemTopics(db)
  const refs = new Map<string, TopicRef>()
  for (const row of rows) for (const ref of topics.get(row.id) ?? []) if (!refs.has(ref.key)) refs.set(ref.key, ref)
  return aggregateGroups(rows, (r) => topics.get(r.id)?.map((t) => t.key)).map((g) => {
    const ref = refs.get(g.key)
    return { ...g, label: ref?.label ?? g.key, source: ref?.source ?? "idea" }
  })
}

/** Dashboard table (Pillar | Posts | Avg Views | Engagement | Leads). */
export function pillarPerformance(db: Database, now: Date, options: AggregateOptions = {}): PillarAggregate[] {
  return groupByPillar(db, scopedRows(db, now, options))
}

export function platformPerformance(db: Database, now: Date, options: AggregateOptions = {}): PlatformAggregate[] {
  return groupByPlatform(scopedRows(db, now, options))
}

export function formatPerformance(db: Database, now: Date, options: AggregateOptions = {}): FormatAggregate[] {
  return groupByFormat(db, scopedRows(db, now, options))
}

/** Which hook styles earn the highest views / retention / engagement / leads (spec §13). */
export function hookCategoryPerformance(db: Database, now: Date, options: AggregateOptions = {}): HookCategoryAggregate[] {
  return groupByHookCategory(scopedRows(db, now, options))
}

export function hookPerformance(db: Database, now: Date, options: AggregateOptions = {}): HookAggregate[] {
  return groupByHook(db, scopedRows(db, now, options))
}

export function anglePerformance(db: Database, now: Date, options: AggregateOptions = {}): AngleAggregate[] {
  return groupByAngle(db, scopedRows(db, now, options))
}

export function funnelPerformance(db: Database, now: Date, options: AggregateOptions = {}): FunnelAggregate[] {
  return groupByFunnel(scopedRows(db, now, options))
}

/** By idea core topic, falling back to tag names, then pillar name. */
export function topicPerformance(db: Database, now: Date, options: AggregateOptions = {}): TopicAggregate[] {
  return groupByTopic(db, scopedRows(db, now, options))
}

/* -------------------------------- Campaigns -------------------------------- */

export interface CampaignPerformance {
  campaign: ContentCampaign
  /** Every item in the campaign, any stage. */
  items: ContentItem[]
  /** Published items with metrics and tiers, newest first. */
  rows: TieredRow[]
  totals: GroupAggregate
  published: number
  /** Items not yet published. */
  planned: number
  targetPosts: number | null
  /** published ÷ target_posts × 100; null without a target. */
  progressPct: number | null
  byPlatform: PlatformAggregate[]
  bestPost: TieredRow | null
  /** Calendar days until end_date (negative once over). */
  daysRemaining: number | null
}

/** Campaign totals, progress vs target_posts, per-platform split and best post; null for an unknown id. */
export function campaignPerformance(db: Database, campaignId: ID, now: Date, settings?: AppSettings): CampaignPerformance | null {
  const campaign = db.content_campaigns.find((c) => c.id === campaignId)
  if (!campaign) return null
  const items = db.content_items.filter((i) => i.campaign_id === campaignId)
  const rows = sharedTieredRows(db, resolveSettings(db, settings), now).filter((r) => r.campaignId === campaignId)
  const target = campaign.target_posts && campaign.target_posts > 0 ? campaign.target_posts : null
  const end = toDate(campaign.end_date)
  const bestPost = rows.filter((r) => r.metric).sort((a, b) => b.views - a.views || b.engagements - a.engagements)[0] ?? null
  const publishedIds = new Set(rows.map((r) => r.id))
  return {
    campaign,
    items,
    rows,
    totals: aggregateRows(rows, campaign.id),
    published: rows.length,
    planned: items.filter((i) => !publishedIds.has(i.id)).length,
    targetPosts: target,
    progressPct: target ? Math.round((rows.length / target) * 100) : null,
    byPlatform: groupByPlatform(rows),
    bestPost,
    daysRemaining: end ? differenceInCalendarDays(end, now) : null,
  }
}

/* ------------------------------- Time series ------------------------------- */

/** Summable metric fields plus "engagements", "posts" and the ratio-of-sums "engagement_rate". */
export type SeriesMetric = MetricKey | "engagements" | "posts" | "engagement_rate"
export type SeriesBucket = "day" | "week"

export interface SeriesOptions extends RangeOptions {
  /** Default "day". Week buckets start on `weekStartsOn` (default settings.week_starts_on). */
  bucket?: SeriesBucket
  /** Default "views". */
  metric?: SeriesMetric
  weekStartsOn?: 0 | 1
  platform?: PlatformId
}

export interface SeriesPoint {
  /** First day of the bucket. */
  date: ISODate
  /** "Sep 7" */
  label: string
  /** Sum for the bucket (0 when empty); rates and avg_retention are null when there is no data. */
  value: number | null
}

export interface GrowthPoint extends SeriesPoint {
  value: number
  cumulative: number
}

function seriesValue(rows: PerformanceRow[], metric: SeriesMetric): number | null {
  switch (metric) {
    case "posts":
      return rows.length
    case "engagements":
      return rows.reduce((acc, r) => acc + r.engagements, 0)
    case "engagement_rate":
      return percentOf(
        rows.reduce((acc, r) => acc + r.engagements, 0),
        rows.reduce((acc, r) => acc + r.base, 0)
      )
    case "avg_retention":
      return average(rows.map((r) => r.retention).filter((v): v is number => v !== null))
    default:
      return rows.reduce((acc, r) => acc + finiteOr0(r.metric?.[metric]), 0)
  }
}

/** Bucketed series (zero-filled) of `metric` summed by publish date over the window (default last 30 days). */
export function timeSeries(db: Database, now: Date, options: SeriesOptions = {}): SeriesPoint[] {
  const bucket = options.bucket ?? "day"
  const weekStartsOn = options.weekStartsOn ?? resolveSettings(db).week_starts_on
  const metric = options.metric ?? "views"
  const window = resolveRange(now, options, 30) ?? trailingDays(now, 30)
  const range: DateRange = bucket === "week" ? { start: localWeekStart(window.start, weekStartsOn), end: window.end } : window
  const keyOf = (d: Date) => dayKey(bucket === "week" ? localWeekStart(d, weekStartsOn) : d)

  const starts: Date[] = []
  for (let d = range.start; d <= range.end; d = bucket === "week" ? addWeeks(d, 1) : addDays(d, 1)) starts.push(d)
  const groups = new Map<ISODate, PerformanceRow[]>(starts.map((d) => [dayKey(d), []]))
  for (const row of sharedPerformanceRows(db, now)) {
    if (!inRange(row.publishedAt, range) || (options.platform && row.platform !== options.platform)) continue
    groups.get(keyOf(row.publishedAt))?.push(row)
  }
  return starts.map((d) => {
    const date = dayKey(d)
    return { date, label: format(d, "MMM d"), value: seriesValue(groups.get(date) ?? [], metric) }
  })
}

/** Followers gained per bucket (by publish date) with a running cumulative total. */
export function followerGrowthSeries(db: Database, now: Date, options: Omit<SeriesOptions, "metric"> = {}): GrowthPoint[] {
  let running = 0
  return timeSeries(db, now, { ...options, metric: "followers_gained" }).map((p) => {
    const value = p.value ?? 0
    running += value
    return { ...p, value, cumulative: running }
  })
}

/* ------------------------------ Period totals ------------------------------ */

export interface PeriodTotals {
  start: ISODate
  end: ISODate
  posts: number
  measured: number
  views: number
  reach: number
  engagements: number
  likes: number
  comments: number
  shares: number
  saves: number
  followers: number
  leads: number
  sales: number
  profileVisits: number
  linkClicks: number
  engagementRate: number | null
}

export const PERIOD_TOTAL_KEYS = [
  "posts",
  "views",
  "reach",
  "engagements",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers",
  "leads",
  "sales",
  "profileVisits",
  "linkClicks",
  "engagementRate",
] as const

export type PeriodTotalKey = (typeof PERIOD_TOTAL_KEYS)[number]
/** % change per total; null when the previous value is 0 or missing. */
export type PeriodDeltas = Record<PeriodTotalKey, number | null>

/** Sums over items published between the start of `start`'s day and the end of `end`'s day. */
export function periodTotals(db: Database, start: Date, end: Date): PeriodTotals {
  const range = { start: startOfDay(start), end: endOfDay(end) }
  const agg = aggregateRows(sharedPerformanceRows(db, range.end).filter((r) => inRange(r.publishedAt, range)))
  return {
    start: dayKey(range.start),
    end: dayKey(range.end),
    posts: agg.posts,
    measured: agg.measured,
    views: agg.views,
    reach: agg.reach,
    engagements: agg.engagements,
    likes: agg.likes,
    comments: agg.comments,
    shares: agg.shares,
    saves: agg.saves,
    followers: agg.followersGained,
    leads: agg.leads,
    sales: agg.sales,
    profileVisits: agg.profileVisits,
    linkClicks: agg.linkClicks,
    engagementRate: agg.engagementRate,
  }
}

/** (current − previous) ÷ |previous| × 100, 1 decimal; null when previous is 0 or either is null. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return roundTo(((current - previous) / Math.abs(previous)) * 100)
}

/** % delta for every total (engagementRate is compared relatively too). */
export function comparePeriods(current: PeriodTotals, previous: PeriodTotals): PeriodDeltas {
  const out = {} as PeriodDeltas
  for (const key of PERIOD_TOTAL_KEYS) out[key] = percentChange(current[key], previous[key])
  return out
}

/** The equally long window immediately before [start, end]. */
export function previousPeriod(start: Date, end: Date): DateRange {
  const days = differenceInCalendarDays(end, start) + 1
  return { start: startOfDay(subDays(start, days)), end: endOfDay(subDays(start, 1)) }
}
