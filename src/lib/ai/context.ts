/**
 * Brand Context — the compact, JSON-serialisable snapshot of Brand HQ, audience, pillars, goals,
 * platforms, winners and stories that accompanies every AI call (spec §29, §57).
 *
 * Built client-side from the workspace (`buildBrandContext`) and validated leniently on the
 * server (`brandContextSchema`), so a partial or older client never breaks the gateway.
 * `buildAnalyticsSnapshot` is the numbers-only companion used by the strategist and reviews.
 */
import * as z from "zod"
import {
  aggregateRows,
  contentBuffer,
  contentHealthScore,
  engagementTrend,
  funnelMix,
  getWinners,
  groupByFormat,
  groupByHookCategory,
  groupByPillar,
  groupByPlatform,
  pillarMix,
  recommendNextContent,
  scopedRows,
  strategicInsights,
  weeklyPostingProgress,
  type GroupAggregate,
} from "@/lib/analytics"
import {
  DAYS_OF_WEEK,
  GOAL_CATEGORY_IDS,
  GOAL_METRIC_MAP,
  GOAL_PERIODS,
  HOOK_CATEGORIES,
  HOOK_CATEGORY_IDS,
  PERFORMANCE_TIER_IDS,
  PERSONALITY_TRAIT_MAP,
  PLATFORM_IDS,
  PLATFORMS,
  SCRIPT_FORMAT_IDS,
  TONE_MAP,
} from "@/lib/constants"
import { buildRow } from "@/lib/data/defaults"
import { toISODate } from "@/lib/dates"
import type {
  Database,
  GoalCategory,
  HookCategory,
  ID,
  PerformanceTier,
  PlatformId,
  ScriptFormat,
} from "@/lib/types"
import { clip, overlap, tokenSet } from "./offline/text"

/* ------------------------------ Lenient schema ----------------------------- */

const text = (max: number) =>
  z
    .string()
    .catch("")
    .transform((s) => clip(s, max))
const nullableId = z.string().nullable().catch(null)
const count = (fallback = 0) => z.number().catch(fallback)
const nullableNumber = z.number().nullable().catch(null)
const flag = z.boolean().catch(false)

function strings(maxItems: number, maxLen: number) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .slice(0, maxItems)
        .map((s) => clip(s, maxLen))
    )
}

/** Array whose invalid elements are dropped instead of failing the whole context. */
function listOf<T extends z.ZodType>(item: T, maxItems: number) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((list) => {
      const out: z.output<T>[] = []
      for (const value of list) {
        if (out.length >= maxItems) break
        const parsed = item.safeParse(value)
        if (parsed.success) out.push(parsed.data)
      }
      return out
    })
}

const platformEnum = z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]])
const hookCategoryEnum = z.enum(HOOK_CATEGORY_IDS as [HookCategory, ...HookCategory[]])
const platformList = z
  .array(z.unknown())
  .catch([])
  .transform((list) => list.filter((v): v is PlatformId => typeof v === "string" && (PLATFORM_IDS as string[]).includes(v)))

const brandSchema = z.object({
  name: text(120),
  brand_name: text(120),
  role: text(160),
  industry: text(160),
  expertise_summary: text(600),
  years_experience: nullableNumber,
  location: text(120),
  who_am_i: text(600),
  known_for: text(400),
  problems_solved: text(400),
  why_listen: text(500),
  point_of_view: text(600),
  positioning_statement: text(400),
  positioning_audience: text(200),
  positioning_result: text(200),
  positioning_method: text(200),
  expertise_areas: strings(12, 60),
  personality: strings(10, 40),
  language: z.enum(["english", "tagalog", "taglish"]).catch("english"),
  tones: strings(6, 40),
  always_do: text(600),
  never_do: text(600),
  phrases_used: strings(12, 80),
  phrases_avoid: strings(15, 60),
  cta_style: text(360),
  storytelling_style: text(400),
})

