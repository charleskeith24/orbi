"use client"

import { CircleCheck, Scale, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { ChartFrame, FunnelBars, MixBar, type ChartTable } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { MIN_MIX_SAMPLE, type FunnelAggregate, type FunnelMix } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { funnelMessages } from "./funnel-messages"
import { FUNNEL_COLORS } from "./funnel-utils"
import { formatPoints, TARGET_TOTAL } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"
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
  const t = useT(funnelMessages)
  const p = useT(pillarMessages)
  const lang = useUiLang()
  const table: ChartTable = {
    columns: [t("stage"), p("items"), p("actual"), p("target"), p("vs_target")],
    rows: mix.rows.map((r) => [
      `${r.label} · ${FUNNEL_STAGES[r.stage].name}`,
      r.count,
      `${Math.round(r.actualPct)}%`,
      `${Math.round(r.targetPct)}%`,
      formatPoints(r.deviation, lang),
    ]),
  }
  const description = [
    p("mix_window", { window: windowLabel }),
    p.plural("items", mix.total, { count: formatNumber(mix.total) }),
    mix.unassigned ? t("without_stage", { count: mix.unassigned }) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <ChartFrame title={t("distribution_title")} description={description} table={table}>
      <div className="flex flex-col gap-4">
        <MixBar
          segments={mix.rows.map((r) => ({ id: r.stage, label: `${r.label} · ${FUNNEL_STAGES[r.stage].name}`, value: r.count, color: FUNNEL_COLORS[r.stage] }))}
          targets={mix.rows.map((r) => ({ id: r.stage, value: r.targetPct }))}
          valueLabel={p("items")}
          aria-label={t("mix_aria")}
          emptyMessage={t("distribution_empty")}
        />
        {targetTotal !== TARGET_TOTAL ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          >
            <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
            <span className="min-w-0 flex-1">
              {t("targets_total_before")} <strong className="num font-semibold">{targetTotal}%</strong> {t("targets_total_after")}
            </span>
            <Button type="button" size="xs" variant="outline" onClick={onEditTargets}>
              <Scale aria-hidden />
              {t("edit_targets")}
            </Button>
          </div>
        ) : null}
        {!mix.total ? null : !mix.enoughData ? (
          <p className="text-xs text-muted-foreground">{p("balance_warnings_start", { count: MIN_MIX_SAMPLE })}</p>
        ) : mix.warnings.length ? (
          <ul className="flex flex-col gap-1.5" aria-label={t("warnings_aria")}>
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
            {t("every_stage_ok")}
          </p>
        )}
      </div>
    </ChartFrame>
  )
}

type PerfMetric = "views" | "engagement" | "leads"


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
  const t = useT(funnelMessages)
  const p = useT(pillarMessages)
  const [metric, setMetric] = useState<PerfMetric>("views")
  const metricOptions: SegmentOption<PerfMetric>[] = [
    { value: "views", label: t("views") },
    { value: "engagement", label: p("engagement") },
    { value: "leads", label: p("leads") },
  ]
  const stages = perf.filter((row) => row.stage)
  const unassigned = perf.find((row) => !row.stage)
  const table: ChartTable = {
    columns: [t("stage"), p("posts"), t("views"), p("avg_views"), p("engagement"), p("leads")],
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
      title={t("performance_title")}
      description={`${t("performance_description", { window: windowLabel })}${
        unassigned ? ` · ${t.plural("posts_without_stage", unassigned.posts, { count: formatNumber(unassigned.posts) })}` : ""
      }`}
      table={table}
      footer={metric === "engagement" ? t("engagement_footer") : undefined}
    >
      {/* Metric switch lives in the body so the header title keeps its width on narrow screens. */}
      <div className="flex flex-col gap-4">
        <SegmentedToggle value={metric} options={metricOptions} onChange={setMetric} aria-label={t("metric")} className="self-start" />
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
          aria-label={t("metric_by_stage", { metric: metricOptions.find((o) => o.value === metric)?.label ?? "" })}
          emptyMessage={t("performance_empty")}
        />
      </div>
    </ChartFrame>
  )
}
