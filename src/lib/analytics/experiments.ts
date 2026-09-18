/**
 * A/B experiment evaluation (spec §35).
 */
import { EXPERIMENT_METRIC_MAP } from "@/lib/constants"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { ContentExperiment, ContentItem, Database, ExperimentMetric, ExperimentWinner, ID } from "@/lib/types"
import { average, uniq } from "@/lib/utils"
import { experimentMessages } from "./messages"
import { metricValue, sharedLatestMetrics } from "./metrics"
import { roundTo } from "./shared"

/** Measured posts needed per variant before a winner is suggested. */
export const EXPERIMENT_MIN_N = 2
/** Minimum |lift| (%) before a winner is suggested. */
export const EXPERIMENT_MIN_LIFT = 10

export interface VariantResult {
  items: { item: ContentItem; value: number | null }[]
  /** Items with a value for the experiment metric. */
  n: number
  mean: number | null
}

export interface ExperimentResults {
  metric: ExperimentMetric
  a: VariantResult
  b: VariantResult
  /** (mean B − mean A) ÷ |mean A| × 100, 1 decimal; null when A's mean is 0 or missing. */
  lift: number | null
  suggestedWinner: ExperimentWinner
  /** Plain-language explanation of the suggestion. */
  reason: string
}

/**
 * Per variant: n and mean of the experiment metric (latest snapshots); lift = B vs A in %;
 * winner = sign of lift, "inconclusive" when either n < 2 or |lift| < 10%. `reason` is in `lang` (default English).
 */
export function experimentResults(db: Database, experiment: ContentExperiment, lang: UiLang = "en"): ExperimentResults {
  const t = translator(experimentMessages, lang)
  const latest = sharedLatestMetrics(db)
  const items = new Map(db.content_items.map((i) => [i.id, i]))
  const variant = (ids: ID[]): VariantResult => {
    const rows = uniq(ids).flatMap((id) => {
      const item = items.get(id)
      return item ? [{ item, value: metricValue(latest.get(id), experiment.metric) }] : []
    })
    const values = rows.map((r) => r.value).filter((v): v is number => v !== null)
    return { items: rows, n: values.length, mean: average(values) }
  }
  const a = variant(experiment.variant_a_item_ids)
  const b = variant(experiment.variant_b_item_ids)
  const lift = a.mean !== null && b.mean !== null && a.mean !== 0 ? roundTo(((b.mean - a.mean) / Math.abs(a.mean)) * 100) : null
  const label = (EXPERIMENT_METRIC_MAP[experiment.metric]?.label ?? experiment.metric).toLowerCase()

  let suggestedWinner: ExperimentWinner = "inconclusive"
  let reason: string
  if (a.n < EXPERIMENT_MIN_N || b.n < EXPERIMENT_MIN_N) {
    reason = t("needs_posts", { min: EXPERIMENT_MIN_N, a: a.n, b: b.n })
  } else if (lift === null) {
    reason = t("zero_baseline", { metric: label })
  } else if (Math.abs(lift) < EXPERIMENT_MIN_LIFT) {
    reason = t("too_close", { min: EXPERIMENT_MIN_LIFT, lift: `${lift > 0 ? "+" : ""}${lift}` })
  } else if (lift > 0) {
    suggestedWinner = "b"
    reason = t("b_wins", { lift, metric: label })
  } else {
    suggestedWinner = "a"
    reason = t("a_wins", { lift: Math.abs(lift), metric: label })
  }
  return { metric: experiment.metric, a, b, lift, suggestedWinner, reason }
}
