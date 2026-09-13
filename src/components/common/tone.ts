import { CircleAlert, CircleCheck, CircleDashed, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react"
import type { StatusTone } from "@/components/common/types"

/** Foreground ink for status text and icons. */
export const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-good-fg",
  warning: "text-warning-fg",
  serious: "text-serious-fg",
  critical: "text-critical-fg",
  neutral: "text-muted-foreground",
}

/** Soft status wash for pills and callouts. */
export const TONE_SOFT: Record<StatusTone, string> = {
  good: "bg-good/10 dark:bg-good/15",
  warning: "bg-warning/15 dark:bg-warning/15",
  serious: "bg-serious/12 dark:bg-serious/15",
  critical: "bg-critical/10 dark:bg-critical/20",
  neutral: "bg-muted",
}

/** Solid fill for bars, rings and dots. */
export const TONE_FILL: Record<StatusTone, string> = {
  good: "bg-good",
  warning: "bg-warning",
  serious: "bg-serious",
  critical: "bg-critical",
  neutral: "bg-muted-foreground",
}

export const TONE_STROKE: Record<StatusTone, string> = {
  good: "stroke-good",
  warning: "stroke-warning",
  serious: "stroke-serious",
  critical: "stroke-critical",
  neutral: "stroke-muted-foreground",
}

/** Default icon per tone — status is always icon + label, never colour alone. */
export const TONE_ICON: Record<StatusTone, LucideIcon> = {
  good: CircleCheck,
  warning: TriangleAlert,
  serious: CircleAlert,
  critical: OctagonAlert,
  neutral: CircleDashed,
}

/** Score 0–100 → tone, using the Content Health bands (80 / 60 / 40). */
export function toneForScore(score: number | null | undefined): StatusTone {
  if (score === null || score === undefined || Number.isNaN(score)) return "neutral"
  if (score >= 80) return "good"
  if (score >= 60) return "warning"
  if (score >= 40) return "serious"
  return "critical"
}