const groupStatSchema = z.object({
  key: text(60),
  label: text(60),
  posts: count(),
  avg_views: nullableNumber,
  engagement_rate: nullableNumber,
  leads: count(),
  winners: count(),
  /** Average views ÷ overall average views. */
  ratio: nullableNumber,
})

export const brandContextSchema = z.object({
  version: count(1),
  generated_at: text(40),
  today: text(10),
  weekday: text(12),
  brand: brandSchema.catch(() => brandSchema.parse({})),
  goals: listOf(
    z.object({
      id: z.string(),
      name: text(100),
      category: z.enum(GOAL_CATEGORY_IDS as [GoalCategory, ...GoalCategory[]]).catch("awareness"),
      description: text(180),
      target: text(80),
      is_primary: flag,
      is_secondary: flag,
    }),
    8
  ),
  pillars: listOf(
    z.object({
      id: z.string(),
      name: text(60),
      description: text(240),
      target_percentage: count(),
      /** Share of the last 30 days' content mix (0–100), null without data. */
      recent_share: nullableNumber,
      examples: strings(6, 70),
    }),
    10
  ),
  personas: listOf(
    z.object({
      id: z.string(),
      name: text(80),
      profession: text(120),
      experience_level: text(100),
      is_primary: flag,
      platforms: platformList,
      goals: strings(3, 100),
      problems: strings(5, 100),
      frustrations: strings(3, 100),
      questions: strings(4, 100),
      objections: strings(2, 90),
      language_used: strings(5, 50),
    }),
    5
  ),
  problems: listOf(
    z.object({
      id: z.string(),
      problem: text(150),
      persona_id: nullableId,
      pillar_id: nullableId,
      severity: count(3),
      category: text(20),
    }),
    12
  ),
  questions: listOf(
    z.object({ id: z.string(), question: text(150), frequency: count(1), persona_id: nullableId, pillar_id: nullableId }),
    8
  ),
  platforms: listOf(
    z.object({
      platform: platformEnum,
      label: text(30),
      posting_frequency: count(),
      audience: text(120),
      cta_style: text(120),
      preferred_format_ids: strings(6, 60),
      preferred_pillar_ids: strings(6, 60),
      posts_90d: count(),
      avg_views: nullableNumber,
      engagement_rate: nullableNumber,
    }),
    7
  ),
  formats: listOf(
    z.object({
      id: z.string(),
      name: text(50),
      category: text(20),
      script_format: z.enum(SCRIPT_FORMAT_IDS as [ScriptFormat, ...ScriptFormat[]]).catch("custom"),
    }),
    30
  ),
  angles: listOf(z.object({ id: z.string(), name: text(40) }), 30),
  /** Hook styles ranked by average views vs overall (best first). */
  hook_performance: listOf(
    z.object({ category: hookCategoryEnum, label: text(30), posts: count(), avg_views: nullableNumber, ratio: nullableNumber }),
    11
  ),
  top_hooks: listOf(
    z.object({
      text: text(180),
      category: hookCategoryEnum.catch("custom"),
      source: z.enum(["winner", "library"]).catch("library"),
    }),
    8
  ),
  winners: listOf(
    z.object({
      item_id: z.string(),
      title: text(120),
      hook: text(160),
      hook_category: hookCategoryEnum.nullable().catch(null),
      pillar_id: nullableId,
      platform: platformEnum.catch("facebook"),
      format_id: nullableId,
      tier: z.enum(PERFORMANCE_TIER_IDS as [PerformanceTier, ...PerformanceTier[]]).catch("winner"),
      ratio: nullableNumber,
      views: count(),
      why_it_worked: text(180),
      published_on: text(10),
    }),
    6
  ),
  recent_titles: strings(30, 90),
  stories: listOf(
    z.object({
      id: z.string(),
      title: text(120),
      type: text(20),
      situation: text(200),
      problem: text(200),
      action: text(200),
      result: text(200),
      lesson: text(200),
      emotion: text(80),
      keywords: strings(8, 40),
      pillar_id: nullableId,
      is_favorite: flag,
    }),
    12
  ),
  schedule: listOf(
    z.object({
      day_of_week: count(1),
      day: text(12),
      label: text(60),
      pillar_id: nullableId,
      format_id: nullableId,
      platforms: platformList,
      time: z.string().nullable().catch(null),
    }),
    21
  ),
  settings: z
    .object({
      weekly_post_target: count(10),
      week_starts_on: count(1).transform((n): 0 | 1 => (n === 0 ? 0 : 1)),
      funnel_targets: z.object({ tofu: count(50), mofu: count(35), bofu: count(15) }).catch({ tofu: 50, mofu: 35, bofu: 15 }),
      timezone: text(60),
    })
    .catch({ weekly_post_target: 10, week_starts_on: 1, funnel_targets: { tofu: 50, mofu: 35, bofu: 15 }, timezone: "" }),
})

