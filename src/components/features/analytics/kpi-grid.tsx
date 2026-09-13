"use client"

import { useSyncExternalStore } from "react"
import { StatTile } from "@/components/common"
import { percentChange } from "@/lib/analytics"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
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

const withRate = (value: number | null, label: string) => (value === null ? undefined : `${formatPercent(value)} ${label}`)

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
  const showTrends = useIsWide() && points.length >= 4
  const tiles: KpiDef[] = [
    {
      key: "posts",
      label: "Posts published",
      value: (t) => t.posts,
      format: formatNumber,
      sublabel: (t) => (t.posts > t.measured ? `${formatNumber(t.posts - t.measured)} without analytics` : "All with analytics"),
      trend: (p) => p.posts,
      href: postsHref,
    },
    {
      key: "views",
      label: "Views",
      value: (t) => t.views,
      format: formatCompact,
      sublabel: (t) => (t.avgViews === null ? undefined : `${formatCompact(t.avgViews)} avg / post`),
      trend: (p) => p.views,
    },
    {
      key: "reach",
      label: "Reach",
      value: (t) => t.reach,
      format: formatCompact,
      sublabel: (t) => (t.measured ? `${formatCompact(t.reach / t.measured)} avg / post` : undefined),
      trend: (p) => p.reach,
    },
    {
      key: "engagements",
      label: "Engagements",
      value: (t) => t.engagements,
      format: formatCompact,
      sublabel: (t) => withRate(t.engagementRate, "engagement rate"),
      trend: (p) => p.engagements,
    },
    {
      key: "followers",
      label: "Followers gained",
      value: (t) => t.followersGained,
      format: formatCompact,
      sublabel: (t) => withRate(t.followerConversion, "of profile visits"),
      trend: (p) => p.followers,
    },
    {
      key: "leads",
      label: "Leads",
      value: (t) => t.leads,
      format: formatNumber,
      sublabel: (t) => withRate(t.leadConversion, "lead conversion"),
      trend: (p) => p.leads,
    },
    {
      key: "saves",
      label: "Saves",
      value: (t) => t.saves,
      format: formatCompact,
      sublabel: (t) => withRate(t.saveRate, "save rate"),
      trend: (p) => p.saves,
    },
    {
      key: "shares",
      label: "Shares",
      value: (t) => t.shares,
      format: formatCompact,
      sublabel: (t) => withRate(t.shareRate, "share rate"),
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
