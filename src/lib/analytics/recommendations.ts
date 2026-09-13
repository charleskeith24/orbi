/**
 * Content Decision Engine (spec §38) and dashboard strategic insights.
 * Every score, reason and insight is computed from the workspace — nothing is invented.
 */
import { DAYS_OF_WEEK, HOOK_CATEGORIES, IDEA_STATUS_MAP, PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import type {
  AppSettings,
  AudienceProblem,
  ContentFormat,
  ContentIdea,
  ContentItem,
  Database,
  HookCategory,
  ID,
  IdeaStatus,
  PipelineStage,
  PlatformId,
  PostingSlot,
} from "@/lib/types"
import { clamp, formatPercent, pluralize, truncate } from "@/lib/utils"
import { aggregateRows, groupByAngle, groupByFormat, groupByHookCategory, groupByPillar, groupByPlatform, scopedRows } from "./aggregates"
import { funnelMix, pillarMix, type PillarMix } from "./balance"
import { weeklyPostingProgress } from "./consistency"
import { engagementTrend } from "./health"
import { isWinnerTier, repurposedSourceIds, type TieredRow } from "./performance"
import { contentBuffer, contentToday } from "./pipeline"
import { compareText, formatMultiple, jaccard, tokenize } from "./shared"

/* ----------------------------- Decision engine ----------------------------- */

/** Points per factor; they sum to 100. */
export const RECOMMENDATION_WEIGHTS = {
  pillarGap: 20,
  slot: 15,
  ideaScore: 20,
  demand: 15,
  winnerSimilarity: 15,
  platform: 10,
  freshness: 5,
} as const

export type RecommendationFactor = keyof typeof RECOMMENDATION_WEIGHTS

export interface RecommendOptions {
  /** Default 5. */
  limit?: number
  /** Only candidates that can go out on this platform. */
  platform?: PlatformId
}

export interface RecommendationReasons {
  topic: string
  platform: string
  format: string
  angle: string
}

export interface ContentRecommendation {
  kind: "idea" | "item"
  id: ID
  title: string
  pillarId: ID | null
  platform: PlatformId
  /** The candidate's own format, or a suggested one (today's slot / best format on the platform). */
  formatId: ID | null
  /** The candidate's own angle, or the best-performing angle. */
  angleId: ID | null
  /** The candidate's hook, or a Hook Library suggestion from the best hook style. */
  hook: string
  cta: string
  /** 0–100. */
  score: number
  /** One plain-language reason per decision, shown verbatim. */
  reasons: RecommendationReasons
  /** Every supporting signal, strongest first. */
  signals: string[]
  /** Points earned per factor (max = RECOMMENDATION_WEIGHTS). */
  breakdown: Record<RecommendationFactor, number>
}

const CANDIDATE_IDEA_STATUSES: IdeaStatus[] = ["validated", "selected", "inbox"]
/** Early board columns: the item exists but nobody has committed a date yet. */
const CANDIDATE_ITEM_STAGES: PipelineStage[] = ["idea", "selected", "brief", "scripting"]
const PERFORMANCE_WINDOW_DAYS = 90
const FRESHNESS_WINDOW_DAYS = 30
const NEAR_DUPLICATE_SIMILARITY = 0.5
/** A performance multiple must reach this before it is quoted as a reason. */
const NOTABLE_MULTIPLE = 1.1

interface Candidate {
  kind: "idea" | "item"
  id: ID
  ideaId: ID | null
  title: string
  tokens: Set<string>
  pillarId: ID | null
  formatId: ID | null
  angleId: ID | null
  hookCategory: HookCategory | null
  hook: string
  cta: string
  /** Allowed platforms (items: exactly one). */
  platforms: PlatformId[]
  /** Idea Score, or an item's Content Score when its idea is unscored. */
  ideaScore: number | null
  scoreLabel: "Idea Score" | "Content Score"
  problemId: ID | null
  /** Fallback topic reason. */
  statusText: string
}

interface WinnerPattern {
  text: string
  hookCategory: HookCategory | null
  platform: PlatformId | null
}

interface Context {
  now: Date
  dayName: string
  pillarNames: Map<ID, string>
  formats: Map<ID, ContentFormat>
  angleNames: Map<ID, string>
  ideas: Map<ID, ContentIdea>
  mix: PillarMix
  slots: PostingSlot[]
  demandByIdea: Map<ID, number>
  demandByItem: Map<ID, number>
  problems: Map<ID, AudienceProblem>
  winners: { row: TieredRow; tokens: Set<string> }[]
  pattern: WinnerPattern | null
  /** Platform avg views ÷ overall avg views (last 90 days, ≥ 2 measured posts). */
  platformRatio: Map<PlatformId, number>
  platformOrder: { platforms: PlatformId[]; source: "strategy" | "data" | "default" }
  bestFormatByPlatform: Map<PlatformId, { id: ID; label: string; ratio: number }>
  angleRatio: Map<ID, number>
  bestAngle: { id: ID; label: string; ratio: number } | null
  bestHookStyle: { category: HookCategory; ratio: number } | null
  hookSuggestion: string
  recent: { item: ContentItem; tokens: Set<string>; ageDays: number }[]
  /** token → indices into `recent`, so freshness only compares posts sharing a word. */
  recentIndex: Map<string, number[]>
  slotPlatforms: Set<PlatformId>
  briefCta: Map<ID, string>
}

function mostCommon<T extends string>(values: (T | null)[]): [T | null, number] {
  const counts = new Map<T, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: [T | null, number] = [null, 0]
  for (const [value, count] of counts) if (count > best[1]) best = [value, count]
  return best
}

/** Shared traits of the most recent winners, e.g. "Your last 3 winners used story hooks on TikTok". */
function winnerPattern(winners: TieredRow[]): WinnerPattern | null {
  const last = winners.slice(0, 3)
  const n = last.length
  if (n < 2) return null
  const [category, categoryCount] = mostCommon(last.map((w) => w.hookCategory))
  const [platform, platformCount] = mostCommon(last.map((w) => w.platform))
  const hooks = category ? `${HOOK_CATEGORIES[category].label.toLowerCase()} hooks` : null
  const platformLabel = platform ? PLATFORMS[platform].label : null
  if (hooks && categoryCount === n && platformLabel && platformCount === n) {
    return { text: `Your last ${n} winners used ${hooks} on ${platformLabel}`, hookCategory: category, platform }
  }
  if (hooks && categoryCount === n) return { text: `Your last ${n} winners used ${hooks}`, hookCategory: category, platform: null }
  if (platformLabel && platformCount === n) return { text: `Your last ${n} winners were on ${platformLabel}`, hookCategory: null, platform }
  if (hooks && categoryCount >= 2) return { text: `${categoryCount} of your last ${n} winners used ${hooks}`, hookCategory: category, platform: null }
  return null
}

function buildContext(db: Database, now: Date, settings: AppSettings): Context {
  const ideas = new Map(db.content_ideas.map((i) => [i.id, i]))
  const allRows = scopedRows(db, now, { settings })
  const measured = allRows.filter((r) => r.metric && r.ageDays < PERFORMANCE_WINDOW_DAYS)
  const overall = aggregateRows(measured).avgViews

  const platformRatio = new Map<PlatformId, number>()
  const bestFormatByPlatform = new Map<PlatformId, { id: ID; label: string; ratio: number }>()
  for (const g of groupByPlatform(measured)) {
    if (overall && g.measured >= 2 && g.avgViews !== null) platformRatio.set(g.platform, g.avgViews / overall)
    const platformRows = measured.filter((r) => r.platform === g.platform)
    const platformAvg = g.avgViews
    if (!platformAvg) continue
    for (const f of groupByFormat(db, platformRows)) {
      if (!f.format || f.measured < 2 || f.avgViews === null) continue
      const ratio = f.avgViews / platformAvg
      const current = bestFormatByPlatform.get(g.platform)
      if (!current || ratio > current.ratio) bestFormatByPlatform.set(g.platform, { id: f.format.id, label: f.label, ratio })
    }
  }

  const angleRatio = new Map<ID, number>()
  let bestAngle: Context["bestAngle"] = null
  let bestHookStyle: Context["bestHookStyle"] = null
  if (overall) {
    for (const a of groupByAngle(db, measured)) {
      if (a.measured < 2 || a.avgViews === null) continue
      const ratio = a.avgViews / overall
      angleRatio.set(a.angle.id, ratio)
      if (ratio >= NOTABLE_MULTIPLE && (!bestAngle || ratio > bestAngle.ratio)) bestAngle = { id: a.angle.id, label: a.label, ratio }
    }
    for (const h of groupByHookCategory(measured)) {
      if (!h.category || h.measured < 2 || h.avgViews === null) continue
      const ratio = h.avgViews / overall
      if (ratio >= NOTABLE_MULTIPLE && (!bestHookStyle || ratio > bestHookStyle.ratio)) bestHookStyle = { category: h.category, ratio }
    }
  }
  const hookSuggestion = bestHookStyle
    ? ([...db.hooks]
        .filter((h) => h.category === bestHookStyle?.category && h.text.trim())
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || Number(b.is_template) - Number(a.is_template))[0]?.text ?? "")
    : ""

  const topicText = (item: ContentItem) => `${item.title} ${item.idea_id ? (ideas.get(item.idea_id)?.core_topic ?? "") : ""}`
  const winnerRows = allRows
    .filter((r) => (isWinnerTier(r.tier) || r.item.pinned_winner) && r.ageDays < PERFORMANCE_WINDOW_DAYS)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 10)

  const demandByIdea = new Map<ID, number>()
  const demandByItem = new Map<ID, number>()
  const questions = new Map(db.audience_questions.map((q) => [q.id, q]))
  for (const q of db.audience_questions) {
    if (q.status === "dismissed") continue
    const freq = Math.max(1, q.frequency)
    if (q.idea_id) demandByIdea.set(q.idea_id, (demandByIdea.get(q.idea_id) ?? 0) + freq)
    if (q.content_item_id) demandByItem.set(q.content_item_id, (demandByItem.get(q.content_item_id) ?? 0) + freq)
  }
  for (const idea of db.content_ideas) {
    if (idea.source !== "question_bank" || !idea.source_ref_id) continue
    const q = questions.get(idea.source_ref_id)
    if (q && q.idea_id !== idea.id && q.status !== "dismissed") {
      demandByIdea.set(idea.id, (demandByIdea.get(idea.id) ?? 0) + Math.max(1, q.frequency))
    }
  }

  const strategyPlatforms = db.content_platforms.filter((p) => p.is_active).map((p) => p.platform)
  const brandPlatforms = db.brand_profiles[0]?.main_platforms ?? []
  const dataPlatforms = [...platformRatio.keys()]
  const platformOrder: Context["platformOrder"] = strategyPlatforms.length
    ? { platforms: strategyPlatforms, source: "strategy" }
    : brandPlatforms.length
      ? { platforms: brandPlatforms, source: "strategy" }
      : dataPlatforms.length
        ? { platforms: dataPlatforms, source: "data" }
        : { platforms: ["facebook"], source: "default" }

  const weekday = now.getDay()
  const slots = db.content_calendar.filter((s) => s.is_active && s.day_of_week === weekday).sort((a, b) => a.sort_order - b.sort_order)
  const recent = allRows
    .filter((r) => r.ageDays < FRESHNESS_WINDOW_DAYS)
    .map((r) => ({ item: r.item, tokens: tokenize(r.item.title), ageDays: r.ageDays }))
  const recentIndex = new Map<string, number[]>()
  recent.forEach((r, i) => {
    for (const token of r.tokens) {
      const list = recentIndex.get(token)
      if (list) list.push(i)
      else recentIndex.set(token, [i])
    }
  })
  return {
    now,
    dayName: DAYS_OF_WEEK[weekday]?.label ?? "Today",
    pillarNames: new Map(db.content_pillars.map((p) => [p.id, p.name])),
    formats: new Map(db.content_formats.map((f) => [f.id, f])),
    angleNames: new Map(db.angles.map((a) => [a.id, a.name])),
    ideas,
    mix: pillarMix(db, now, settings),
    slots,
    slotPlatforms: new Set(slots.flatMap((s) => s.platforms)),
    demandByIdea,
    demandByItem,
    problems: new Map(db.audience_problems.map((p) => [p.id, p])),
    winners: winnerRows.map((row) => ({ row, tokens: tokenize(topicText(row.item)) })),
    pattern: winnerPattern(winnerRows),
    platformRatio,
    platformOrder,
    bestFormatByPlatform,
    angleRatio,
    bestAngle,
    bestHookStyle,
    hookSuggestion,
    recent,
    recentIndex,
    briefCta: new Map(db.content_briefs.filter((b) => b.cta.trim()).map((b) => [b.content_item_id, b.cta])),
  }
}

