/**
 * Onboarding wizard model (spec §48): the answers collected in steps 1–9, their defaults and
 * validation, and the pure helpers behind the steps — pillar rebalancing, the posts-per-platform
 * split, the recommended weekly posting strategy (§49) and the `onboarding_strategy` AI input.
 * No React and no store access, so it is unit-tested directly.
 */
import { positioningStatement } from "@/lib/ai/context"
import type { AiTaskInput } from "@/lib/ai/tasks"
import {
  CATEGORICAL_COLORS,
  GOAL_CATEGORY_IDS,
  LANGUAGES,
  PERSONALITY_TRAITS,
  PILLAR_PRESETS,
  PLATFORM_IDS,
  TONES,
} from "@/lib/constants"
import { GOALS, PLATFORM_STRATEGIES, POSTING_SLOTS, type FormatName } from "@/lib/data/seed/starter-data"
import type {
  BrandLanguage,
  BrandTone,
  CategoricalColor,
  ContentPillar,
  Database,
  GoalCategory,
  GoalPeriod,
  PersonalityTrait,
  PlatformId,
  ProblemCategory,
} from "@/lib/types"

/* ---------------------------------- Steps --------------------------------- */

export type StepKey =
  | "identity"
  | "positioning"
  | "audience"
  | "expertise"
  | "pillars"
  | "platforms"
  | "posting"
  | "goals"
  | "voice"
  | "strategy"

export interface StepMeta {
  key: StepKey
  /** Label under the progress segment. */
  short: string
  title: string
  description: string
}

export const STEPS: StepMeta[] = [
  {
    key: "identity",
    short: "You",
    title: "Who are you?",
    description: "The basics your audience should know — every idea, hook and script is written from here.",
  },
  {
    key: "positioning",
    short: "Known for",
    title: "What do you want to be known for?",
    description: "Your positioning is the filter for everything you post. Be specific — specific is memorable.",
  },
  {
    key: "audience",
    short: "Audience",
    title: "Who do you want to reach?",
    description: "Describe your primary persona: the one kind of person your content is really for.",
  },
  {
    key: "expertise",
    short: "Expertise",
    title: "What are your expertise areas?",
    description: "Pick the topics you can talk about from real experience, not just research.",
  },
  {
    key: "pillars",
    short: "Pillars",
    title: "Choose your content pillars",
    description: "The themes you rotate through. Targets set your content mix and must add up to 100%.",
  },
  {
    key: "platforms",
    short: "Platforms",
    title: "Choose your platforms",
    description: "Where you'll show up. A few platforms done consistently beat every platform done occasionally.",
  },
  {
    key: "posting",
    short: "Posting",
    title: "Set your posting targets",
    description: "A weekly target and a posting schedule you can actually sustain.",
  },
  {
    key: "goals",
    short: "Goals",
    title: "Choose your personal brand goals",
    description: "What should all this content achieve? Pick one primary goal and, if you like, a secondary one.",
  },
  {
    key: "voice",
    short: "Voice",
    title: "Configure your tone",
    description: "How you sound. The Content Strategist and every AI draft follow these choices.",
  },
  {
    key: "strategy",
    short: "Strategy",
    title: "Your initial strategy",
    description: "A starting strategy built from your answers. Edit anything, choose your ideas, then finish setup.",
  },
]

export const STEP_COUNT = STEPS.length
export const LAST_STEP = STEP_COUNT - 1
/** The voice step — its primary action generates the strategy. */
export const GENERATE_STEP = STEP_COUNT - 2

export const stepIndex = (key: StepKey) => STEPS.findIndex((s) => s.key === key)

/* ---------------------------------- Limits -------------------------------- */

/** Text limits match the `onboarding_strategy` input schema so the gateway never rejects answers. */
export const LIMITS = {
  name: 120,
  brandName: 120,
  role: 160,
  industry: 160,
  location: 120,
  positioning: 300,
  longText: 1000,
  expertise: 60,
  expertiseMax: 10,
  problem: 200,
  problemsMax: 10,
  personaGoal: 200,
  personaGoalsMax: 8,
  story: 2000,
  tonesMax: 3,
  traitsMax: 5,
  pillarsMin: 2,
  pillarsMax: 8,
  pillarName: 40,
  pillarDescription: 200,
  weeklyMax: 50,
  platformMax: 21,
  label: 60,
  years: 80,
  ideaCount: 30,
} as const

/* ---------------------------------- Options ------------------------------- */

