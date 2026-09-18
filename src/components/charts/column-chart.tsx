"use client"

import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { seriesColor, type ChartColor } from "@/components/charts/colors"
import { EmptyChart } from "@/components/charts/empty-chart"
import { chartMessages } from "@/components/charts/messages"
import { ChartTooltipCard } from "@/components/charts/primitives"
import { AXIS_TICK_STYLE, defaultValueFormatter, formatAxisValue } from "@/components/charts/utils"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { useT } from "@/lib/i18n"
import { cn, truncate } from "@/lib/utils"

export interface ColumnDatum {
  label: string
  value: number
  /** Only when the category has an identity color (pillar, campaign…); otherwise the series color. */
  color?: ChartColor
  id?: string
}

export interface ColumnChartProps {
  data: ColumnDatum[]
  /** SVG height including the x-axis band. */
  height?: number
  /** One series, one color (default blue). */
  color?: ChartColor
  valueFormatter?: (value: number) => string
  axisFormatter?: (value: number) => string
  /** id or label of the column to emphasize; the others recede. */
  highlight?: string
  /** Value labels on column caps — "highlight" (default) labels only the emphasized column. */
  labels?: "none" | "highlight" | "all"
  /** Measure name in the tooltip, e.g. "Posts". */
  valueLabel?: string
  emptyMessage?: string
  className?: string
  "aria-label"?: string
}

type Row = ColumnDatum & { key: string }

/** Vertical columns for ordered categories (weekdays, weeks, hours): ≤24px wide, 4px rounded tops. */
export function ColumnChart({
  data,
  height = 220,
  color = "blue",
  valueFormatter = defaultValueFormatter,
  axisFormatter = formatAxisValue,
  highlight,
  labels = "highlight",
  valueLabel: valueLabelProp,
  emptyMessage,
  className,
  "aria-label": ariaLabel,
}: ColumnChartProps) {
  const t = useT(chartMessages)
  const valueLabel = valueLabelProp ?? t("value")
  if (!data.length) return <EmptyChart message={emptyMessage ?? t("no_data_yet")} height={height} className={className} />

  const rows: Row[] = data.map((d, i) => ({ ...d, key: d.id ?? `${d.label}-${i}` }))
  const isHighlighted = (d: ColumnDatum | undefined) =>
    !!d && highlight !== undefined && (d.id === highlight || d.label === highlight)
  const hasHighlight = rows.some(isHighlighted)
  const showLabels = labels === "all" || (labels === "highlight" && hasHighlight)
  const integers = rows.every((d) => Number.isInteger(d.value))
  const maxValue = Math.max(0, ...rows.map((d) => d.value))
  const minValue = Math.min(0, ...rows.map((d) => d.value))

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const datum = active ? (payload?.[0]?.payload as Row | undefined) : undefined
    if (!datum) return null
    return (
      <ChartTooltipCard
        title={datum.label}
        rows={[
          { key: "value", label: valueLabel, value: valueFormatter(datum.value), color: datum.color ?? color },
        ]}
      />
    )
  }

  const renderLabel = (props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
    const datum = props.index === undefined ? undefined : rows[props.index]
    if (!datum || (labels === "highlight" && !isHighlighted(datum))) return null
    const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2
    return (
      <text
        x={x}
        y={Number(props.y ?? 0) - 6}
        textAnchor="middle"
        style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
      >
        {valueFormatter(datum.value)}
      </text>
    )
  }

  return (
    <ChartContainer
      config={{ value: { label: valueLabel } }}
      className={cn("aspect-auto w-full", className)}
      style={{ height }}
    >
      <BarChart
        data={rows}
        margin={{ top: showLabels ? 20 : 8, right: 4, bottom: 0, left: 0 }}
        barCategoryGap="24%"
        title={ariaLabel}
      >
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tick={{ style: AXIS_TICK_STYLE }}
          tickMargin={8}
          interval={rows.length > 12 ? "preserveStartEnd" : 0}
          tickFormatter={(value) => truncate(String(value), 12)}
        />
        <YAxis
          width="auto"
          tickLine={false}
          axisLine={false}
          tick={{ style: AXIS_TICK_STYLE }}
          tickFormatter={(value) => axisFormatter(Number(value))}
          tickMargin={4}
          allowDecimals={!integers}
          domain={[minValue < 0 ? "auto" : 0, maxValue > 0 ? "auto" : 1]}
        />
        <ChartTooltip cursor={{ fillOpacity: 0.7 }} content={renderTooltip} isAnimationActive={false} wrapperStyle={{ outline: "none" }} />
        <Bar
          dataKey="value"
          maxBarSize={24}
          isAnimationActive={false}
          shape={(props: { x?: number; y?: number; width?: number; height?: number; index: number; isActive: boolean }) => {
            const datum = rows[props.index]
            const faded = hasHighlight && !isHighlighted(datum)
            return (
              <Rectangle
                x={props.x}
                y={props.y}
                width={props.width}
                height={props.height}
                radius={[4, 4, 0, 0]}
                fill={seriesColor(datum?.color ?? color)}
                fillOpacity={faded ? (props.isActive ? 0.55 : 0.35) : props.isActive ? 0.85 : 1}
              />
            )
          }}
        >
          {showLabels ? <LabelList dataKey="value" position="top" content={renderLabel} /> : null}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
