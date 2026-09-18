"use client"

import { Pie, PieChart, Sector, type PieSectorShapeProps, type TooltipContentProps } from "recharts"
import { CHART_SURFACE, seriesColor, type ChartColor } from "@/components/charts/colors"
import { EmptyChart } from "@/components/charts/empty-chart"
import { chartMessages } from "@/components/charts/messages"
import { ChartTooltipCard, SeriesKey } from "@/components/charts/primitives"
import { defaultValueFormatter, foldToOther, formatShare, type ChartPart } from "@/components/charts/utils"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { useT } from "@/lib/i18n"
import { cn, sum } from "@/lib/utils"

export interface DonutSegment {
  id: string
  label: string
  value: number
  color: ChartColor
}

export interface DonutChartProps {
  /** Part-to-whole, at most 6 — smaller tails fold into "Other". Prefer MixBar when values are close. */
  segments: DonutSegment[]
  centerLabel?: string
  centerValue?: string
  /** Diameter in px. */
  size?: number
  valueFormatter?: (value: number) => string
  /** Measure name in the tooltip, e.g. "Posts". */
  valueLabel?: string
  showLegend?: boolean
  emptyMessage?: string
  className?: string
  "aria-label"?: string
}

const MAX_SEGMENTS = 6

/** Donut with 2px surface gaps, a center figure and a value + share legend. */
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 168,
  valueFormatter = defaultValueFormatter,
  valueLabel: valueLabelProp,
  showLegend = true,
  emptyMessage,
  className,
  "aria-label": ariaLabel,
}: DonutChartProps) {
  const t = useT(chartMessages)
  const valueLabel = valueLabelProp ?? t("value")
  const total = sum(segments.map((s) => Math.max(0, s.value)))
  if (!(total > 0)) return <EmptyChart message={emptyMessage ?? t("nothing_to_show")} height={size} className={className} />

  const parts: ChartPart[] = foldToOther(
    segments.filter((s) => s.value > 0),
    MAX_SEGMENTS,
    t("other")
  )
  const config: ChartConfig = Object.fromEntries(parts.map((p) => [p.id, { label: p.label }]))

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const hovered = active ? (payload?.[0]?.payload as Partial<ChartPart> | undefined) : undefined
    const part = parts.find((p) => p.id === hovered?.id)
    if (!part) return null
    return (
      <ChartTooltipCard
        title={part.label}
        rows={[
          { key: "value", label: valueLabel, value: valueFormatter(part.value), color: part.color },
          { key: "share", label: t("of_total"), value: formatShare(part.value, total) },
        ]}
      />
    )
  }

  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ChartContainer
          config={config}
          className="aspect-square size-full"
          initialDimension={{ width: size, height: size }}
        >
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }} title={ariaLabel}>
            <ChartTooltip content={renderTooltip} isAnimationActive={false} wrapperStyle={{ outline: "none", zIndex: 10 }} />
            <Pie
              data={parts}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              shape={(props: PieSectorShapeProps) => (
                <Sector
                  {...props}
                  fill={seriesColor(parts[props.index]?.color ?? "other")}
                  stroke={CHART_SURFACE}
                  strokeWidth={2}
                  outerRadius={props.isActive ? props.outerRadius + 3 : props.outerRadius}
                />
              )}
            />
          </PieChart>
        </ChartContainer>
        {centerValue || centerLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue ? <span className="text-xl leading-none font-semibold">{centerValue}</span> : null}
            {centerLabel ? (
              <span className="mt-1 max-w-[60%] truncate text-xs text-muted-foreground">{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {showLegend ? (
        <ul role="list" className="grid w-full min-w-0 flex-1 gap-2 text-xs">
          {parts.map((part) => (
            <li key={part.id} className="flex min-w-0 items-center gap-2">
              <SeriesKey color={part.color} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{part.label}</span>
              <span className="num font-medium text-foreground">{valueFormatter(part.value)}</span>
              <span className="num w-9 text-right text-muted-foreground">{formatShare(part.value, total)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