export const EXPERIENCE_LEVELS = [
  { id: "Beginner", label: "Beginner" },
  { id: "Intermediate", label: "Intermediate" },
  { id: "Advanced", label: "Advanced" },
  { id: "Mixed", label: "Mixed levels" },
] as const

export function problemCategoryFor(level: string): ProblemCategory {
  const l = level.trim().toLowerCase()
  if (l.startsWith("beginner")) return "beginner"
  if (l.startsWith("advanced")) return "advanced"
  return "intermediate"
}

export const LANGUAGE_NOTES: Record<BrandLanguage, string> = {
  english: "Clear, conversational English.",
  tagalog: "Natural Filipino — the way you'd explain it to a friend.",
  taglish: "English and Tagalog mixed, the way you actually talk.",
}

export const CTA_PRESETS: { label: string; text: string }[] = [
  { label: "Soft", text: "Soft by default — comment a keyword to get the resource, or DM me your situation." },
  { label: "Conversation", text: "End with a question people can answer from their own experience." },
  { label: "Direct", text: "Direct on conversion posts only — book a call or grab the offer through the link." },
]

/* ---------------------------------- Answers ------------------------------- */

export interface PillarDraft {
  /** Stable local key: "preset:<name>" or "custom:<n>". */
  key: string
  name: string
  description: string
  /** lucide-react icon name. */
  icon: string
  examples: string[]
  /** Target share of the mix, whole percent. */
  target: number
  selected: boolean
  preset: boolean
}

export interface ScheduleDay {
  /** 0 = Sunday … 6 = Saturday. */
  day: number
  enabled: boolean
  /** Theme label, e.g. "Educational / Authority". */
  label: string
  platforms: PlatformId[]
  /** "HH:mm" or null. */
  time: string | null
  /** Content format name (matched to the format library by name when saved). */
  format: string
}

export interface GoalTarget {
  value: number | null
  period: GoalPeriod
}

export interface OnboardingAnswers {
  // 1 · Who are you?
  name: string
  brand_name: string
  role: string
  industry: string
  years_experience: number | null
  location: string
  // 2 · Known for
  audience: string
  result: string
  method: string
  known_for: string
  problems_solved: string
  why_listen: string
  point_of_view: string
  // 3 · Primary persona
  persona_name: string
  persona_profession: string
  persona_experience: string
  persona_goals: string[]
  persona_problems: string[]
  persona_platforms: PlatformId[]
  // 4 · Expertise
  expertise_areas: string[]
  expertise_summary: string
  story: string
  // 5 · Pillars
  pillars: PillarDraft[]
  // 6 · Platforms
  platforms: PlatformId[]
  // 7 · Posting
  /** Posts per week per main platform; the weekly post target is their sum. */
  split: Partial<Record<PlatformId, number>>
  schedule_mode: "recommended" | "custom"
  custom_schedule: ScheduleDay[]
  // 8 · Goals
  primary_goal: GoalCategory | null
  secondary_goal: GoalCategory | null
  goal_targets: Partial<Record<GoalCategory, GoalTarget>>
  // 9 · Voice
  language: BrandLanguage
  tones: BrandTone[]
  personality: PersonalityTrait[]
  cta_style: string
  always_do: string
  never_do: string
}

export function presetPillars(): PillarDraft[] {
  return PILLAR_PRESETS.map((p) => ({
    key: `preset:${p.name}`,
    name: p.name,
    description: p.description,
    icon: p.icon,
    examples: [...p.examples],
    target: p.target_percentage,
    selected: true,
    preset: true,
  }))
}

export function emptyAnswers(): OnboardingAnswers {
  return {
    name: "",
    brand_name: "",
    role: "",
    industry: "",
    years_experience: null,
    location: "",
    audience: "",
    result: "",
    method: "",
    known_for: "",
    problems_solved: "",
    why_listen: "",
    point_of_view: "",
    persona_name: "",
    persona_profession: "",
    persona_experience: "",
    persona_goals: [],
    persona_problems: [],
    persona_platforms: [],
    expertise_areas: [],
    expertise_summary: "",
    story: "",
    pillars: presetPillars(),
    platforms: [],
    split: {},
    schedule_mode: "recommended",
    custom_schedule: [],
    primary_goal: null,
    secondary_goal: null,
    goal_targets: {},
    language: "english",
    tones: ["conversational"],
    personality: [],
    cta_style: "",
    always_do: "",
    never_do: "",
  }
}

