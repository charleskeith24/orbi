"use client"

import { BarList, ChartFrame, platformColor, TrendChart, type BarListItem, type ChartTable } from "@/components/charts"
import type { MonthlyReport } from "@/lib/analytics"
import { formatShortDate } from "@/lib/dates"
import { cn, formatNumber } from "@/lib/utils"
import { countLabel } from "./report-format"

/** Cumulative followers gained from the month's posts (by publish date), with a daily table twin. */
export function FollowerGrowthCard({ report, className }: { report: MonthlyReport; className?: string }) {
  const points = report.followerGrowthSeries
  const hasGrowth = report.audienceGrowth.total > 0
  const table: ChartTable = {
    columns: ["Date", "Followers gained", "Cumulative"],
    rows: points.filter((p) => p.value > 0).map((p) => [formatShortDate(p.date), p.value, p.cumulative]),
  }
  return (
    <ChartFrame
      title="Follower Growth"
      description="Followers gained from this month's posts, cumulative by publish date"
      table={table}
      className={cn("print:break-inside-avoid", className)}
    >
      <TrendChart
        data={hasGrowth ? points.map((p) => ({ date: p.date, cumulative: p.cumulative })) : []}
        series={[{ key: "cumulative", label: "Followers gained", color: "blue" }]}
        type="area"
        height={220}
        valueFormatter={formatNumber}
        emptyMessage="No follower gains logged for this month's posts yet."
        aria-label="Cumulative followers gained this month"
      />
    </ChartFrame>
  )
}

/** Followers gained per platform (platform identity colours). */
export function AudienceGrowthCard({ report, className }: { report: MonthlyReport; className?: string }) {
  const items: BarListItem[] = report.audienceGrowth.byPlatform.map((p) => ({
    id: p.platform,
    label: p.label,
    value: p.followersGained,
    color: platformColor(p.platform),
  }))
  return (
    <ChartFrame
      title="Audience Growth"
      description={`${countLabel(report.audienceGrowth.total, "new follower")} by platform`}
      table={{ columns: ["Platform", "Followers gained"], rows: items.map((i) => [i.label, i.value]) }}
      className={cn("print:break-inside-avoid", className)}
    >
      <BarList items={items} valueFormatter={formatNumber} emptyMessage="No posts published this month." aria-label="Followers gained by platform" />
    </ChartFrame>
  )
}
