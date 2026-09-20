"use client"

import { useState } from "react"
import { BarList, ChartFrame } from "@/components/charts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { HookCategoryAggregate } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { analyticsMessages } from "./messages"

type HookMetric = "views" | "retention" | "engagement" | "leads"

const HOOK_METRICS: {
  id: HookMetric
  label: string
  description: "hook_views_description" | "hook_retention_description" | "hook_engagement_description" | "hook_leads_description"
  value: (g: HookCategoryAggregate) => number | null
  format: (value: number) => string
}[] = [
  { id: "views", label: "Avg views", description: "hook_views_description", value: (g) => g.avgViews, format: formatCompact },
  {
    id: "retention",
    label: "Avg retention",
    description: "hook_retention_description",
    value: (g) => g.avgRetention,
    format: (v) => formatPercent(v),
  },
  {
    id: "engagement",
    label: "Engagement rate",
    description: "hook_engagement_description",
    value: (g) => g.engagementRate,
    format: (v) => formatPercent(v),
  },
  { id: "leads", label: "Leads / post", description: "hook_leads_description", value: (g) => g.leadsPerPost, format: (v) => v.toFixed(v < 10 ? 1 : 0) },
]

/** Which hook styles earn the most views, retention, engagement or leads (spec §13). */
export function HookStyleChart({ groups }: { groups: HookCategoryAggregate[] }) {
  const t = useT(analyticsMessages)
  const [metricId, setMetricId] = useState<HookMetric>("views")
  const metric = HOOK_METRICS.find((m) => m.id === metricId) ?? HOOK_METRICS[0]
  const withValue = groups.filter((g) => metric.value(g) !== null)
  const missing = groups.length - withValue.length

  return (
    <ChartFrame
      title={t("hook_title")}
      info={t(metric.description)}
      actions={
        <Select value={metricId} onValueChange={(value) => setMetricId(value as HookMetric)}>
          <SelectTrigger size="sm" className="w-36" aria-label={t("hook_metric_aria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {HOOK_METRICS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      table={{
        columns: ["Hook style", "Posts", "Avg views", "Avg retention", "Eng. rate", "Leads / post"],
        rows: groups.map((g) => [
          g.label,
          g.posts,
          formatNumber(g.avgViews),
          formatPercent(g.avgRetention),
          formatPercent(g.engagementRate),
          g.leadsPerPost === null ? "—" : g.leadsPerPost.toFixed(1),
        ]),
      }}
      footer={
        missing > 0 && withValue.length > 0
          ? t.plural("hook_left_out", missing, { count: formatNumber(missing), metric: metric.label.toLowerCase() })
          : undefined
      }
    >
      <BarList
        items={withValue.map((g) => ({
          id: g.key,
          label: g.label,
          value: metric.value(g) ?? 0,
          color: g.category ? undefined : "other",
          secondary: t.plural("posts", g.posts, { count: formatNumber(g.posts) }),
        }))}
        valueFormatter={metric.format}
        limit={6}
        emptyMessage={
          groups.length
            ? t("hook_no_data", { metric: metric.label.toLowerCase() })
            : t("hook_empty")
        }
        aria-label={t("hook_aria", { metric: metric.label })}
      />
    </ChartFrame>
  )
}