export type BrandContext = z.output<typeof brandContextSchema>
export type ContextPillar = BrandContext["pillars"][number]
export type ContextPersona = BrandContext["personas"][number]
export type ContextProblem = BrandContext["problems"][number]
export type ContextStory = BrandContext["stories"][number]
export type ContextFormat = BrandContext["formats"][number]
export type ContextWinner = BrandContext["winners"][number]

/** Parse anything into a BrandContext (never throws). */
export function parseBrandContext(value: unknown): BrandContext {
  const parsed = brandContextSchema.safeParse(value && typeof value === "object" ? value : {})
  return parsed.success ? parsed.data : brandContextSchema.parse({})
}

export const EMPTY_BRAND_CONTEXT: BrandContext = brandContextSchema.parse({})

/* -------------------------------- Builders --------------------------------- */

const round = (n: number | null | undefined, digits = 1): number | null =>
  n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10 ** digits) / 10 ** digits

export interface BuildContextOptions {
  /** Free text the request is about — ranks stories, problems and questions by relevance. */
  focus?: string
  /** Stories to include in full regardless of relevance (e.g. picked in the Content Studio). */
  storyIds?: ID[]
}

/** "I help [audience] [result] through [method]." — empty when the parts are missing. */
export function positioningStatement(audience: string, result: string, method: string): string {
  const a = audience.trim()
  const r = result.trim().replace(/^to\s+/i, "")
  const m = method.trim()
  if (!a || !r) return ""
  return `I help ${a} ${r}${m ? ` through ${m}` : ""}.`
}

function groupStat(g: GroupAggregate & { label: string }, overallAvgViews: number | null) {
  return {
    key: g.key,
    label: g.label,
    posts: g.posts,
    avg_views: round(g.avgViews, 0),
    engagement_rate: round(g.engagementRate, 2),
    leads: g.leads,
    winners: g.winners,
    ratio: overallAvgViews && g.avgViews !== null ? round(g.avgViews / overallAvgViews, 2) : null,
  }
}

/**
 * Compact Brand Context for AI calls (target < ~6k tokens). Pure over (db, now).
 * Pass `focus` (the text the request is about) so the most relevant stories, problems and questions are kept.
 */
