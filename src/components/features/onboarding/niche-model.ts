/**
 * Niche Discovery model: suggestion chips for hilig / galing / kanino (relevant to Filipino creators and
 * professionals), the `niche_discovery` request, applying a chosen direction to the answers, and the
 * deterministic clarity check. Pure — unit-tested with the rest of the onboarding model.
 */
import type { NicheOption } from "@/lib/ai"
import type { AiTaskInput } from "@/lib/ai/tasks"
import type { AiProviderId } from "@/lib/types"
import type { Copy } from "./copy-en"
import type { OnboardingLang } from "./copy"
import {
  LIMITS,
  norm,
  personaNameOf,
  presetPillars,
  rebalancePillars,
  sanitizeNicheOption,
  selectedPillars,
  type OnboardingAnswers,
  type PillarDraft,
  type StepKey,
} from "./onboarding-model"

/* -------------------------------- Suggestions ------------------------------ */

export const HILIG_GROUPS: { id: keyof Copy["hilig"]["groups"]; items: string[] }[] = [
  { id: "money", items: ["Personal finance", "Ipon & budgeting", "Investing", "Negosyo & small business", "Online selling", "Real estate", "Side hustles"] },
  { id: "work", items: ["Freelancing", "Career growth", "Corporate life", "Leadership", "Remote work", "OFW life", "Sales"] },
  { id: "digital", items: ["Social media", "Content creation", "Digital marketing", "AI tools", "Tech & programming", "Design", "Productivity"] },
  { id: "life", items: ["Fitness", "Healthy eating", "Mental health", "Parenting", "Faith", "Self-growth", "Travel"] },
  {
    id: "hobbies",
    items: ["Cooking & baking", "Coffee", "Photography", "Music", "Fashion & beauty", "Gaming", "K-drama & pop culture", "Plants & gardening", "Pets", "Books & reading"],
  },
]

export const GALING_GROUPS: { id: keyof Copy["galing"]["groups"]; items: string[] }[] = [
  { id: "business", items: ["Bookkeeping", "BIR & taxes", "Sales", "Customer service", "Operations & SOPs", "Project management", "Hiring & HR", "Pricing"] },
  { id: "marketing", items: ["Facebook ads", "Social media management", "Copywriting", "Video editing", "Graphic design", "Photography", "SEO", "Community management"] },
  { id: "tech", items: ["Excel & spreadsheets", "Programming", "AI tools", "Web design", "Data analysis", "Virtual assistance", "Automation"] },
  { id: "people", items: ["Teaching & tutoring", "Public speaking", "Coaching", "Leadership", "Nursing & healthcare", "Cooking & baking", "Fitness training", "Parenting"] },
]

export const KANINO_CHIPS = [
  "Freelancers",
  "Virtual assistants",
  "Online sellers",
  "Small business owners",
  "Young professionals",
  "Fresh grads",
  "Students",
  "OFWs & their families",
  "Moms & parents",
  "BPO agents",
  "Creators",
  "Corporate managers",
  "Nurses & healthcare workers",
  "Teachers",
  "Startup founders",
]

/* ---------------------------------- Request -------------------------------- */

const clip = (value: string, max: number) => value.trim().slice(0, max)
const clipList = (list: readonly string[], each: number, max: number) => list.map((x) => clip(x, each)).filter(Boolean).slice(0, max)

/** The `niche_discovery` request: only Niche Discovery answers (identity comes later, so it never makes results stale). */
export function nicheInput(a: OnboardingAnswers, lang: OnboardingLang): AiTaskInput<"niche_discovery"> {
  return {
    language: lang,
    interests: clipList(a.interests, 80, 12),
    skills: clipList(a.expertise_areas, 80, 12),
    help_requests: clip(a.help_requests, LIMITS.help),
    years_experience: a.years_experience === null || !Number.isFinite(a.years_experience) ? null : Math.min(LIMITS.years, Math.max(0, Math.round(a.years_experience))),
    proof: clip(a.proof, LIMITS.proof),
    story: clip(a.story, LIMITS.story),
    audiences: clipList(a.audiences, 80, 8),
    audience_level: clip(a.persona_experience, 40),
    audience_stage: clip(a.persona_profession, 300),
    audience_goal: clip(a.audience_goal, LIMITS.audienceGoal),
    audience_problems: clipList(a.persona_problems, LIMITS.problem, LIMITS.problemsMax),
    aims: [...a.aims],
  }
}

