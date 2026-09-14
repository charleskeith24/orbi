/**
 * Brand HQ form model: form values ⇄ brand row, validation, completeness and the input for
 * "Suggest with AI" (the onboarding_strategy task). Pure — no React, no store.
 */
import type { AiTaskInput } from "@/lib/ai"
import { PERSONALITY_TRAIT_MAP, TONE_MAP } from "@/lib/constants"
import type { BrandProfile, Database, GoalCategory, UpdateRow } from "@/lib/types"

/** Every Brand HQ field the page edits, in page order. */
export const BRAND_FORM_FIELDS = [
  "niche",
  "interests",
  "niche_fit",
  "name",
  "brand_name",
  "role",
  "industry",
  "expertise_summary",
  "years_experience",
  "location",
  "main_platforms",
  "who_am_i",
  "known_for",
  "problems_solved",
  "why_listen",
  "point_of_view",
  "positioning_audience",
  "positioning_result",
  "positioning_method",
  "expertise_areas",
  "personality_traits",
  "language",
  "tones",
  "always_do",
  "never_do",
  "phrases_used",
  "phrases_avoid",
  "cta_style",
  "storytelling_style",
] as const satisfies readonly (keyof BrandProfile)[]

export type BrandField = (typeof BRAND_FORM_FIELDS)[number]
export type BrandFormValues = Pick<BrandProfile, BrandField>
export type BrandErrors = Partial<Record<BrandField, string>>
export type SetBrandValue = <K extends BrandField>(key: K, value: BrandFormValues[K]) => void

/** Free-text fields (inputs and textareas). */
export type BrandTextField = Exclude<
  { [K in BrandField]: BrandFormValues[K] extends string ? K : never }[BrandField],
  "language"
>

/** Characters of each text field the AI actually reads (buildBrandContext clips the rest). */
export const CONTEXT_LIMITS: Partial<Record<BrandTextField, number>> = {
  niche: 200,
  niche_fit: 600,
  name: 120,
  brand_name: 120,
  role: 160,
  industry: 160,
  expertise_summary: 600,
  location: 120,
  who_am_i: 600,
  known_for: 400,
  problems_solved: 400,
  why_listen: 500,
  point_of_view: 600,
  positioning_audience: 200,
  positioning_result: 200,
  positioning_method: 200,
  always_do: 600,
  never_do: 600,
  cta_style: 360,
  storytelling_style: 400,
}

/** Items of each list the AI reads. */
export const LIST_LIMITS = { interests: 12, expertise_areas: 12, phrases_used: 12, phrases_avoid: 15 } as const

/** DOM id of a field's control (used for labels, focus and "complete next" jumps). */
export function fieldId(field: BrandField): string {
  return `brand-${field}`
}

