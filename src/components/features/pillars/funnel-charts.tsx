"use client"

import { CircleCheck, Scale, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { ChartFrame, FunnelBars, MixBar, type ChartTable } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { MIN_MIX_SAMPLE, type FunnelAggregate, type FunnelMix } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { FUNNEL_COLORS } from "./funnel-utils"
import { formatPoints, TARGET_TOTAL } from "./pillar-math"
import { SegmentedToggle, type SegmentOption } from "./segmented-toggle"

/** TOFU / MOFU / BOFU share of the window vs settings.funnel_targets, with warnings. */
export function FunnelDistributionCard({
  mix,
  windowLabel,
  targetTotal,
  onEditTargets,
}: {
  mix: FunnelMix
  windowLabel: string
  /** Raw sum of the funnel targets; a callout appears unless it is 100. */
  targetTotal: number
  onEditTargets: () => void
}) {
  const table: ChartTable = {
    columns: ["Stage", "Items", "Actual", "Target", "vs target"],
    rows: mix.rows.map((r) => [
      `${r.label} · ${FUNNEL_STAGES[r.stage].name}`,
      r.count,
      `${Math.round(r.actualPct)}%`,
      `${Math.round(r.targetPct)}%`,
      formatPoints(r.deviation),
    ]),
  }
  const description = [
    `Published in the ${windowLabel} plus scheduled for the next 7 days`,
    pluralize(mix.total, "item"),
    mix.unassigned ? `${mix.unassigned} without a stage` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <ChartFrame title="Distribution vs targets" description={description} table={table}>
      <div className="flex flex-col gap-4">
        <MixBar
          segments={mix.rows.map((r) => ({ id: r.stage, label: `${r.label} · ${FUNNEL_STAGES[r.stage].name}`, value: r.count, color: FUNNEL_COLORS[r.stage] }))}
          targets={mix.rows.map((r) => ({ id: r.stage, value: r.targetPct }))}
          valueLabel="Items"
          aria-label="Funnel mix, actual vs target"
          emptyMessage="Nothing with a funnel stage was published or scheduled in this window."
        />
        {targetTotal !== TARGET_TOTAL ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          >
            <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
            <span className="min-w-0 flex-1">
              Funnel targets add up to <strong className="num font-semibold">{targetTotal}%</strong> — set them to 100%.
            </span>
            <Button type="button" size="xs" variant="outline" onClick={onEditTargets}>
              <Scale aria-hidden />
              Edit targets
            </Button>
          </div>
        ) : null}
        {!mix.total ? null : !mix.enoughData ? (
          <p className="text-xs text-muted-foreground">Balance warnings start once {MIN_MIX_SAMPLE} or more items are in the window.</p>
        ) : mix.warnings.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="Funnel warnings">
            {mix.warnings.map((warning) => (
              <li key={warning.key} className="flex items-start gap-2 text-xs">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
                <span className="min-w-0">{warning.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-good-fg">
            <CircleCheck className="size-3.5 shrink-0" aria-hidden />
            Every stage is within its target range.
          </p>
        )}
      </div>
    </ChartFrame>
  )
}

type PerfMetric = "views" | "engagement" | "leads"

const METRIC_OPTIONS: SegmentOption<PerfMetric>[] = [
  { value: "views", label: "Views" },
  { value: "engagement", label: "Engagement" },
  { value: "leads", label: "Leads" },
]

const METRIC_VALUE: Record<PerfMetric, (row: FunnelAggregate) => number> = {
  views: (row) => row.views,
  engagement: (row) => row.engagementRate ?? 0,
  leads: (row) => row.leads,
}

const METRIC_FORMAT: Record<PerfMetric, (value: number) => string> = {
  views: formatCompact,
  engagement: (value) => formatPercent(value),
  leads: formatNumber,
}

/** Views, engagement rate and leads per funnel stage for published posts in the window (table twin included). */
export function FunnelPerformanceCard({ perf, windowLabel }: { perf: FunnelAggregate[]; windowLabel: string }) {
  const [metric, setMetric] = useState<PerfMetric>("views")
  const stages = perf.filter((row) => row.stage)
  const unassigned = perf.find((row) => !row.stage)
  const table: ChartTable = {
    columns: ["Stage", "Posts", "Views", "Avg views", "Engagement", "Leads"],
    rows: perf.map((row) => [
      row.stage ? `${row.label} · ${FUNNEL_STAGES[row.stage].name}` : row.label,
      row.posts,
      formatCompact(row.views),
      formatCompact(row.avgViews),
      formatPercent(row.engagementRate),
      row.leads,
    ]),
  }
  const hasPosts = stages.some((row) => row.posts > 0)

  return (
    <ChartFrame
      title="Performance by stage"
      description={`Published posts in the ${windowLabel}${unassigned ? ` · ${pluralize(unassigned.posts, "post")} without a stage` : ""}`}
      table={table}
      footer={metric === "engagement" ? "Engagement rate = likes + comments + shares + saves ÷ reach." : undefined}
    >
      {/* Metric switch lives in the body so the header title keeps its width on narrow screens. */}
      <div className="flex flex-col gap-4">
        <SegmentedToggle value={metric} options={METRIC_OPTIONS} onChange={setMetric} aria-label="Metric" className="self-start" />
        <FunnelBars
          stages={
            hasPosts
              ? stages.map((row) => ({
                  id: row.key,
                  label: row.label,
                  sublabel: row.stage ? FUNNEL_STAGES[row.stage].name : undefined,
                  value: METRIC_VALUE[metric](row),
                  color: row.stage ? FUNNEL_COLORS[row.stage] : undefined,
                }))
              : []
          }
          valueFormatter={METRIC_FORMAT[metric]}
          showShare={metric !== "engagement"}
          aria-label={`${METRIC_OPTIONS.find((o) => o.value === metric)?.label} by funnel stage`}
          emptyMessage="No published posts with a funnel stage in this window."
        />
      </div>
    </ChartFrame>
  )
}