function ideaCandidate(idea: ContentIdea): Candidate {
  return {
    kind: "idea",
    id: idea.id,
    ideaId: idea.id,
    title: idea.title,
    tokens: tokenize(`${idea.title} ${idea.core_topic}`),
    pillarId: idea.pillar_id,
    formatId: idea.format_id,
    angleId: idea.angle_id,
    hookCategory: idea.hook_category,
    hook: idea.hook,
    cta: idea.cta,
    platforms: idea.platforms,
    ideaScore: idea.score,
    scoreLabel: "Idea Score",
    problemId: idea.problem_id,
    statusText: `${IDEA_STATUS_MAP[idea.status]?.label ?? "Open"} idea in your Idea Bank`,
  }
}

function itemCandidate(item: ContentItem, ctx: Context): Candidate {
  const idea = item.idea_id ? ctx.ideas.get(item.idea_id) : undefined
  const ideaScore = idea?.score ?? null
  return {
    kind: "item",
    id: item.id,
    ideaId: item.idea_id,
    title: item.title,
    tokens: tokenize(`${item.title} ${idea?.core_topic ?? ""}`),
    pillarId: item.pillar_id,
    formatId: item.format_id,
    angleId: item.angle_id,
    hookCategory: item.hook_category,
    hook: item.hook,
    cta: ctx.briefCta.get(item.id) ?? idea?.cta ?? "",
    platforms: [item.platform],
    ideaScore: ideaScore ?? item.quality_score?.total ?? null,
    scoreLabel: ideaScore !== null ? "Idea Score" : "Content Score",
    problemId: item.problem_id ?? idea?.problem_id ?? null,
    statusText: `Already in ${PIPELINE_STAGE_MAP[item.stage]?.label ?? "production"} — no date yet`,
  }
}

