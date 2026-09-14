"use client"

import { useState } from "react"
import { BarList, ChartFrame, platformColor, type BarListItem, type ChartColor, type ChartTable } from "@/components/charts"
import { PageSection } from "@/components/common"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { GroupAggregate, MonthlyReport } from "@/lib/analytics"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { countLabel } from "./report-format"

type PerfMetric = "avgViews" | "engagementRate" | "leads" | "posts"

const METRICS: Record<PerfMetric, { label: string; pick: (g: GroupAggregate) => number | null; format: (v: number) => string }> = {
  avgViews: { label: "Avg. views", pick: (g) => g.avgViews, format: (v) => formatCompact(v) },
  engagementRate: { label: "Eng. rate", pick: (g) => g.engagementRate, format: (v) => formatPercent(v) },
  leads: { label: "Leads", pick: (g) => (g.posts ? g.leads : null), format: formatNumber },
  posts: { label: "Posts", pick: (g) => g.posts, format: formatNumber },
}
const METRIC_IDS = Object.keys(METRICS) as PerfMetric[]

type Group = GroupAggregate & { label: string; color?: ChartColor }

function PerformanceChart({
  title,
  dimension,
  groups,
  metric,
  limit,
}: {
  title: string
  dimension: string
  groups: Group[]
  metric: PerfMetric
  limit?: number
}) {
  const def = METRICS[metric]
  const items: BarListItem[] = groups.flatMap((g) => {
    const value = def.pick(g)
    if (value === null || (metric !== "posts" && !g.posts)) return []
    const unmeasured = g.posts - g.measured
    return [
      {
        id: g.key,
        label: g.label,
        value,
        color: g.color,
        secondary: `${countLabel(g.posts, "post")}${unmeasured > 0 ? ` · ${formatNumber(unmeasured)} without analytics` : ""}`,
      },
    ]
  })
  const table: ChartTable = {
    columns: [dimension, "Posts", "Views", "Avg. views", "Eng. rate", "Leads"],
    rows: groups
      .filter((g) => g.posts > 0)
      .map((g) => [g.label, g.posts, formatNumber(g.views), formatNumber(g.avgViews), formatPercent(g.engagementRate), g.leads]),
  }
  return (
    <ChartFrame title={title} description={`${def.label} by ${dimension.toLowerCase()}`} table={table} className="print:break-inside-avoid">
      <BarList
        items={items}
        valueFormatter={def.format}
        limit={limit}
        emptyMessage="No published posts this month."
        aria-label={`${title}: ${def.label}`}
      />
    </ChartFrame>
  )
}

/** Platform / Pillar / Topic / Format Performance with one shared metric switch. */
export function PerformanceBreakdowns({ report, className }: { report: MonthlyReport; className?: string }) {
  const [metric, setMetric] = useState<PerfMetric>("avgViews")
  const platforms: Group[] = report.platformPerformance.map((g) => ({ ...g, color: platformColor(g.platform) }))
  const pillars: Group[] = report.pillarPerformance.map((g) => ({ ...g, color: g.color ?? "other" }))
  return (
    <PageSection
      title="Performance"
      description="How each platform, pillar, topic and format performed this month"
      className={className}
      action={
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={metric}
          onValueChange={(value) => {
            if (value && value in METRICS) setMetric(value as PerfMetric)
          }}
          aria-label="Performance metric"
          className="print:hidden"
        >
          {METRIC_IDS.map((id) => (
            <ToggleGroupItem key={id} value={id} className="px-2.5 text-xs">
              {METRICS[id].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <div className={cn("grid gap-4 md:grid-cols-2")}>
        <PerformanceChart title="Platform Performance" dimension="Platform" groups={platforms} metric={metric} />
        <PerformanceChart title="Pillar Performance" dimension="Pillar" groups={pillars} metric={metric} />
        <PerformanceChart title="Topic Performance" dimension="Topic" groups={report.topicPerformance} metric={metric} limit={6} />
        <PerformanceChart title="Format Performance" dimension="Format" groups={report.formatPerformance} metric={metric} limit={6} />
      </div>
    </PageSection>
  )
}
