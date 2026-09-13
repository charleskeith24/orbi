"use client"

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { CHART_SURFACE, MAX_SERIES, seriesColor, type ChartColor } from "@/components/charts/colors"
import { EmptyChart } from "@/components/charts/empty-chart"
import { ChartTooltipCard, SeriesLegend } from "@/components/charts/primitives"
import {
  AXIS_TICK_STYLE,
  defaultValueFormatter,
  estimateTextWidth,
  formatAxisValue,
  isFiniteNumber,
} from "@/components/charts/utils"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { formatDate } from "@/lib/dates"
import type { ISODate } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface TrendSeries {
  /** Field on each datum. */
  key: string
  label: string
  /** Identity color (pillar/platform/campaign) or the next slot in `SERIES_ORDER`. */
  color: ChartColor
}

/** One point in time; series values are numbers (`null` leaves a gap). */
export type TrendDatum = { date: ISODate; [series: string]: number | string | null }

export interface TrendChartProps {
  data: TrendDatum[]
  /** At most 8 — fold the tail into "Other" before passing it in. */
  series: TrendSeries[]
  type?: "line" | "area"
  /** SVG height including the x-axis band. The legend (2+ series) adds its own row above. */
  height?: number
  /** Tooltip and end-label values. */
  valueFormatter?: (value: number) => string
  /** Y-axis ticks (compact by default). */
  axisFormatter?: (value: number) => string
  /** X-axis ticks (default "Sep 8"). */
  dateFormatter?: (date: ISODate) => string
  /** Tooltip heading (default "Sep 8, 2026"). */
  tooltipDateFormatter?: (date: ISODate) => string
  /** Direct-label the latest value at the line end (default: on for a single series). */
  endLabel?: boolean
  emptyMessage?: string
  className?: string
  "aria-label"?: string
}

const shortDate = (date: ISODate) => formatDate(date, "MMM d")
const longDate = (date: ISODate) => formatDate(date, "MMM d, yyyy")

/** Change over time: 2px lines (or 10% area wash), crosshair tooltip listing every series, one y-axis. */
export function TrendChart({
  data,
  series: seriesProp,
  type = "line",
  height = 240,
  valueFormatter = defaultValueFormatter,
  axisFormatter = formatAxisValue,
  dateFormatter = shortDate,
  tooltipDateFormatter = longDate,
  endLabel,
  emptyMessage = "No data for this period yet.",
  className,
  "aria-label": ariaLabel,
}: TrendChartProps) {
  const series = seriesProp.slice(0, MAX_SERIES)
  const lastIndex = new Map<string, number>()
  let min = Infinity
  let max = -Infinity
  let integers = true
  for (const s of series) {
    data.forEach((row, i) => {
      const value = row[s.key]
      if (!isFiniteNumber(value)) return
      lastIndex.set(s.key, i)
      min = Math.min(min, value)
      max = Math.max(max, value)
      if (!Number.isInteger(value)) integers = false
    })
  }

  if (!data.length || !lastIndex.size) {
    return <EmptyChart message={emptyMessage} height={height} className={className} />
  }

  const showEndLabel = endLabel ?? series.length === 1
  const endLabelWidth = showEndLabel
    ? Math.max(
        0,
        ...series.map((s) => {
          const value = data[lastIndex.get(s.key) ?? -1]?.[s.key]
          return isFiniteNumber(value) ? estimateTextWidth(valueFormatter(value)) : 0
        })
      )
    : 0
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label }]))

  const endDot = (s: TrendSeries) =>
    function EndDot(props: { cx?: number; cy?: number; index: number }) {
      if (props.index !== lastIndex.get(s.key) || props.cx === undefined || props.cy === undefined) return null
      const value = data[props.index]?.[s.key]
      return (
        <g key={`end-${s.key}`}>
          <circle cx={props.cx} cy={props.cy} r={4} fill={seriesColor(s.color)} stroke={CHART_SURFACE} strokeWidth={2} />
          {showEndLabel && isFiniteNumber(value) ? (
            <text
              x={props.cx + 9}
              y={props.cy}
              dy="0.32em"
              style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
            >
              {valueFormatter(value)}
            </text>
          ) : null}
        </g>
      )
    }

  const renderTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const byKey = new Map(payload.map((entry) => [String(entry.dataKey), entry.value]))
    return (
      <ChartTooltipCard
        title={tooltipDateFormatter(String(label))}
        rows={series.map((s) => {
          const value = byKey.get(s.key)
          return {
            key: s.key,
            label: s.label,
            color: s.color,
            mark: "line",
            value: isFiniteNumber(value) ? valueFormatter(value) : "—",
          }
        })}
      />
    )
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {series.length >= 2 ? (
        <SeriesLegend
          items={series.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
          mark={type === "area" ? "rect" : "line"}
        />
      ) : null}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: showEndLabel ? endLabelWidth + 16 : 10, bottom: 0, left: 0 }}
          title={ariaLabel}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-axis)" }}
            tick={{ style: AXIS_TICK_STYLE }}
            tickFormatter={(value) => dateFormatter(String(value))}
            tickMargin={8}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            width="auto"
            tickLine={false}
            axisLine={false}
            tick={{ style: AXIS_TICK_STYLE }}
            tickFormatter={(value) => axisFormatter(Number(value))}
            tickMargin={4}
            allowDecimals={!integers}
            domain={min >= 0 ? [0, max > 0 ? "auto" : 1] : ["auto", "auto"]}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1, style: { stroke: "var(--chart-axis)" } }}
            content={renderTooltip}
            isAnimationActive={false}
            wrapperStyle={{ outline: "none" }}
          />
          {series.map((s) => {
            const color = seriesColor(s.color)
            const activeDot = { r: 4, fill: color, stroke: CHART_SURFACE, strokeWidth: 2 }
            return type === "area" ? (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={color}
                fillOpacity={0.1}
                dot={endDot(s)}
                activeDot={activeDot}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={endDot(s)}
                activeDot={activeDot}
                isAnimationActive={false}
              />
            )
          })}
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