type PlatformSource = "requested" | "planned" | "performance" | "strategy" | "default"

function choosePlatform(c: Candidate, ctx: Context, requested?: PlatformId): { platform: PlatformId; source: PlatformSource } {
  if (requested) return { platform: requested, source: "requested" }
  if (c.platforms.length === 1) return { platform: c.platforms[0], source: "planned" }
  const pool = c.platforms.length ? c.platforms : ctx.platformOrder.platforms
  let best = pool[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const p of pool) {
    const score = (ctx.platformRatio.get(p) ?? 1) + (ctx.slotPlatforms.has(p) ? 0.25 : 0)
    if (score > bestScore) {
      best = p
      bestScore = score
    }
  }
  if (c.platforms.length) return { platform: best, source: "planned" }
  if (ctx.platformRatio.has(best)) return { platform: best, source: "performance" }
  return { platform: best, source: ctx.platformOrder.source === "default" ? "default" : "strategy" }
}

interface Signal {
  kind: "topic" | "platform" | "other"
  text: string
  weight: number
}

function slotLabel(slot: PostingSlot, ctx: Context): string {
  if (slot.label.trim()) return slot.label.trim()
  return [slot.pillar_id ? ctx.pillarNames.get(slot.pillar_id) : null, slot.format_id ? ctx.formats.get(slot.format_id)?.name : null]
    .filter(Boolean)
    .join(" / ")
}

