/**
 * Onboarding wizard model (spec §48, docs/QUICK_SETUP.md): the flows (4-screen Quick setup for a new
 * workspace, the detailed setup for a re-run, Niche Discovery only), the answers each step collects,
 * their defaults and validation, and the pure helpers behind the steps — pillar rebalancing, the
 * posts-per-platform split, the recommended weekly posting strategy (§49), aims → goals and the
 * `onboarding_strategy` AI input. No React and no store access, so it is unit-tested directly.
 * `quick-setup.ts` turns the Quick setup answers into the full answers the plan understands.
 */
import type { NicheAim, NicheOption } from "@/lib/ai"
import { positioningStatement } from "@/lib/ai/context"
import type { AiTaskInput } from "@/lib/ai/tasks"
import { CATEGORICAL_COLORS, GOAL_CATEGORY_IDS, LANGUAGES, PERSONALITY_TRAITS, PILLAR_PRESETS, PLATFORM_IDS, TONES } from "@/lib/constants"
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
import { EN, type Copy } from "./copy-en"

/* ---------------------------------- Steps --------------------------------- */

export type StepKey =
  // Quick setup (first run) — also screens 2–4 of a Niche Discovery re-run
  | "start"
  | "about"
  | "who"
  | "pick"
  // Detailed setup (re-run from Brand HQ)
  | "welcome"
  | "hilig"
  | "galing"
  | "kanino"
  | "para_saan"
  | "niche"
  | "identity"
  | "platforms"
  | "voice"
  | "pillars"
  | "strategy"

/** first = a new workspace (Quick setup) · rerun = Detailed setup from Brand HQ · niche = only Niche Discovery (`/onboarding?step=niche`). */
export type WizardMode = "first" | "rerun" | "niche"

/** Quick setup: start (language, name, platforms) → about you → who you help → pick your niche. A Building screen follows (not a step). */
export const QUICK_FLOW: readonly StepKey[] = ["start", "about", "who", "pick"]
/** Detailed setup: Niche Discovery first, then the setup it pre-fills. The welcome screen picks the language and isn't counted. */
export const FULL_FLOW: readonly StepKey[] = ["welcome", "hilig", "galing", "kanino", "para_saan", "niche", "identity", "platforms", "voice", "pillars", "strategy"]
/** Niche Discovery re-run: the Quick setup screens 2–4, pre-filled from Brand HQ. */
export const NICHE_FLOW: readonly StepKey[] = ["about", "who", "pick"]
/** Detailed-setup steps shown under the "Niche Discovery" phase in its progress bar. */
export const DISCOVERY_STEPS: ReadonlySet<StepKey> = new Set<StepKey>(["hilig", "galing", "kanino", "para_saan", "niche"])

export const flowFor = (mode: WizardMode): readonly StepKey[] => (mode === "first" ? QUICK_FLOW : mode === "niche" ? NICHE_FLOW : FULL_FLOW)
/** Quick setup and Niche Discovery use the light screens (one progress bar); a re-run uses the detailed steps. */
export const isQuickMode = (mode: WizardMode) => mode !== "rerun"
export const countedSteps = (flow: readonly StepKey[]) => flow.filter((k) => k !== "welcome")
export const stepIndex = (flow: readonly StepKey[], key: StepKey) => flow.indexOf(key)

/** 1-based number shown for a step (0 for the welcome screen). */
export function stepNumber(flow: readonly StepKey[], index: number): number {
  const key = flow[index]
  return key && key !== "welcome" ? countedSteps(flow).indexOf(key) + 1 : 0
}

/** The pillars step — its primary action generates the strategy. */
export const GENERATE_KEY: StepKey = "pillars"

/* ---------------------------------- Limits -------------------------------- */

/** Text limits match the AI task input schemas so the gateway never rejects answers. */
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
  interest: 60,
  interestsMin: 2,
  interestsMax: 12,
  audience: 80,
  audiencesMax: 6,
  aimsMax: 3,
  help: 600,
  proof: 600,
  audienceGoal: 300,
  niche: 200,
  nicheFit: 600,
  problem: 200,
  problemsMax: 10,
  problemsGood: 3,
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

export const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced", "Mixed"] as const

