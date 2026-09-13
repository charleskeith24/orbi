/**
 * Pure helpers for Audience HQ, the Problem Bank and the Question Bank — no React, no store access.
 * Callers pass `now` (ARCHITECTURE §3 "Time").
 */
import { endOfDay, startOfDay, subDays } from "date-fns"
import { CATEGORICAL_COLORS, PLATFORMS, PROBLEM_CATEGORY_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate } from "@/lib/dates"
import type {
  AudiencePersona,
  AudienceProblem,
  AudienceQuestion,
  CategoricalColor,
  ContentIdea,
  ContentItem,
  ID,
  InsertRow,
  ISODate,
  Priority,
  ProblemCategory,
  QuestionStatus,
  UpdateRow,
} from "@/lib/types"

/** Filter value for "no persona / no pillar / no platform". */
export const NONE = "none"

/** Window behind "share of recent content" on persona cards. */
export const RECENT_DAYS = 90

/** "a,b" → ["a", "b"] for list-valued URL params. */
export function parseIdList(value: string | null | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : []
}

/** Rows per persona id (NONE for unassigned). */
export function countByPersona(rows: { persona_id: ID | null }[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of rows) {
    const key = row.persona_id ?? NONE
    out.set(key, (out.get(key) ?? 0) + 1)
  }
  return out
}

/* -------------------------------- Personas -------------------------------- */

/** Primary first, then in the order they were defined. */
export function sortPersonas(personas: AudiencePersona[]): AudiencePersona[] {
  return [...personas].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      a.created_at.localeCompare(b.created_at) ||
      a.name.localeCompare(b.name)
  )
}

/** First categorical colour no persona uses yet (fixed order), cycling once all eight are taken. */
export function nextPersonaColor(personas: Pick<AudiencePersona, "color">[]): CategoricalColor {
  const used = new Set(personas.map((p) => p.color))
  return CATEGORICAL_COLORS.find((c) => !used.has(c)) ?? CATEGORICAL_COLORS[personas.length % CATEGORICAL_COLORS.length]
}

/** A new row carrying every field of `persona`: "(copy)" name, not primary, the next free colour. */
export function duplicatePersonaValues(persona: AudiencePersona, personas: AudiencePersona[]): InsertRow<"audience_personas"> {
  const copy: Partial<AudiencePersona> = structuredClone(persona)
  delete copy.id
  delete copy.user_id
  delete copy.created_at
  delete copy.updated_at
  return {
    ...copy,
    name: `${persona.name.trim() || "Untitled persona"} (copy)`,
    is_primary: false,
    color: nextPersonaColor(personas),
  }
}

const PROFILE_TEXT = ["age_range", "profession", "industry", "experience_level", "location", "buying_motivation"] as const
const PROFILE_LISTS = [
  "goals",
  "problems",
  "fears",
  "frustrations",
  "aspirations",
  "questions",
  "objections",
  "content_consumed",
  "platforms",
  "influencers",
  "language_used",
] as const

/** Share of the §5 profile that is filled in, 0–100 (name, colour and notes excluded). */
export function personaCompleteness(persona: AudiencePersona): number {
  const filled =
    PROFILE_TEXT.filter((key) => persona[key].trim()).length + PROFILE_LISTS.filter((key) => persona[key].length > 0).length
  return Math.round((filled / (PROFILE_TEXT.length + PROFILE_LISTS.length)) * 100)
}

export interface ContentShare {
  /** Dated content (published, scheduled or due) inside the window. */
  total: number
  /** Persona id (or NONE) → pieces. */
  counts: Map<string, number>
}