function evaluate(c: Candidate, ctx: Context, requested?: PlatformId): ContentRecommendation {
  const W = RECOMMENDATION_WEIGHTS
  const signals: Signal[] = []
  const push = (kind: Signal["kind"], text: string, weight: number) => signals.push({ kind, text, weight })
  const { platform, source } = choosePlatform(c, ctx, requested)
  const platformLabel = PLATFORMS[platform]?.label ?? platform

  // Pillar gap: full points at 10+ points under target.
  let pillarGap = 0
  const mixRow = c.pillarId ? ctx.mix.rows.find((r) => r.key === c.pillarId) : undefined
  if (mixRow && mixRow.deviation < 0) {
    pillarGap = Math.min(1, -mixRow.deviation / 10) * W.pillarGap
    if (mixRow.count === 0) {
      push("topic", `No ${mixRow.label} posts in the last 30 days — target is ${Math.round(mixRow.targetPct)}%`, pillarGap)
    } else if (-mixRow.deviation >= 3) {
      push("topic", `${mixRow.label} is ${Math.round(-mixRow.deviation)} points under target over the last 30 days`, pillarGap)
    }
  }

  // Today's posting slot: pillar 8 + format 4 + platform 3.
  let slot = 0
  let matchedSlot: PostingSlot | null = null
  for (const s of ctx.slots) {
    const points =
      (s.pillar_id && s.pillar_id === c.pillarId ? 8 : 0) +
      (s.format_id && s.format_id === c.formatId ? 4 : 0) +
      (s.platforms.includes(platform) ? 3 : 0)
    if (points > slot) {
      slot = points
      matchedSlot = s
    }
  }
  const matchedSlotLabel = matchedSlot ? slotLabel(matchedSlot, ctx) : ""
  if (matchedSlot && matchedSlotLabel && (matchedSlot.pillar_id === c.pillarId || matchedSlot.format_id === c.formatId)) {
    push("topic", `${ctx.dayName}'s slot is ${matchedSlotLabel}`, slot)
  }

  // Idea score (unscored → neutral half, no signal).
  const ideaScore = c.ideaScore !== null ? (clamp(c.ideaScore, 0, 100) / 100) * W.ideaScore : W.ideaScore / 2
  if (c.ideaScore !== null) {
    const text = `${c.scoreLabel} ${Math.round(c.ideaScore)}`
    push("topic", c.scoreLabel === "Idea Score" && c.ideaScore >= 75 ? `${text} — high priority` : text, ideaScore * 0.8)
  }

  // Audience demand: question frequency (5+ asks = full) or problem severity (5/5 = full).
  const frequency = (ctx.demandByItem.get(c.id) ?? 0) + (c.ideaId ? (ctx.demandByIdea.get(c.ideaId) ?? 0) : 0)
  const problem = c.problemId ? ctx.problems.get(c.problemId) : undefined
  const questionShare = Math.min(1, frequency / 5)
  const problemShare = problem ? clamp(problem.severity, 0, 5) / 5 : 0
  const demand = Math.max(questionShare, problemShare) * W.demand
  if (frequency > 0 && questionShare >= problemShare) {
    push("topic", `Asked ${frequency}× in your Question Bank`, demand)
  } else if (problem) {
    push("topic", `Solves a severity ${problem.severity}/5 audience problem: “${truncate(problem.problem, 60)}”`, demand)
  }

  // Similarity to recent winners: pillar 0.4 + hook style 0.3 + topic overlap 0.3.
  let similarity = 0
  let closest: { row: TieredRow; traits: string[] } | null = null
  for (const w of ctx.winners) {
    const pillarHit = !!c.pillarId && c.pillarId === w.row.pillarId
    const hookHit = !!c.hookCategory && c.hookCategory === w.row.hookCategory
    const topicShare = Math.min(1, jaccard(c.tokens, w.tokens) / 0.3)
    const sim = 0.4 * Number(pillarHit) + 0.3 * Number(hookHit) + 0.3 * topicShare
    if (sim > similarity) {
      similarity = sim
      closest = {
        row: w.row,
        traits: [pillarHit ? "pillar" : "", hookHit ? "hook style" : "", topicShare >= 1 ? "topic" : ""].filter(Boolean),
      }
    }
  }
  const winnerSimilarity = similarity * W.winnerSimilarity
  const pattern = ctx.pattern
  const matchesPattern =
    !!pattern &&
    (!pattern.hookCategory || c.hookCategory === pattern.hookCategory) &&
    (!pattern.platform || platform === pattern.platform)
  if (pattern && matchesPattern) {
    push("topic", pattern.text, Math.max(winnerSimilarity, W.winnerSimilarity * 0.3))
  } else if (closest && closest.traits.length && similarity >= 0.4) {
    push("topic", `Same ${closest.traits.join(" and ")} as your winner “${truncate(closest.row.item.title, 50)}”`, winnerSimilarity)
  }

  // Platform performance: 0.5x → 20%, 1.0x → 60%, 1.5x+ → 100% of the weight; unknown → half.
  const multiple = ctx.platformRatio.get(platform) ?? null
  const platformPoints = multiple === null ? W.platform / 2 : W.platform * clamp(0.2 + (multiple - 0.5) * 0.8, 0.2, 1)
  if (multiple !== null && multiple >= 1.15) {
    push("platform", `${platformLabel} posts average ${formatMultiple(multiple)} your overall views`, platformPoints)
  }

  // Freshness: nothing near-identical published in the last 30 days (same-idea cross-posts excluded).
  let duplicate: { item: ContentItem; ageDays: number; sim: number } | null = null
  const sharedTokens = new Map<number, number>()
  for (const token of c.tokens) for (const i of ctx.recentIndex.get(token) ?? []) sharedTokens.set(i, (sharedTokens.get(i) ?? 0) + 1)
  for (const [i, shared] of sharedTokens) {
    const r = ctx.recent[i]
    if (r.item.id === c.id || (c.ideaId && r.item.idea_id === c.ideaId)) continue
    const sim = shared / (c.tokens.size + r.tokens.size - shared)
    if (sim >= NEAR_DUPLICATE_SIMILARITY && (!duplicate || sim > duplicate.sim)) duplicate = { item: r.item, ageDays: r.ageDays, sim }
  }
  const freshness = duplicate ? 0 : W.freshness

  // Hook suggestion when the candidate has none.
  const ownHook = c.hook.trim()
  const hook = ownHook || ctx.hookSuggestion
  if (!ownHook && ctx.hookSuggestion && ctx.bestHookStyle) {
    const label = HOOK_CATEGORIES[ctx.bestHookStyle.category].label
    push("other", `Suggested hook: ${label} hooks average ${formatMultiple(ctx.bestHookStyle.ratio)} your views`, 1)
  }
  if (duplicate) {
    const when = duplicate.ageDays === 0 ? "today" : duplicate.ageDays === 1 ? "yesterday" : `${duplicate.ageDays} days ago`
    push("other", `Close to “${truncate(duplicate.item.title, 50)}”, published ${when}`, 0)
  }

  const breakdown: Record<RecommendationFactor, number> = {
    pillarGap: Math.round(pillarGap * 10) / 10,
    slot,
    ideaScore: Math.round(ideaScore * 10) / 10,
    demand: Math.round(demand * 10) / 10,
    winnerSimilarity: Math.round(winnerSimilarity * 10) / 10,
    platform: Math.round(platformPoints * 10) / 10,
    freshness,
  }
  const score = clamp(Math.round(pillarGap + slot + ideaScore + demand + winnerSimilarity + platformPoints + freshness), 0, 100)
  signals.sort((a, b) => b.weight - a.weight)

  // Reasons shown next to each decision.
  const topicSignal = signals.find((s) => s.kind === "topic")
  const pillarName = c.pillarId ? ctx.pillarNames.get(c.pillarId) : undefined
  const topic = topicSignal?.text ?? `${c.statusText}${pillarName ? ` · ${pillarName}` : ""}`

  const platformSignal = signals.find((s) => s.kind === "platform")
  const multipleSuffix = multiple !== null ? ` (${formatMultiple(multiple)} your overall views)` : ""
  const platformReason =
    platformSignal?.text ??
    (matchedSlot?.platforms.includes(platform)
      ? `${ctx.dayName}'s slot includes ${platformLabel}`
      : source === "requested"
        ? `Filtered to ${platformLabel}`
        : source === "planned"
          ? `Planned for ${platformLabel}${multipleSuffix}`
          : source === "performance"
            ? `${platformLabel} averages ${formatMultiple(multiple ?? 1)} your overall views`
            : source === "strategy"
              ? `${platformLabel} is one of your active platforms`
              : `No platform set — defaulting to ${platformLabel}`)

  let formatId = c.formatId && ctx.formats.has(c.formatId) ? c.formatId : null
  let formatReason: string
  const bestFormat = ctx.bestFormatByPlatform.get(platform)
  const referenceSlot = matchedSlot ?? ctx.slots[0] ?? null
  if (formatId) {
    const name = ctx.formats.get(formatId)?.name ?? "this format"
    formatReason =
      referenceSlot?.format_id === formatId
        ? `${ctx.dayName}'s slot calls for ${name}`
        : bestFormat && bestFormat.id === formatId && bestFormat.ratio >= NOTABLE_MULTIPLE
          ? `${name} is your best format on ${platformLabel} (${formatMultiple(bestFormat.ratio)} views)`
          : `Planned as ${name}`
  } else if (referenceSlot?.format_id && ctx.formats.has(referenceSlot.format_id)) {
    formatId = referenceSlot.format_id
    formatReason = `${ctx.dayName}'s slot calls for ${ctx.formats.get(formatId)?.name ?? "this format"}`
  } else if (bestFormat && bestFormat.ratio >= NOTABLE_MULTIPLE) {
    formatId = bestFormat.id
    formatReason = `${bestFormat.label} posts average ${formatMultiple(bestFormat.ratio)} your ${platformLabel} views`
  } else {
    formatReason = "No format set yet"
  }

  let angleId = c.angleId && ctx.angleNames.has(c.angleId) ? c.angleId : null
  let angleReason: string
  if (angleId) {
    const ratio = ctx.angleRatio.get(angleId)
    angleReason = `Uses the “${ctx.angleNames.get(angleId)}” angle${ratio && ratio >= NOTABLE_MULTIPLE ? ` — averages ${formatMultiple(ratio)} your views` : ""}`
  } else if (ctx.bestAngle) {
    angleId = ctx.bestAngle.id
    angleReason = `“${ctx.bestAngle.label}” posts average ${formatMultiple(ctx.bestAngle.ratio)} your views`
  } else {
    angleReason = "No angle set yet"
  }

  return {
    kind: c.kind,
    id: c.id,
    title: c.title,
    pillarId: c.pillarId,
    platform,
    formatId,
    angleId,
    hook,
    cta: c.cta,
    score,
    reasons: { topic, platform: platformReason, format: formatReason, angle: angleReason },
    signals: [...new Set(signals.map((s) => s.text))],
    breakdown,
  }
}