export function problemCategoryFor(level: string): ProblemCategory {
  const l = level.trim().toLowerCase()
  if (l.startsWith("beginner")) return "beginner"
  if (l.startsWith("advanced")) return "advanced"
  return "intermediate"
}

/** "Para saan": what the brand should do for the creator. */
export const AIM_IDS = ["clients", "career", "audience", "products", "speaking", "community"] as const satisfies readonly NicheAim[]

/** Each aim becomes the goal category it's measured by. */
export const AIM_GOAL: Record<NicheAim, GoalCategory> = {
  clients: "leads",
  career: "authority",
  audience: "awareness",
  products: "business",
  speaking: "authority",
  community: "community",
}
const GOAL_AIM: Record<GoalCategory, NicheAim> = { leads: "clients", authority: "speaking", awareness: "audience", business: "products", community: "community" }

/** Goal categories the aims point to, in pick order. */
export const aimGoals = (aims: readonly NicheAim[]): GoalCategory[] => [...new Set(aims.map((aim) => AIM_GOAL[aim]))]

/** Primary and secondary goal after the aims change — a primary that's still among them is kept. */
export function goalsFromAims(
  aims: readonly NicheAim[],
  current: Pick<OnboardingAnswers, "primary_goal">
): Pick<OnboardingAnswers, "primary_goal" | "secondary_goal"> {
  const categories = aimGoals(aims)
  const primary = current.primary_goal && categories.includes(current.primary_goal) ? current.primary_goal : (categories[0] ?? null)
  return { primary_goal: primary, secondary_goal: categories.find((c) => c !== primary) ?? null }
}

/* ---------------------------------- Answers ------------------------------- */

export interface PillarDraft {
  /** Stable local key: "preset:<name>", "niche:<n>-<slug>", "existing:<id>" or "custom:<n>". */
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
  // Hilig
  interests: string[]
  // Galing
  expertise_areas: string[]
  help_requests: string
  years_experience: number | null
  proof: string
  /** Optional proof story — saved to the Story Vault. */
  story: string
  // Kanino
  audiences: string[]
  /** "Where are they now?" — saved as the persona's profession/situation. */
  persona_profession: string
  persona_experience: string
  /** "Where do they want to be?" — the persona's first goal. */
  audience_goal: string
  persona_problems: string[]
  persona_platforms: PlatformId[]
  // Para saan
  aims: NicheAim[]
  primary_goal: GoalCategory | null
  secondary_goal: GoalCategory | null
  goal_targets: Partial<Record<GoalCategory, GoalTarget>>
  // Niche
  niche: string
  niche_fit: string
  /** The suggested direction the niche came from (null = written by the creator). */
  niche_option: NicheOption | null
  /** "Write my own" is the chosen niche card (Quick setup and Niche Discovery). Screens 2–3 become optional. */
  own_niche: boolean
  audience: string
  result: string
  method: string
  // Identity
  name: string
  brand_name: string
  role: string
  industry: string
  location: string
  // Carried over from Brand HQ on a re-run; edited in the strategy step or Brand HQ
  known_for: string
  problems_solved: string
  why_listen: string
  point_of_view: string
  expertise_summary: string
  persona_name: string
  persona_goals: string[]
  // Pillars
  pillars: PillarDraft[]
  // Platforms & schedule
  platforms: PlatformId[]
  /** Posts per week per main platform; the weekly post target is their sum. */
  split: Partial<Record<PlatformId, number>>
  schedule_mode: "recommended" | "custom"
  custom_schedule: ScheduleDay[]
  // Voice
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
    interests: [],
    expertise_areas: [],
    help_requests: "",
    years_experience: null,
    proof: "",
    story: "",
    audiences: [],
    persona_profession: "",
    persona_experience: "",
    audience_goal: "",
    persona_problems: [],
    persona_platforms: [],
    aims: [],
    primary_goal: null,
    secondary_goal: null,
    goal_targets: {},
    niche: "",
    niche_fit: "",
    niche_option: null,
    own_niche: false,
    audience: "",
    result: "",
    method: "",
    name: "",
    brand_name: "",
    role: "",
    industry: "",
    location: "",
    known_for: "",
    problems_solved: "",
    why_listen: "",
    point_of_view: "",
    expertise_summary: "",
    persona_name: "",
    persona_goals: [],
    pillars: presetPillars(),
    platforms: [],
    split: {},
    schedule_mode: "recommended",
    custom_schedule: [],
    language: "english",
    tones: ["conversational"],
    personality: [],
    cta_style: "",
    always_do: "",
    never_do: "",
  }
}