export const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0]?.replace(/["“”']/g, "") ?? ""
}

/* ------------------------------- Math helpers ----------------------------- */

/**
 * Split `total` into whole numbers proportional to `weights` (largest remainder), each at least `min`.
 * Shares that would fall under `min` are lifted by taking from the largest ones, so weights that
 * already fit (30/20/20/15/10/5 of 100) come back unchanged. A total below `min × n` is raised to it.
 */
export function largestRemainder(weights: number[], total: number, min = 0): number[] {
  const n = weights.length
  if (!n) return []
  const target = Math.max(Math.round(total), min * n)
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const weightSum = clean.reduce((a, w) => a + w, 0)
  const raw = clean.map((w) => (weightSum > 0 ? (w / weightSum) * target : target / n))
  const out = raw.map((r) => Math.floor(r))
  let left = target - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    out[i]++
    left--
  }
  for (let i = 0; i < n; i++) {
    while (out[i] < min) {
      let donor = -1
      for (let j = 0; j < n; j++) if (out[j] > min && (donor === -1 || out[j] > out[donor])) donor = j
      if (donor === -1) break
      out[donor]--
      out[i]++
    }
  }
  return out
}

const clampInt = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)))

/* ---------------------------------- Pillars ------------------------------- */

export const selectedPillars = (a: Pick<OnboardingAnswers, "pillars">) => a.pillars.filter((p) => p.selected)

export const pillarTotal = (pillars: PillarDraft[]) =>
  pillars.filter((p) => p.selected).reduce((acc, p) => acc + (Number.isFinite(p.target) ? p.target : 0), 0)

/** Scale selected targets to exactly 100 (each ≥ 1), keeping their proportions. Zero targets get an average share. */
export function rebalancePillars(pillars: PillarDraft[]): PillarDraft[] {
  const selected = pillars.filter((p) => p.selected)
  if (!selected.length) return pillars
  const positive = selected.filter((p) => p.target > 0)
  const fallback = positive.length ? positive.reduce((a, p) => a + p.target, 0) / positive.length : 1
  const targets = largestRemainder(
    selected.map((p) => (p.target > 0 ? p.target : fallback)),
    100,
    1
  )
  let i = 0
  return pillars.map((p) => (p.selected ? { ...p, target: targets[i++] } : p))
}

/** Equal targets for every selected pillar (summing to 100). */
export function evenPillars(pillars: PillarDraft[]): PillarDraft[] {
  const count = pillars.filter((p) => p.selected).length
  if (!count) return pillars
  const targets = largestRemainder(Array.from({ length: count }, () => 1), 100, 1)
  let i = 0
  return pillars.map((p) => (p.selected ? { ...p, target: targets[i++] } : p))
}

/**
 * Colours for the selected pillars, keyed by draft key. Pillars that already exist (matched by name)
 * keep their colour; new ones take the first free slot in CATEGORICAL_COLORS order.
 */
export function pillarColors(
  pillars: PillarDraft[],
  existing: Pick<ContentPillar, "name" | "color">[] = []
): Map<string, CategoricalColor> {
  const byName = new Map(existing.map((p) => [norm(p.name), p.color]))
  const selected = pillars.filter((p) => p.selected)
  const out = new Map<string, CategoricalColor>()
  const taken = new Set<CategoricalColor>()
  for (const p of selected) {
    const color = byName.get(norm(p.name))
    if (color) {
      out.set(p.key, color)
      taken.add(color)
    }
  }
  const everUsed = new Set<CategoricalColor>(existing.map((p) => p.color))
  selected.forEach((p, index) => {
    if (out.has(p.key)) return
    const color =
      CATEGORICAL_COLORS.find((c) => !taken.has(c) && !everUsed.has(c)) ??
      CATEGORICAL_COLORS.find((c) => !taken.has(c)) ??
      CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
    out.set(p.key, color)
    taken.add(color)
  })
  return out
}

/* --------------------------------- Platforms ------------------------------ */

export const platformsInOrder = (platforms: readonly PlatformId[]) => PLATFORM_IDS.filter((p) => platforms.includes(p))

export const defaultFrequency = (platform: PlatformId) => PLATFORM_STRATEGIES[platform].frequency

/** Posts per week for each main platform (missing entries fall back to the platform's starter frequency). */
export function platformSplit(a: Pick<OnboardingAnswers, "platforms" | "split">): Record<PlatformId, number> {
  const out = {} as Record<PlatformId, number>
  for (const p of platformsInOrder(a.platforms)) {
    const value = a.split[p]
    out[p] = typeof value === "number" && Number.isFinite(value) ? clampInt(value, 1, LIMITS.platformMax) : defaultFrequency(p)
  }
  return out
}