export function buildBrandContext(db: Database, now: Date, options: BuildContextOptions = {}): BrandContext {
  const brand = db.brand_profiles[0] ?? buildRow("brand_profiles", {}, "", now)
  const settings = db.app_settings[0] ?? buildRow("app_settings", {}, "", now)
  const focus = tokenSet(options.focus ?? "")
  const forcedStories = new Set(options.storyIds ?? [])

  const mix = pillarMix(db, now, settings)
  const shareByPillar = new Map(mix.rows.map((r) => [r.key, r.actualPct]))
  const rows = scopedRows(db, now, { days: 90, settings })
  const measured = rows.filter((r) => r.metric)
  const overall = aggregateRows(measured)

  const pillars = db.content_pillars
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      target_percentage: p.target_percentage,
      recent_share: mix.enoughData ? (shareByPillar.get(p.id) ?? 0) : null,
      examples: p.examples,
    }))

  const goals = db.content_goals
    .filter((g) => g.is_active)
    .map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      description: g.description,
      target:
        g.target_metric && g.target_value
          ? `${g.target_value.toLocaleString("en-US")} ${GOAL_METRIC_MAP[g.target_metric]?.label.toLowerCase() ?? g.target_metric} ${GOAL_PERIODS.find((p) => p.id === g.period)?.label ?? ""}`.trim()
          : "",
      is_primary: g.id === brand.primary_goal_id,
      is_secondary: g.id === brand.secondary_goal_id,
    }))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(b.is_secondary) - Number(a.is_secondary))

  const personas = [...db.audience_personas]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((p) => ({
      id: p.id,
      name: p.name,
      profession: p.profession,
      experience_level: p.experience_level,
      is_primary: p.is_primary,
      platforms: p.platforms,
      goals: p.goals,
      problems: p.problems,
      frustrations: p.frustrations,
      questions: p.questions,
      objections: p.objections,
      language_used: p.language_used,
    }))

  const relevance = (value: string) => (focus.size ? overlap(focus, tokenSet(value)) : 0)
  const problems = [...db.audience_problems]
    .map((p) => ({ p, rank: p.severity + relevance(p.problem) * 6 }))
    .sort((a, b) => b.rank - a.rank)
    .map(({ p }) => ({
      id: p.id,
      problem: p.problem,
      persona_id: p.persona_id,
      pillar_id: p.pillar_id,
      severity: p.severity,
      category: p.category,
    }))

  const questions = db.audience_questions
    .filter((q) => q.status !== "dismissed")
    .map((q) => ({ q, rank: Math.min(q.frequency, 10) + relevance(`${q.question} ${q.topic}`) * 8 }))
    .sort((a, b) => b.rank - a.rank)
    .map(({ q }) => ({ id: q.id, question: q.question, frequency: q.frequency, persona_id: q.persona_id, pillar_id: q.pillar_id }))

  const platformStats = new Map(groupByPlatform(measured).map((g) => [g.platform, g]))
  const strategies = db.content_platforms.filter((p) => p.is_active)
  const platformIds: PlatformId[] = strategies.length ? strategies.map((s) => s.platform) : brand.main_platforms
  const platforms = platformIds.map((id) => {
    const s = strategies.find((x) => x.platform === id)
    const stat = platformStats.get(id)
    return {
      platform: id,
      label: PLATFORMS[id]?.label ?? id,
      posting_frequency: s?.posting_frequency ?? 0,
      audience: s?.audience ?? "",
      cta_style: s?.cta_style ?? "",
      preferred_format_ids: s?.preferred_format_ids ?? [],
      preferred_pillar_ids: s?.preferred_pillar_ids ?? [],
      posts_90d: stat?.posts ?? 0,
      avg_views: round(stat?.avgViews, 0),
      engagement_rate: round(stat?.engagementRate, 2),
    }
  })

  const hookPerformance = groupByHookCategory(measured)
    .filter((g): g is typeof g & { category: HookCategory } => g.category !== null && g.measured > 0)
    .map((g) => ({
      category: g.category,
      label: HOOK_CATEGORIES[g.category]?.label ?? g.label,
      posts: g.measured,
      avg_views: round(g.avgViews, 0),
      ratio: overall.avgViews && g.avgViews !== null ? round(g.avgViews / overall.avgViews, 2) : null,
    }))
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0) || b.posts - a.posts)

  const winnerRows = getWinners(db, settings, now, { days: 120 }).slice(0, 8)
  const winners = winnerRows.map((w) => ({
    item_id: w.id,
    title: w.item.title,
    hook: w.item.hook,
    hook_category: w.hookCategory,
    pillar_id: w.pillarId,
    platform: w.platform,
    format_id: w.formatId,
    tier: w.tier,
    ratio: round(w.ratio, 2),
    views: w.views,
    why_it_worked: w.item.why_it_worked,
    published_on: toISODate(w.publishedAt),
  }))

  // Winners already carry their hooks; this list adds Hook Library favourites in the best-performing styles.
  const bestCategories = new Set(hookPerformance.slice(0, 3).map((h) => h.category))
  const topHooks = db.hooks
    .filter((h) => h.text.trim() && (bestCategories.has(h.category) || h.is_favorite))
    .sort(
      (a, b) =>
        Number(bestCategories.has(b.category)) - Number(bestCategories.has(a.category)) ||
        Number(b.is_favorite) - Number(a.is_favorite) ||
        Number(b.is_template) - Number(a.is_template)
    )
    .slice(0, 6)
    .map((h) => ({ text: h.text, category: h.category, source: "library" as const }))

  const recentTitles = [
    ...new Set(
      rows
        .slice()
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .map((r) => r.item.title.trim())
        .filter(Boolean)
    ),
  ].slice(0, 30)

  const rankedStories = db.stories
    .map((s) => ({
      s,
      rank:
        (forcedStories.has(s.id) ? 1000 : 0) +
        relevance(`${s.title} ${s.lesson} ${s.keywords.join(" ")} ${s.situation}`) * 10 +
        (s.is_favorite ? 2 : 0),
    }))
    .sort((a, b) => b.rank - a.rank || b.s.updated_at.localeCompare(a.s.updated_at))
    .slice(0, 12)
  const detailed = Math.max(4, forcedStories.size)
  const stories = rankedStories.map(({ s }, i) => {
    const full = i < detailed
    return {
      id: s.id,
      title: s.title,
      type: s.type,
      situation: full ? s.situation : "",
      problem: full ? s.problem : "",
      action: full ? s.action : "",
      result: full ? s.result : "",
      lesson: s.lesson,
      emotion: full ? s.emotion : "",
      keywords: s.keywords,
      pillar_id: s.pillar_id,
      is_favorite: s.is_favorite,
    }
  })

  const schedule = db.content_calendar
    .filter((slot) => slot.is_active)
    .sort((a, b) => a.day_of_week - b.day_of_week || a.sort_order - b.sort_order)
    .map((slot) => ({
      day_of_week: slot.day_of_week,
      day: DAYS_OF_WEEK[slot.day_of_week]?.label ?? "",
      label: slot.label,
      pillar_id: slot.pillar_id,
      format_id: slot.format_id,
      platforms: slot.platforms,
      time: slot.time,
    }))

  return brandContextSchema.parse({
    version: 1,
    generated_at: now.toISOString(),
    today: toISODate(now),
    weekday: DAYS_OF_WEEK[now.getDay()]?.label ?? "",
    brand: {
      name: brand.name,
      brand_name: brand.brand_name,
      role: brand.role,
      industry: brand.industry,
      expertise_summary: brand.expertise_summary,
      years_experience: brand.years_experience,
      location: brand.location,
      who_am_i: brand.who_am_i,
      known_for: brand.known_for,
      problems_solved: brand.problems_solved,
      why_listen: brand.why_listen,
      point_of_view: brand.point_of_view,
      positioning_statement: positioningStatement(brand.positioning_audience, brand.positioning_result, brand.positioning_method),
      positioning_audience: brand.positioning_audience,
      positioning_result: brand.positioning_result,
      positioning_method: brand.positioning_method,
      expertise_areas: brand.expertise_areas,
      personality: brand.personality_traits.map((t) => PERSONALITY_TRAIT_MAP[t]?.label ?? t),
      language: brand.language,
      tones: brand.tones.map((t) => TONE_MAP[t]?.label ?? t),
      always_do: brand.always_do,
      never_do: brand.never_do,
      phrases_used: brand.phrases_used,
      phrases_avoid: brand.phrases_avoid,
      cta_style: brand.cta_style,
      storytelling_style: brand.storytelling_style,
    },
    goals,
    pillars,
    personas,
    problems,
    questions,
    platforms,
    formats: [...db.content_formats]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({ id: f.id, name: f.name, category: f.category, script_format: f.script_format })),
    angles: db.angles.map((a) => ({ id: a.id, name: a.name })),
    hook_performance: hookPerformance,
    top_hooks: topHooks,
    winners,
    recent_titles: recentTitles,
    stories,
    schedule,
    settings: {
      weekly_post_target: settings.weekly_post_target,
      week_starts_on: settings.week_starts_on,
      funnel_targets: settings.funnel_targets,
      timezone: settings.timezone,
    },
  })
}