export function brandFormValues(brand: BrandProfile): BrandFormValues {
  const out = {} as Record<BrandField, unknown>
  for (const key of BRAND_FORM_FIELDS) out[key] = brand[key]
  return out as BrandFormValues
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Fields whose value differs from the saved brand. */
export function changedFields(values: BrandFormValues, saved: BrandFormValues): BrandField[] {
  return BRAND_FORM_FIELDS.filter((key) => !sameValue(values[key], saved[key]))
}

/** Trimmed, non-empty, case-insensitively unique. */
export function cleanList(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

/** The row patch saved by "Save changes". */
export function brandPatch(values: BrandFormValues): UpdateRow<"brand_profiles"> {
  const years = values.years_experience
  return {
    niche: values.niche.replace(/\s+/g, " ").trim(),
    interests: cleanList(values.interests),
    niche_fit: values.niche_fit.trim(),
    name: values.name.trim(),
    brand_name: values.brand_name.trim(),
    role: values.role.trim(),
    industry: values.industry.trim(),
    expertise_summary: values.expertise_summary.trim(),
    years_experience: years === null || !Number.isFinite(years) ? null : Math.min(80, Math.max(0, Math.round(years * 10) / 10)),
    location: values.location.trim(),
    main_platforms: values.main_platforms,
    who_am_i: values.who_am_i.trim(),
    known_for: values.known_for.trim(),
    problems_solved: values.problems_solved.trim(),
    why_listen: values.why_listen.trim(),
    point_of_view: values.point_of_view.trim(),
    positioning_audience: values.positioning_audience.trim(),
    positioning_result: values.positioning_result.trim(),
    positioning_method: values.positioning_method.trim(),
    expertise_areas: cleanList(values.expertise_areas),
    personality_traits: values.personality_traits,
    language: values.language,
    tones: values.tones,
    always_do: values.always_do.trim(),
    never_do: values.never_do.trim(),
    phrases_used: cleanList(values.phrases_used),
    phrases_avoid: cleanList(values.phrases_avoid),
    cta_style: values.cta_style.trim(),
    storytelling_style: values.storytelling_style.trim(),
  }
}

export function validateBrand(values: BrandFormValues): BrandErrors {
  const errors: BrandErrors = {}
  if (!values.name.trim()) errors.name = "Add your name — every AI draft is written as you."
  const years = values.years_experience
  if (years !== null && (!Number.isFinite(years) || years < 0 || years > 80)) {
    errors.years_experience = "Enter a number of years between 0 and 80."
  }
  return errors
}

/* ------------------------------ Sections -------------------------------- */

export type BrandSectionKey =
  | "niche"
  | "identity"
  | "positioning"
  | "statement"
  | "expertise"
  | "personality"
  | "communication"
  | "rules"

export interface BrandSectionMeta {
  key: BrandSectionKey
  /** Section heading. */
  title: string
  /** Short label for the section nav. */
  navLabel: string
  description: string
  fields: BrandField[]
}

export const BRAND_SECTIONS: BrandSectionMeta[] = [
  {
    key: "niche",
    title: "Niche",
    navLabel: "Niche",
    description: "What you talk about, the interests behind it and why it's yours to own.",
    fields: ["niche", "interests", "niche_fit"],
  },
  {
    key: "identity",
    title: "Identity",
    navLabel: "Identity",
    description: "Who you are, what you do and where you publish.",
    fields: ["name", "brand_name", "role", "industry", "expertise_summary", "years_experience", "location", "main_platforms"],
  },
  {
    key: "positioning",
    title: "Brand Positioning",
    navLabel: "Positioning",
    description: "The answers the AI leans on when it writes in your voice.",
    fields: ["who_am_i", "known_for", "problems_solved", "why_listen", "point_of_view"],
  },
  {
    key: "statement",
    title: "Positioning Statement",
    navLabel: "Statement",
    description: "One sentence that says who you help, what they get and how.",
    fields: ["positioning_audience", "positioning_result", "positioning_method"],
  },
  {
    key: "expertise",
    title: "Expertise Areas",
    navLabel: "Expertise",
    description: "The topics you can speak on with authority.",
    fields: ["expertise_areas"],
  },
  {
    key: "personality",
    title: "Brand Personality",
    navLabel: "Personality",
    description: "How you show up — the AI mirrors these traits in every draft.",
    fields: ["personality_traits"],
  },
  {
    key: "communication",
    title: "Communication Style",
    navLabel: "Style",
    description: "The language and tone your content is written in.",
    fields: ["language", "tones"],
  },
  {
    key: "rules",
    title: "Brand Rules",
    navLabel: "Rules",
    description: "Guardrails every draft follows — what to always do, never do and never say.",
    fields: ["always_do", "never_do", "phrases_used", "phrases_avoid", "cta_style", "storytelling_style"],
  },
]

const SECTION_OF = new Map<BrandField, BrandSectionKey>(BRAND_SECTIONS.flatMap((s) => s.fields.map((f) => [f, s.key] as const)))

export function sectionOf(field: BrandField): BrandSectionKey {
  return SECTION_OF.get(field) ?? "identity"
}

/* ----------------------------- Completeness ----------------------------- */

interface CheckSpec {
  field: BrandField
  label: string
  /** Minimum list length (lists only). */
  min?: number
}

const CHECKS: CheckSpec[] = [
  { field: "niche", label: "Your niche" },
  { field: "interests", label: "At least 3 interests", min: 3 },
  { field: "niche_fit", label: "Why your niche fits" },
  { field: "name", label: "Your name" },
  { field: "brand_name", label: "Brand name" },
  { field: "role", label: "Role / profession" },
  { field: "industry", label: "Industry" },
  { field: "expertise_summary", label: "Expertise summary" },
  { field: "years_experience", label: "Years of experience" },
  { field: "location", label: "Location" },
  { field: "main_platforms", label: "Main platforms", min: 1 },
  { field: "who_am_i", label: "Who am I?" },
  { field: "known_for", label: "What you want to be known for" },
  { field: "problems_solved", label: "Problems you help solve" },
  { field: "why_listen", label: "Why people should listen" },
  { field: "point_of_view", label: "Your point of view" },
  { field: "positioning_audience", label: "Positioning audience" },
  { field: "positioning_result", label: "Desired result" },
  { field: "positioning_method", label: "Method / expertise" },
  { field: "expertise_areas", label: "At least 3 expertise areas", min: 3 },
  { field: "personality_traits", label: "At least 3 personality traits", min: 3 },
  { field: "tones", label: "Tone of voice", min: 1 },
  { field: "always_do", label: "Always do" },
  { field: "never_do", label: "Never do" },
  { field: "phrases_used", label: "Phrases you use", min: 1 },
  { field: "phrases_avoid", label: "Phrases to avoid", min: 1 },
  { field: "cta_style", label: "Preferred CTA style" },
  { field: "storytelling_style", label: "Storytelling style" },
]

export interface CompletenessItem {
  field: BrandField
  label: string
  section: BrandSectionKey
}

export interface BrandCompleteness {
  /** 0–100, rounded. */
  pct: number
  done: number
  total: number
  missing: CompletenessItem[]
  sections: Record<BrandSectionKey, { done: number; total: number }>
}

function isComplete(values: BrandFormValues, spec: CheckSpec): boolean {
  const value = values[spec.field]
  if (Array.isArray(value)) return value.length >= (spec.min ?? 1)
  if (typeof value === "number") return Number.isFinite(value)
  if (value === null || value === undefined) return false
  return String(value).trim().length > 0
}

export function brandCompleteness(values: BrandFormValues): BrandCompleteness {
  const sections = Object.fromEntries(BRAND_SECTIONS.map((s) => [s.key, { done: 0, total: 0 }])) as BrandCompleteness["sections"]
  const missing: CompletenessItem[] = []
  let done = 0
  for (const spec of CHECKS) {
    const section = sectionOf(spec.field)
    sections[section].total++
    if (isComplete(values, spec)) {
      done++
      sections[section].done++
    } else {
      missing.push({ field: spec.field, label: spec.label, section })
    }
  }
  return { pct: Math.round((done / CHECKS.length) * 100), done, total: CHECKS.length, missing, sections }
}

/* -------------------------- Positioning statement ------------------------- */

const RESULT_VERBS = [
  "achieve", "attract", "become", "book", "break", "build", "close", "create", "double", "earn", "escape", "find",
  "fix", "generate", "get", "go", "grow", "hire", "hit", "improve", "increase", "land", "launch", "lead", "learn",
  "make", "master", "move", "raise", "reach", "reduce", "run", "save", "scale", "sell", "ship", "start", "stop",
  "transform", "turn", "unlock", "win",
]
const VERB_PATTERN = new RegExp(`\\s(?:to\\s+)?(?:${RESULT_VERBS.join("|")})\\b`, "i")

export interface PositioningParts {
  audience: string
  result: string
  method: string
}

/**
 * "I help [audience] [result] through [method]." → its three parts, so an AI-suggested statement can
 * fill the builder. `fallback` (the current parts) resolves where the audience ends.
 */
export function splitPositioning(statement: string, fallback: PositioningParts): PositioningParts {
  const text = statement.replace(/\s+/g, " ").trim().replace(/[.!\s]+$/, "")
  const rest = text.replace(/^i\s+help\s+/i, "")
  const throughAt = rest.toLowerCase().lastIndexOf(" through ")
  const head = (throughAt > 0 ? rest.slice(0, throughAt) : rest).trim()
  const method = throughAt > 0 ? rest.slice(throughAt + " through ".length).trim() : ""
  const stripTo = (value: string) => value.trim().replace(/^to\s+/i, "")

  const knownAudience = fallback.audience.trim()
  if (knownAudience && head.toLowerCase().startsWith(`${knownAudience.toLowerCase()} `)) {
    return { audience: knownAudience, result: stripTo(head.slice(knownAudience.length)), method }
  }
  const match = VERB_PATTERN.exec(head)
  if (match && match.index > 0) {
    return { audience: head.slice(0, match.index).trim(), result: stripTo(head.slice(match.index)), method }
  }
  return { audience: head, result: "", method }
}

/* ------------------------------ AI suggestion ----------------------------- */

const cut = (value: string, max: number) => value.trim().slice(0, max)

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/[.!?]+$/, ""))
    .filter((s) => s.length > 3)
}