/** The weekly post target: one post on one platform counts as one post. */
export function weeklyTotal(a: Pick<OnboardingAnswers, "platforms" | "split">): number {
  return Object.values(platformSplit(a)).reduce((acc, n) => acc + n, 0)
}

/** Keep the split for platforms still selected, add starter frequencies for new ones, drop the rest. */
export function normalizeSplit(
  split: Partial<Record<PlatformId, number>>,
  platforms: PlatformId[]
): Partial<Record<PlatformId, number>> {
  return platformSplit({ platforms, split })
}

/** Spread a new weekly target over the main platforms, proportional to the current split (≥ 1 each). */
export function distributeTotal(
  total: number,
  a: Pick<OnboardingAnswers, "platforms" | "split">
): Partial<Record<PlatformId, number>> {
  const platforms = platformsInOrder(a.platforms)
  if (!platforms.length) return {}
  const current = platformSplit(a)
  const target = clampInt(total, platforms.length, Math.min(LIMITS.weeklyMax, LIMITS.platformMax * platforms.length))
  const values = largestRemainder(
    platforms.map((p) => current[p]),
    target,
    1
  )
  return Object.fromEntries(platforms.map((p, i) => [p, Math.min(LIMITS.platformMax, values[i])]))
}

/* ------------------------------ Posting schedule -------------------------- */

/** Which platforms suit each format of the recommended strategy. */
const FORMAT_PLATFORMS: Partial<Record<FormatName, PlatformId[]>> = {
  "Short-form Video": ["tiktok", "instagram", "youtube", "facebook"],
  "Facebook Post": ["facebook", "threads", "linkedin"],
  Carousel: ["instagram", "linkedin", "facebook"],
  "LinkedIn Post": ["linkedin", "facebook", "threads", "x"],
  "Behind-the-scenes": ["tiktok", "instagram", "facebook", "youtube"],
}

/** The natural format for a platform when a slot has to move there. */
export const PLATFORM_FORMAT: Record<PlatformId, FormatName> = {
  facebook: "Facebook Post",
  tiktok: "Short-form Video",
  instagram: "Carousel",
  youtube: "Short-form Video",
  linkedin: "LinkedIn Post",
  x: "X Post",
  threads: "Threads",
}

/**
 * The recommended weekly posting strategy (spec §49) adapted to the chosen platforms: each day keeps
 * its theme; platforms you don't use are dropped and an empty day moves to one of your platforms
 * (rotating, so no single platform takes every substitute), switching to a format that fits it.
 */
export function recommendedSchedule(platforms: PlatformId[]): ScheduleDay[] {
  const main = platformsInOrder(platforms)
  let rotation = 0
  return POSTING_SLOTS.map((slot) => {
    let chosen = slot.platforms.filter((p) => main.includes(p))
    let format: string = slot.format
    if (!chosen.length && main.length) {
      const fits = FORMAT_PLATFORMS[slot.format] ?? []
      const fitting = main.filter((p) => fits.includes(p))
      if (fitting.length) {
        chosen = [fitting[rotation % fitting.length]]
      } else {
        const platform = main[rotation % main.length]
        chosen = [platform]
        format = PLATFORM_FORMAT[platform]
      }
      rotation++
    }
    return { day: slot.day, enabled: chosen.length > 0, label: slot.label, platforms: chosen, time: slot.time, format }
  })
}

/** Days in display order for the workspace's week start. */
export function weekOrder(weekStartsOn: 0 | 1 = 1): number[] {
  return weekStartsOn === 0 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0]
}

/** All seven days, restricted to the main platforms (an enabled day never ends up without a platform). */
export function normalizeSchedule(days: ScheduleDay[], platforms: PlatformId[]): ScheduleDay[] {
  const main = platformsInOrder(platforms)
  const recommended = recommendedSchedule(main)
  return recommended.map((fallback) => {
    const day = days.find((d) => d.day === fallback.day)
    if (!day) return fallback
    const kept = day.platforms.filter((p) => main.includes(p))
    return { ...day, platforms: kept.length || !day.enabled ? kept : fallback.platforms }
  })
}

/** The schedule that will be saved: recommended or custom, enabled days only. */
export function finalSchedule(a: Pick<OnboardingAnswers, "schedule_mode" | "custom_schedule" | "platforms">): ScheduleDay[] {
  const days = a.schedule_mode === "custom" ? normalizeSchedule(a.custom_schedule, a.platforms) : recommendedSchedule(a.platforms)
  return days.filter((d) => d.enabled && d.platforms.length > 0)
}