/** Identifies the answers (and language) niche suggestions were generated from. */
export const nicheKey = (a: OnboardingAnswers, lang: OnboardingLang) => JSON.stringify(nicheInput(a, lang))

export interface NicheResult {
  /** nicheKey() of the answers it was generated from — a different key means it's out of date. */
  key: string
  provider: AiProviderId
  model: string
  options: NicheOption[]
  notes: string[]
}

const PROVIDERS: AiProviderId[] = ["anthropic", "openai", "offline"]

export function sanitizeNicheResult(raw: unknown): NicheResult | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const options = Array.isArray(r.options) ? r.options.map(sanitizeNicheOption).filter((o): o is NicheOption => Boolean(o)) : []
  if (typeof r.key !== "string" || !options.length) return null
  return {
    key: r.key,
    provider: PROVIDERS.includes(r.provider as AiProviderId) ? (r.provider as AiProviderId) : "offline",
    model: typeof r.model === "string" ? r.model : "",
    options: options.slice(0, 3),
    notes: Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === "string").slice(0, 6) : [],
  }
}

/* ---------------------------------- Choosing ------------------------------- */

/** A direction's pillars, selected; everything else stays in the list unselected (presets remain available). */
export function pillarsFromOption(option: NicheOption, current: PillarDraft[]): PillarDraft[] {
  const suggested: PillarDraft[] = option.pillars.slice(0, LIMITS.pillarsMax).map((p, i) => ({
    key: `niche:${i}-${norm(p.name).replace(/[^a-z0-9]+/g, "-")}`,
    name: p.name.trim().slice(0, LIMITS.pillarName),
    description: p.description.trim().slice(0, LIMITS.pillarDescription),
    icon: "Layers",
    examples: [],
    target: Math.max(1, Math.round(p.target_percentage)),
    selected: true,
    preset: false,
  }))
  const names = new Set(suggested.map((p) => norm(p.name)))
  const rest = current.filter((p) => !p.key.startsWith("niche:") && !names.has(norm(p.name))).map((p) => ({ ...p, selected: false }))
  const presets = presetPillars()
    .filter((p) => !names.has(norm(p.name)) && !rest.some((r) => norm(r.name) === norm(p.name)))
    .map((p) => ({ ...p, selected: false }))
  return rebalancePillars([...suggested, ...rest, ...presets])
}

/** The selected pillars are exactly this direction's pillars. */
export function pillarsMatchOption(a: Pick<OnboardingAnswers, "pillars">, option: NicheOption): boolean {
  const current = selectedPillars(a).map((p) => norm(p.name)).sort().join("|")
  return current === option.pillars.map((p) => norm(p.name)).sort().join("|")
}

/** brand.niche_fit from a direction's fit reasons: passion × expertise × demand. */
export function fitSummary(option: NicheOption, copy: Copy): string {
  const f = copy.niche.fit
  const part = (label: string, fit: NicheOption["fit"]["passion"]) => `${label} ${fit.score}/10 — ${fit.reason.trim().replace(/[.\s]+$/, "")}.`
  return [part(f.passion, option.fit.passion), part(f.expertise, option.fit.expertise), part(f.demand, option.fit.demand)].join(" ").slice(0, LIMITS.nicheFit)
}

/** brand.niche_fit for a niche the creator wrote: the hilig, galing and problems it rests on. */
export function customFit(a: OnboardingAnswers, copy: Copy): string {
  const f = copy.niche.fit
  const list = (items: string[]) => items.map((x) => x.trim()).filter(Boolean).slice(0, 3).join(", ")
  const parts = [
    a.interests.length ? `${f.passion}: ${list(a.interests)}.` : "",
    a.expertise_areas.length ? `${f.expertise}: ${list(a.expertise_areas)}${a.years_experience ? ` (${a.years_experience} ${copy.galing.yearsSuffix})` : ""}.` : "",
    a.persona_problems.length ? `${f.demand}: ${a.persona_problems.slice(0, 2).map((p) => `“${p.trim()}”`).join(", ")}.` : "",
  ]
  return parts.filter(Boolean).join(" ").slice(0, LIMITS.nicheFit)
}

