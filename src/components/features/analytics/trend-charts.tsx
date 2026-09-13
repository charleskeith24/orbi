"use client"

import Link from "next/link"
import { ChartFrame, TrendChart } from "@/components/charts"
import { formatDate } from "@/lib/dates"
import type { ISODate } from "@/lib/types"
import { formatCompact, formatNumber, pluralize } from "@/lib/utils"
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
  const byDate = new Map(points.map((p) => [p.date, p]))
  const tooltipLabel = (date: ISODate) => periodLabel(byDate.get(date), bucket)
  const firstColumn = bucket === "week" ? "7 days" : "Day"
  const unit = bucket === "week" ? "7-day period" : "day"

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartFrame
        className="lg:col-span-2"
        title="Views & reach"
        description={`Totals of the posts published in each ${unit}, latest ${unit} ending today`}
        table={{
          columns: [firstColumn, "Posts", "Views", "Reach"],
          rows: points.map((p) => [periodLabel(p, bucket, true), p.posts, formatNumber(p.views), formatNumber(p.reach)]),
        }}
      >
        <TrendChart
          data={points.map((p) => ({ date: p.date, views: p.views, reach: p.reach }))}
          series={[
            { key: "views", label: "Views", color: "blue" },
            { key: "reach", label: "Reach", color: "orange" },
          ]}
          height={240}
          valueFormatter={formatNumber}
          tooltipDateFormatter={tooltipLabel}
          emptyMessage="No posts published in this period yet."
          aria-label="Views and reach over time"
        />
      </ChartFrame>
      <ChartFrame
        title="Follower growth"
        description="Followers gained from these posts, running total"
        table={{
          columns: [firstColumn, "Gained", "Running total"],
          rows: points.map((p) => [periodLabel(p, bucket, true), formatNumber(p.followers), formatNumber(p.cumulativeFollowers)]),
        }}
        footer={
          audience ? (
            <>
              {formatCompact(audience.followers)} current followers across {pluralize(audience.platforms, "platform")} ·{" "}
              <Link href="/strategy/platforms" className="underline-offset-2 hover:text-foreground hover:underline">
                Platform strategy
              </Link>
            </>
          ) : undefined
        }
      >
        <TrendChart
          type="area"
          data={points.map((p) => ({ date: p.date, followers: p.cumulativeFollowers }))}
          series={[{ key: "followers", label: "Followers gained", color: "blue" }]}
          height={240}
          valueFormatter={formatNumber}
          tooltipDateFormatter={tooltipLabel}
          emptyMessage="No posts published in this period yet."
          aria-label="Followers gained over time"
        />
      </ChartFrame>
    </div>
  )
}
