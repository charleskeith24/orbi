"use client"

import { format } from "date-fns"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { ChartTooltipCard, SERIES_ORDER, SeriesLegend, seriesColor, type ChartColor } from "@/components/charts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { INCOME_SOURCE_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { incomeSourceMessages } from "@/lib/i18n/messages/money"
import type { IncomeSource } from "@/lib/types"
import { formatMoney } from "@/lib/utils"
import { moneyOverviewMessages } from "./messages"
import type { MonthSourceRow } from "./money-model"

/** A source keeps its hue everywhere: fixed categorical order by source, never by rank. */
export const sourceColor = (source: IncomeSource): ChartColor => SERIES_ORDER[INCOME_SOURCE_IDS.indexOf(source)] ?? "other"

const AXIS_TICK = { fill: "var(--chart-muted)", fontSize: 11, fontVariantNumeric: "tabular-nums" } as const

type ChartRow = Record<IncomeSource, number> & { key: string; label: string; total: number; bottom: IncomeSource | null; top: IncomeSource | null }

/** Stacked monthly columns by income source (≤24px, 4px rounded top, 2px gaps between segments, one y-axis). */
export function IncomeSourceChart({ rows, currency, height = 240 }: { rows: MonthSourceRow[]; currency: string; height?: number }) {
  const t = useT(moneyOverviewMessages)
  const sourceLabel = useT(incomeSourceMessages)
  const sources = useMemo(() => INCOME_SOURCE_IDS.filter((s) => rows.some((r) => r.bySource[s] > 0)), [rows])
  const data = useMemo<ChartRow[]>(
    () =>
      rows.map((r) => {
        const present = sources.filter((s) => r.bySource[s] > 0)
        return {
          ...r.bySource,
          key: r.month,
          label: format(r.start, "MMM"),
          total: r.total,
          bottom: present[0] ?? null,
          top: present[present.length - 1] ?? null,
        }
      }),
    [rows, sources]
  )
  const money = (value: number) => formatMoney(value, currency)

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const row = active ? (payload?.[0]?.payload as ChartRow | undefined) : undefined
    if (!row) return null
    return (
      <ChartTooltipCard
        title={format(rows.find((r) => r.month === row.key)?.start ?? new Date(), "MMMM yyyy")}
        rows={[...sources]
          .reverse()
          .filter((s) => row[s] > 0)
          .map((s) => ({ key: s, label: sourceLabel(s), value: money(row[s]), color: sourceColor(s), mark: "rect" as const }))}
        footer={`${t("total")} ${money(row.total)}`}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ChartContainer config={{}} className="aspect-auto w-full" style={{ height }}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%" accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} tick={{ style: AXIS_TICK }} tickMargin={8} interval={0} />
          <YAxis
            width="auto"
            tickLine={false}
            axisLine={false}
            tick={{ style: AXIS_TICK }}
            tickMargin={4}
            tickFormatter={(value) => formatMoney(Number(value), currency, { compact: true })}
            domain={[0, "auto"]}
          />
          <ChartTooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={renderTooltip} isAnimationActive={false} wrapperStyle={{ outline: "none" }} />
          {sources.map((source) => (
            <Bar
              key={source}
              dataKey={source}
              name={sourceLabel(source)}
              stackId="income"
              maxBarSize={24}
              isAnimationActive={false}
              fill={seriesColor(sourceColor(source))}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; index: number }) => {
                const row = data[props.index]
                const h = props.height ?? 0
                if (!row || h <= 0) return <g />
                const isTop = row.top === source
                const isBottom = row.bottom === source
                const gap = isBottom || h <= 2 ? 0 : 2
                return (
                  <Rectangle
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={h - gap}
                    radius={isTop ? [4, 4, 0, 0] : 0}
                    fill={seriesColor(sourceColor(source))}
                  />
                )
              }}
            />
          ))}
        </BarChart>
      </ChartContainer>
      {sources.length > 1 ? (
        <SeriesLegend
          items={sources.map((s) => ({
            key: s,
            label: sourceLabel(s),
            color: sourceColor(s),
            value: formatMoney(
              rows.reduce((acc, r) => acc + r.bySource[s], 0),
              currency,
              { compact: true }
            ),
          }))}
        />
      ) : null}
    </div>
  )
}
