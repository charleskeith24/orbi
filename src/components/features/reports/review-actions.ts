/**
 * Review writes (store). Upserts are keyed by the period so a week / month never gets two rows.
 */
import { dataActions } from "@/lib/store"
import type { ContentExperiment, GeneratedBy, ID, ReviewStatus } from "@/lib/types"
import type { ReportPeriod } from "./report-periods"
import {
  experimentFromRecommendation,
  findMonthlyReview,
  findWeeklyReview,
  mergeStats,
  type MonthlyReviewFields,
  type WeeklyReviewFields,
} from "./review-model"

interface SaveInput<F> {
  fields: F
  status: ReviewStatus
  generatedBy: GeneratedBy
  /** Plain-JSON report summary frozen on the row (`stats.report`). */
  report: Record<string, unknown>
}

export interface SaveResult {
  id: ID
  created: boolean
}

/** Upsert the week's `weekly_reviews` row; the Weekly Planner's focus, planned items and `stats.plan` are kept. */
export function saveWeeklyReview(period: ReportPeriod, input: SaveInput<WeeklyReviewFields>): SaveResult {
  const existing = findWeeklyReview(dataActions.getDb().weekly_reviews, period)
  const patch = {
    ...input.fields,
    status: input.status,
    generated_by: input.generatedBy,
    stats: mergeStats(existing?.stats, input.report),
  }
  if (existing) {
    dataActions.update("weekly_reviews", existing.id, patch)
    return { id: existing.id, created: false }
  }
  return { id: dataActions.insert("weekly_reviews", { week_start: period.startISO, ...patch }).id, created: true }
}

/** Upsert the month's `monthly_reviews` row (`month` = first day of the month). */
export function saveMonthlyReview(period: ReportPeriod, input: SaveInput<MonthlyReviewFields>): SaveResult {
  const existing = findMonthlyReview(dataActions.getDb().monthly_reviews, period)
  const patch = {
    ...input.fields,
    status: input.status,
    generated_by: input.generatedBy,
    stats: mergeStats(existing?.stats, input.report),
  }
  if (existing) {
    dataActions.update("monthly_reviews", existing.id, patch)
    return { id: existing.id, created: false }
  }
  return { id: dataActions.insert("monthly_reviews", { month: period.startISO, ...patch }).id, created: true }
}

/** A planned experiment from one "Experiment" recommendation. */
export function createExperimentFromRecommendation(text: string): ContentExperiment {
  return dataActions.insert("content_experiments", { ...experimentFromRecommendation(text), status: "planned" })
}
