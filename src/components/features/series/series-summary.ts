/**
 * Per-series roll-up. An episode is one piece of content across its platform versions
 * (items sharing an idea, or a title on the same day); counts, numbering and "views per
 * episode" work on episodes, while engagement totals stay post-level. Pure.
 */
import { startOfDay } from "date-fns"
import { aggregateRows, tieredRows, type GroupAggregate, type TieredRow } from "@/lib/analytics"
import { PLATFORM_IDS, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate, toISODate } from "@/lib/dates"
import type { AppSettings, ContentItem, ContentSeries, Database, ID, PerformanceTier, PlatformId } from "@/lib/types"
import { nextEpisodeDate } from "./series-schedule"

export interface Episode {
  key: string
  /** 1-based, chronological (undated last). */
  number: number
  /** Platform versions, series platform order first. */
  items: ContentItem[]
  primary: ContentItem
  /** Earliest date among the versions. */
  date: Date | null
  /** Live on at least one platform. */
  published: boolean
  /** Published versions with analytics fields and tiers. */
  rows: TieredRow[]
  /** Σ views across versions with analytics; null when none has analytics. */
  views: number | null
  engagementRate: number | null
  /** Best tier among the versions. */
  tier: PerformanceTier | null
}

export interface SeriesSummary {
  series: ContentSeries
  episodes: Episode[]
  published: Episode[]
  /** Episodes not live anywhere yet, soonest first (undated last). */
  upcoming: Episode[]
  lastPublished: Episode | null
  /** Earliest upcoming episode dated today or later. */
  nextPlanned: Episode | null
  /** Where the next new episode goes: one interval after the latest dated post, on the series weekday. */
  suggestedNext: Date
  /** Content items (posts) across all episodes. */
  posts: number
  /** Post-level totals over published posts. */
  totals: GroupAggregate
  /** Mean views per published episode with analytics (platform versions summed). */
  avgEpisodeViews: number | null
  best: Episode | null
}

const TIER_RANK: Record<PerformanceTier, number> = { normal: 0, good: 1, winner: 2, breakout: 3 }
const DAY_MS = 86_400_000
const isPublished = (item: ContentItem) => PUBLISHED_STAGES.includes(item.stage)
const dayTime = (date: Date | null) => (date ? startOfDay(date).getTime() : Number.POSITIVE_INFINITY)

/** Platform versions of one episode share an idea, or the same title on the same day. */
export function episodeKey(item: ContentItem): string {
  if (item.idea_id) return `idea:${item.idea_id}`
  const title = item.title.trim().toLowerCase()
  if (!title) return `item:${item.id}`
  const date = contentItemDate(item)
  return `title:${title}|${date ? toISODate(date) : "undated"}`
}

function buildEpisode(
  key: string,
  items: ContentItem[],
  series: ContentSeries,
  rowsById: Map<ID, TieredRow>
): Omit<Episode, "number"> {
  const order = (platform: PlatformId) => {
    const index = series.platforms.indexOf(platform)
    return index === -1 ? series.platforms.length + PLATFORM_IDS.indexOf(platform) : index
  }
  const sorted = [...items].sort(
    (a, b) => dayTime(contentItemDate(a)) - dayTime(contentItemDate(b)) || order(a.platform) - order(b.platform)
  )
  const date = sorted.reduce<Date | null>((min, item) => {
    const d = contentItemDate(item)
    return d && (!min || d < min) ? d : min
  }, null)
  const rows = sorted.map((i) => rowsById.get(i.id)).filter((r): r is TieredRow => r !== undefined)
  const measured = rows.filter((r) => r.metric)
  const tier = rows.reduce<PerformanceTier | null>((top, r) => (!top || TIER_RANK[r.tier] > TIER_RANK[top] ? r.tier : top), null)
  return {
    key,
    items: sorted,
    primary: sorted[0],
    date,
    published: sorted.some(isPublished),
    rows,
    views: measured.length ? measured.reduce((acc, r) => acc + r.views, 0) : null,
    engagementRate: measured.length ? aggregateRows(measured).engagementRate : null,
    tier,
  }
}

export function summarizeSeries(
  series: ContentSeries,
  items: ContentItem[],
  rowsById: Map<ID, TieredRow>,
  now: Date
): SeriesSummary {
  const today = startOfDay(now)
  const groups = new Map<string, ContentItem[]>()
  for (const item of items) {
    const key = episodeKey(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }

  const episodes: Episode[] = [...groups]
    .map(([key, list]) => buildEpisode(key, list, series, rowsById))
    .sort((a, b) => dayTime(a.date) - dayTime(b.date) || a.primary.created_at.localeCompare(b.primary.created_at))
    .map((episode, index) => ({ ...episode, number: index + 1 }))

  const published = episodes.filter((e) => e.published)
  const upcoming = episodes.filter((e) => !e.published)
  const latestDated = items.reduce<Date | null>((max, item) => {
    const d = contentItemDate(item)
    return d && (!max || d > max) ? d : max
  }, null)
  const withViews = published.filter((e) => e.views !== null)
  const best = withViews.reduce<Episode | null>((top, e) => (!top || (e.views ?? 0) > (top.views ?? 0) ? e : top), null)

  return {
    series,
    episodes,
    published,
    upcoming,
    lastPublished: published[published.length - 1] ?? null,
    nextPlanned: upcoming.find((e) => e.date && e.date.getTime() >= today.getTime()) ?? null,
    suggestedNext: nextEpisodeDate(series, latestDated, now),
    posts: items.length,
    totals: aggregateRows(
      published.flatMap((e) => e.rows),
      series.id
    ),
    avgEpisodeViews: withViews.length ? withViews.reduce((acc, e) => acc + (e.views ?? 0), 0) / withViews.length : null,
    best,
  }
}

/** Summaries for every series: active first, then by name. */
export function summarizeAllSeries(db: Database, now: Date, settings: AppSettings): SeriesSummary[] {
  const rowsById = new Map(tieredRows(db, settings, now).map((r) => [r.id, r]))
  const itemsBySeries = new Map<ID, ContentItem[]>()
  for (const item of db.content_items) {
    if (!item.series_id) continue
    const list = itemsBySeries.get(item.series_id)
    if (list) list.push(item)
    else itemsBySeries.set(item.series_id, [item])
  }
  return [...db.content_series]
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
    .map((series) => summarizeSeries(series, itemsBySeries.get(series.id) ?? [], rowsById, now))
}

/** The next expected episode date: a planned upcoming episode, else the suggestion. */
export function nextEpisodeInfo(summary: SeriesSummary): { date: Date; planned: boolean; episode: Episode | null } {
  if (summary.nextPlanned?.date) return { date: summary.nextPlanned.date, planned: true, episode: summary.nextPlanned }
  return { date: summary.suggestedNext, planned: false, episode: null }
}

/** Published episodes dated within the last `days` calendar days. */
export function recentEpisodes(summary: SeriesSummary, now: Date, days = 30): number {
  const cutoff = startOfDay(now).getTime() - (days - 1) * DAY_MS
  return summary.published.filter((e) => e.date && e.date.getTime() >= cutoff).length
}
