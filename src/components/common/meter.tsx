"use client"

import { catVar } from "@/components/common/color"
import { meterMessages } from "@/components/common/messages"
import { TONE_FILL, TONE_STROKE, toneForScore } from "@/components/common/tone"
import type { StatusTone } from "@/components/common/types"
import { useT } from "@/lib/i18n"
import type { CategoricalColor } from "@/lib/types"
import { clamp, cn, formatNumber } from "@/lib/utils"

export type MeterTone = "brand" | Exclude<StatusTone, "neutral"> | "neutral"

const METER_FILL: Record<MeterTone, string> = { brand: "bg-brand", ...TONE_FILL }
const RING_STROKE: Record<MeterTone, string> = { brand: "stroke-brand", ...TONE_STROKE }

export interface MeterProps {
  value: number
  max?: number
  tone?: MeterTone
  /** Identity colour (e.g. a pillar) — overrides `tone`. */
  color?: CategoricalColor
  label?: React.ReactNode
  showValue?: boolean
  /** Visible + announced value text. Defaults to the percentage of `max`. */
  valueText?: string
  /** Draws a target tick at this value (same scale as `value`). */
  target?: number
  size?: "sm" | "default"
  className?: string
  "aria-label"?: string
}

/** Horizontal progress/quantity bar. Accessible as `role="meter"`. */
export function Meter({
  value,
  max = 100,
  tone = "brand",
  color,
  label,
  showValue = false,
  valueText,
  target,
  size = "default",
  className,
  "aria-label": ariaLabel,
}: MeterProps) {
  const safeMax = max > 0 ? max : 1
  const pct = clamp((value / safeMax) * 100, 0, 100)
  const targetPct = target === undefined ? null : clamp((target / safeMax) * 100, 0, 100)
  const text = valueText ?? `${Math.round((value / safeMax) * 100)}%`
  const name = ariaLabel ?? (typeof label === "string" ? label : undefined)

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
          {label ? <span className="min-w-0 truncate text-muted-foreground">{label}</span> : <span />}
          {showValue ? <span className="shrink-0 font-medium num text-foreground">{text}</span> : null}
        </div>
      ) : null}
      <div
        role="meter"
        aria-label={name}
        aria-valuenow={clamp(Number.isFinite(value) ? value : 0, 0, safeMax)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuetext={text}
        className={cn("relative w-full", size === "sm" ? "h-1" : "h-1.5")}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted dark:bg-input/60">
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", !color && METER_FILL[tone])}
            style={{ width: `${pct}%`, ...(color ? { backgroundColor: catVar(color) } : null) }}
          />
        </div>
        {targetPct !== null ? (
          <div
            aria-hidden
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/55"
            style={{ left: `${targetPct}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}

export interface ScoreRingProps {
  /** 0–100; `null` renders an empty ring with "—". */
  value: number | null
  size?: number
  strokeWidth?: number
  /** Accessible name; also shown inside the ring when `size` ≥ 72. */
  label?: string
  /** `auto` picks good / warning / serious / critical from the Content Health bands. */
  tone?: MeterTone | "auto"
  className?: string
}

/** Circular 0–100 score (Content Score, Health Score). Accessible as `role="meter"`. */
export function ScoreRing({ value, size = 48, strokeWidth = 4, label, tone = "brand", className }: ScoreRingProps) {
  const t = useT(meterMessages)
  const score = value === null || Number.isNaN(value) ? null : clamp(value, 0, 100)
  const resolvedTone: MeterTone = tone === "auto" ? toneForScore(score) : tone
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = score === null ? circumference : circumference * (1 - score / 100)
  const numberClass =
    size >= 96 ? "text-2xl" : size >= 72 ? "text-xl" : size >= 56 ? "text-base" : size >= 40 ? "text-sm" : "text-[10px]"
  const showLabel = Boolean(label) && size >= 72

  return (
    <div
      role="meter"
      aria-label={label ?? t("score")}
      aria-valuenow={score ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={score === null ? t("not_scored") : t("out_of_100", { score: Math.round(score) })}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted dark:stroke-input"
        />
        {score !== null && score > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-[stroke-dashoffset] duration-500", RING_STROKE[resolvedTone])}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={cn("font-semibold tracking-tight num", numberClass)}>
          {score === null ? "—" : formatNumber(score)}
        </span>
        {showLabel ? <span className="mt-1 max-w-[80%] truncate text-[11px] text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  )
}
