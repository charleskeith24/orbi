/**
 * Experiments (spec §35): status grouping and transitions, metric formatting, timing, the post
 * picker's candidates, form values/validation and the lesson → idea mapping. Pure functions.
 */
import { differenceInCalendarDays } from "date-fns"
import { isPublishedItem, latestMetricsByItem, metricValue, publishedAtOf } from "@/lib/analytics"
import { EXPERIMENT_METRIC_MAP } from "@/lib/constants"
import { formatDate, parseDate } from "@/lib/dates"
import type {
  ContentExperiment,
  ContentItem,
  Database,
  ExperimentMetric,
  ExperimentStatus,
  ExperimentWinner,
  ID,
  InsertRow,
  ISODate,
  UpdateRow,
} from "@/lib/types"
import { clamp, formatDuration, formatNumber, formatPercent, pluralize, truncate } from "@/lib/utils"

export type Variant = "a" | "b"

/* ------------------------------ Status groups ------------------------------ */

export const STATUS_ORDER: ExperimentStatus[] = ["running", "planned", "completed", "cancelled"]

export const STATUS_COPY: Record<ExperimentStatus, string> = {
  running: "Collecting posts and analytics now",
  planned: "Designed and waiting to start",
  completed: "Decided — the lesson is the output",
  cancelled: "Stopped before a result",
}

const LAST = "9999-12-31"

const SORTERS: Record<ExperimentStatus, (a: ContentExperiment, b: ContentExperiment) => number> = {
  running: (a, b) => (a.end_date ?? LAST).localeCompare(b.end_date ?? LAST),
  planned: (a, b) => (a.start_date ?? LAST).localeCompare(b.start_date ?? LAST),
  completed: (a, b) => (b.end_date ?? b.updated_at).localeCompare(a.end_date ?? a.updated_at),
  cancelled: (a, b) => b.updated_at.localeCompare(a.updated_at),
}

export interface ExperimentGroup {
  status: ExperimentStatus
  experiments: ContentExperiment[]
}

/** Non-empty status groups: running (ending soonest first), planned (starting soonest), completed (latest), cancelled. */
export function groupExperiments(experiments: ContentExperiment[]): ExperimentGroup[] {
  return STATUS_ORDER.map((status) => ({
    status,
    experiments: experiments
      .filter((e) => e.status === status)
      .sort((a, b) => SORTERS[status](a, b) || a.name.localeCompare(b.name)),
  })).filter((g) => g.experiments.length > 0)
}

export interface ExperimentStats {
  running: number
  planned: number
  completed: number
  /** Completed with a declared A/B winner. */
  decided: number
  lessons: number
  /** Experiments whose lesson became an idea. */
  lessonIdeas: number
  nextEnd: ContentExperiment | null
  nextStart: ContentExperiment | null
}

export function experimentStats(experiments: ContentExperiment[], ideas: { source_ref_id: ID | null }[]): ExperimentStats {
  const ids = new Set(experiments.map((e) => e.id))
  const running = experiments.filter((e) => e.status === "running").sort(SORTERS.running)
  const planned = experiments.filter((e) => e.status === "planned").sort(SORTERS.planned)
  const completed = experiments.filter((e) => e.status === "completed")
  return {
    running: running.length,
    planned: planned.length,
    completed: completed.length,
    decided: completed.filter((e) => e.winner === "a" || e.winner === "b").length,
    lessons: experiments.filter((e) => e.lesson.trim()).length,
    lessonIdeas: new Set(ideas.flatMap((i) => (i.source_ref_id && ids.has(i.source_ref_id) ? [i.source_ref_id] : []))).size,
    nextEnd: running[0] ?? null,
    nextStart: planned[0] ?? null,
  }
}

/* ------------------------------- Transitions ------------------------------- */

export interface StatusTransition {
  to: ExperimentStatus
  label: string
  primary?: boolean
}

export const TRANSITIONS: Record<ExperimentStatus, StatusTransition[]> = {
  planned: [
    { to: "running", label: "Start experiment", primary: true },
    { to: "cancelled", label: "Cancel experiment" },
  ],
  running: [
    { to: "completed", label: "Mark completed", primary: true },
    { to: "planned", label: "Back to planned" },
    { to: "cancelled", label: "Cancel experiment" },
  ],
  completed: [{ to: "running", label: "Reopen" }],
  cancelled: [{ to: "planned", label: "Restore to planned" }],
}