/** Platform placements per week in a schedule (a slot on two platforms is two posts). */
export const schedulePosts = (days: ScheduleDay[]) => days.reduce((acc, d) => acc + (d.enabled ? d.platforms.length : 0), 0)

/** Preferred pillars (by name) for a schedule theme label. */
const LABEL_PILLARS: { match: RegExp; pillars: string[] }[] = [
  { match: /tutorial|framework|educat|how.?to/i, pillars: ["education", "authority"] },
  { match: /authority|opinion|industry|analysis/i, pillars: ["authority", "leadership", "education"] },
  { match: /leader|team/i, pillars: ["leadership", "authority"] },
  { match: /story|journey|behind/i, pillars: ["journey", "personal"] },
  { match: /personal|lifestyle|reflection|community/i, pillars: ["personal", "journey"] },
  { match: /offer|business|sales|launch/i, pillars: ["business"] },
]

/** The selected pillar a schedule day's theme points to, if any. */
export function pillarForLabel(label: string, pillarNames: string[]): string | null {
  const names = new Map(pillarNames.map((n) => [norm(n), n]))
  const direct = pillarNames.find((n) => norm(label).includes(norm(n)))
  if (direct) return direct
  for (const rule of LABEL_PILLARS) {
    if (!rule.match.test(label)) continue
    for (const candidate of rule.pillars) {
      const hit = names.get(candidate)
      if (hit) return hit
    }
  }
  return null
}

/* ----------------------------------- Goals -------------------------------- */

export function goalTargetFor(a: Pick<OnboardingAnswers, "goal_targets">, category: GoalCategory): GoalTarget {
  return a.goal_targets[category] ?? { value: GOALS[category].target, period: "monthly" }
}

export function chosenGoals(a: Pick<OnboardingAnswers, "primary_goal" | "secondary_goal">): GoalCategory[] {
  const out: GoalCategory[] = []
  if (a.primary_goal) out.push(a.primary_goal)
  if (a.secondary_goal && a.secondary_goal !== a.primary_goal) out.push(a.secondary_goal)
  return out
}

/* -------------------------------- Positioning ----------------------------- */

export function positioningOf(a: Pick<OnboardingAnswers, "audience" | "result" | "method">): string {
  return positioningStatement(a.audience, a.result, a.method)
}

/**
 * Split an "I help [audience] [result] through [method]." statement back into its parts, using the
 * audience the creator gave to find where the result starts. Null when it doesn't have that shape.
 */
export function parsePositioning(
  statement: string,
  audienceHint: string
): { audience: string; result: string; method: string } | null {
  const match = /^\s*I help\s+(.+?)\s+through\s+(.+?)\s*\.?\s*$/i.exec(statement)
  const audience = audienceHint.trim()
  if (!match || !audience) return null
  const head = match[1]
  if (!head.toLowerCase().startsWith(`${audience.toLowerCase()} `)) return null
  const result = head.slice(audience.length).trim()
  const method = match[2].trim()
  return result && method ? { audience: head.slice(0, audience.length), result, method } : null
}

/* -------------------------------- Validation ------------------------------ */

/** Field id → message. Ids double as DOM ids (`ob-<field>`) so the first invalid field can be focused. */
export type StepErrors = Partial<Record<string, string>>