/** Content dated in the last `days` days (published → scheduled → due), grouped by target persona. */
export function recentContentByPersona(items: ContentItem[], now: Date, days = RECENT_DAYS): ContentShare {
  const start = startOfDay(subDays(now, days - 1)).getTime()
  const end = endOfDay(now).getTime()
  const counts = new Map<string, number>()
  let total = 0
  for (const item of items) {
    const time = contentItemDate(item)?.getTime()
    if (time === undefined || time < start || time > end) continue
    total += 1
    const key = item.persona_id ?? NONE
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return { total, counts }
}

/* -------------------------------- Problems -------------------------------- */

export const SEVERITY_LEVELS = [
  { value: 1, label: "Minor" },
  { value: 2, label: "Low" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "High" },
  { value: 5, label: "Critical" },
] as const

export function isProblemCategory(value: string): value is ProblemCategory {
  return value in PROBLEM_CATEGORY_MAP
}

/** Severity is an integer 1–5 (Postgres `integer`). */
export function clampSeverity(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 3
  return Math.min(5, Math.max(1, Math.round(value)))
}

export function severityLabel(value: number): string {
  return SEVERITY_LEVELS[clampSeverity(value) - 1].label
}

export interface ProblemLinks {
  ideas: ContentIdea[]
  items: ContentItem[]
}

export const NO_LINKS: ProblemLinks = { ideas: [], items: [] }

/** Ideas and content items that address each problem (`problem_id`). */
export function linksByProblem(ideas: ContentIdea[], items: ContentItem[]): Map<ID, ProblemLinks> {
  const out = new Map<ID, ProblemLinks>()
  const entry = (id: ID) => {
    let links = out.get(id)
    if (!links) {
      links = { ideas: [], items: [] }
      out.set(id, links)
    }
    return links
  }
  for (const idea of ideas) if (idea.problem_id) entry(idea.problem_id).ideas.push(idea)
  for (const item of items) if (item.problem_id) entry(item.problem_id).items.push(item)
  return out
}

/** No idea and no content addresses the problem yet. */
export function isUntapped(links: ProblemLinks | undefined): boolean {
  return !links || (links.ideas.length === 0 && links.items.length === 0)
}

/** Most severe first, untapped before covered, then alphabetical. */
export function sortProblems(problems: AudienceProblem[], links: Map<ID, ProblemLinks>): AudienceProblem[] {
  return [...problems].sort(
    (a, b) =>
      clampSeverity(b.severity) - clampSeverity(a.severity) ||
      Number(isUntapped(links.get(b.id))) - Number(isUntapped(links.get(a.id))) ||
      a.problem.localeCompare(b.problem)
  )
}

const CLAUSE_BREAKS = [" — ", " – ", " - ", ": ", "; ", ", then ", ", so ", ", but "]

/** Leading clause of a sentence, capitalised, without trailing punctuation, at most `max` chars. */
export function firstClause(text: string, max = 90): string {
  let clause = text.replace(/\s+/g, " ").trim()
  for (const separator of CLAUSE_BREAKS) {
    const index = clause.indexOf(separator)
    if (index > 0) clause = clause.slice(0, index)
  }
  clause = clause.replace(/[\s.?!…]+$/u, "")
  if (clause.length > max) clause = `${clause.slice(0, max).replace(/\s+\S*$/, "")}…`
  return clause.charAt(0).toUpperCase() + clause.slice(1)
}

const REFLECTIVE_CATEGORIES: ProblemCategory[] = ["emotional", "career"]

/** Working title for an idea born from a problem, e.g. "No SOPs — how to fix it". */
export function problemIdeaTitle(problem: Pick<AudienceProblem, "problem" | "category">): string {
  const clause = firstClause(problem.problem) || "Audience problem"
  return `${clause} — ${REFLECTIVE_CATEGORIES.includes(problem.category) ? "what to do about it" : "how to fix it"}`
}

/** Idea Bank row for "Create idea" on a problem (source `problem_bank`, links prefilled). */
export function problemIdeaValues(
  problem: AudienceProblem,
  persona: Pick<AudiencePersona, "name"> | null | undefined
): InsertRow<"content_ideas"> {
  const severity = clampSeverity(problem.severity)
  const category = PROBLEM_CATEGORY_MAP[problem.category]?.label.toLowerCase() ?? "audience"
  const priority: Priority = severity >= 4 ? "high" : severity >= 3 ? "medium" : "low"
  return {
    title: problemIdeaTitle(problem),
    core_topic: firstClause(problem.problem),
    description: [problem.problem.trim(), problem.notes.trim()].filter(Boolean).join("\n\n"),
    problem_id: problem.id,
    persona_id: problem.persona_id,
    pillar_id: problem.pillar_id,
    source: "problem_bank",
    source_ref_id: problem.id,
    status: "inbox",
    priority,
    why_it_matters: `${severityLabel(severity)} (${severity}/5) ${category} problem${persona?.name ? ` for ${persona.name}` : ""}, from the Problem Bank.`,
  }
}

/** Idea Generator pre-filled with the problem's context and started (`run=1`). */
export function generatorHref(problem: Pick<AudienceProblem, "id" | "persona_id" | "pillar_id">): string {
  const params = new URLSearchParams({ problem: problem.id })
  if (problem.persona_id) params.set("persona", problem.persona_id)
  if (problem.pillar_id) params.set("pillar", problem.pillar_id)
  params.set("run", "1")
  return `/ideas/generator?${params.toString()}`
}

/* -------------------------------- Questions ------------------------------- */

/** Repeated questions rise: asked 5+ times → High, 3+ → Medium. */
export function questionPriority(frequency: number): Priority {
  return frequency >= 5 ? "high" : frequency >= 3 ? "medium" : "low"
}

/** Same normalisation as the Today page's "Collect a question", so repeats match everywhere. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function findDuplicateQuestion(questions: AudienceQuestion[], text: string, excludeId?: ID): AudienceQuestion | undefined {
  const key = normalizeQuestion(text)
  if (!key) return undefined
  return questions.find((q) => q.id !== excludeId && normalizeQuestion(q.question) === key)
}

/** "+1 asked again": integer count, today's local date, and a dismissed question comes back. */
export function askedAgainPatch(
  question: Pick<AudienceQuestion, "frequency" | "status">,
  today: ISODate
): UpdateRow<"audience_questions"> {
  return {
    frequency: Math.max(1, Math.round(question.frequency)) + 1,
    last_asked_at: today,
    ...(question.status === "dismissed" ? { status: "new" as const } : {}),
  }
}

export type QuestionView = "open" | "answered" | "dismissed" | "all"
export const QUESTION_VIEWS: QuestionView[] = ["open", "answered", "dismissed", "all"]

export function isQuestionView(value: string): value is QuestionView {
  return (QUESTION_VIEWS as string[]).includes(value)
}

/** New and idea-created questions are still open — nothing answers them yet. */
export function questionView(status: QuestionStatus): Exclude<QuestionView, "all"> {
  return status === "answered" ? "answered" : status === "dismissed" ? "dismissed" : "open"
}

/** Idea Bank row for "Convert to idea" (source `question_bank`, priority from frequency). */
export function questionIdeaValues(question: AudienceQuestion): InsertRow<"content_ideas"> {
  const text = question.question.replace(/\s+/g, " ").trim()
  const frequency = Math.max(1, Math.round(question.frequency))
  const who = question.source_person.trim()
  const where = question.platform ? ` on ${PLATFORMS[question.platform].label}` : ""
  return {
    title: text.length > 300 ? `${text.slice(0, 299)}…` : text,
    core_topic: question.topic.trim() || firstClause(text),
    description: `Audience question${who ? ` from ${who}` : ""}${where}: “${text}”`,
    persona_id: question.persona_id,
    pillar_id: question.pillar_id,
    platforms: question.platform ? [question.platform] : [],
    source: "question_bank",
    source_ref_id: question.id,
    status: "inbox",
    priority: questionPriority(frequency),
    why_it_matters: `Asked ${frequency === 1 ? "once" : `${frequency} times`} — a direct answer is content people are already waiting for.`,
  }
}

const STOP_WORDS = new Set(
  (
    "the and for you your how can why are but not any all our out get got who its was has had too yet did one two " +
    "what when where which while with that this there their them they have from should would could about into than " +
    "then does just like much many more most only also some even after before because really actually still " +
    "ano ang mga kung yung para ako ikaw sila kami tayo lang din rin naman paano"
  ).split(" ")
)

/** Distinct lowercase words (3+ letters, no stop words) for rough topic matching. */
export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  )
}

