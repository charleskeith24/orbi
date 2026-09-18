/**
 * Idea Generator model: the brief (URL params ⇄ form ⇄ AI input), generated drafts (AI output →
 * editable card → Idea Bank row), example briefs built from the workspace, and recent generations
 * read back from the `ai_generations` log. Pure — no React, no store access.
 */
import type { AiTaskInput, GeneratedIdea } from "@/lib/ai"
import { pillarMix } from "@/lib/analytics"
import {
  FUNNEL_STAGE_IDS,
  FUNNEL_STAGES,
  GOAL_CATEGORIES,
  GOAL_CATEGORY_IDS,
  HOOK_CATEGORY_IDS,
  PLATFORM_IDS,
  PLATFORMS,
} from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { translate, type UiLang, type Vars } from "@/lib/i18n/core"
import type {
  AiGeneration,
  AiProviderId,
  AppSettings,
  Database,
  FunnelStage,
  GoalCategory,
  HookCategory,
  ID,
  InsertRow,
  ISODateTime,
  PlatformId,
} from "@/lib/types"
import { truncate } from "@/lib/utils"
import { generatorMessages } from "./generator-messages"
import { labMessages } from "./messages"

export const MIN_COUNT = 1
export const MAX_COUNT = 20
export const DEFAULT_COUNT = 6
export const MORE_LIKE_THIS_COUNT = 3
export const TOPIC_MAX = 500
/** The generate_ideas task accepts angle names up to 80 characters. */
const ANGLE_MAX = 80

/* ---------------------------------- Brief --------------------------------- */

export interface GeneratorBrief {
  pillarId: ID | null
  personaId: ID | null
  problemId: ID | null
  platform: PlatformId | null
  goalId: ID | null
  topic: string
  funnel: FunnelStage | null
  angleId: ID | null
  formatId: ID | null
  count: number
}

export const EMPTY_BRIEF: GeneratorBrief = {
  pillarId: null,
  personaId: null,
  problemId: null,
  platform: null,
  goalId: null,
  topic: "",
  funnel: null,
  angleId: null,
  formatId: null,
  count: DEFAULT_COUNT,
}

/** Query keys of a brief link, e.g. `/ideas/generator?problem=…&persona=…&run=1`. */
export const BRIEF_PARAM_KEYS = ["pillar", "persona", "problem", "platform", "goal", "topic", "funnel", "angle", "format", "count"] as const
/** Every query key the generator owns. */
export const GENERATOR_PARAM_KEYS: readonly string[] = [...BRIEF_PARAM_KEYS, "run"]

/** The workspace tables a brief refers to. */
export type BriefDb = Pick<Database, "content_pillars" | "audience_personas" | "audience_problems" | "content_goals" | "angles" | "content_formats">

type ReadableParams = Pick<URLSearchParams, "get">

export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COUNT
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(value)))
}

export function isValidCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_COUNT && value <= MAX_COUNT
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function knownOrNull(rows: readonly { id: ID }[], id: unknown): ID | null {
  return typeof id === "string" && id && rows.some((row) => row.id === id) ? id : null
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()
const gt = (lang: UiLang, key: keyof (typeof generatorMessages)["en"], vars?: Vars) => translate(generatorMessages, lang, key, vars)

/** "Before vs. After" → "beforevsafter": names compared without case, spacing or punctuation. */
export function nameKey(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "")
}