export function validateStep(key: StepKey, a: OnboardingAnswers): StepErrors {
  const errors: StepErrors = {}
  const need = (field: keyof OnboardingAnswers, message: string) => {
    const value = a[field]
    if (typeof value === "string" && !value.trim()) errors[field] = message
  }
  switch (key) {
    case "identity":
      need("name", "Add your name.")
      need("role", "Add your role — e.g. Founder, Marketing lead, Coach.")
      need("industry", "Add your industry.")
      if (a.years_experience !== null && (a.years_experience < 0 || a.years_experience > LIMITS.years)) {
        errors.years_experience = `Use a number between 0 and ${LIMITS.years}.`
      }
      break
    case "positioning":
      need("audience", "Who do you help?")
      need("result", "What result do you help them get?")
      need("known_for", "Say what you want to be known for.")
      break
    case "audience":
      need("persona_name", "Name your primary persona.")
      if (!a.persona_problems.some((p) => p.trim())) errors.persona_problems = "Add at least one problem they're struggling with."
      break
    case "expertise":
      if (!a.expertise_areas.length) errors.expertise_areas = "Pick at least one expertise area."
      break
    case "pillars": {
      const selected = selectedPillars(a)
      const total = pillarTotal(a.pillars)
      if (selected.length < LIMITS.pillarsMin) errors.pillars = `Choose at least ${LIMITS.pillarsMin} pillars — a mix needs contrast.`
      else if (selected.length > LIMITS.pillarsMax) errors.pillars = `Choose at most ${LIMITS.pillarsMax} pillars.`
      else if (selected.some((p) => !p.name.trim())) errors.pillars = "Every pillar needs a name."
      else if (new Set(selected.map((p) => norm(p.name))).size !== selected.length) errors.pillars = "Pillar names must be unique."
      else if (selected.some((p) => !Number.isInteger(p.target) || p.target < 1)) errors.pillars = "Give every pillar a whole-number target of at least 1%."
      else if (total !== 100) errors.pillars = `Targets add up to ${total}% — they need to total 100%.`
      break
    }
    case "platforms":
      if (!a.platforms.length) errors.platforms = "Choose at least one platform."
      break
    case "posting": {
      if (a.schedule_mode === "custom") {
        const days = normalizeSchedule(a.custom_schedule, a.platforms)
        if (!days.some((d) => d.enabled)) errors.schedule = "Turn on at least one posting day."
        else if (days.some((d) => d.enabled && !d.platforms.length)) errors.schedule = "Every posting day needs a platform."
      }
      break
    }
    case "goals": {
      if (!a.primary_goal) errors.primary_goal = "Choose your primary goal."
      for (const category of chosenGoals(a)) {
        const target = goalTargetFor(a, category)
        if (target.value !== null && (!Number.isFinite(target.value) || target.value < 1)) {
          errors[`goal_${category}`] = "Use a target of at least 1, or leave it empty."
        }
      }
      break
    }
    case "voice":
      if (!a.tones.length) errors.tones = "Pick at least one tone."
      if (!a.personality.length) errors.personality = "Pick at least one personality trait."
      break
    case "strategy":
      break
  }
  return errors
}

export const hasErrors = (errors: StepErrors) => Object.keys(errors).length > 0

/** Index of the first step (before `upTo`) whose answers are invalid, or -1. */
export function firstInvalidStep(a: OnboardingAnswers, upTo = LAST_STEP): number {
  for (let i = 0; i < Math.min(upTo, STEP_COUNT); i++) {
    if (hasErrors(validateStep(STEPS[i].key, a))) return i
  }
  return -1
}

/* ------------------------------------ AI ---------------------------------- */

const clip = (value: string, max: number) => value.trim().slice(0, max)

/** The `onboarding_strategy` request for these answers (clipped to the task's input limits). */
export function strategyInput(a: OnboardingAnswers): AiTaskInput<"onboarding_strategy"> {
  return {
    name: clip(a.name, LIMITS.name),
    brand_name: clip(a.brand_name, LIMITS.brandName),
    role: clip(a.role, LIMITS.role),
    industry: clip(a.industry, LIMITS.industry),
    years_experience:
      a.years_experience === null || !Number.isFinite(a.years_experience) ? null : clampInt(a.years_experience, 0, LIMITS.years),
    expertise_areas: a.expertise_areas.map((x) => clip(x, LIMITS.expertise)).filter(Boolean).slice(0, 15),
    audience: clip(a.audience || a.persona_name, LIMITS.positioning),
    result: clip(a.result, LIMITS.positioning),
    method: clip(a.method, LIMITS.positioning),
    audience_problems: a.persona_problems.map((p) => clip(p, LIMITS.problem)).filter(Boolean).slice(0, LIMITS.problemsMax),
    platforms: platformsInOrder(a.platforms),
    goals: chosenGoals(a),
    language: a.language,
    tones: a.tones.slice(0, 6),
    personality: a.personality.slice(0, 10),
    story: clip(a.story, LIMITS.story),
    idea_count: LIMITS.ideaCount,
  }
}

/** Identifies the answers a strategy was generated from (changes → the strategy is out of date). */
export const strategyKey = (a: OnboardingAnswers) => JSON.stringify(strategyInput(a))

/* ------------------------------ From the workspace ------------------------ */

/**
 * Answers pre-filled from whatever the workspace already holds — blank for a fresh workspace,
 * the current Brand HQ when setup is re-run (so re-running edits rather than retypes).
 */
