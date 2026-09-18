"use client"

import Link from "next/link"
import { ChartFrame, TrendChart } from "@/components/charts"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ISODate } from "@/lib/types"
import { formatCompact, formatNumber } from "@/lib/utils"
import { analyticsMessages } from "./messages"
import { postMessages } from "./post-messages"
import type { Bucket, BucketPoint } from "./scope"

export interface AudienceSummary {
  followers: number
  platforms: number
}

function periodLabel(point: BucketPoint | undefined, bucket: Bucket, withYear = false): string {
  if (!point) return ""
  if (bucket === "day") return formatDate(point.date, withYear ? "EEE, MMM d, yyyy" : "EEE, MMM d")
  return `${formatDate(point.date, "MMM d")} – ${formatDate(point.end, withYear ? "MMM d, yyyy" : "MMM d")}`
}

/** Views & reach over time plus the running total of followers gained (both by publish date). */
export function TrendCharts({
  points,
  bucket,
  audience,
}: {
  /** Empty when nothing was published in scope. */
  points: BucketPoint[]
  bucket: Bucket
  audience: AudienceSummary | null
}) {
  const t = useT(analyticsMessages)
  const p = useT(postMessages)
  const byDate = new Map(points.map((point) => [point.date, point]))
  const tooltipLabel = (date: ISODate) => periodLabel(byDate.get(date), bucket)
  const firstColumn = bucket === "week" ? t("col_7_days") : t("col_day")
  const unit = bucket === "week" ? t("unit_week") : t("unit_day")

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartFrame
        className="lg:col-span-2"
        title={t("views_reach_title")}
        description={t("views_reach_description", { unit })}
        table={{
          columns: [firstColumn, "Posts", "Views", "Reach"],
          rows: points.map((point) => [periodLabel(point, bucket, true), point.posts, formatNumber(point.views), formatNumber(point.reach)]),
        }}
      >
        <TrendChart
          data={points.map((point) => ({ date: point.date, views: point.views, reach: point.reach }))}
          series={[
            { key: "views", label: "Views", color: "blue" },
            { key: "reach", label: "Reach", color: "orange" },
          ]}
          height={240}
          valueFormatter={formatNumber}
          tooltipDateFormatter={tooltipLabel}
          emptyMessage={t("no_posts_period_yet")}
          aria-label={t("views_reach_aria")}
        />
      </ChartFrame>
      <ChartFrame
        title={t("follower_title")}
        description={t("follower_description")}
        table={{
          columns: [firstColumn, t("col_gained"), t("col_running")],
          rows: points.map((point) => [periodLabel(point, bucket, true), formatNumber(point.followers), formatNumber(point.cumulativeFollowers)]),
        }}
        footer={
          audience ? (
            <>
              {t.plural("current_followers", audience.platforms, {
                count: formatNumber(audience.platforms),
                followers: formatCompact(audience.followers),
              })}{" "}
              ·{" "}
              <Link href="/strategy/platforms" className="underline-offset-2 hover:text-foreground hover:underline">
                {t("platform_strategy")}
              </Link>
            </>
          ) : undefined
        }
      >
        <TrendChart
          type="area"
          data={points.map((point) => ({ date: point.date, followers: point.cumulativeFollowers }))}
          series={[{ key: "followers", label: p("followers_gained"), color: "blue" }]}
          height={240}
          valueFormatter={formatNumber}
          tooltipDateFormatter={tooltipLabel}
          emptyMessage={t("no_posts_period_yet")}
          aria-label={t("followers_aria")}
        />
      </ChartFrame>
    </div>
  )
}