/* ---------------------------- Analytics snapshot --------------------------- */

export const analyticsSnapshotSchema = z.object({
  generated_at: text(40),
  today: text(10),
  health: z
    .object({
      score: count(),
      band: text(60),
      components: listOf(z.object({ label: text(40), score: count(), max: count(), detail: text(200) }), 8),
    })
    .catch({ score: 0, band: "", components: [] }),
  buffer: z
    .object({ days: count(), ready_count: count(), status: text(20), label: text(40), target_days: count(7) })
    .catch({ days: 0, ready_count: 0, status: "", label: "", target_days: 7 }),
  weekly: z
    .object({
      published: count(),
      target: count(),
      pct: count(),
      scheduled_remaining: count(),
      on_track: flag,
      days_left: count(),
    })
    .catch({ published: 0, target: 0, pct: 0, scheduled_remaining: 0, on_track: false, days_left: 0 }),
  totals_30d: z
    .object({
      posts: count(),
      views: count(),
      engagements: count(),
      engagement_rate: nullableNumber,
      leads: count(),
      followers_gained: count(),
    })
    .catch({ posts: 0, views: 0, engagements: 0, engagement_rate: null, leads: 0, followers_gained: 0 }),
  engagement_trend: z
    .object({ current: nullableNumber, previous: nullableNumber, change_pct: nullableNumber })
    .catch({ current: null, previous: null, change_pct: null }),
  pillar_mix: listOf(
    z.object({
      pillar_id: z.string(),
      label: text(60),
      count: count(),
      actual_pct: count(),
      target_pct: count(),
      deviation: count(),
    }),
    12
  ),
  funnel_mix: listOf(
    z.object({ stage: text(8), label: text(20), count: count(), actual_pct: count(), target_pct: count(), deviation: count() }),
    3
  ),
  mix_warnings: strings(6, 200),
  platforms: listOf(groupStatSchema, 8),
  pillars: listOf(groupStatSchema, 10),
  formats: listOf(groupStatSchema, 10),
  hook_styles: listOf(groupStatSchema, 11),
  winners: listOf(
    z.object({
      item_id: z.string(),
      title: text(120),
      platform: text(20),
      pillar_id: nullableId,
      tier: text(12),
      ratio: nullableNumber,
      views: count(),
      hook: text(160),
    }),
    8
  ),
  underperformers: listOf(
    z.object({
      item_id: z.string(),
      title: text(120),
      platform: text(20),
      pillar_id: nullableId,
      ratio: nullableNumber,
      views: count(),
      hook: text(160),
    }),
    5
  ),
  insights: listOf(z.object({ type: text(20), text: text(240) }), 8),
  recommendations: listOf(
    z.object({
      kind: text(8),
      id: z.string(),
      title: text(120),
      pillar_id: nullableId,
      platform: text(20),
      format_id: nullableId,
      score: count(),
      reasons: z
        .object({ topic: text(200), platform: text(160), format: text(160), angle: text(160) })
        .catch({ topic: "", platform: "", format: "", angle: "" }),
      /** The candidate's own hook (or a Hook Library suggestion). */
      hook: text(200),
    }),
    5
  ),
})

