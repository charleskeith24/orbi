"use client"

import { ChartNoAxesColumn } from "lucide-react"
import { useState } from "react"
import { BarList, type BarListItem } from "@/components/charts"
import { EmptyState, SectionCard, ViewToggle } from "@/components/common"
import { Button } from "@/components/ui/button"
import { uiActions } from "@/lib/store"
import { formatCompact, formatDelta, formatNumber } from "@/lib/utils"
import type { PlatformGrowthRow } from "./dashboard-utils"

type GrowthMetric = "followers" | "views"

const METRIC_OPTIONS = [
  { value: "followers" as const, label: "Followers" },
  { value: "views" as const, label: "Views" },
]

/** Change vs the previous 30 days: "+3.7%", "new" (nothing before) or "no change". */
function changeText(delta: number | null, previous: number, current: number): string {
  if (delta !== null) return formatDelta(delta, Math.abs(delta) >= 100 ? 0 : 1)
  if (previous === 0 && current > 0) return "new"
  return "no change"
}

function secondary(row: PlatformGrowthRow, metric: GrowthMetric): string {
  return metric === "followers"
    ? `${changeText(row.followersDelta, row.previousFollowers, row.followers)} · ${formatCompact(row.views)} views`
    : `${changeText(row.viewsDelta, row.previousViews, row.views)} · +${formatNumber(row.followers)} followers`
}

/** Followers gained (or views) per platform, last 30 days, with change vs the 30 days before. */
export function PlatformGrowthCard({ rows, className }: { rows: PlatformGrowthRow[]; className?: string }) {
  const [metric, setMetric] = useState<GrowthMetric>("followers")
  const items: BarListItem[] = rows.map((row) => ({
    id: row.platform,
    label: row.label,
    value: metric === "followers" ? row.followers : row.views,
    secondary: secondary(row, metric),
    href: "/analytics",
  }))
  const leader = [...rows].sort((a, b) => (metric === "followers" ? b.followers - a.followers : b.views - a.views))[0]
  const leaderValue = leader ? (metric === "followers" ? leader.followers : leader.views) : 0

  return (
    <SectionCard
      title="Platform Growth"
      description="Last 30 days vs the 30 days before"
      action={<ViewToggle value={metric} onChange={setMetric} options={METRIC_OPTIONS} aria-label="Platform growth metric" />}
      className={className}
      contentClassName="flex flex-col gap-2"
    >
      {rows.length ? (
        <>
          {leader && leaderValue > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{leader.label}</span>{" "}
              {metric === "followers"
                ? `gained the most followers: +${formatNumber(leader.followers)} (${changeText(leader.followersDelta, leader.previousFollowers, leader.followers)} vs prior 30 days)`
                : `drew the most views: ${formatCompact(leader.views)} (${changeText(leader.viewsDelta, leader.previousViews, leader.views)} vs prior 30 days)`}
            </p>
          ) : null}
          <BarList
            items={items}
            valueFormatter={(value) => (metric === "followers" ? `+${formatNumber(value)}` : formatCompact(value))}
            aria-label={metric === "followers" ? "Followers gained by platform" : "Views by platform"}
          />
        </>
      ) : (
        <EmptyState
          compact
          icon={ChartNoAxesColumn}
          title="No published posts in the last 60 days"
          description="Log published posts and their analytics to see which platforms grow."
          action={
            <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              Log a published post
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