/** Everything choosing a direction changes. Pillars only follow automatically on a first run. */
export function applyNicheOption(
  a: OnboardingAnswers,
  option: NicheOption,
  options: { replacePillars: boolean; copy: Copy }
): Partial<OnboardingAnswers> {
  const statement = option.niche_statement.trim().slice(0, LIMITS.niche)
  const patch: Partial<OnboardingAnswers> = {
    niche: statement,
    niche_fit: fitSummary(option, options.copy),
    niche_option: option,
    audience: option.positioning_audience.trim().slice(0, LIMITS.positioning),
    result: option.positioning_result.trim().slice(0, LIMITS.positioning),
    method: option.positioning_method.trim().slice(0, LIMITS.positioning),
  }
  if (!a.known_for.trim() || norm(a.known_for) === norm(a.niche)) patch.known_for = statement
  if (option.industry.trim() && (!a.industry.trim() || (a.niche_option && norm(a.industry) === norm(a.niche_option.industry)))) {
    patch.industry = option.industry.trim().slice(0, LIMITS.industry)
  }
  if (options.replacePillars) patch.pillars = pillarsFromOption(option, a.pillars)
  return patch
}

/** Switch to a niche the creator writes: positioning starts from their own Kanino answers. */
export function startOwnNiche(a: OnboardingAnswers, copy: Copy): Partial<OnboardingAnswers> {
  return {
    niche_option: null,
    niche_fit: customFit(a, copy),
    audience: a.audience.trim() || (a.audiences[0] ?? "").trim().toLowerCase(),
    result: a.result.trim() || a.audience_goal.trim().replace(/^to\s+/i, ""),
  }
}

/** Editing the statement keeps known-for in sync while it still mirrors the niche. */
export function editNiche(a: OnboardingAnswers, value: string): Partial<OnboardingAnswers> {
  const patch: Partial<OnboardingAnswers> = { niche: value }
  if (!a.known_for.trim() || norm(a.known_for) === norm(a.niche)) patch.known_for = value
  return patch
}

/* ------------------------------- Clarity check ----------------------------- */

export type ClarityKey = "sentence" | "audience" | "problems" | "range" | "money"

export interface ClarityCheck {
  key: ClarityKey
  ok: boolean
  /** Where to fix it: another step, or a field on the niche step. */
  fix: { step: StepKey } | { field: string }
  /** Real problems counted (for the problems check). */
  count?: number
}

/** Audiences too broad to build a niche on. */
const GENERIC_AUDIENCE = new Set(
  "everyone|anyone|everybody|people|all|lahat|kahit sino|sa lahat|mga tao|tao|followers|audience|users|customers|clients|filipinos|pinoys|businesses|professionals|students|the public|entrepreneurs".split("|")
)

/** Deterministic checks before leaving the niche step — warnings, never blockers. */
export function clarityChecks(a: OnboardingAnswers): ClarityCheck[] {
  const niche = a.niche.trim()
  const words = niche.split(/\s+/).filter(Boolean).length
  const sentences = niche.split(/(?<=[.!?])\s+(?=\S)/).filter(Boolean).length
  const sentence = words >= 4 && words <= 28 && sentences <= 1 && niche.length <= 180 && !/[;\n•]/.test(niche)
  const audienceText = norm((a.audience || personaNameOf(a)).replace(/^mga\s+/i, ""))
  const audience = Boolean(audienceText) && !GENERIC_AUDIENCE.has(audienceText)
  const problems = a.persona_problems.filter((p) => p.trim().split(/\s+/).length >= 3).length
  const topics = new Set([...a.interests, ...a.expertise_areas, ...a.persona_problems].map(norm).filter(Boolean)).size
  const pillarCount = a.niche_option ? Math.max(selectedPillars(a).length, a.niche_option.pillars.length) : selectedPillars(a).length
  return [
    { key: "sentence", ok: sentence, fix: { field: "niche" } },
    { key: "audience", ok: audience, fix: { field: "audience" } },
    { key: "problems", ok: problems >= LIMITS.problemsGood, fix: { step: "kanino" }, count: problems },
    { key: "range", ok: pillarCount >= 4 && topics >= 6, fix: { step: "hilig" } },
    { key: "money", ok: a.aims.length > 0, fix: { step: "para_saan" } },
  ]
}