export type AnalyticsSnapshot = z.output<typeof analyticsSnapshotSchema>

/** Numbers the strategist and reviews reason over — health, buffer, pace, mix, performance, winners, insights. */
export function buildAnalyticsSnapshot(db: Database, now: Date): AnalyticsSnapshot {
  const settings = db.app_settings[0] ?? buildRow("app_settings", {}, "", now)
  const health = contentHealthScore(db, now, settings)
  const buffer = contentBuffer(db, now, settings)
  const week = weeklyPostingProgress(db, now, settings)
  const rows90 = scopedRows(db, now, { days: 90, settings }).filter((r) => r.metric)
  const overall90 = aggregateRows(rows90)
  const totals30 = aggregateRows(scopedRows(db, now, { days: 30, settings }))
  const trend = engagementTrend(db, now)
  const pMix = pillarMix(db, now, settings)
  const fMix = funnelMix(db, now, settings)
  const avg = overall90.avgViews

  const underperformers = rows90
    .filter((r) => r.ratio !== null && r.ratio < 0.7 && r.ageDays <= 60)
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))
    .slice(0, 5)

  return analyticsSnapshotSchema.parse({
    generated_at: now.toISOString(),
    today: toISODate(now),
    health: {
      score: health.score,
      band: health.band.label,
      components: health.components.map((c) => ({ label: c.label, score: c.score, max: c.max, detail: c.detail })),
    },
    buffer: {
      days: buffer.days,
      ready_count: buffer.readyCount,
      status: buffer.status,
      label: buffer.label,
      target_days: buffer.targetDays,
    },
    weekly: {
      published: week.published,
      target: week.target,
      pct: week.pct,
      scheduled_remaining: week.scheduledRemaining,
      on_track: week.onTrack,
      days_left: week.daysLeft,
    },
    totals_30d: {
      posts: totals30.posts,
      views: totals30.views,
      engagements: totals30.engagements,
      engagement_rate: round(totals30.engagementRate, 2),
      leads: totals30.leads,
      followers_gained: totals30.followersGained,
    },
    engagement_trend: {
      current: round(trend.current, 2),
      previous: round(trend.previous, 2),
      change_pct: trend.ratio !== null ? round((trend.ratio - 1) * 100, 0) : null,
    },
    pillar_mix: pMix.rows.map((r) => ({
      pillar_id: r.key,
      label: r.label,
      count: r.count,
      actual_pct: r.actualPct,
      target_pct: r.targetPct,
      deviation: r.deviation,
    })),
    funnel_mix: fMix.rows.map((r) => ({
      stage: r.stage,
      label: r.label,
      count: r.count,
      actual_pct: r.actualPct,
      target_pct: r.targetPct,
      deviation: r.deviation,
    })),
    mix_warnings: [...pMix.warnings, ...fMix.warnings].map((w) => w.message),
    platforms: groupByPlatform(rows90).map((g) => groupStat(g, avg)),
    pillars: groupByPillar(db, rows90)
      .filter((g) => g.pillar && g.measured > 0)
      .map((g) => groupStat(g, avg)),
    formats: groupByFormat(db, rows90)
      .filter((g) => g.format && g.measured > 0)
      .map((g) => groupStat(g, avg)),
    hook_styles: groupByHookCategory(rows90)
      .filter((g) => g.category && g.measured > 0)
      .map((g) => groupStat(g, avg)),
    winners: getWinners(db, settings, now, { days: 90 })
      .slice(0, 8)
      .map((w) => ({
        item_id: w.id,
        title: w.item.title,
        platform: w.platform,
        pillar_id: w.pillarId,
        tier: w.tier,
        ratio: round(w.ratio, 2),
        views: w.views,
        hook: w.item.hook,
      })),
    underperformers: underperformers.map((r) => ({
      item_id: r.id,
      title: r.item.title,
      platform: r.platform,
      pillar_id: r.pillarId,
      ratio: round(r.ratio, 2),
      views: r.views,
      hook: r.item.hook,
    })),
    insights: strategicInsights(db, now, settings).map((i) => ({ type: i.type, text: i.text })),
    recommendations: recommendNextContent(db, now, settings, { limit: 5 }).map((r) => ({
      kind: r.kind,
      id: r.id,
      title: r.title,
      pillar_id: r.pillarId,
      platform: r.platform,
      format_id: r.formatId,
      score: r.score,
      reasons: r.reasons,
      hook: r.hook,
    })),
  })
}
