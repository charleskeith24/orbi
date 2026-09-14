/**
 * Weekly / monthly review editing model: field definitions, saved-row lookup, frozen-stats merge and
 * "Experiment" recommendation → planned experiment. Pure — no store access.
 */
import { EXPERIMENT_TEMPLATES } from "@/lib/constants"
import type { ContentExperiment, ExperimentMetric, MonthlyReview, WeeklyReview } from "@/lib/types"
import type { ReportPeriod } from "./report-periods"

/* --------------------------------- Weekly ---------------------------------- */

export type WeeklyFieldKey = "what_worked" | "what_didnt" | "learned" | "double_down" | "stop" | "test_next"
export type WeeklyReviewFields = Pick<WeeklyReview, WeeklyFieldKey>

export const WEEKLY_FIELDS: { key: WeeklyFieldKey; label: string; placeholder: string }[] = [
  { key: "what_worked", label: "What worked", placeholder: "Which posts, hooks or formats beat your average — and by how much?" },
  { key: "what_didnt", label: "What didn't", placeholder: "What missed: consistency, weak posts, a pillar that went quiet…" },
  { key: "learned", label: "What we learned", placeholder: "The one insight you'll act on next week." },
  { key: "double_down", label: "What to double down on", placeholder: "The topic, hook or format that deserves more slots." },
  { key: "stop", label: "What to stop", placeholder: "What you'll cut or change next week." },
  { key: "test_next", label: "What to test next week", placeholder: "One experiment: hypothesis, variants and the metric to watch." },
]

const WEEKLY_KEYS = WEEKLY_FIELDS.map((f) => f.key)

export function weeklyFieldsOf(row?: Partial<WeeklyReviewFields> | null): WeeklyReviewFields {
  return {
    what_worked: row?.what_worked ?? "",
    what_didnt: row?.what_didnt ?? "",
    learned: row?.learned ?? "",
    double_down: row?.double_down ?? "",
    stop: row?.stop ?? "",
    test_next: row?.test_next ?? "",
  }
}

export function trimWeeklyFields(fields: WeeklyReviewFields): WeeklyReviewFields {
  const out = weeklyFieldsOf(fields)
  for (const key of WEEKLY_KEYS) out[key] = out[key].trim()
  return out
}

export function hasWeeklyText(fields: WeeklyReviewFields): boolean {
  return WEEKLY_KEYS.some((key) => fields[key].trim() !== "")
}

export function sameWeeklyFields(a: WeeklyReviewFields, b: WeeklyReviewFields): boolean {
  return WEEKLY_KEYS.every((key) => a[key] === b[key])
}

/** The week's saved row: exact week start first, else any row dated inside the week (the week-start setting changed). */
export function findWeeklyReview(rows: WeeklyReview[], period: ReportPeriod): WeeklyReview | undefined {
  return (
    rows.find((r) => r.week_start === period.startISO) ??
    rows.find((r) => r.week_start >= period.startISO && r.week_start <= period.endISO)
  )
}

/* --------------------------------- Monthly --------------------------------- */

export type MonthlyListKey = "continue_doing" | "increase" | "reduce" | "stop" | "experiment"
export type MonthlyReviewFields = Pick<MonthlyReview, "summary" | MonthlyListKey>

export const MONTHLY_LISTS: { key: MonthlyListKey; label: string; description: string; placeholder: string }[] = [
  { key: "continue_doing", label: "Continue", description: "Working — keep doing it.", placeholder: "Keep… (cite the numbers)" },
  { key: "increase", label: "Increase", description: "Deserves more slots.", placeholder: "More…" },
  { key: "reduce", label: "Reduce", description: "Fewer slots until it improves.", placeholder: "Less…" },
  { key: "stop", label: "Stop", description: "Cut it or change it completely.", placeholder: "Stop…" },
  { key: "experiment", label: "Experiment", description: "Tests to run next month.", placeholder: "Test… (and the metric to watch)" },
]

const MONTHLY_KEYS = MONTHLY_LISTS.map((l) => l.key)

export function monthlyFieldsOf(row?: Partial<MonthlyReviewFields> | null): MonthlyReviewFields {
  return {
    summary: row?.summary ?? "",
    continue_doing: [...(row?.continue_doing ?? [])],
    increase: [...(row?.increase ?? [])],
    reduce: [...(row?.reduce ?? [])],
    stop: [...(row?.stop ?? [])],
    experiment: [...(row?.experiment ?? [])],
  }
}

