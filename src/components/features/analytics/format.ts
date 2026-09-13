/**
 * Display helpers shared by the analytics views (pure — safe in tests).
 */
import { formatCompact, formatDuration, formatNumber, formatPercent } from "@/lib/utils"

export type ValueKind = "count" | "percent" | "duration" | "multiple"

/** One formatter for every metric cell: counts, percentages (0–100), seconds and tier multiples. */
export function formatValue(value: number | null | undefined, kind: ValueKind, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  switch (kind) {
    case "percent":
      return formatPercent(value)
    case "duration":
      return formatWatchTime(value)
    case "multiple":
      return formatRatio(value)
    default:
      return compact ? formatCompact(value) : formatNumber(value)
  }
}

/** Total watch time: 45 → "45s", 95 → "1:35", 356,402 → "99.0h" (clock format stops being readable past an hour). */
export function formatWatchTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—"
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return formatDuration(seconds)
  return `${HOURS_FORMAT.format(seconds / 3600)}h`
}

const HOURS_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

/** 1.834 → "1.8×". */
export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return `${(Math.round(value * 10) / 10).toFixed(1)}×`
}

/** Fixed-precision number for exports (no thousands separators); null stays null. */
export function roundOrNull(value: number | null | undefined, digits = 2): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** 0 → "12a", 13 → "1p" (heatmap column labels). */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`
}

/** 0 → "12 AM", 20 → "8 PM". */
export function hourLongLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`
}
