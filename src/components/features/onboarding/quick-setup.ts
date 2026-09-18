/**
 * Quick setup (docs/QUICK_SETUP.md): what Orbi fills in from the four screens. `quickSetupAnswers` turns
 * the Quick setup answers and the chosen niche into the full `OnboardingAnswers` that `planOnboarding`
 * already understands, so a setup is still written one way. Anything that needs the creator's own
 * judgement (voice, more audience problems, story) is left empty for the Home checklist.
 * Pure — unit-tested with the rest of the onboarding model.
 */
import type { NicheAim, NicheOption } from "@/lib/ai"
import type { OnboardingLang } from "./copy"
import { EN, type Copy } from "./copy-en"
import { TL } from "./copy-tl"
import { customFit, fitSummary, pillarsFromOption } from "./niche-model"
import { tokens } from "./onboarding-ideas"
import {
  chosenGoals,
  emptyAnswers,
  goalsFromAims,
  LIMITS,
  normalizeSplit,
  platformsInOrder,
  presetPillars,
  validateStep,
  type OnboardingAnswers,
} from "./onboarding-model"

const COPIES: Record<OnboardingLang, Copy> = { english: EN, taglish: TL }

/** What the four screens ask (the rest of `OnboardingAnswers` is filled in by Orbi). */
export type QuickAnswers = Pick<OnboardingAnswers, "name" | "platforms" | "interests" | "expertise_areas" | "audiences" | "persona_problems" | "aims">

export interface QuickNiche {
  /** The direction the pillars, positioning and industry come from. */
  option: NicheOption
  /** The creator's own sentence ("Write my own"); the option then only supplies the structure. */
  written?: string
}

/** Without a pick, the brand starts by growing an audience (→ the awareness goal). */
export const DEFAULT_AIM: NicheAim = "audience"

export const quickAims = (aims: readonly NicheAim[]): NicheAim[] => (aims.length ? [...new Set(aims)].slice(0, LIMITS.aimsMax) : [DEFAULT_AIM])

/** Brand HQ role from the niche's industry — a plain, editable starting point ("Personal finance creator"). */
export function roleFor(industry: string): string {
  const clean = industry.trim()
  return (clean ? `${clean} creator` : "Content creator").slice(0, LIMITS.role)
}

const cleanList = (values: readonly string[], each: number, max: number) => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = raw.trim().slice(0, each)
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
  }
  return out.slice(0, max)
}

/**
 * The full answers for a Quick setup. Identity: the name, with role and industry from the niche.
 * Platforms get the recommended weekly strategy (§49); pillars come from the chosen direction (or the
 * one built for a written niche); the persona is the first audience with the #1 problem; goals follow
 * the aims (default: audience → awareness) without targets; tones and traits stay empty.
 */
export function quickSetupAnswers(quick: QuickAnswers, niche: QuickNiche, lang: OnboardingLang): OnboardingAnswers {
  const copy = COPIES[lang]
  const option = niche.option
  const written = (niche.written ?? "").trim().slice(0, LIMITS.niche)
  const a = emptyAnswers()

  // Screen 1
  a.name = quick.name.trim().slice(0, LIMITS.name)
  a.platforms = platformsInOrder(quick.platforms)
  a.split = normalizeSplit({}, a.platforms)
  a.schedule_mode = "recommended"
  a.custom_schedule = []

  // Screen 2
  a.interests = cleanList(quick.interests, LIMITS.interest, LIMITS.interestsMax)
  a.expertise_areas = cleanList(quick.expertise_areas, LIMITS.expertise, LIMITS.expertiseMax)

  // Screen 3
  a.audiences = cleanList(quick.audiences, LIMITS.audience, LIMITS.audiencesMax)
  a.persona_problems = cleanList(quick.persona_problems, LIMITS.problem, LIMITS.problemsMax)
  // The creator posts where their audience is: a starting point for the persona, edited in Audience HQ.
  a.persona_platforms = [...a.platforms]
  a.aims = quickAims(quick.aims)
  Object.assign(a, goalsFromAims(a.aims, { primary_goal: null }))
  // Goals start without targets — the creator sets them once there's a baseline (Strategy → Goals).
  a.goal_targets = {}
  for (const goal of chosenGoals(a)) a.goal_targets[goal] = { value: null, period: "monthly" }

  // Screen 4: the niche, its positioning, industry and pillars
  a.niche = written || option.niche_statement.trim().slice(0, LIMITS.niche)
  a.own_niche = Boolean(written)
  a.niche_option = written ? null : option
  a.niche_fit = (written ? customFit(a, copy) : "") || fitSummary(option, copy)
  a.audience = option.positioning_audience.trim().slice(0, LIMITS.positioning)
  a.result = option.positioning_result.trim().slice(0, LIMITS.positioning)
  a.method = option.positioning_method.trim().slice(0, LIMITS.positioning)
  a.known_for = a.niche
  a.industry = option.industry.trim().slice(0, LIMITS.industry)
  a.role = roleFor(a.industry)
  a.pillars = pillarsFromOption(option, presetPillars())

  // Voice: the writing language follows screen 1; tone and personality are the creator's call (Home checklist).
  a.language = lang
  a.tones = []
  a.personality = []
  return a
}

/* --------------------------------- The niche ------------------------------- */

const fitTotal = (o: NicheOption) => o.fit.passion.score + o.fit.expertise.score + o.fit.demand.score

/** The direction with the strongest passion × expertise × demand fit (first on a tie) — the "Best match". */
export function bestMatchIndex(options: readonly NicheOption[]): number {
  let best = -1
  options.forEach((o, i) => {
    if (best === -1 || fitTotal(o) > fitTotal(options[best])) best = i
  })
  return best
}

/** The best match first, the rest in their original order. */
export function rankedOptions(options: readonly NicheOption[]): NicheOption[] {
  const best = bestMatchIndex(options)
  return best <= 0 ? [...options] : [options[best], ...options.filter((_, i) => i !== best)]
}

/** For a written niche: the direction closest to the creator's own sentence (shared words), first on a tie. */
export function optionForWrittenNiche(options: readonly NicheOption[], niche: string): NicheOption | null {
  const words = tokens(niche)
  let best: NicheOption | null = null
  let bestScore = -1
  for (const o of options) {
    const own = tokens([o.name, o.niche_statement, o.positioning_audience, ...o.pillars.map((p) => p.name)].join(" "))
    let score = 0
    for (const w of words) if (own.has(w)) score++
    if (score > bestScore) {
      best = o
      bestScore = score
    }
  }
  return best
}

/** Screens 2 and 3 hold enough to suggest directions (at least 2 interests and one audience). */
export function canSuggestNiches(a: OnboardingAnswers): boolean {
  const strict = { ...a, own_niche: false }
  return !Object.keys(validateStep("about", strict)).length && !Object.keys(validateStep("who", strict)).length
}