/** Audience problems and goal categories from the workspace, for the AI suggestion input. */
export function suggestionExtras(db: Database, values: BrandFormValues): { problems: string[]; goals: GoalCategory[] } {
  const bank = [...db.audience_problems]
    .sort((a, b) => b.severity - a.severity)
    .map((p) => p.problem)
    .filter((p) => p.trim())
  const problems = (bank.length ? bank : sentences(values.problems_solved)).slice(0, 10).map((p) => cut(p, 200))

  const brand = db.brand_profiles[0]
  const active = db.content_goals.filter((g) => g.is_active)
  const ordered = [
    active.find((g) => g.id === brand?.primary_goal_id),
    active.find((g) => g.id === brand?.secondary_goal_id),
    ...active,
  ]
  const goals: GoalCategory[] = []
  for (const goal of ordered) if (goal && !goals.includes(goal.category)) goals.push(goal.category)
  return { problems, goals: goals.slice(0, 5) }
}

/** The onboarding_strategy input built from the current (unsaved) Brand HQ answers. Clipped to the task's limits. */
export function brandSuggestionInput(
  values: BrandFormValues,
  extras: { problems: string[]; goals: GoalCategory[] }
): AiTaskInput<"onboarding_strategy"> {
  const years = values.years_experience
  return {
    name: cut(values.name, 120),
    brand_name: cut(values.brand_name, 120),
    role: cut(values.role, 160),
    industry: cut(values.industry, 160),
    years_experience: years === null || !Number.isFinite(years) ? null : Math.min(80, Math.max(0, Math.round(years))),
    expertise_areas: cleanList(values.expertise_areas)
      .slice(0, 15)
      .map((a) => cut(a, 60)),
    audience: cut(values.positioning_audience, 300),
    result: cut(values.positioning_result, 300),
    method: cut(values.positioning_method, 300),
    audience_problems: extras.problems.slice(0, 10).map((p) => cut(p, 200)),
    platforms: values.main_platforms.slice(0, 7),
    goals: extras.goals.slice(0, 5),
    language: values.language,
    tones: values.tones.slice(0, 6).map((t) => cut(TONE_MAP[t]?.label ?? t, 30)),
    personality: values.personality_traits.slice(0, 10).map((t) => cut(PERSONALITY_TRAIT_MAP[t]?.label ?? t, 30)),
    story: cut([values.who_am_i, values.why_listen].filter((s) => s.trim()).join("\n\n"), 2000),
    idea_count: 5,
  }
}