export const TRANSITION_TOASTS: Record<ExperimentStatus, string> = {
  running: "Experiment running",
  planned: "Experiment moved to planned",
  completed: "Experiment completed — record the result and lesson",
  cancelled: "Experiment cancelled",
}

/** The status change plus the dates it implies: starting stamps today as the start; completing never ends in the future. */
export function transitionPatch(experiment: ContentExperiment, to: ExperimentStatus, today: ISODate): UpdateRow<"content_experiments"> {
  const patch: UpdateRow<"content_experiments"> = { status: to }
  if (to === "running" && experiment.status === "planned") {
    const start = !experiment.start_date || experiment.start_date > today ? today : experiment.start_date
    if (start !== experiment.start_date) patch.start_date = start
    if (experiment.end_date && experiment.end_date < start) patch.end_date = null
  }
  if (to === "completed") {
    if (experiment.start_date && experiment.start_date > today) patch.start_date = today
    if (!experiment.end_date || experiment.end_date > today) patch.end_date = today
  }
  return patch
}

/* --------------------------------- Metrics --------------------------------- */

const PERCENT_METRICS = new Set<ExperimentMetric>([
  "avg_retention",
  "engagement_rate",
  "share_rate",
  "save_rate",
  "lead_conversion_rate",
  "follower_conversion_rate",
])

export function metricLabel(metric: ExperimentMetric): string {
  return EXPERIMENT_METRIC_MAP[metric]?.label ?? metric
}

/** Percent metrics "62.4%", watch time "1:35", counts "1,284" (means under 100 keep one decimal: "2.5"). */
export function formatMetricValue(metric: ExperimentMetric, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  if (PERCENT_METRICS.has(metric)) return formatPercent(value)
  if (metric === "watch_time_seconds") return formatDuration(value)
  if (Number.isInteger(value) || Math.abs(value) >= 100) return formatNumber(value)
  return value.toFixed(1)
}

/* ---------------------------------- Timing --------------------------------- */

export function dateRangeLabel(experiment: Pick<ContentExperiment, "start_date" | "end_date">): string {
  const start = experiment.start_date ? formatDate(experiment.start_date, "MMM d") : null
  const end = experiment.end_date ? formatDate(experiment.end_date, "MMM d, yyyy") : null
  if (start && end) return `${start} – ${end}`
  if (start) return `From ${formatDate(experiment.start_date, "MMM d, yyyy")}`
  if (end) return `Until ${end}`
  return "No dates set"
}

export interface ExperimentTiming {
  label: string
  /** Share of the planned window elapsed (running experiments with both dates). */
  progress: number | null
}

export function experimentTiming(experiment: ContentExperiment, now: Date): ExperimentTiming {
  const start = parseDate(experiment.start_date)
  const end = parseDate(experiment.end_date)
  switch (experiment.status) {
    case "running": {
      if (start && end) {
        const total = Math.max(1, differenceInCalendarDays(end, start) + 1)
        const day = clamp(differenceInCalendarDays(now, start) + 1, 1, total)
        const left = differenceInCalendarDays(end, now)
        if (left < 0) return { label: `Past its end date (${formatDate(end, "MMM d")})`, progress: 1 }
        return { label: `Day ${day} of ${total} · ${left === 0 ? "ends today" : `${pluralize(left, "day")} left`}`, progress: day / total }
      }
      if (start) return { label: `Started ${formatDate(start, "MMM d")} · no end date`, progress: null }
      return { label: "No dates set", progress: null }
    }
    case "planned": {
      if (!start) return { label: "No start date yet", progress: null }
      const until = differenceInCalendarDays(start, now)
      if (until > 0) return { label: `Starts in ${pluralize(until, "day")}`, progress: null }
      return { label: until === 0 ? "Starts today" : `Was due to start ${formatDate(start, "MMM d")}`, progress: null }
    }
    case "completed":
      return { label: end ? `Ended ${formatDate(end, "MMM d, yyyy")}` : "Completed", progress: null }
    case "cancelled":
      return { label: "Cancelled", progress: null }
  }
}

