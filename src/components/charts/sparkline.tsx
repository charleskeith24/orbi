"use client"

import { CHART_SURFACE, seriesColor, type ChartColor } from "@/components/charts/colors"
import { chartMessages } from "@/components/charts/messages"
import { useT } from "@/lib/i18n"
import { formatNumber, cn } from "@/lib/utils"

export interface SparklineProps {
  /** Oldest → newest. `null` leaves a gap. */
  values: (number | null | undefined)[]
  /** Size it with classes (default `h-6 w-20`). */
  className?: string
  /** De-emphasis gray by default; a series color when the line carries identity. */
  color?: ChartColor | "muted"
  /** Accent dot on the latest value (the current period). */
  highlightLast?: boolean
  /** ~10% wash under the line. */
  area?: boolean
  "aria-label"?: string
}

const VIEW_W = 100
const VIEW_H = 32
const PAD = 3

/** Tiny inline trend (plain SVG, no Recharts) for stat tiles and table cells. */
export function Sparkline({
  values,
  className,
  color = "muted",
  highlightLast = false,
  area = false,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const t = useT(chartMessages)
  const points = values.map((v, i) => ({ i, v: typeof v === "number" && Number.isFinite(v) ? v : null }))
  const finite = points.filter((p): p is { i: number; v: number } => p.v !== null)
  const stroke = color === "muted" ? "var(--chart-muted)" : seriesColor(color)
  const label =
    ariaLabel ??
    (finite.length
      ? t("trend_from", { from: formatNumber(finite[0].v), to: formatNumber(finite[finite.length - 1].v) })
      : t("no_trend"))

  if (finite.length === 0) {
    return (
      <span role="img" aria-label={label} className={cn("relative inline-block h-6 w-20 align-middle", className)}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-chart-grid" />
      </span>
    )
  }

  const min = Math.min(...finite.map((p) => p.v))
  const max = Math.max(...finite.map((p) => p.v))
  const n = values.length
  const x = (i: number) => (n <= 1 ? VIEW_W / 2 : (i / (n - 1)) * VIEW_W)
  const y = (v: number) => (max === min ? VIEW_H / 2 : PAD + (1 - (v - min) / (max - min)) * (VIEW_H - PAD * 2))

  let line = ""
  let penDown = false
  for (const p of points) {
    if (p.v === null) {
      penDown = false
      continue
    }
    line += `${penDown ? "L" : "M"}${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`
    penDown = true
  }
  const first = finite[0]
  const last = finite[finite.length - 1]
  const wash = area && finite.length > 1
    ? `M${x(first.i).toFixed(2)},${VIEW_H} ${finite.map((p) => `L${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ")} L${x(last.i).toFixed(2)},${VIEW_H} Z`
    : null

  return (
    <span role="img" aria-label={label} className={cn("relative inline-block h-6 w-20 align-middle", className)}>
      <svg
        aria-hidden
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        {wash ? <path d={wash} fill={stroke} fillOpacity={0.1} stroke="none" /> : null}
        <path
          d={finite.length === 1 ? `M${x(first.i) - 0.01},${y(first.v)}L${x(first.i) + 0.01},${y(first.v)}` : line}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {highlightLast ? (
        <span
          aria-hidden
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${(x(last.i) / VIEW_W) * 100}%`,
            top: `${(y(last.v) / VIEW_H) * 100}%`,
            background: "var(--brand)",
            boxShadow: `0 0 0 1.5px ${CHART_SURFACE}`,
          }}
        />
      ) : null}
    </span>
  )
}