/**
 * Ranked "what to make next": open ideas (validated, selected, inbox) and undated Idea/Selected/Brief/Scripting items,
 * scored 0–100 = pillar gap 20 + today's slot 15 + idea score 20 + audience demand 15 +
 * winner similarity 15 + platform performance 10 + freshness 5 (see RECOMMENDATION_WEIGHTS).
 */
export function recommendNextContent(
  db: Database,
  now: Date,
  settings: AppSettings,
  options: RecommendOptions = {}
): ContentRecommendation[] {
  const ctx = buildContext(db, now, settings)
  const requested = options.platform
  const candidates: Candidate[] = []
  const ideasOnBoard = new Set<ID>()
  for (const item of db.content_items) {
    if (!CANDIDATE_ITEM_STAGES.includes(item.stage) || item.scheduled_at || item.due_date) continue
    candidates.push(itemCandidate(item, ctx))
    if (item.idea_id) ideasOnBoard.add(item.idea_id)
  }
  // An open idea that already has an undated item is recommended once, through that item.
  for (const idea of db.content_ideas) {
    if (CANDIDATE_IDEA_STATUSES.includes(idea.status) && !ideasOnBoard.has(idea.id)) candidates.push(ideaCandidate(idea))
  }
  return candidates
    .filter((c) => !requested || (c.kind === "item" ? c.platforms[0] === requested : !c.platforms.length || c.platforms.includes(requested)))
    .map((c) => evaluate(c, ctx, requested))
    .sort((a, b) => b.score - a.score || b.breakdown.ideaScore - a.breakdown.ideaScore || compareText(a.title, b.title))
    .slice(0, Math.max(0, options.limit ?? 5))
}

