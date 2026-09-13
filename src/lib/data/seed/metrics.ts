/**
 * Transparent metrics model for the demo workspace, so analytics tell a
 * coherent story:
 *   views = platform baseline × pillar × hook style × format × growth × noise
 * then a chronological pass per platform pins designated winners/breakouts to
 * their ratio vs the previous 20 posts and keeps every other post below 2x.
 * Engagement, clicks and leads derive from views with pillar/hook/funnel effects.
 */
import { addDays, differenceInCalendarDays } from "date-fns"
import { toISODate } from "@/lib/dates"
import type { ContentItem, ContentMetric, FunnelStage, GoalCategory, HookCategory, PlatformId } from "@/lib/types"
import { clamp } from "@/lib/utils"
import type { PillarKey } from "./brand-data"
import type { SeedContext } from "./context"

export type FormatKind = "short" | "long" | "live" | "carousel" | "text" | "image" | "story" | "audio"

export interface MetricSubject {
  item: ContentItem
  publishedAt: Date
  pillar: PillarKey
  hc: HookCategory
  kind: FormatKind
  funnel: FunnelStage
  goal: GoalCategory
  hookWords: number
  /** Forced ratio vs the previous 20 posts on the platform. */
  tier?: number
  /** Repurposed from a proven winner. */
  repurposed?: boolean
  /** Variant A of the Taglish vs English experiment. */
  taglish?: boolean
  /** Add an earlier snapshot for this item. */
  earlySnapshot?: boolean
  /** Leads are not customers (e.g. job applications), so no sales. */
  noSales?: boolean
  note?: string
}

const PLATFORM_BASE: Record<PlatformId, number> = {
  tiktok: 9000,
  facebook: 5000,
  youtube: 4000,
  instagram: 3500,
  linkedin: 2200,
  x: 1200,
  threads: 1500,
}
const PILLAR_MULT: Record<PillarKey, number> = {
  journey: 1.35,
  personal: 1.25,
  authority: 1.1,
  leadership: 1.05,
  education: 1,
  business: 0.6,
}
const HOOK_MULT: Record<HookCategory, number> = {
  contrarian: 1.35,
  story: 1.3,
  results: 1.2,
  curiosity: 1.1,
  mistake: 1.1,
  warning: 1.05,
  authority: 1,
  list: 1,
  problem: 0.95,
  question: 0.9,
  custom: 1,
}
const FORMAT_MULT: Record<FormatKind, number> = {
  short: 1.2,
  long: 1,
  live: 0.75,
  carousel: 0.9,
  text: 0.8,
  image: 0.85,
  story: 0.6,
  audio: 0.7,
}
/** Per-view rates: likes, comments, shares, saves, followers, link clicks. */
const PLATFORM_RATES: Record<PlatformId, [number, number, number, number, number, number]> = {
  tiktok: [0.045, 0.005, 0.004, 0.006, 0.004, 0.0015],
  facebook: [0.035, 0.007, 0.006, 0.003, 0.002, 0.004],
  instagram: [0.05, 0.004, 0.003, 0.012, 0.004, 0.002],
  linkedin: [0.03, 0.006, 0.002, 0.002, 0.006, 0.006],
  youtube: [0.04, 0.003, 0.001, 0.002, 0.005, 0.008],
  x: [0.02, 0.002, 0.003, 0.001, 0.003, 0.003],
  threads: [0.03, 0.006, 0.002, 0.001, 0.003, 0.001],
}
/** Seconds of video per format (for watch time). */
const VIDEO_LENGTH: Partial<Record<FormatKind, number>> = { short: 50, long: 780, live: 2400 }
const WINDOW = 20
const MIN_SAMPLE = 3
const HISTORY_DAYS = 120

