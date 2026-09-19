"use client"

import { ChartNoAxesColumn } from "lucide-react"
import { useState } from "react"
import { BarList, type BarListItem } from "@/components/charts"
import { EmptyState, SectionCard, ViewToggle } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, type Translator } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { formatCompact, formatDelta, formatNumber } from "@/lib/utils"
import type { PlatformGrowthRow } from "./dashboard-utils"
import { dashboardMessages } from "./messages"

type T = Translator<typeof dashboardMessages.en>

type GrowthMetric = "followers" | "views"

const METRIC_OPTIONS = [
  { value: "followers" as const, label: "Followers" },
  { value: "views" as const, label: "Views" },
]

/** Change vs the previous 30 days: "+3.7%", "new" (nothing before) or "no change". */
function changeText(t: T, delta: number | null, previous: number, current: number): string {
  if (delta !== null) return formatDelta(delta, Math.abs(delta) >= 100 ? 0 : 1)
  if (previous === 0 && current > 0) return t("change_new")
  return t("change_none")
}

function secondary(t: T, row: PlatformGrowthRow, metric: GrowthMetric): string {
  return metric === "followers"
    ? t("secondary_followers", { change: changeText(t, row.followersDelta, row.previousFollowers, row.followers), views: formatCompact(row.views) })
    : t("secondary_views", { change: changeText(t, row.viewsDelta, row.previousViews, row.views), followers: formatNumber(row.followers) })
}

/** Followers gained (or views) per platform, last 30 days, with change vs the 30 days before. */
export function PlatformGrowthCard({ rows, className }: { rows: PlatformGrowthRow[]; className?: string }) {
  const t = useT(dashboardMessages)
  const [metric, setMetric] = useState<GrowthMetric>("followers")
  const items: BarListItem[] = rows.map((row) => ({
    id: row.platform,
    label: row.label,
    value: metric === "followers" ? row.followers : row.views,
    secondary: secondary(t, row, metric),
    href: "/analytics",
  }))
  const leader = [...rows].sort((a, b) => (metric === "followers" ? b.followers - a.followers : b.views - a.views))[0]
  const leaderValue = leader ? (metric === "followers" ? leader.followers : leader.views) : 0

  return (
    <SectionCard
      title={t("growth_platform_title")}
      info={t("growth_platform_description")}
      action={<ViewToggle value={metric} onChange={setMetric} options={METRIC_OPTIONS} aria-label={t("growth_metric_aria")} />}
      className={className}
      contentClassName="flex flex-col gap-2"
    >
      {rows.length ? (
        <>
          {leader && leaderValue > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{leader.label}</span>{" "}
              {metric === "followers"
                ? t("leader_followers", {
                    count: formatNumber(leader.followers),
                    change: changeText(t, leader.followersDelta, leader.previousFollowers, leader.followers),
                  })
                : t("leader_views", {
                    views: formatCompact(leader.views),
                    change: changeText(t, leader.viewsDelta, leader.previousViews, leader.views),
                  })}
            </p>
          ) : null}
          <BarList
            items={items}
            valueFormatter={(value) => (metric === "followers" ? `+${formatNumber(value)}` : formatCompact(value))}
            aria-label={metric === "followers" ? t("followers_by_platform") : t("views_by_platform")}
          />
        </>
      ) : (
        <EmptyState
          compact
          icon={ChartNoAxesColumn}
          title={t("no_posts_60")}
          description={t("no_posts_60_description")}
          action={
            <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              {t("log_published")}
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