export interface AnswerCandidates {
  /** Content made from the question's idea, or sharing its keywords — best first. */
  suggested: ContentItem[]
  others: ContentItem[]
}

/** Content items to link when marking a question answered. Published pieces rank above drafts. */
export function rankAnswerCandidates(
  question: Pick<AudienceQuestion, "question" | "topic" | "idea_id" | "content_item_id">,
  items: ContentItem[],
  limit = 6
): AnswerCandidates {
  const words = keywords(`${question.question} ${question.topic}`)
  const scored = items.map((item) => {
    const titleWords = keywords(`${item.title} ${item.hook}`)
    let overlap = 0
    for (const word of words) if (titleWords.has(word)) overlap += 1
    const linked = item.id === question.content_item_id || (question.idea_id !== null && item.idea_id === question.idea_id)
    const relevance = (linked ? 100 : 0) + overlap * 10
    const score = relevance + (PUBLISHED_STAGES.includes(item.stage) ? 3 : 0)
    return { item, relevance, score, time: contentItemDate(item)?.getTime() ?? 0 }
  })
  scored.sort((a, b) => b.score - a.score || b.time - a.time)
  // Linked content, or at least two shared keywords — one shared word ("ads") matches too much.
  const suggested = scored.filter((s) => s.relevance >= 20).slice(0, limit)
  const picked = new Set(suggested.map((s) => s.item.id))
  return {
    suggested: suggested.map((s) => s.item),
    others: scored.filter((s) => !picked.has(s.item.id)).map((s) => s.item),
  }
}