/* --------------------------- Strategic insights ---------------------------- */

export type InsightType = "double_down" | "fix" | "opportunity" | "warning"

export interface StrategicInsight {
  /** Stable key for lists. */
  id: string
  type: InsightType
  text: string
  href?: string
  /** Higher = more urgent; insights are returned in this order. */
  priority: number
}

/** Multiple a group must beat before it is called out. */
const INSIGHT_MULTIPLE = 1.3
/** Measured posts a group needs before it is compared. */
const INSIGHT_MIN_POSTS = 3

/**
 * Up to 8 short, data-backed insights (buffer, weekly pace, overdue work, engagement trend,
 * pillar / funnel mix, winners to replicate or repurpose, best pillar / hook style / format / platform,
 * audience questions, idea backlog), most urgent first. Nothing is emitted without the data to back it.
 */
export function strategicInsights(db: Database, now: Date, settings: AppSettings): StrategicInsight[] {
  const out: StrategicInsight[] = []
  const add = (id: string, type: InsightType, priority: number, text: string, href?: string) =>
    out.push({ id, type, text, priority, ...(href ? { href } : {}) })

  const buffer = contentBuffer(db, now, settings)
  if (buffer.status !== "healthy") {
    add(
      "buffer",
      "warning",
      buffer.status === "low" ? 95 : 70,
      buffer.readyCount
        ? `Buffer is ${buffer.days} days — below your ${settings.buffer_healthy_days}-day target`
        : `Nothing is ready to post — your ${settings.buffer_healthy_days}-day buffer is empty`,
      "/pipeline"
    )
  }

  const week = weeklyPostingProgress(db, now, settings)
  const gap = week.target - week.published - week.scheduledRemaining
  if (week.target > 0 && gap > 0) {
    add(
      "weekly-pace",
      "warning",
      85,
      `${week.published} of ${week.target} posts out this week${week.scheduledRemaining ? ` (+${week.scheduledRemaining} scheduled)` : ""} — ${gap} more needed with ${pluralize(week.daysLeft, "day")} left`,
      "/calendar/planner"
    )
  }

  const today = contentToday(db, now)
  if (today.overdue.length) {
    const n = today.overdue.length
    add("overdue", "fix", 80, `${pluralize(n, "item")} ${n === 1 ? "is" : "are"} overdue — reschedule or cut ${n === 1 ? "it" : "them"}`, "/pipeline")
  }
  if (today.toReview.length >= 3) {
    add("review-queue", "fix", 64, `${today.toReview.length} items are waiting for review — approve them to refill the buffer`, "/pipeline")
  }

  const trend = engagementTrend(db, now)
  if (trend.ratio !== null) {
    const change = Math.round((trend.ratio - 1) * 100)
    if (change <= -15) {
      add(
        "engagement-down",
        "fix",
        75,
        `Engagement rate is down ${-change}% over the last 30 days vs the 90 days before (${formatPercent(trend.current)} vs ${formatPercent(trend.previous)})`,
        "/analytics"
      )
    } else if (change >= 15) {
      add("engagement-up", "double_down", 48, `Engagement rate is up ${change}% over the last 30 days vs the 90 days before — keep this mix going`, "/analytics")
    }
  }

  const mix = pillarMix(db, now, settings)
  const pillarWarning = mix.warnings[0]
  if (pillarWarning) add(`pillar-mix-${pillarWarning.key}`, "fix", 70, pillarWarning.message, `/pillars?open=${pillarWarning.key}`)
  const funnelWarning = funnelMix(db, now, settings).warnings[0]
  if (funnelWarning) add(`funnel-mix-${funnelWarning.key}`, "fix", 60, funnelWarning.message, "/pillars/funnel")

  const rows = scopedRows(db, now, { days: PERFORMANCE_WINDOW_DAYS, settings }).filter((r) => r.metric)
  const overall = aggregateRows(rows)

  const pillars = groupByPillar(db, rows).filter((g) => g.pillar && g.measured >= INSIGHT_MIN_POSTS && g.avgViews)
  if (pillars.length >= 2) {
    const sorted = [...pillars].sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0))
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    const multiple = (best.avgViews ?? 0) / (worst.avgViews ?? 1)
    const bestStatus = mix.rows.find((r) => r.key === best.key)?.status
    if (multiple >= INSIGHT_MULTIPLE && bestStatus !== "over") {
      add(
        "pillar-double-down",
        "double_down",
        72,
        `${best.label} posts average ${formatMultiple(multiple)} the views of ${worst.label} — make more of them`,
        `/pillars?open=${best.key}`
      )
    }
  }

  const repurposed = repurposedSourceIds(db)
  const winners = rows.filter((r) => isWinnerTier(r.tier) || r.item.pinned_winner)
  const unrepurposed = winners.filter((w) => !repurposed.has(w.id)).length
  if (unrepurposed) {
    add("repurpose-winners", "opportunity", 68, `${pluralize(unrepurposed, "winner")} ${unrepurposed === 1 ? "hasn't" : "haven't"} been repurposed yet`, "/winners")
  }
  const recentWinner = winners
    .filter((w) => isWinnerTier(w.tier) && w.ratio !== null && w.ageDays < 30)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
  if (recentWinner?.ratio) {
    add(
      "recent-winner",
      "double_down",
      66,
      `“${truncate(recentWinner.item.title, 60)}” hit ${formatMultiple(recentWinner.ratio)} your ${PLATFORMS[recentWinner.platform]?.label ?? recentWinner.platform} average — make a follow-up`,
      `/studio/${recentWinner.id}`
    )
  }

  if (overall.avgViews) {
    const avg = overall.avgViews
    const hookStyle = groupByHookCategory(rows).find((g) => g.category && g.measured >= INSIGHT_MIN_POSTS && g.avgViews)
    if (hookStyle?.avgViews && hookStyle.avgViews / avg >= INSIGHT_MULTIPLE) {
      add("hook-style", "double_down", 62, `${hookStyle.label} hooks average ${formatMultiple(hookStyle.avgViews / avg)} your overall views — use them more`, "/ideas/hooks")
    }
    const format = groupByFormat(db, rows)
      .filter((g) => g.format && g.measured >= INSIGHT_MIN_POSTS && g.avgViews)
      .sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0))[0]
    if (format?.avgViews && format.avgViews / avg >= INSIGHT_MULTIPLE) {
      add("format", "double_down", 52, `${format.label} posts average ${formatMultiple(format.avgViews / avg)} your overall views`, "/analytics")
    }
  }

  if (overall.engagementRate) {
    const platforms = groupByPlatform(rows).filter((g) => g.measured >= INSIGHT_MIN_POSTS && g.engagementRate !== null)
    const best = [...platforms].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0]
    if (platforms.length >= 2 && best?.engagementRate && best.engagementRate / overall.engagementRate >= INSIGHT_MULTIPLE) {
      add(
        "platform",
        "double_down",
        55,
        `${best.label} engagement rate is ${formatMultiple(best.engagementRate / overall.engagementRate)} your average (${formatPercent(best.engagementRate)}) — prioritise it`,
        "/analytics"
      )
    }
  }

  const hotQuestions = db.audience_questions.filter((q) => q.status === "new" && q.frequency >= 3 && !q.idea_id && !q.content_item_id).length
  if (hotQuestions) {
    add(
      "questions",
      "opportunity",
      58,
      `${pluralize(hotQuestions, "audience question")} asked 3+ times ${hotQuestions === 1 ? "has" : "have"} no content yet`,
      "/audience/questions"
    )
  }

  const readyIdeas = db.content_ideas.filter((i) => i.status === "validated" || i.status === "selected").length
  if (readyIdeas < Math.ceil(settings.weekly_post_target / 2)) {
    add(
      "idea-backlog",
      "opportunity",
      50,
      readyIdeas
        ? `Only ${pluralize(readyIdeas, "validated idea")} left — run the Idea Generator`
        : "No validated ideas in the Idea Bank — run the Idea Generator",
      "/ideas/generator"
    )
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 8)
}
