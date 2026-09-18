/**
 * Experiments (spec §35): status grouping and transitions, metric formatting, timing, the post
 * picker's candidates, form values/validation and the lesson → idea mapping. Pure functions.
 */
import { differenceInCalendarDays } from "date-fns"
import { isPublishedItem, latestMetricsByItem, metricValue, publishedAtOf } from "@/lib/analytics"
import { EXPERIMENT_METRIC_MAP } from "@/lib/constants"
import { formatDate, parseDate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
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
import { clamp, formatDuration, formatNumber, formatPercent, truncate } from "@/lib/utils"
import { experimentsMessages } from "./messages"

export type Variant = "a" | "b"

/* ------------------------------ Status groups ------------------------------ */

export const STATUS_ORDER: ExperimentStatus[] = ["running", "planned", "completed", "cancelled"]

/** One-line description of a status group ("Collecting posts and analytics now"). */
export function statusCopy(status: ExperimentStatus, lang: UiLang = "en"): string {
  return translator(experimentsMessages, lang)(`group_${status}`)
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

type ExperimentsKey = keyof typeof experimentsMessages.en

export interface StatusTransition {
  to: ExperimentStatus
  /** Key of `experimentsMessages`. */
  label: ExperimentsKey
  primary?: boolean
}

export const TRANSITIONS: Record<ExperimentStatus, StatusTransition[]> = {
  planned: [
    { to: "running", label: "start_experiment", primary: true },
    { to: "cancelled", label: "cancel_experiment" },
  ],
  running: [
    { to: "completed", label: "mark_completed", primary: true },
    { to: "planned", label: "back_to_planned" },
    { to: "cancelled", label: "cancel_experiment" },
  ],
  completed: [{ to: "running", label: "reopen" }],
  cancelled: [{ to: "planned", label: "restore_planned" }],
}

/** Toast after a status change ("Experiment running"). */
export function transitionToast(to: ExperimentStatus, lang: UiLang = "en"): string {
  return translator(experimentsMessages, lang)(`toast_${to}`)
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

export function dateRangeLabel(experiment: Pick<ContentExperiment, "start_date" | "end_date">, lang: UiLang = "en"): string {
  const t = translator(experimentsMessages, lang)
  const start = experiment.start_date ? formatDate(experiment.start_date, "MMM d") : null
  const end = experiment.end_date ? formatDate(experiment.end_date, "MMM d, yyyy") : null
  if (start && end) return `${start} – ${end}`
  if (start) return t("range_from", { date: formatDate(experiment.start_date, "MMM d, yyyy") })
  if (end) return t("range_until", { date: end })
  return t("no_dates")
}

export interface ExperimentTiming {
  label: string
  /** Share of the planned window elapsed (running experiments with both dates). */
  progress: number | null
}

export function experimentTiming(experiment: ContentExperiment, now: Date, lang: UiLang = "en"): ExperimentTiming {
  const t = translator(experimentsMessages, lang)
  const start = parseDate(experiment.start_date)
  const end = parseDate(experiment.end_date)
  switch (experiment.status) {
    case "running": {
      if (start && end) {
        const total = Math.max(1, differenceInCalendarDays(end, start) + 1)
        const day = clamp(differenceInCalendarDays(now, start) + 1, 1, total)
        const left = differenceInCalendarDays(end, now)
        if (left < 0) return { label: t("past_end", { date: formatDate(end, "MMM d") }), progress: 1 }
        const rest = left === 0 ? t("ends_today") : t.plural("days_left", left, { count: formatNumber(left) })
        return { label: t("day_of", { day, total, rest }), progress: day / total }
      }
      if (start) return { label: t("started_no_end", { date: formatDate(start, "MMM d") }), progress: null }
      return { label: t("no_dates"), progress: null }
    }
    case "planned": {
      if (!start) return { label: t("no_start_yet"), progress: null }
      const until = differenceInCalendarDays(start, now)
      if (until > 0) return { label: t.plural("starts_in", until, { count: formatNumber(until) }), progress: null }
      return { label: until === 0 ? t("starts_today") : t("was_due", { date: formatDate(start, "MMM d") }), progress: null }
    }
    case "completed":
      return { label: end ? t("ended", { date: formatDate(end, "MMM d, yyyy") }) : t("completed"), progress: null }
    case "cancelled":
      return { label: t("cancelled"), progress: null }
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

export function validateExperiment(values: ExperimentFormValues, lang: UiLang = "en"): ExperimentFormErrors {
  const t = translator(experimentsMessages, lang)
  const errors: ExperimentFormErrors = {}
  const a = values.variant_a.trim()
  const b = values.variant_b.trim()
  if (!values.name.trim()) errors.name = t("error_name")
  if (!a) errors.variant_a = t("error_variant_a")
  if (!b) errors.variant_b = t("error_variant_b")
  else if (a && a.toLowerCase() === b.toLowerCase()) errors.variant_b = t("error_same")
  if (values.start_date && values.end_date && values.end_date < values.start_date) errors.end_date = t("error_end")
  return errors
}

/* ------------------------------ Lesson → idea ------------------------------ */

export function winnerLabel(experiment: Pick<ContentExperiment, "variant_a" | "variant_b">, winner: ExperimentWinner, lang: UiLang = "en"): string {
  const t = translator(experimentsMessages, lang)
  if (winner === "inconclusive") return t("inconclusive")
  const name = winner === "a" ? experiment.variant_a : experiment.variant_b
  return `${t("variant", { letter: winner.toUpperCase() })}${name ? ` · ${name}` : ""}`
}

/**
 * Idea Bank row for a lesson: the first sentence as the title, the full lesson as the description. The
 * `inspiration` credit is written in `lang` (the UI language when the idea is created).
 */
export function lessonIdeaValues(experiment: ContentExperiment, lesson: string, lang: UiLang = "en"): InsertRow<"content_ideas"> {
  const t = translator(experimentsMessages, lang)
  const text = lesson.trim()
  const first = (text.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text).trim().replace(/[.!?]+$/, "")
  const winner = experiment.winner === "a" ? experiment.variant_a : experiment.winner === "b" ? experiment.variant_b : ""
  return {
    title: truncate(first || experiment.name, 120),
    description: text,
    why_it_matters: experiment.result.trim(),
    inspiration: winner ? t("inspiration_winner", { name: experiment.name, winner }) : t("inspiration", { name: experiment.name }),
    source: "manual",
    source_ref_id: experiment.id,
    status: "inbox",
  }
}