/** Titles compared without case, spacing or punctuation (duplicate detection). */
export function titleKey(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

export function matchAngleId(name: string, angles: readonly { id: ID; name: string }[]): ID | null {
  const key = nameKey(name)
  if (!key) return null
  return angles.find((angle) => nameKey(angle.name) === key)?.id ?? null
}

/** Exact name first; otherwise a partial match only when exactly one format fits. */
export function matchFormatId(name: string, formats: readonly { id: ID; name: string }[]): ID | null {
  const key = nameKey(name)
  if (!key) return null
  const exact = formats.find((format) => nameKey(format.name) === key)
  if (exact) return exact.id
  const partial = formats.filter((format) => {
    const k = nameKey(format.name)
    return k.length > 2 && (key.includes(k) || k.includes(key))
  })
  return partial.length === 1 ? partial[0].id : null
}

export interface ParsedBrief {
  brief: GeneratorBrief
  /** `run=1`: generate as soon as the page opens. */
  run: boolean
  /** Any brief parameter was present. */
  hasBrief: boolean
  /** Parts of the link that no longer match the workspace (a deleted persona, an unknown platform…). */
  ignored: string[]
}

/**
 * Brief from `?pillar=&persona=&problem=&platform=&goal=&topic=&funnel=&angle=&format=&count=&run=1`.
 * Ids are checked against the workspace; `goal` also accepts a goal category, `angle`/`format` a name.
 * A problem fills an empty persona and pillar from its own.
 */
export function parseBriefParams(params: ReadableParams, db: BriefDb): ParsedBrief {
  const brief: GeneratorBrief = { ...EMPTY_BRIEF }
  const ignored: string[] = []
  const get = (key: (typeof BRIEF_PARAM_KEYS)[number]) => params.get(key)?.trim() || null
  const hasBrief = BRIEF_PARAM_KEYS.some((key) => Boolean(get(key)))

  const pillar = get("pillar")
  if (pillar) {
    brief.pillarId = knownOrNull(db.content_pillars, pillar)
    if (!brief.pillarId) ignored.push("content pillar")
  }
  const persona = get("persona")
  if (persona) {
    brief.personaId = knownOrNull(db.audience_personas, persona)
    if (!brief.personaId) ignored.push("persona")
  }
  const problemId = get("problem")
  if (problemId) {
    const problem = db.audience_problems.find((p) => p.id === problemId)
    if (problem) {
      brief.problemId = problem.id
      brief.personaId ??= knownOrNull(db.audience_personas, problem.persona_id)
      brief.pillarId ??= knownOrNull(db.content_pillars, problem.pillar_id)
    } else {
      ignored.push("audience problem")
    }
  }
  const platform = get("platform")?.toLowerCase()
  if (platform) {
    if ((PLATFORM_IDS as string[]).includes(platform)) brief.platform = platform as PlatformId
    else ignored.push("platform")
  }
  const goal = get("goal")
  if (goal) {
    const category = goal.toLowerCase() as GoalCategory
    const byCategory = GOAL_CATEGORY_IDS.includes(category)
      ? (db.content_goals.find((g) => g.category === category && g.is_active) ?? db.content_goals.find((g) => g.category === category))
      : undefined
    brief.goalId = knownOrNull(db.content_goals, goal) ?? byCategory?.id ?? null
    if (!brief.goalId) ignored.push("goal")
  }
  const topic = params.get("topic")
  if (topic?.trim()) brief.topic = oneLine(topic).slice(0, TOPIC_MAX)
  const funnel = get("funnel")?.toLowerCase()
  if (funnel) {
    if ((FUNNEL_STAGE_IDS as string[]).includes(funnel)) brief.funnel = funnel as FunnelStage
    else ignored.push("funnel stage")
  }
  const angle = get("angle")
  if (angle) {
    brief.angleId = knownOrNull(db.angles, angle) ?? matchAngleId(angle, db.angles)
    if (!brief.angleId) ignored.push("angle")
  }
  const format = get("format")
  if (format) {
    brief.formatId = knownOrNull(db.content_formats, format) ?? matchFormatId(format, db.content_formats)
    if (!brief.formatId) ignored.push("format")
  }
  const count = get("count")
  if (count) {
    const n = Number.parseInt(count, 10)
    if (Number.isFinite(n)) brief.count = clampCount(n)
    else ignored.push("number of ideas")
  }
  const run = params.get("run")
  return { brief, run: run === "1" || run === "true", hasBrief, ignored }
}

/** Replaces the generator's keys in `params` with the brief (drops `run`; the default count is omitted). */
export function writeBriefParams(params: URLSearchParams, brief: GeneratorBrief): void {
  for (const key of GENERATOR_PARAM_KEYS) params.delete(key)
  if (brief.pillarId) params.set("pillar", brief.pillarId)
  if (brief.personaId) params.set("persona", brief.personaId)
  if (brief.problemId) params.set("problem", brief.problemId)
  if (brief.platform) params.set("platform", brief.platform)
  if (brief.goalId) params.set("goal", brief.goalId)
  const topic = oneLine(brief.topic)
  if (topic) params.set("topic", topic)
  if (brief.funnel) params.set("funnel", brief.funnel)
  if (brief.angleId) params.set("angle", brief.angleId)
  if (brief.formatId) params.set("format", brief.formatId)
  if (clampCount(brief.count) !== DEFAULT_COUNT) params.set("count", String(clampCount(brief.count)))
}

/** Brief → generate_ideas input. The angle travels by name (the task's contract). */
export function briefToInput(brief: GeneratorBrief, angles: readonly { id: ID; name: string }[]): AiTaskInput<"generate_ideas"> {
  const angle = brief.angleId ? angles.find((a) => a.id === brief.angleId) : undefined
  return {
    pillar_id: brief.pillarId,
    persona_id: brief.personaId,
    problem_id: brief.problemId,
    platform: brief.platform,
    goal_id: brief.goalId,
    topic: oneLine(brief.topic).slice(0, TOPIC_MAX) || null,
    funnel_stage: brief.funnel,
    angle: angle ? angle.name.trim().slice(0, ANGLE_MAX) || null : null,
    format_id: brief.formatId,
    count: clampCount(brief.count),
  }
}

/** A logged generate_ideas input → brief (ids that no longer exist are dropped). */
export function briefFromTaskInput(input: unknown, db: BriefDb): GeneratorBrief {
  const v = isRecord(input) ? input : {}
  const angle = typeof v.angle === "string" ? v.angle : ""
  return {
    pillarId: knownOrNull(db.content_pillars, v.pillar_id),
    personaId: knownOrNull(db.audience_personas, v.persona_id),
    problemId: knownOrNull(db.audience_problems, v.problem_id),
    platform: (PLATFORM_IDS as unknown[]).includes(v.platform) ? (v.platform as PlatformId) : null,
    goalId: knownOrNull(db.content_goals, v.goal_id),
    topic: typeof v.topic === "string" ? oneLine(v.topic).slice(0, TOPIC_MAX) : "",
    funnel: (FUNNEL_STAGE_IDS as unknown[]).includes(v.funnel_stage) ? (v.funnel_stage as FunnelStage) : null,
    angleId: angle ? matchAngleId(angle, db.angles) : null,
    formatId: knownOrNull(db.content_formats, v.format_id),
    count: typeof v.count === "number" ? clampCount(v.count) : DEFAULT_COUNT,
  }
}

/** Short labels for the constraints of a brief, e.g. ["Education", "for Founders", "TikTok", "TOFU"]. */
export function describeBrief(brief: GeneratorBrief, db: BriefDb, lang: UiLang = "en"): string[] {
  const parts: string[] = []
  const pillar = brief.pillarId ? db.content_pillars.find((p) => p.id === brief.pillarId) : undefined
  if (pillar) parts.push(pillar.name || gt(lang, "brief_untitled_pillar"))
  const persona = brief.personaId ? db.audience_personas.find((p) => p.id === brief.personaId) : undefined
  if (persona) parts.push(gt(lang, "brief_for", { name: persona.name || gt(lang, "brief_a_persona") }))
  if (brief.platform) parts.push(PLATFORMS[brief.platform].label)
  const goal = brief.goalId ? db.content_goals.find((g) => g.id === brief.goalId) : undefined
  if (goal) parts.push(goal.name || GOAL_CATEGORIES[goal.category].label)
  if (brief.funnel) parts.push(FUNNEL_STAGES[brief.funnel].label)
  const angle = brief.angleId ? db.angles.find((a) => a.id === brief.angleId) : undefined
  if (angle) parts.push(gt(lang, "brief_angle", { name: angle.name }))
  const format = brief.formatId ? db.content_formats.find((f) => f.id === brief.formatId) : undefined
  if (format) parts.push(format.name)
  const problem = brief.problemId ? db.audience_problems.find((p) => p.id === brief.problemId) : undefined
  if (problem) parts.push(`“${truncate(oneLine(problem.problem), 48)}”`)
  const topic = oneLine(brief.topic)
  if (topic) parts.push(`“${truncate(topic, 48)}”`)
  return parts
}

/* --------------------------------- Drafts --------------------------------- */

/** One generated idea as an editable card, until it is saved to the Idea Bank. */
export interface GeneratedDraft {
  /** Unique across batches: `<batchId>:<index>`. */
  key: string
  title: string
  core_idea: string
  why_it_matters: string
  hook: string
  hook_category: HookCategory
  format_id: ID | null
  /** The AI's format name — shown when it doesn't match a format in the library. */
  format_name: string
  angle_id: ID | null
  angle_name: string
  talking_points: string[]
  cta: string
  platform: PlatformId
  funnel_stage: FunnelStage
  pillar_id: ID | null
  persona_id: ID | null
  problem_id: ID | null
  /** The Idea Bank row created from this draft. */
  saved_idea_id: ID | null
}

export function draftFromIdea(idea: GeneratedIdea, db: BriefDb, key: string): GeneratedDraft {
  return {
    key,
    title: oneLine(idea.title),
    core_idea: idea.core_idea.trim(),
    why_it_matters: idea.why_it_matters.trim(),
    hook: oneLine(idea.hook),
    hook_category: (HOOK_CATEGORY_IDS as string[]).includes(idea.hook_category) ? idea.hook_category : "custom",
    format_id: matchFormatId(idea.format, db.content_formats),
    format_name: idea.format.trim(),
    angle_id: matchAngleId(idea.angle, db.angles),
    angle_name: idea.angle.trim(),
    talking_points: idea.talking_points.map((point) => point.trim()).filter(Boolean),
    cta: idea.cta.trim(),
    platform: idea.platform,
    funnel_stage: idea.funnel_stage,
    pillar_id: knownOrNull(db.content_pillars, idea.pillar_id),
    persona_id: knownOrNull(db.audience_personas, idea.persona_id),
    problem_id: knownOrNull(db.audience_problems, idea.problem_id),
    saved_idea_id: null,
  }
}

/**
 * Draft → Idea Bank row (source "ai_generator", status inbox). The goal comes from the brief; a short
 * brief topic becomes the core topic. References that no longer exist are dropped.
 */
export function draftToIdeaValues(draft: GeneratedDraft, brief: GeneratorBrief, db: BriefDb): InsertRow<"content_ideas"> {
  const hook = oneLine(draft.hook)
  const topic = oneLine(brief.topic)
  return {
    title: oneLine(draft.title),
    core_topic: topic.length <= 60 ? topic : "",
    description: draft.core_idea.trim(),
    hook,
    hook_category: hook ? draft.hook_category : null,
    angle_id: knownOrNull(db.angles, draft.angle_id),
    pillar_id: knownOrNull(db.content_pillars, draft.pillar_id),
    persona_id: knownOrNull(db.audience_personas, draft.persona_id),
    problem_id: knownOrNull(db.audience_problems, draft.problem_id),
    goal_id: knownOrNull(db.content_goals, brief.goalId),
    platforms: [draft.platform],
    format_id: knownOrNull(db.content_formats, draft.format_id),
    funnel_stage: draft.funnel_stage,
    source: "ai_generator",
    status: "inbox",
    why_it_matters: draft.why_it_matters.trim(),
    talking_points: draft.talking_points.map((point) => point.trim()).filter(Boolean),
    cta: draft.cta.trim(),
  }
}

/** "More like this": the same slot (pillar, persona, problem, platform, stage, format), new angles on the topic. */
export function moreLikeThisBrief(parent: GeneratorBrief, draft: GeneratedDraft): GeneratorBrief {
  return {
    pillarId: draft.pillar_id,
    personaId: draft.persona_id,
    problemId: draft.problem_id,
    platform: draft.platform,
    goalId: parent.goalId,
    topic: truncate(oneLine(draft.title), TOPIC_MAX),
    funnel: draft.funnel_stage,
    angleId: null,
    formatId: draft.format_id,
    count: MORE_LIKE_THIS_COUNT,
  }
}

/** Plain-text version of a draft for the clipboard. */
export function draftToText(draft: GeneratedDraft, names: { format: string; angle: string }, lang: UiLang = "en"): string {
  const funnel = FUNNEL_STAGES[draft.funnel_stage]
  return [
    draft.title,
    draft.hook ? gt(lang, "text_hook", { text: draft.hook }) : "",
    draft.core_idea ? gt(lang, "text_core_idea", { text: draft.core_idea }) : "",
    draft.why_it_matters ? gt(lang, "text_why", { text: draft.why_it_matters }) : "",
    draft.talking_points.length ? `${gt(lang, "text_points")}\n${draft.talking_points.map((point) => `- ${point}`).join("\n")}` : "",
    draft.cta ? gt(lang, "text_cta", { text: draft.cta }) : "",
    gt(lang, "text_meta", {
      format: names.format,
      angle: names.angle,
      platform: PLATFORMS[draft.platform].label,
      funnel: funnel.label,
      name: funnel.name,
    }),
  ]
    .filter(Boolean)
    .join("\n\n")
}

/* --------------------------------- Batches -------------------------------- */

export type BatchKind = "brief" | "more" | "restored"

/** One generate_ideas result on screen. */
export interface GeneratedBatch {
  /** The ai_generations row id when the call was logged. */
  id: string
  kind: BatchKind
  /** "More like this": the title it expands. */
  sourceTitle: string | null
  brief: GeneratorBrief
  requested: number
  drafts: GeneratedDraft[]
  provider: AiProviderId
  model: string
  createdAt: ISODateTime
  generationId: ID | null
  /** Restored from the AI log, which keeps a shortened copy of large batches. */
  trimmed: boolean
}

/* ---------------------------- Recent generations --------------------------- */

export interface LoggedGeneration {
  id: ID
  createdAt: ISODateTime
  provider: AiProviderId
  model: string
  brief: GeneratorBrief
  requested: number
  ideas: GeneratedIdea[]
  /** The log kept a shortened copy (text cut or the batch too large to keep). */
  trimmed: boolean
}

/** The AI log (`trimForLog`) cuts long strings to 80 / 200 / 600 characters and appends "…". */
const LOG_CUT_LENGTHS = new Set([81, 201, 601])
const wasCut = (value: unknown) => typeof value === "string" && value.endsWith("…") && LOG_CUT_LENGTHS.has(value.length)

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/** A logged idea object → GeneratedIdea (null without a title). */
export function parseLoggedIdea(value: unknown, fallbackPlatform: PlatformId): GeneratedIdea | null {
  if (!isRecord(value)) return null
  const title = oneLine(text(value.title))
  if (!title) return null
  const id = (x: unknown) => (typeof x === "string" && x ? x : null)
  return {
    title,
    core_idea: text(value.core_idea),
    why_it_matters: text(value.why_it_matters),
    hook: text(value.hook),
    hook_category: (HOOK_CATEGORY_IDS as unknown[]).includes(value.hook_category) ? (value.hook_category as HookCategory) : "custom",
    format: text(value.format),
    angle: text(value.angle),
    talking_points: Array.isArray(value.talking_points) ? value.talking_points.filter((p): p is string => typeof p === "string") : [],
    cta: text(value.cta),
    platform: (PLATFORM_IDS as unknown[]).includes(value.platform) ? (value.platform as PlatformId) : fallbackPlatform,
    funnel_stage: (FUNNEL_STAGE_IDS as unknown[]).includes(value.funnel_stage) ? (value.funnel_stage as FunnelStage) : "tofu",
    pillar_id: id(value.pillar_id),
    persona_id: id(value.persona_id),
    problem_id: id(value.problem_id),
  }
}

/** Successful generate_ideas calls from the log, newest first. */
export function recentGenerations(rows: readonly AiGeneration[], db: BriefDb, limit = 6): LoggedGeneration[] {
  return rows
    .filter((row) => row.task === "generate_ideas" && row.status === "success")
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .slice(0, limit)
    .map((row) => {
      const brief = briefFromTaskInput(row.input, db)
      const output = isRecord(row.output) ? row.output : {}
      const raw: unknown[] = Array.isArray(output.ideas) ? output.ideas : []
      const ideas = raw
        .map((value) => parseLoggedIdea(value, brief.platform ?? "facebook"))
        .filter((idea): idea is GeneratedIdea => idea !== null)
      const cut = raw.some((value) => isRecord(value) && Object.values(value).some((x) => wasCut(x) || (Array.isArray(x) && x.some(wasCut))))
      return {
        id: row.id,
        createdAt: row.created_at,
        provider: row.provider,
        model: row.model,
        brief,
        requested: brief.count,
        ideas,
        trimmed: output.truncated === true || cut,
      }
    })
}

/* ------------------------------ Example briefs ----------------------------- */

export interface ExampleBrief {
  id: string
  title: string
  /** Why this brief, in the workspace's own numbers. */
  reason: string
  brief: GeneratorBrief
}

/** Starting briefs built from real workspace gaps (pillar mix, untapped problems, open questions, goals). */
export function exampleBriefs(db: Database, now: Date, settings: AppSettings, limit = 4, lang: UiLang = "en"): ExampleBrief[] {
  const out: ExampleBrief[] = []
  const base: GeneratorBrief = { ...EMPTY_BRIEF }

  const mix = pillarMix(db, now, settings)
  const gap = mix.enoughData ? [...mix.rows].filter((row) => row.status === "under").sort((a, b) => a.deviation - b.deviation)[0] : undefined
  if (gap) {
    out.push({
      id: "pillar-gap",
      title: gt(lang, "example_gap_title", { pillar: gap.pillar.name || gt(lang, "example_gap_pillar") }),
      reason: gt(lang, "example_gap_reason", {
        pillar: gap.pillar.name || gt(lang, "example_gap_this_pillar"),
        actual: Math.round(gap.actualPct),
        target: Math.round(gap.targetPct),
      }),
      brief: { ...base, pillarId: gap.pillar.id },
    })
  }

  const usedProblems = new Set<ID>()
  for (const row of [...db.content_ideas, ...db.content_items]) if (row.problem_id) usedProblems.add(row.problem_id)
  const problem = db.audience_problems
    .filter((p) => p.problem.trim() && !usedProblems.has(p.id))
    .sort((a, b) => b.severity - a.severity || a.problem.localeCompare(b.problem))[0]
  if (problem) {
    out.push({
      id: "problem",
      title: gt(lang, "example_problem_title", { problem: truncate(oneLine(problem.problem), 60) }),
      reason: gt(lang, "example_problem_reason", { severity: problem.severity }),
      brief: {
        ...base,
        problemId: problem.id,
        personaId: knownOrNull(db.audience_personas, problem.persona_id),
        pillarId: knownOrNull(db.content_pillars, problem.pillar_id),
        count: 5,
      },
    })
  }

  const question = db.audience_questions
    .filter((q) => q.status === "new" && q.question.trim())
    .sort((a, b) => b.frequency - a.frequency || b.last_asked_at.localeCompare(a.last_asked_at))[0]
  if (question) {
    out.push({
      id: "question",
      title: gt(lang, "example_question_title", { question: truncate(oneLine(question.question), 60) }),
      reason:
        question.frequency > 1
          ? gt(lang, "example_question_asked", { count: question.frequency })
          : gt(lang, "example_question_open"),
      brief: {
        ...base,
        topic: oneLine(question.question).slice(0, TOPIC_MAX),
        pillarId: knownOrNull(db.content_pillars, question.pillar_id),
        personaId: knownOrNull(db.audience_personas, question.persona_id),
        count: 3,
      },
    })
  }

  const persona = db.audience_personas.find((p) => p.is_primary) ?? db.audience_personas[0]
  const platform = db.brand_profiles[0]?.main_platforms[0] ?? null
  if (persona || platform) {
    out.push({
      id: "reach",
      title: gt(lang, "example_reach_title"),
      reason: gt(lang, "example_reach_reason", {
        persona: persona ? gt(lang, "example_reach_persona", { name: persona.name || gt(lang, "example_reach_primary") }) : "",
        platform: platform ? gt(lang, "example_reach_platform", { platform: PLATFORMS[platform].label }) : "",
      }),
      brief: { ...base, personaId: persona?.id ?? null, platform, funnel: "tofu" },
    })
  }

  const goal =
    db.content_goals.find((g) => g.is_active && g.category === "leads") ?? db.content_goals.find((g) => g.is_active && g.category === "business")
  if (goal) {
    out.push({
      id: "leads",
      title: gt(lang, "example_leads_title"),
      reason: gt(lang, "example_leads_reason", { goal: goal.name || GOAL_CATEGORIES[goal.category].label }),
      brief: { ...base, goalId: goal.id, funnel: "bofu", count: 5 },
    })
  }

  out.push({
    id: "balanced",
    title: gt(lang, "example_balanced_title"),
    reason: gt(lang, "example_balanced_reason"),
    brief: base,
  })
  return out.slice(0, limit)
}

/* ---------------------------------- Time ---------------------------------- */

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then "Sep 3". */
export function timeAgo(iso: string, now: Date, lang: UiLang = "en"): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ""
  const t = (key: keyof (typeof labMessages)["en"], vars?: Vars) => translate(labMessages, lang, key, vars)
  const minutes = Math.floor((now.getTime() - time) / 60_000)
  if (minutes < 1) return t("just_now")
  if (minutes < 60) return t("minutes_ago", { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t("hours_ago", { count: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return t("yesterday")
  if (days < 7) return t("days_ago", { count: days })
  return formatDate(iso, "MMM d")
}
