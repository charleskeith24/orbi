"use client"

import { useSyncExternalStore } from "react"
import { StatTile } from "@/components/common"
import { percentChange } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { analyticsMessages } from "./messages"
import type { BucketPoint, KpiTotals } from "./scope"

interface KpiDef {
  key: string
  label: string
  value: (t: KpiTotals) => number
  format: (value: number) => string
  sublabel?: (t: KpiTotals) => string | undefined
  trend: (p: BucketPoint) => number
  href?: string
}


// Two tiles share a phone-width row: sparklines there would truncate the numbers.
const WIDE_QUERY = "(min-width: 640px)"
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true
  )
}

/** Period totals with % change vs the previous equally long window (omitted for all time). */
export function KpiGrid({
  current,
  previous,
  points,
  postsHref,
}: {
  current: KpiTotals
  previous: KpiTotals | null
  points: BucketPoint[]
  postsHref: string
}) {
  const t = useT(analyticsMessages)
  const withRate = (value: number | null, key: "rate_engagement" | "rate_profile_visits" | "rate_lead" | "rate_save" | "rate_share") =>
    value === null ? undefined : t(key, { rate: formatPercent(value) })
  const showTrends = useIsWide() && points.length >= 4
  const tiles: KpiDef[] = [
    {
      key: "posts",
      label: t("kpi_posts"),
      value: (k) => k.posts,
      format: formatNumber,
      sublabel: (k) => (k.posts > k.measured ? t("without_analytics", { count: formatNumber(k.posts - k.measured) }) : t("all_with_analytics")),
      trend: (p) => p.posts,
      href: postsHref,
    },
    {
      key: "views",
      label: "Views",
      value: (k) => k.views,
      format: formatCompact,
      sublabel: (k) => (k.avgViews === null ? undefined : t("avg_per_post", { value: formatCompact(k.avgViews) })),
      trend: (p) => p.views,
    },
    {
      key: "reach",
      label: "Reach",
      value: (k) => k.reach,
      format: formatCompact,
      sublabel: (k) => (k.measured ? t("avg_per_post", { value: formatCompact(k.reach / k.measured) }) : undefined),
      trend: (p) => p.reach,
    },
    {
      key: "engagements",
      label: "Engagements",
      value: (k) => k.engagements,
      format: formatCompact,
      sublabel: (k) => withRate(k.engagementRate, "rate_engagement"),
      trend: (p) => p.engagements,
    },
    {
      key: "followers",
      label: t("kpi_followers"),
      value: (k) => k.followersGained,
      format: formatCompact,
      sublabel: (k) => withRate(k.followerConversion, "rate_profile_visits"),
      trend: (p) => p.followers,
    },
    {
      key: "leads",
      label: "Leads",
      value: (k) => k.leads,
      format: formatNumber,
      sublabel: (k) => withRate(k.leadConversion, "rate_lead"),
      trend: (p) => p.leads,
    },
    {
      key: "saves",
      label: "Saves",
      value: (k) => k.saves,
      format: formatCompact,
      sublabel: (k) => withRate(k.saveRate, "rate_save"),
      trend: (p) => p.saves,
    },
    {
      key: "shares",
      label: "Shares",
      value: (k) => k.shares,
      format: formatCompact,
      sublabel: (k) => withRate(k.shareRate, "rate_share"),
      trend: (p) => p.shares,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile
          key={tile.key}
          label={tile.label}
          value={tile.format(tile.value(current))}
          delta={previous ? percentChange(tile.value(current), tile.value(previous)) : undefined}
          sublabel={tile.sublabel?.(current)}
          trend={showTrends ? points.map(tile.trend) : undefined}
          href={tile.href}
        />
      ))}
    </div>
  )
}
