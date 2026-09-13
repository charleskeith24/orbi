"use client"

import { useState } from "react"
import { BarList, ChartFrame } from "@/components/charts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { HookCategoryAggregate } from "@/lib/analytics"
import { formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"

type HookMetric = "views" | "retention" | "engagement" | "leads"

const HOOK_METRICS: {
  id: HookMetric
  label: string
  description: string
  value: (g: HookCategoryAggregate) => number | null
  format: (value: number) => string
}[] = [
  { id: "views", label: "Avg views", description: "Average views per measured post", value: (g) => g.avgViews, format: formatCompact },
  {
    id: "retention",
    label: "Avg retention",
    description: "Average % watched, on posts with retention logged",
    value: (g) => g.avgRetention,
    format: (v) => formatPercent(v),
  },
  {
    id: "engagement",
    label: "Engagement rate",
    description: "Engagements ÷ reach across the hook style",
    value: (g) => g.engagementRate,
    format: (v) => formatPercent(v),
  },
  { id: "leads", label: "Leads / post", description: "Leads per measured post", value: (g) => g.leadsPerPost, format: (v) => v.toFixed(v < 10 ? 1 : 0) },
]

/** Which hook styles earn the most views, retention, engagement or leads (spec §13). */
export function HookStyleChart({ groups }: { groups: HookCategoryAggregate[] }) {
  const [metricId, setMetricId] = useState<HookMetric>("views")
  const metric = HOOK_METRICS.find((m) => m.id === metricId) ?? HOOK_METRICS[0]
  const withValue = groups.filter((g) => metric.value(g) !== null)
  const missing = groups.length - withValue.length

  return (
    <ChartFrame
      title="By hook style"
      description={metric.description}
      actions={
        <Select value={metricId} onValueChange={(value) => setMetricId(value as HookMetric)}>
          <SelectTrigger size="sm" className="w-36" aria-label="Hook style metric">
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
          ? `${pluralize(missing, "hook style")} without ${metric.label.toLowerCase()} data ${missing === 1 ? "is" : "are"} left out.`
          : undefined
      }
    >
      <BarList
        items={withValue.map((g) => ({
          id: g.key,
          label: g.label,
          value: metric.value(g) ?? 0,
          color: g.category ? undefined : "other",
          secondary: pluralize(g.posts, "post"),
        }))}
        valueFormatter={metric.format}
        limit={6}
        emptyMessage={
          groups.length
            ? `No ${metric.label.toLowerCase()} data for these posts yet.`
            : "Tag hooks with a style in the Content Studio to compare them here."
        }
        aria-label={`${metric.label} by hook style`}
      />
    </ChartFrame>
  )
}