export function answersFromWorkspace(db: Database, options: { rerun?: boolean } = {}): OnboardingAnswers {
  const a = emptyAnswers()
  const brand = db.brand_profiles[0]
  if (brand) {
    Object.assign(a, {
      name: brand.name,
      brand_name: brand.brand_name,
      role: brand.role,
      industry: brand.industry,
      years_experience: brand.years_experience,
      location: brand.location,
      audience: brand.positioning_audience,
      result: brand.positioning_result,
      method: brand.positioning_method,
      known_for: brand.known_for,
      problems_solved: brand.problems_solved,
      why_listen: brand.why_listen,
      point_of_view: brand.point_of_view,
      expertise_areas: [...brand.expertise_areas].slice(0, LIMITS.expertiseMax),
      expertise_summary: brand.expertise_summary,
      platforms: platformsInOrder(brand.main_platforms),
      language: brand.language,
      tones: brand.tones.length ? brand.tones.slice(0, LIMITS.tonesMax) : a.tones,
      personality: brand.personality_traits.slice(0, LIMITS.traitsMax),
      cta_style: brand.cta_style,
      always_do: brand.always_do,
      never_do: brand.never_do,
    } satisfies Partial<OnboardingAnswers>)
  }

  const persona = db.audience_personas.find((p) => p.is_primary) ?? db.audience_personas[0]
  if (persona) {
    const problems = db.audience_problems.filter((p) => p.persona_id === persona.id).map((p) => p.problem)
    Object.assign(a, {
      persona_name: persona.name,
      persona_profession: persona.profession,
      persona_experience: persona.experience_level,
      persona_goals: persona.goals.slice(0, LIMITS.personaGoalsMax),
      persona_problems: (problems.length ? problems : persona.problems).slice(0, LIMITS.problemsMax),
      persona_platforms: platformsInOrder(persona.platforms),
    } satisfies Partial<OnboardingAnswers>)
  }

  const active = db.content_pillars.filter((p) => p.is_active).sort((x, y) => x.sort_order - y.sort_order)
  if (active.length) {
    const existing: PillarDraft[] = active.map((p) => ({
      key: `existing:${p.id}`,
      name: p.name,
      description: p.description,
      icon: p.icon,
      examples: [...p.examples],
      target: Math.round(p.target_percentage),
      selected: true,
      preset: PILLAR_PRESETS.some((preset) => norm(preset.name) === norm(p.name)),
    }))
    const missingPresets = presetPillars()
      .filter((preset) => !active.some((p) => norm(p.name) === norm(preset.name)))
      .map((preset) => ({ ...preset, selected: false }))
    a.pillars = [...existing, ...missingPresets]
  }

  if (!a.platforms.length && options.rerun) {
    a.platforms = platformsInOrder(db.content_platforms.filter((p) => p.is_active).map((p) => p.platform))
  }
  const split: Partial<Record<PlatformId, number>> = {}
  for (const p of a.platforms) {
    const row = db.content_platforms.find((r) => r.platform === p)
    if (row && row.posting_frequency > 0) split[p] = clampInt(row.posting_frequency, 1, LIMITS.platformMax)
  }
  a.split = normalizeSplit(split, a.platforms)

  const slots = db.content_calendar.filter((s) => s.is_active)
  if (options.rerun && slots.length) {
    const formatName = (id: string | null) => db.content_formats.find((f) => f.id === id)?.name ?? ""
    const fallback = recommendedSchedule(a.platforms)
    a.schedule_mode = "custom"
    a.custom_schedule = fallback.map((day) => {
      const slot = slots.filter((s) => s.day_of_week === day.day).sort((x, y) => x.sort_order - y.sort_order)[0]
      if (!slot) return { ...day, enabled: false }
      return {
        day: day.day,
        enabled: true,
        label: slot.label,
        platforms: platformsInOrder(slot.platforms),
        time: slot.time,
        format: formatName(slot.format_id) || day.format,
      }
    })
  }

  if (brand) {
    const goalOf = (id: string | null) => db.content_goals.find((g) => g.id === id)
    const primary = goalOf(brand.primary_goal_id)
    const secondary = goalOf(brand.secondary_goal_id)
    a.primary_goal = primary?.category ?? null
    a.secondary_goal = secondary && secondary.category !== primary?.category ? secondary.category : null
    for (const goal of [primary, secondary]) {
      if (goal) a.goal_targets[goal.category] = { value: goal.target_value, period: goal.period }
    }
  }
  return a
}

/* -------------------------------- Draft safety ---------------------------- */

