import type { ReportHighlight } from "@/lib/analytics"
import { WINNER_METRIC_MAP } from "@/lib/constants"
import type { WinnerMetric } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"

/** "12,137 avg. views", "8.4% engagement rate", "0.5 leads per post", "1.8× platform baseline". */
export function formatHighlightMetric(h: Pick<ReportHighlight, "value" | "metricLabel">): string {
  const label = h.metricLabel
  if (label.startsWith("×")) return `${h.value.toFixed(1)}${label}`
  if (/rate/i.test(label)) return `${formatPercent(h.value)} ${label}`
  if (/per post|kada post/i.test(label)) return `${h.value.toFixed(1)} ${label}`
  return `${formatNumber(h.value)} ${label}`
}

/** "views", "engagement rate", "composite"… for "ranked by …" captions. */
export function rankedByLabel(metric: WinnerMetric): string {
  return (WINNER_METRIC_MAP[metric]?.label ?? "Views").toLowerCase()
}

/** 2.14 → "2.1×"; null → "—". */
export function formatRatio(ratio: number | null | undefined): string {
  return ratio === null || ratio === undefined || !Number.isFinite(ratio) ? "—" : `${ratio.toFixed(1)}×`
}