/* ---------------------------------- Picker --------------------------------- */

export interface PickerCandidate {
  item: ContentItem
  date: Date | null
  /** The post's value for the experiment metric (latest snapshot), null when unmeasured. */
  value: number | null
  inWindow: boolean
  /** Already linked to the other variant. */
  inOther: boolean
}

/** Published posts, newest first, with their metric value and whether they fall inside the experiment dates. */
export function pickerCandidates(db: Database, experiment: ContentExperiment, variant: Variant): PickerCandidate[] {
  const latest = latestMetricsByItem(db)
  const start = parseDate(experiment.start_date)
  const end = parseDate(experiment.end_date)
  const endMs = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime() : null
  const other = new Set(variant === "a" ? experiment.variant_b_item_ids : experiment.variant_a_item_ids)
  return db.content_items
    .filter(isPublishedItem)
    .map((item) => {
      const date = publishedAtOf(item)
      const inWindow = Boolean(
        date && (start || end) && (!start || date.getTime() >= start.getTime()) && (endMs === null || date.getTime() <= endMs)
      )
      return { item, date, value: metricValue(latest.get(item.id), experiment.metric), inWindow, inOther: other.has(item.id) }
    })
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
}

export function variantIds(experiment: ContentExperiment, variant: Variant): ID[] {
  return variant === "a" ? experiment.variant_a_item_ids : experiment.variant_b_item_ids
}

export function variantPatch(variant: Variant, ids: ID[]): UpdateRow<"content_experiments"> {
  return variant === "a" ? { variant_a_item_ids: ids } : { variant_b_item_ids: ids }
}

/* ----------------------------------- Form ---------------------------------- */

export interface ExperimentFormValues {
  name: string
  hypothesis: string
  variant_a: string
  variant_b: string
  metric: ExperimentMetric
  start_date: ISODate | null
  end_date: ISODate | null
}

export type ExperimentFormErrors = Partial<Record<keyof ExperimentFormValues, string>>

export function formValuesOf(experiment: ContentExperiment | null): ExperimentFormValues {
  return {
    name: experiment?.name ?? "",
    hypothesis: experiment?.hypothesis ?? "",
    variant_a: experiment?.variant_a ?? "",
    variant_b: experiment?.variant_b ?? "",
    metric: experiment?.metric ?? "engagement_rate",
    start_date: experiment?.start_date ?? null,
    end_date: experiment?.end_date ?? null,
  }
}

export function validateExperiment(values: ExperimentFormValues): ExperimentFormErrors {
  const errors: ExperimentFormErrors = {}
  const a = values.variant_a.trim()
  const b = values.variant_b.trim()
  if (!values.name.trim()) errors.name = "Name the experiment."
  if (!a) errors.variant_a = "Describe what variant A does."
  if (!b) errors.variant_b = "Describe what variant B does."
  else if (a && a.toLowerCase() === b.toLowerCase()) errors.variant_b = "Variant B has to differ from A."
  if (values.start_date && values.end_date && values.end_date < values.start_date) errors.end_date = "The end date is before the start date."
  return errors
}

/* ------------------------------ Lesson → idea ------------------------------ */

export function winnerLabel(experiment: Pick<ContentExperiment, "variant_a" | "variant_b">, winner: ExperimentWinner): string {
  if (winner === "inconclusive") return "Inconclusive"
  const name = winner === "a" ? experiment.variant_a : experiment.variant_b
  return `Variant ${winner.toUpperCase()}${name ? ` · ${name}` : ""}`
}

/** Idea Bank row for a lesson: the first sentence as the title, the full lesson as the description. */
export function lessonIdeaValues(experiment: ContentExperiment, lesson: string): InsertRow<"content_ideas"> {
  const text = lesson.trim()
  const first = (text.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text).trim().replace(/[.!?]+$/, "")
  const winner = experiment.winner === "a" ? experiment.variant_a : experiment.winner === "b" ? experiment.variant_b : ""
  return {
    title: truncate(first || experiment.name, 120),
    description: text,
    why_it_matters: experiment.result.trim(),
    inspiration: `Experiment · ${experiment.name}${winner ? ` — “${winner}” won` : ""}`,
    source: "manual",
    source_ref_id: experiment.id,
    status: "inbox",
  }
}