/** Share of final views a post has collected `ageDays` after publishing. */
function maturity(ageDays: number): number {
  if (ageDays <= 0) return 0.35
  if (ageDays === 1) return 0.6
  if (ageDays === 2) return 0.78
  if (ageDays === 3) return 0.9
  if (ageDays < 7) return 0.96
  return 1
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function buildMetrics(ctx: SeedContext, subjects: MetricSubject[]): ContentMetric[] {
  const { rng } = ctx
  const views = new Map<string, number>()

  // 1. Model views.
  for (const s of subjects) {
    const age = Math.max(0, differenceInCalendarDays(ctx.today, s.publishedAt))
    const growth = 1 + (0.35 * clamp(HISTORY_DAYS - age, 0, HISTORY_DAYS)) / HISTORY_DAYS
    const noise = clamp(Math.exp(0.22 * rng.normal()), 0.72, 1.4)
    const value =
      PLATFORM_BASE[s.item.platform] *
      PILLAR_MULT[s.pillar] *
      HOOK_MULT[s.hc] *
      FORMAT_MULT[s.kind] *
      (s.repurposed ? 1.2 : 1) *
      growth *
      noise *
      maturity(age)
    views.set(s.item.id, Math.max(180, Math.round(value)))
  }

  // 2. Pin winners and cap accidental outliers, in the same order analytics use.
  const byPlatform = new Map<PlatformId, MetricSubject[]>()
  for (const s of subjects) byPlatform.set(s.item.platform, [...(byPlatform.get(s.item.platform) ?? []), s])
  for (const list of byPlatform.values()) {
    list.sort(
      (a, b) =>
        a.publishedAt.getTime() - b.publishedAt.getTime() ||
        a.item.created_at.localeCompare(b.item.created_at) ||
        a.item.id.localeCompare(b.item.id)
    )
    const history: number[] = []
    for (const s of list) {
      let v = views.get(s.item.id)!
      const window = history.slice(-WINDOW)
      if (window.length >= MIN_SAMPLE) {
        const baseline = mean(window)
        if (s.tier) v = Math.round(baseline * s.tier)
        else if (v / baseline >= 1.85) v = Math.round(baseline * rng.float(1.45, 1.8))
      }
      views.set(s.item.id, v)
      history.push(v)
    }
  }

  // 3. Derive the rest of the snapshot.
  const rows: ContentMetric[] = []
  for (const s of subjects) {
    const v = views.get(s.item.id)!
    const age = Math.max(0, differenceInCalendarDays(ctx.today, s.publishedAt))
    const [likeR, commentR, shareR, saveR, followR, clickR] = PLATFORM_RATES[s.item.platform]
    const jitter = () => rng.float(0.8, 1.2)
    const winnerBoost = s.tier ? 1.3 : 1

    const commentMult =
      (s.pillar === "journey" || s.pillar === "personal" ? 1.8 : 1) *
      (s.hc === "story" ? 1.2 : s.hc === "question" ? 1.3 : 1) *
      (s.kind === "live" ? 3 : 1) *
      (s.taglish ? 1.6 : 1)
    const shareMult = (s.hc === "contrarian" ? 2.2 : 1) * winnerBoost * (s.taglish ? 1.25 : 1)
    const saveMult =
      (s.pillar === "education" ? 2.2 : 1) * (s.kind === "carousel" ? 1.8 : 1) * (s.hc === "list" ? 1.3 : 1)
    const funnelFollow = s.funnel === "tofu" ? 1.2 : s.funnel === "bofu" ? 0.6 : 1
    const funnelClick = s.funnel === "bofu" ? 3.5 : s.funnel === "mofu" ? 1.4 : 0.6

    const reach = Math.round(v * rng.float(0.7, 0.9))
    const likes = Math.round(v * likeR * jitter() * (s.taglish ? 1.25 : 1))
    const comments = Math.round(v * commentR * commentMult * jitter())
    const shares = Math.round(v * shareR * shareMult * jitter())
    const saves = Math.round(v * saveR * saveMult * jitter())
    const followers = Math.round(v * followR * funnelFollow * jitter())
    const profileVisits = Math.round(v * rng.float(0.012, 0.02))
    const clicks = Math.round(v * clickR * funnelClick * jitter())

    let leads = 0
    if (s.funnel === "bofu" || s.pillar === "business") leads = Math.round(clicks * rng.float(0.08, 0.14))
    else if (s.funnel === "mofu" && (s.pillar === "authority" || s.goal === "leads")) leads = Math.round(clicks * rng.float(0.03, 0.06))
    else if (rng.chance(0.25)) leads = 1
    let sales = 0
    if (s.funnel === "bofu" || s.pillar === "business") sales = Math.min(3, Math.round(leads * rng.float(0.1, 0.25)))
    else if (s.kind === "long" && s.pillar === "authority" && rng.chance(0.5)) sales = 1
    if (s.noSales) sales = 0

    const length = VIDEO_LENGTH[s.kind]
    let retention: number | null = null
    let watchTime: number | null = null
    if (length) {
      const base = s.kind === "short" ? 42 : s.kind === "long" ? 34 : 28
      const hookEffect = s.kind === "short" ? (s.hookWords <= 8 ? 9 : s.hookWords >= 15 ? -6 : 0) : 0
      retention = Math.round(clamp(base + hookEffect + (s.tier ? 6 : 0) + rng.normal() * 4, 25, 65))
      watchTime = Math.round(v * length * (retention / 100))
    }

    const finalValues = {
      views: v,
      reach,
      likes,
      comments,
      shares,
      saves,
      followers_gained: followers,
      profile_visits: profileVisits,
      link_clicks: clicks,
      leads,
      sales,
      watch_time_seconds: watchTime,
      avg_retention: retention,
    }

    const publishedDay = differenceInCalendarDays(s.publishedAt, ctx.today)
    const latestOffset = Math.min(0, publishedDay + Math.min(7, Math.max(1, age)))
    const latestAt = recordTime(ctx, latestOffset)

    if (s.earlySnapshot && age >= 4) {
      const earlyOffset = publishedDay + 2
      const share = rng.float(0.55, 0.7)
      const scale = (n: number) => Math.round(n * share)
      rows.push(
        ctx.build(
          "content_metrics",
          {
            content_item_id: s.item.id,
            platform: s.item.platform,
            recorded_at: toISODate(addDays(ctx.today, earlyOffset)),
            views: scale(v),
            reach: scale(reach),
            likes: scale(likes),
            comments: scale(comments),
            shares: scale(shares),
            saves: scale(saves),
            followers_gained: scale(followers),
            profile_visits: scale(profileVisits),
            link_clicks: scale(clicks),
            leads: Math.floor(leads * share),
            sales: Math.floor(sales * share),
            watch_time_seconds: watchTime === null ? null : scale(watchTime),
            avg_retention: retention === null ? null : Math.min(65, retention + 2),
            notes: "48-hour check-in",
            source: "manual",
          },
          recordTime(ctx, earlyOffset)
        )
      )
    }

    rows.push(
      ctx.build(
        "content_metrics",
        {
          content_item_id: s.item.id,
          platform: s.item.platform,
          recorded_at: toISODate(addDays(ctx.today, latestOffset)),
          ...finalValues,
          notes: s.note ?? (age < 3 ? "Still collecting — early numbers" : ""),
          source: "manual",
        },
        latestAt
      )
    )
  }
  return rows
}

/** 10:15 on the given day, never later than now. */
function recordTime(ctx: SeedContext, offset: number): Date {
  const at = ctx.date(offset, "10:15")
  return at > ctx.now ? ctx.now : at
}
