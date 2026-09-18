"use client"

import { Trophy } from "lucide-react"
import { EmptyState, SectionCard, ViewToggle } from "@/components/common"
import { BarList, ChartFrame } from "@/components/charts"
import { formatMultiple, type GroupAggregate, type HookCategoryAggregate } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import type { Hook, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { hookMessages } from "./hook-messages"
import { formatHookMetric, HOOK_METRICS, hookMetricValue, type HookMetric, type HookStats } from "./hook-model"
import { HookText } from "./hook-text"
import { labMessages } from "./messages"

/** "Which hook styles work best" — hookCategoryPerformance ranked by the chosen metric, with a table twin. */
export function HookStylesCard({
  styles,
  overall,
  metric,
  onMetricChange,
  className,
}: {
  styles: HookCategoryAggregate[]
  overall: GroupAggregate
  metric: HookMetric
  onMetricChange: (metric: HookMetric) => void
  className?: string
}) {
  const t = useT(hookMessages)
  const l = useT(labMessages)
  const measured = styles.filter((style) => style.category && style.measured > 0)
  const items = measured.flatMap((style) => {
    const value = hookMetricValue(style, metric)
    if (value === null) return []
    return [
      {
        id: style.key,
        label: style.label,
        value,
        secondary: `${l.plural("posts_count", style.measured, { count: formatNumber(style.measured) })}${
          style.winners ? ` · ${t.plural("winners", style.winners, { count: formatNumber(style.winners) })}` : ""
        }`,
      },
    ]
  })
  const best = measured.filter((style) => style.measured >= 2 && style.avgViews !== null).sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0))[0]
  const lift = best?.avgViews && overall.avgViews ? best.avgViews / overall.avgViews : null
  const metricLabel = l(`metric_${metric}`)
  const [footerBefore, footerAfter] = t("styles_footer", { multiple: lift ? formatMultiple(lift) : "" }).split("{style}")

  return (
    <ChartFrame
      className={className}
      title={t("styles_title")}
      description={l("analytics_scope", { description: l(`metric_${metric}_description`) })}
      table={{
        columns: [t("col_hook_style"), l("posts"), l("avg_views"), l("retention"), l("engagement"), l("leads_per_post")],
        rows: measured.map((style) => [
          style.label,
          style.measured,
          formatHookMetric(style.avgViews, "views"),
          formatHookMetric(style.avgRetention, "retention"),
          formatHookMetric(style.engagementRate, "engagement"),
          formatHookMetric(style.leadsPerPost, "leads"),
        ]),
      }}
      footer={
        best && lift && lift >= 1.1 ? (
          <p className="text-xs text-muted-foreground">
            {footerBefore}
            <span className="font-medium text-foreground">{best.label}</span>
            {footerAfter}
          </p>
        ) : undefined
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
          <ViewToggle
            value={metric}
            onChange={onMetricChange}
            options={HOOK_METRICS.map((m) => ({ value: m, label: l(`metric_${m}`) }))}
            aria-label={t("rank_by")}
          />
        </div>
        <BarList
          items={items}
          valueFormatter={(value) => formatHookMetric(value, metric)}
          emptyMessage={metric === "retention" ? t("retention_empty") : t("styles_empty")}
          aria-label={t("ranked_by", { metric: metricLabel.toLowerCase() })}
        />
      </div>
    </ChartFrame>
  )
}

/** The five library hooks whose posts average the most views. */
export function TopHooksCard({
  hooks,
  stats,
  overall,
  onOpen,
  className,
}: {
  hooks: Hook[]
  stats: Map<ID, HookStats>
  overall: GroupAggregate
  onOpen: (id: ID) => void
  className?: string
}) {
  const t = useT(hookMessages)
  const l = useT(labMessages)
  const top = hooks
    .flatMap((hook) => {
      const performance = stats.get(hook.id)?.performance
      return performance && performance.measured > 0 && performance.avgViews !== null ? [{ hook, performance }] : []
    })
    .sort((a, b) => (b.performance.avgViews ?? 0) - (a.performance.avgViews ?? 0))
    .slice(0, 5)

  return (
    <SectionCard
      className={className}
      title={t("top_title")}
      description={t("top_description")}
      icon={Trophy}
      contentClassName="px-2 pt-2 pb-2"
    >
      {top.length ? (
        <ol className="flex flex-col">
          {top.map(({ hook, performance }, index) => (
            <li key={hook.id}>
              <button
                type="button"
                onClick={() => onOpen(hook.id)}
                className="flex w-full min-w-0 items-start gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="w-4 shrink-0 pt-px text-xs text-muted-foreground num">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <HookText text={hook.text} className="line-clamp-2 text-sm leading-snug" />
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {l.plural("posts_count", performance.measured, { count: formatNumber(performance.measured) })} ·{" "}
                    {t("top_engagement", { rate: formatHookMetric(performance.engagementRate, "engagement") })}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium num">{formatHookMetric(performance.avgViews, "views")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {overall.avgViews && performance.avgViews
                      ? t("top_vs_average", { multiple: formatMultiple(performance.avgViews / overall.avgViews) })
                      : t("top_avg_views")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          compact
          icon={Trophy}
          title={t("top_empty_title")}
          description={t("top_empty_description")}
        />
      )}
    </SectionCard>
  )
}