export const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

const upperFirst = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0]?.replace(/["“”']/g, "") ?? ""
}

/** The primary persona's name: kept from Brand HQ on a re-run, else the first audience from "Kanino". */
export function personaNameOf(a: Pick<OnboardingAnswers, "persona_name" | "audiences" | "audience">): string {
  const first = a.audiences.find((x) => x.trim()) ?? a.audience
  return (a.persona_name.trim() || upperFirst(first.trim())).slice(0, 80)
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
export type ErrorCopy = Copy["errors"]

const filled = (list: readonly string[]) => list.filter((x) => x.trim()).length

export function validateStep(key: StepKey, a: OnboardingAnswers, e: ErrorCopy = EN.errors): StepErrors {
  const errors: StepErrors = {}
  const need = (field: keyof OnboardingAnswers, message: string) => {
    const value = a[field]
    if (typeof value === "string" && !value.trim()) errors[field] = message
  }
  const years = () => {
    if (a.years_experience !== null && (a.years_experience < 0 || a.years_experience > LIMITS.years)) errors.years_experience = e.years(LIMITS.years)
  }
  switch (key) {
    case "welcome":
    case "strategy":
      break
    // Quick setup: only these block. Writing your own niche makes "about" and "who" optional.
    case "start":
      need("name", e.name)
      if (!a.platforms.length) errors.platforms = e.platforms
      break
    case "about":
      if (!a.own_niche && filled(a.interests) < LIMITS.interestsMin) errors.interests = e.interests
      break
    case "who":
      if (!a.own_niche && !filled(a.audiences)) errors.audiences = e.audiences
      break
    case "pick":
      if (a.own_niche) {
        if (!a.niche.trim()) errors.niche = e.ownNiche
      } else if (!a.niche_option || !a.niche.trim()) errors.niche = e.pickNiche
      break
    case "hilig":
      if (filled(a.interests) < LIMITS.interestsMin) errors.interests = e.interests
      break
    case "galing":
      if (!filled(a.expertise_areas) && !a.help_requests.trim()) errors.expertise_areas = e.skills
      years()
      break
    case "kanino":
      if (!filled(a.audiences)) errors.audiences = e.audiences
      if (!filled(a.persona_problems)) errors.persona_problems = e.problems
      break
    case "para_saan":
      if (!a.aims.length) errors.aims = e.aims
      for (const category of chosenGoals(a)) {
        const target = goalTargetFor(a, category)
        if (target.value !== null && (!Number.isFinite(target.value) || target.value < 1)) errors[`goal_${category}`] = e.goalTarget
      }
      break
    case "niche":
      if (!a.niche.trim()) errors.niche = e.niche
      else {
        need("audience", e.audience)
        need("result", e.result)
      }
      break
    case "identity":
      need("name", e.name)
      need("role", e.role)
      need("industry", e.industry)
      years()
      break
    case "platforms": {
      if (!a.platforms.length) errors.platforms = e.platforms
      else if (a.schedule_mode === "custom") {
        const days = normalizeSchedule(a.custom_schedule, a.platforms)
        if (!days.some((d) => d.enabled)) errors.schedule = e.scheduleDay
        else if (days.some((d) => d.enabled && !d.platforms.length)) errors.schedule = e.schedulePlatform
      }
      break
    }
    case "voice":
      if (!a.tones.length) errors.tones = e.tones
      if (!a.personality.length) errors.personality = e.personality
      break
    case "pillars": {
      const selected = selectedPillars(a)
      const total = pillarTotal(a.pillars)
      if (selected.length < LIMITS.pillarsMin) errors.pillars = e.pillarsMin(LIMITS.pillarsMin)
      else if (selected.length > LIMITS.pillarsMax) errors.pillars = e.pillarsMax(LIMITS.pillarsMax)
      else if (selected.some((p) => !p.name.trim())) errors.pillars = e.pillarNames
      else if (new Set(selected.map((p) => norm(p.name))).size !== selected.length) errors.pillars = e.pillarsUnique
      else if (selected.some((p) => !Number.isInteger(p.target) || p.target < 1)) errors.pillars = e.pillarsWhole
      else if (total !== 100) errors.pillars = e.pillarsTotal(total)
      break
    }
  }
  return errors
}

export const hasErrors = (errors: StepErrors) => Object.keys(errors).length > 0

/** Index of the first step in `flow` (before `upTo`) whose answers are invalid, or -1. */
export function firstInvalidStep(a: OnboardingAnswers, flow: readonly StepKey[] = FULL_FLOW, upTo = flow.length - 1, e: ErrorCopy = EN.errors): number {
  for (let i = 0; i < Math.min(upTo, flow.length); i++) {
    if (hasErrors(validateStep(flow[i], a, e))) return i
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
    audience: clip(a.audience || personaNameOf(a), LIMITS.positioning),
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
    niche: clip(a.niche, LIMITS.niche),
    interests: a.interests.map((x) => clip(x, LIMITS.interest)).filter(Boolean).slice(0, LIMITS.interestsMax),
    niche_fit: clip(a.niche_fit, LIMITS.nicheFit),
    pillars: selectedPillars(a)
      .filter((p) => p.name.trim())
      .slice(0, LIMITS.pillarsMax)
      .map((p) => ({ name: clip(p.name, LIMITS.pillarName), description: clip(p.description, LIMITS.pillarDescription), target_percentage: clampInt(p.target || 0, 0, 100) })),
  }
}

/** Identifies the answers a strategy was generated from (changes → the strategy is out of date). Pillar targets don't count. */
export const strategyKey = (a: OnboardingAnswers) => {
  const input = strategyInput(a)
  return JSON.stringify({ ...input, pillars: (input.pillars ?? []).map((p) => p.name) })
}

/* ------------------------------ From the workspace ------------------------ */

/**
 * Answers pre-filled from whatever the workspace already holds — blank for a fresh workspace,
 * the current Brand HQ when setup (or Niche Discovery) is re-run, so re-running edits rather than retypes.
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
      help_requests: brand.problems_solved.slice(0, LIMITS.help),
      why_listen: brand.why_listen,
      proof: brand.why_listen.slice(0, LIMITS.proof),
      point_of_view: brand.point_of_view,
      expertise_areas: [...brand.expertise_areas].slice(0, LIMITS.expertiseMax),
      expertise_summary: brand.expertise_summary,
      niche: (brand.niche ?? "").slice(0, LIMITS.niche),
      // Niche Discovery opens with the current niche as "your own", so saving without a new pick keeps it.
      own_niche: Boolean((brand.niche ?? "").trim()),
      niche_fit: brand.niche_fit ?? "",
      interests: [...(brand.interests ?? [])].slice(0, LIMITS.interestsMax),
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
      audiences: [persona.name.slice(0, LIMITS.audience)],
      persona_profession: persona.profession,
      persona_experience: persona.experience_level,
      audience_goal: (persona.goals[0] ?? "").slice(0, LIMITS.audienceGoal),
      persona_goals: persona.goals.slice(1, LIMITS.personaGoalsMax),
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
    a.aims = [...new Set(chosenGoals(a).map((c) => GOAL_AIM[c]))]
  }
  return a
}

/* -------------------------------- Draft safety ---------------------------- */

const STRING_FIELDS = [
  "help_requests",
  "proof",
  "story",
  "persona_profession",
  "persona_experience",
  "audience_goal",
  "niche",
  "niche_fit",
  "audience",
  "result",
  "method",
  "name",
  "brand_name",
  "role",
  "industry",
  "location",
  "known_for",
  "problems_solved",
  "why_listen",
  "point_of_view",
  "expertise_summary",
  "persona_name",
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

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)
const text = (value: unknown) => (typeof value === "string" ? value : "")
const NICHE_KINDS = ["expertise", "passion", "audience"] as const

/** A stored niche direction, or null when it's malformed. */
export function sanitizeNicheOption(raw: unknown): NicheOption | null {
  if (!isRecord(raw) || !oneOf(raw.kind, NICHE_KINDS) || typeof raw.name !== "string" || typeof raw.niche_statement !== "string") return null
  const fitRaw = isRecord(raw.fit) ? raw.fit : {}
  const fit = (value: unknown) => {
    const f = isRecord(value) ? value : {}
    return { score: typeof f.score === "number" && Number.isFinite(f.score) ? clampInt(f.score, 1, 10) : 5, reason: text(f.reason) }
  }
  const rows = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : [])
  return {
    kind: raw.kind,
    name: raw.name,
    niche_statement: raw.niche_statement,
    audience: text(raw.audience),
    industry: text(raw.industry),
    positioning_statement: text(raw.positioning_statement),
    positioning_audience: text(raw.positioning_audience),
    positioning_result: text(raw.positioning_result),
    positioning_method: text(raw.positioning_method),
    pillars: rows(raw.pillars)
      .filter((p) => typeof p.name === "string")
      .slice(0, LIMITS.pillarsMax)
      .map((p) => ({ name: String(p.name), description: text(p.description), target_percentage: typeof p.target_percentage === "number" && Number.isFinite(p.target_percentage) ? p.target_percentage : 0 })),
    sample_posts: rows(raw.sample_posts)
      .filter((p) => typeof p.title === "string")
      .slice(0, 8)
      .map((p) => ({ title: String(p.title), hook: text(p.hook) })),
    monetization: strings(raw.monetization, 8),
    fit: { passion: fit(fitRaw.passion), expertise: fit(fitRaw.expertise), demand: fit(fitRaw.demand) },
    why_it_fits: text(raw.why_it_fits),
    risk: text(raw.risk),
  }
}

/** Answers restored from a stored draft, with anything malformed replaced by its default. */
export function sanitizeAnswers(raw: unknown): OnboardingAnswers {
  const out = emptyAnswers()
  if (!isRecord(raw)) return out
  const r = raw
  for (const field of STRING_FIELDS) {
    const value = r[field]
    if (typeof value === "string") out[field] = value
  }
  if (typeof r.years_experience === "number" && Number.isFinite(r.years_experience)) out.years_experience = r.years_experience
  out.interests = strings(r.interests, LIMITS.interestsMax)
  out.audiences = strings(r.audiences, LIMITS.audiencesMax)
  out.aims = listOf(r.aims, AIM_IDS).slice(0, LIMITS.aimsMax)
  out.niche_option = sanitizeNicheOption(r.niche_option)
  out.own_niche = r.own_niche === true
  out.persona_goals = strings(r.persona_goals, LIMITS.personaGoalsMax)
  out.persona_problems = strings(r.persona_problems, LIMITS.problemsMax)
  out.persona_platforms = listOf(r.persona_platforms, PLATFORM_IDS)
  out.expertise_areas = strings(r.expertise_areas, LIMITS.expertiseMax)
  out.platforms = platformsInOrder(listOf(r.platforms, PLATFORM_IDS))

  if (Array.isArray(r.pillars)) {
    const pillars = r.pillars
      .filter(isRecord)
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

  if (isRecord(r.split)) {
    const split: Partial<Record<PlatformId, number>> = {}
    for (const [key, value] of Object.entries(r.split)) {
      if (oneOf(key, PLATFORM_IDS) && typeof value === "number" && Number.isFinite(value)) split[key] = value
    }
    out.split = normalizeSplit(split, out.platforms)
  } else {
    out.split = normalizeSplit({}, out.platforms)
  }
  out.schedule_mode = r.schedule_mode === "custom" ? "custom" : "recommended"
  if (Array.isArray(r.custom_schedule)) {
    out.custom_schedule = r.custom_schedule
      .filter((d): d is Record<string, unknown> => isRecord(d) && typeof d.day === "number")
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
  if (isRecord(r.goal_targets)) {
    for (const [key, value] of Object.entries(r.goal_targets)) {
      if (!oneOf(key, GOAL_CATEGORY_IDS) || !isRecord(value)) continue
      out.goal_targets[key] = {
        value: typeof value.value === "number" && Number.isFinite(value.value) ? value.value : null,
        period: value.period === "weekly" || value.period === "quarterly" ? value.period : "monthly",
      }
    }
  }

  const languages = LANGUAGES.map((l) => l.id)
  out.language = oneOf(r.language, languages) ? r.language : "english"
  out.tones = listOf(
    r.tones,
    TONES.map((t) => t.id)
  ).slice(0, LIMITS.tonesMax)
  out.personality = listOf(
    r.personality,
    PERSONALITY_TRAITS.map((t) => t.id)
  ).slice(0, LIMITS.traitsMax)
  return out
}
