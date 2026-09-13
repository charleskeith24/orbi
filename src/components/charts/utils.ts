import type { ChartColor } from "@/components/charts/colors"
import { formatNumber, sum } from "@/lib/utils"

const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const plainFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

/** Compact axis ticks: 950 → "950", 2,500 → "2.5K", 1,200,000 → "1.2M". */
export function formatAxisValue(value: number): string {
  if (!Number.isFinite(value)) return ""
  return Math.abs(value) >= 1000 ? compactFormat.format(value) : plainFormat.format(value)
}

/** Default tooltip / label formatter: thousands-comma'd whole numbers. */
export function defaultValueFormatter(value: number): string {
  return formatNumber(value)
}

/** Whole-percent share of a total; tiny non-zero shares read "<1%". */
export function formatShare(value: number, total: number): string {
  if (!(total > 0)) return "—"
  const pct = (value / total) * 100
  if (pct > 0 && pct < 1) return "<1%"
  return `${Math.round(pct)}%`
}

/** Approximate rendered width of a label in the UI sans — decides whether an inline label fits. */
export function estimateTextWidth(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.6
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/** Axis tick text. Inline style so it wins over ChartContainer's class defaults. */
export const AXIS_TICK_STYLE = { fill: "var(--chart-muted)", fontSize: 11, fontVariantNumeric: "tabular-nums" } as const

export interface ChartPart {
  id: string
  label: string
  value: number
  color: ChartColor
}

/** Id of the neutral entry produced by `foldToOther`. */
export const OTHER_ID = "__other"

/**
 * Keeps at most `max` parts: the `max - 1` largest stay (in their original order) and the rest fold into
 * one neutral "Other" part — a chart never generates a 9th hue.
 */
export function foldToOther<T extends ChartPart>(parts: T[], max: number, otherLabel = "Other"): (T | ChartPart)[] {
  if (parts.length <= max) return parts
  const keep = new Set(
    [...parts]
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.max(0, max - 1))
      .map((p) => p.id)
  )
  const rest = parts.filter((p) => !keep.has(p.id))
  return [
    ...parts.filter((p) => keep.has(p.id)),
    { id: OTHER_ID, label: otherLabel, value: sum(rest.map((p) => p.value)), color: "other" },
  ]
}
