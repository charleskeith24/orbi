import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import Link from "next/link"
import { TONE_ICON, TONE_TEXT } from "@/components/common/tone"
import type { IconComponent, StatusTone } from "@/components/common/types"
import { cn, formatDelta } from "@/lib/utils"

/**
 * Tiny inline trend line in muted ink; the latest point is marked in the brand colour.
 * Decorative — pair it with the number it summarises.
 */
export function Sparkline({
  values,
  width = 72,
  height = 24,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  const points = values.filter((v) => Number.isFinite(v))
  if (points.length < 2) return null
  const pad = 3
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2)
    const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2)
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const
  })
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ")
  const [lx, ly] = coords[coords.length - 1]
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn("shrink-0 overflow-visible text-muted-foreground/60", className)}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.75} className="fill-brand stroke-card" strokeWidth={1.5} />
    </svg>
  )
}

/** Signed change with direction arrow; colour follows whether the change is good. */
export function Delta({
  value,
  positiveIsGood = true,
  suffix = "%",
  className,
}: {
  value: number | null | undefined
  positiveIsGood?: boolean
  suffix?: string
  className?: string
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>
  }
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat"
  const good = direction === "flat" ? null : (direction === "up") === positiveIsGood
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium num",
        good === null ? "text-muted-foreground" : good ? "text-good-fg" : "text-critical-fg",
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{direction === "up" ? "Up" : direction === "down" ? "Down" : "No change"}</span>
      {formatDelta(rounded, Math.abs(rounded) >= 100 || Number.isInteger(rounded) ? 0 : 1, suffix)}
    </span>
  )
}

/** Announced with a toned tile so the status isn't carried by icon colour alone. */
const TONE_LABEL: Record<Exclude<StatusTone, "neutral">, string> = {
  good: "good",
  warning: "needs attention",
  serious: "at risk",
  critical: "critical",
}

export interface StatTileProps {
  label: React.ReactNode
  value: React.ReactNode
  sublabel?: React.ReactNode
  /** % change vs. the comparison period. */
  delta?: number | null
  deltaPositiveIsGood?: boolean
  /** Text after the delta, e.g. "vs last week". */
  deltaLabel?: React.ReactNode
  deltaSuffix?: string
  trend?: number[]
  icon?: IconComponent
  href?: string
  /** Status tone for the icon (defaults to the tone's icon when none is given). */
  tone?: StatusTone
  className?: string
}

/** One number with context: label, value, change and an optional sparkline. */
export function StatTile({
  label,
  value,
  sublabel,
  delta,
  deltaPositiveIsGood = true,
  deltaLabel,
  deltaSuffix,
  trend,
  icon,
  href,
  tone,
  className,
}: StatTileProps) {
  const Icon = icon ?? (tone && tone !== "neutral" ? TONE_ICON[tone] : undefined)
  const hasFooter = delta !== undefined || deltaLabel || sublabel
  const body = (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {Icon ? (
          <Icon className={cn("size-4 shrink-0", tone ? TONE_TEXT[tone] : "text-muted-foreground")} aria-hidden />
        ) : null}
        {tone && tone !== "neutral" ? <span className="sr-only">Status: {TONE_LABEL[tone]}</span> : null}
      </div>
      <div className="flex min-w-0 items-end justify-between gap-3">
        <span className="truncate text-2xl leading-8 font-semibold tracking-tight">{value}</span>
        {trend && trend.length > 1 ? <Sparkline values={trend} className="mb-1.5" /> : null}
      </div>
      {hasFooter ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {delta !== undefined ? (
            <Delta value={delta} positiveIsGood={deltaPositiveIsGood} suffix={deltaSuffix} />
          ) : null}
          {deltaLabel ? <span>{deltaLabel}</span> : null}
          {sublabel ? (
            <span className={cn("min-w-0 truncate", (delta !== undefined || deltaLabel) && "before:mr-1.5 before:content-['·']")}>
              {sublabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  )

  const base = "flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground"
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "transition-colors outline-none hover:border-foreground/15 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {body}
      </Link>
    )
  }
  return <div className={cn(base, className)}>{body}</div>
}
