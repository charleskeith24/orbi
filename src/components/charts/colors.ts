import { CATEGORICAL_COLORS, PLATFORM_IDS } from "@/lib/constants"
import type { CategoricalColor, PlatformId } from "@/lib/types"

/** A mark color: one of the 8 categorical slots, or the neutral "other" used for a folded tail. */
export type ChartColor = CategoricalColor | "other"

/** A chart color name, or any CSS color (e.g. a ramp step from `ordinalColor`). */
export type ColorInput = ChartColor | (string & Record<never, never>)

/** Reserved status meaning — always pair with an icon and a label, never color alone. */
export type StatusTone = "good" | "warning" | "serious" | "critical"

/** Fixed categorical order. Assign in sequence; never cycle past 8 — fold the tail into "Other". */
export const SERIES_ORDER: readonly CategoricalColor[] = CATEGORICAL_COLORS

/** Most series one chart may carry. */
export const MAX_SERIES = SERIES_ORDER.length

/** Surface behind marks (end-dot rings, segment gaps). `ChartFrame` sets it to the card color. */
export const CHART_SURFACE = "var(--chart-surface, var(--card))"

const CHART_COLOR_NAMES = new Set<string>([...CATEGORICAL_COLORS, "other"])

/** CSS color of a series mark — theme-aware through `--cat-*`, so dark mode needs no re-render. */
export function seriesColor(color: ChartColor): string {
  return color === "other" ? "var(--chart-muted)" : `var(--cat-${color})`
}

/** Resolves a chart color name to CSS; passes any other CSS color through. */
export function resolveColor(color: ColorInput): string {
  return CHART_COLOR_NAMES.has(color) ? seriesColor(color as ChartColor) : color
}

/** Slot for the n-th series without an identity color; `null` past 8 (fold the rest into "Other"). */
export function seriesColorAt(index: number): CategoricalColor | null {
  return SERIES_ORDER[index] ?? null
}

/** Stable color per platform, so a platform keeps its hue across every chart and filter. */
export function platformColor(platform: PlatformId): CategoricalColor {
  return SERIES_ORDER[PLATFORM_IDS.indexOf(platform)] ?? "blue"
}

/** Status fill for marks. */
export function statusColor(tone: StatusTone): string {
  return `var(--${tone})`
}

/** Status ink for text and icons (clears contrast on the surface). */
export function statusTextColor(tone: StatusTone): string {
  return `var(--${tone}-fg)`
}

/** Sequential magnitude for t ∈ [0, 1]: brand blue mixed into the chart surface (the low end recedes). */
export function sequentialColor(t: number): string {
  const pct = Math.round(14 + 86 * Math.min(1, Math.max(0, t)))
  return `color-mix(in oklch, var(--brand) ${pct}%, ${CHART_SURFACE})`
}

/**
 * Ordinal step `index` of `count` (0 = strongest): one hue, monotone lightness. The lightest step stays
 * at 55% brand so it clears 2:1 on the surface in both themes; steps separate cleanly up to 4 stages,
 * beyond that the stage labels carry the order.
 */
export function ordinalColor(index: number, count: number): string {
  const t = count <= 1 ? 0 : Math.min(1, Math.max(0, index / (count - 1)))
  const pct = Math.round(100 - 45 * t)
  return pct >= 100 ? "var(--brand)" : `color-mix(in oklch, var(--brand) ${pct}%, ${CHART_SURFACE})`
}

// Ink vs white picked per slot and theme by WCAG contrast against the fill.
const ON_COLOR_TEXT: Record<ChartColor, string> = {
  blue: "text-white dark:text-neutral-950",
  orange: "text-neutral-950",
  aqua: "text-neutral-950",
  yellow: "text-neutral-950",
  magenta: "text-neutral-950",
  green: "text-white",
  violet: "text-white dark:text-neutral-950",
  red: "text-neutral-950",
  other: "text-neutral-950",
}

/** Text classes that stay legible on a filled mark of this color (in-segment labels only). */
export function onColorTextClass(color: ColorInput): string {
  return CHART_COLOR_NAMES.has(color) ? ON_COLOR_TEXT[color as ChartColor] : "text-neutral-950"
}