const STRING_FIELDS = [
  "name",
  "brand_name",
  "role",
  "industry",
  "location",
  "audience",
  "result",
  "method",
  "known_for",
  "problems_solved",
  "why_listen",
  "point_of_view",
  "persona_name",
  "persona_profession",
  "persona_experience",
  "expertise_summary",
  "story",
  "cta_style",
  "always_do",
  "never_do",
] as const satisfies readonly (keyof OnboardingAnswers)[]

const strings = (value: unknown, max = 50): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === "string").slice(0, max) : []

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
}

const listOf = <T extends string>(value: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(value) ? value.filter((x): x is T => oneOf(x, allowed)) : []

/** Answers restored from a stored draft, with anything malformed replaced by its default. */
export function sanitizeAnswers(raw: unknown): OnboardingAnswers {
  const out = emptyAnswers()
  if (!raw || typeof raw !== "object") return out
  const r = raw as Record<string, unknown>
  for (const field of STRING_FIELDS) {
    const value = r[field]
    if (typeof value === "string") out[field] = value
  }
  if (typeof r.years_experience === "number" && Number.isFinite(r.years_experience)) out.years_experience = r.years_experience
  out.persona_goals = strings(r.persona_goals, LIMITS.personaGoalsMax)
  out.persona_problems = strings(r.persona_problems, LIMITS.problemsMax)
  out.persona_platforms = listOf(r.persona_platforms, PLATFORM_IDS)
  out.expertise_areas = strings(r.expertise_areas, LIMITS.expertiseMax)
  out.platforms = platformsInOrder(listOf(r.platforms, PLATFORM_IDS))

  if (Array.isArray(r.pillars)) {
    const pillars = r.pillars
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
      .filter((p) => typeof p.name === "string" && typeof p.key === "string")
      .map(
        (p): PillarDraft => ({
          key: String(p.key),
          name: String(p.name),
          description: typeof p.description === "string" ? p.description : "",
          icon: typeof p.icon === "string" && p.icon ? p.icon : "Layers",
          examples: strings(p.examples, 12),
          target: typeof p.target === "number" && Number.isFinite(p.target) ? Math.round(p.target) : 0,
          selected: p.selected === true,
          preset: p.preset === true,
        })
      )
    if (pillars.length) out.pillars = pillars
  }

  if (r.split && typeof r.split === "object") {
    const split: Partial<Record<PlatformId, number>> = {}
    for (const [key, value] of Object.entries(r.split as Record<string, unknown>)) {
      if (oneOf(key, PLATFORM_IDS) && typeof value === "number" && Number.isFinite(value)) split[key] = value
    }
    out.split = normalizeSplit(split, out.platforms)
  } else {
    out.split = normalizeSplit({}, out.platforms)
  }
  out.schedule_mode = r.schedule_mode === "custom" ? "custom" : "recommended"
  if (Array.isArray(r.custom_schedule)) {
    out.custom_schedule = r.custom_schedule
      .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object" && typeof d.day === "number")
      .map((d) => ({
        day: clampInt(d.day as number, 0, 6),
        enabled: d.enabled === true,
        label: typeof d.label === "string" ? d.label : "",
        platforms: listOf(d.platforms, PLATFORM_IDS),
        time: typeof d.time === "string" && /^\d{2}:\d{2}$/.test(d.time) ? d.time : null,
        format: typeof d.format === "string" ? d.format : "",
      }))
  }

  out.primary_goal = oneOf(r.primary_goal, GOAL_CATEGORY_IDS) ? r.primary_goal : null
  out.secondary_goal = oneOf(r.secondary_goal, GOAL_CATEGORY_IDS) ? r.secondary_goal : null
  if (r.goal_targets && typeof r.goal_targets === "object") {
    for (const [key, value] of Object.entries(r.goal_targets as Record<string, unknown>)) {
      if (!oneOf(key, GOAL_CATEGORY_IDS) || !value || typeof value !== "object") continue
      const target = value as Record<string, unknown>
      out.goal_targets[key] = {
        value: typeof target.value === "number" && Number.isFinite(target.value) ? target.value : null,
        period: target.period === "weekly" || target.period === "quarterly" ? target.period : "monthly",
      }
    }
  }

  const languages = LANGUAGES.map((l) => l.id)
  out.language = oneOf(r.language, languages) ? r.language : "english"
  const tones = listOf(
    r.tones,
    TONES.map((t) => t.id)
  )
  out.tones = tones.slice(0, LIMITS.tonesMax)
  out.personality = listOf(
    r.personality,
    PERSONALITY_TRAITS.map((t) => t.id)
  ).slice(0, LIMITS.traitsMax)
  return out
}
