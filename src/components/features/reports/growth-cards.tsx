"use client"

import { BarList, ChartFrame, platformColor, TrendChart, type BarListItem, type ChartTable } from "@/components/charts"
import type { MonthlyReport } from "@/lib/analytics"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import { monthlyReviewMessages } from "./monthly-messages"

/** Cumulative followers gained from the month's posts (by publish date), with a daily table twin. */
export function FollowerGrowthCard({ report, className }: { report: MonthlyReport; className?: string }) {
  const t = useT(monthlyReviewMessages)
  const points = report.followerGrowthSeries
  const hasGrowth = report.audienceGrowth.total > 0
  const table: ChartTable = {
    columns: [t("col_date"), t("followers_gained"), t("col_cumulative")],
    rows: points.filter((p) => p.value > 0).map((p) => [formatShortDate(p.date), p.value, p.cumulative]),
  }
  return (
    <ChartFrame
      title={t("follower_growth")}
      info={t("follower_growth_info")}
      table={table}
      className={cn("print:break-inside-avoid", className)}
    >
      <TrendChart
        data={hasGrowth ? points.map((p) => ({ date: p.date, cumulative: p.cumulative })) : []}
        series={[{ key: "cumulative", label: t("followers_gained"), color: "blue" }]}
        type="area"
        height={220}
        valueFormatter={formatNumber}
        emptyMessage={t("no_follower_gains")}
        aria-label={t("follower_growth_aria")}
      />
    </ChartFrame>
  )
}

/** Followers gained per platform (platform identity colours). */
export function AudienceGrowthCard({ report, className }: { report: MonthlyReport; className?: string }) {
  const t = useT(monthlyReviewMessages)
  const items: BarListItem[] = report.audienceGrowth.byPlatform.map((p) => ({
    id: p.platform,
    label: p.label,
    value: p.followersGained,
    color: platformColor(p.platform),
  }))
  return (
    <ChartFrame
      title={t("audience_growth_title")}
      description={t.plural("new_followers", report.audienceGrowth.total, { count: formatNumber(report.audienceGrowth.total) })}
      table={{ columns: [t("col_platform"), t("followers_gained")], rows: items.map((i) => [i.label, i.value]) }}
      className={cn("print:break-inside-avoid", className)}
    >
      <BarList items={items} valueFormatter={formatNumber} emptyMessage={t("no_posts_month")} aria-label={t("followers_by_platform")} />
    </ChartFrame>
  )
}