export function trimMonthlyFields(fields: MonthlyReviewFields): MonthlyReviewFields {
  const out = monthlyFieldsOf(fields)
  out.summary = out.summary.trim()
  for (const key of MONTHLY_KEYS) out[key] = out[key].map((s) => s.trim()).filter(Boolean)
  return out
}

export function hasMonthlyText(fields: MonthlyReviewFields): boolean {
  return fields.summary.trim() !== "" || MONTHLY_KEYS.some((key) => fields[key].some((s) => s.trim() !== ""))
}

export function sameMonthlyFields(a: MonthlyReviewFields, b: MonthlyReviewFields): boolean {
  return (
    a.summary === b.summary &&
    MONTHLY_KEYS.every((key) => a[key].length === b[key].length && a[key].every((s, i) => s === b[key][i]))
  )
}

export function findMonthlyReview(rows: MonthlyReview[], period: ReportPeriod): MonthlyReview | undefined {
  return rows.find((r) => r.month === period.startISO) ?? rows.find((r) => r.month.slice(0, 7) === period.key)
}

/* ---------------------------------- Shared --------------------------------- */

/** What a history row / badge shows: a plan-only weekly row (Weekly Planner) has no review text yet. */
export type ReviewState = "final" | "draft" | "plan" | "unsaved"

export function weeklyReviewState(row: WeeklyReview | undefined): ReviewState {
  if (!row) return "unsaved"
  return hasWeeklyText(weeklyFieldsOf(row)) ? row.status : "plan"
}

export function monthlyReviewState(row: MonthlyReview | undefined): ReviewState {
  return row ? row.status : "unsaved"
}

/** Replaces `report` and keeps every other key (the Weekly Planner stores its plan under `plan`). */
export function mergeStats(
  previous: Record<string, unknown> | null | undefined,
  report: Record<string, unknown>
): Record<string, unknown> {
  const base = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}
  return { ...base, report }
}

/* -------------------------------- Experiments ------------------------------ */

export type ExperimentDraft = Pick<ContentExperiment, "name" | "hypothesis" | "variant_a" | "variant_b" | "metric">

const METRIC_HINTS: [RegExp, ExperimentMetric][] = [
  [/retention|watch(ed)? time|completion|% watched/i, "avg_retention"],
  [/\bleads?\b|\bdms?\b|bookings?|consults?/i, "leads"],
  [/engagement/i, "engagement_rate"],
  [/\bsaves?\b/i, "saves"],
  [/\bshares?\b/i, "shares"],
  [/\bcomments?\b/i, "comments"],
  [/followers?/i, "followers_gained"],
  [/\bviews?\b|\breach\b/i, "views"],
]

/** The metric a free-text test talks about (default: engagement rate). */
export function inferExperimentMetric(text: string): ExperimentMetric {
  return METRIC_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "engagement_rate"
}

const CLAUSE_END = /:\s|\s[—–-]\s|[.?!](?:\s|$)/
const MAX_NAME = 60

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function shorten(text: string): string {
  if (text.length <= MAX_NAME) return text
  const cut = text.slice(0, MAX_NAME + 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 20 ? cut.slice(0, space) : cut.slice(0, MAX_NAME)).replace(/[\s,;:]+$/, "")}…`
}

/**
 * A planned experiment from one "Experiment" recommendation: the whole text is the hypothesis; the name is its
 * first clause. Texts that start with a template name ("Short hooks vs long hooks: …") take the template's
 * variants and metric; "A vs B" clauses become the variants.
 */
export function experimentFromRecommendation(text: string): ExperimentDraft {
  const clean = text.trim().replace(/\s+/g, " ")
  const lower = clean.toLowerCase()
  const template = EXPERIMENT_TEMPLATES.find((t) => lower.startsWith(t.name.toLowerCase()))
  if (template) {
    return { name: template.name, hypothesis: clean, variant_a: template.variant_a, variant_b: template.variant_b, metric: template.metric }
  }
  const clause = clean.split(CLAUSE_END)[0]?.trim() || clean
  const versus = /^(.+?)\s+vs\.?\s+(.+)$/i.exec(clause)
  return {
    name: capitalize(shorten(clause)),
    hypothesis: clean,
    variant_a: versus ? capitalize(versus[1].trim()) : "",
    variant_b: versus ? capitalize(versus[2].trim()) : "",
    metric: inferExperimentMetric(clean),
  }
}
