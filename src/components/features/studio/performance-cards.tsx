"use client"

import { Plus, Trophy } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { TrendChart, type TrendDatum } from "@/components/charts"
import { SectionCard, StatusPill, TierBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { computeRates, isWinnerTier, type TieredRow } from "@/lib/analytics"
import { PERFORMANCE_TIERS, PLATFORMS, RATE_FIELDS, WINNER_METRIC_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { AppSettings, ContentMetric, PerformanceTier, RateKey } from "@/lib/types"
import { cn, formatDuration, formatNumber, formatPercent, pluralize } from "@/lib/utils"

export const SOURCE_LABEL: Record<ContentMetric["source"], string> = { manual: "Manual", import: "Imported", integration: "Integration" }

const ratioLabel = (ratio: number) => `${ratio.toFixed(1)}×`

/* ---------------------------------- Tier ---------------------------------- */

function comparisonLabel(value: number | null, settings: AppSettings): string {
  if (value === null) return "—"
  if (settings.winner_metric === "composite") return value.toFixed(2)
  if (settings.winner_metric === "engagement_rate") return formatPercent(value)
  return formatNumber(value)
}

/** Winner detection for one post: tier, value vs baseline, ratio and where it sits on the tier scale. */
export function TierCard({ row, settings }: { row: TieredRow; settings: AppSettings }) {
  const platform = PLATFORMS[row.platform].label
  const metric = (WINNER_METRIC_MAP[settings.winner_metric]?.label ?? "Views").toLowerCase()
  const minSample = Math.min(settings.winner_window, settings.winner_min_sample)
  const tiered = row.ratio !== null
  let reason = ""
  if (!tiered) {
    if (row.sampleSize < minSample) {
      reason = row.sampleSize
        ? `Only ${pluralize(row.sampleSize, `earlier measured ${platform} post`)} to compare with — tiers start at ${minSample}.`
        : `No earlier measured ${platform} posts to compare with yet — tiers start at ${minSample}.`
    } else if (row.value === null) {
      reason = `No ${metric} logged for this post yet.`
    } else {
      reason = "Your comparison average is 0, so there's no ratio yet."
    }
  }
  const composite = settings.winner_metric === "composite"

  return (
    <SectionCard
      title="Winner detection"
      description={`Compared with the average ${metric} of your previous ${settings.winner_window} measured ${platform} posts`}
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/settings?tab=performance">Thresholds</Link>
        </Button>
      }
      contentClassName="flex flex-col gap-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {tiered ? <TierBadge tier={row.tier} showNormal /> : <StatusPill tone="neutral">Not tiered yet</StatusPill>}
        <span className="text-sm text-pretty">
          {tiered && row.ratio !== null ? (
            <>
              <span className="font-medium num">{ratioLabel(row.ratio)}</span> your {platform} average
            </>
          ) : (
            reason
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{composite ? "Performance index" : "This post"}</dt>
          <dd className="text-sm font-medium num">{comparisonLabel(row.value, settings)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">Baseline</dt>
          <dd className="text-sm font-medium num">
            {comparisonLabel(row.baseline, settings)}
            <span className="block text-xs font-normal text-muted-foreground">avg of {pluralize(row.sampleSize, "post")}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">Ratio</dt>
          <dd className="text-sm font-medium num">{row.ratio !== null ? ratioLabel(row.ratio) : "—"}</dd>
        </div>
      </dl>
      <TierScale ratio={row.ratio} active={tiered ? row.tier : null} settings={settings} />
      {isWinnerTier(row.tier) ? (
        <Link
          href={`/winners?open=${row.id}`}
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Trophy className="size-3.5 shrink-0 text-good-fg" aria-hidden />
          <span className="min-w-0 flex-1">In your Winning Content Library — create more content like this.</span>
          <span className="shrink-0 font-medium">Replicate</span>
        </Link>
      ) : null}
    </SectionCard>
  )
}

const TIER_ORDER: PerformanceTier[] = ["normal", "good", "winner", "breakout"]
const thresholdLabel = (value: number) => `${Number(value.toFixed(1))}×`

/** Equal-width tier bands; the marker sits piecewise-linearly inside its band. */
function tierPosition(ratio: number, settings: AppSettings): number {
  const edges = [0, settings.tier_good, settings.tier_winner, settings.tier_breakout, settings.tier_breakout * 1.5]
  for (let band = 0; band < 4; band++) {
    const lo = edges[band]
    const hi = edges[band + 1]
    if (ratio < hi || band === 3) {
      const within = Math.min(1, Math.max(0, (ratio - lo) / Math.max(0.0001, hi - lo)))
      return Math.min(100, (band + within) * 25)
    }
  }
  return 100
}

function TierScale({ ratio, active, settings }: { ratio: number | null; active: PerformanceTier | null; settings: AppSettings }) {
  const from: Record<PerformanceTier, number> = {
    normal: 0,
    good: settings.tier_good,
    winner: settings.tier_winner,
    breakout: settings.tier_breakout,
  }
  return (
    <div aria-hidden className="flex flex-col gap-1.5">
      <div className="relative">
        <div className="grid h-2 grid-cols-4 gap-0.5">
          {TIER_ORDER.map((tier) => (
            <div
              key={tier}
              className={cn(
                "h-full first:rounded-l-[3px] last:rounded-r-[3px]",
                tier === active ? (tier === "normal" ? "bg-foreground/35" : "bg-good") : "bg-muted dark:bg-input/60"
              )}
            />
          ))}
        </div>
        {ratio !== null ? (
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
            style={{ left: `${tierPosition(ratio, settings)}%` }}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-0.5 text-[11px] text-muted-foreground">
        {TIER_ORDER.map((tier) => (
          <span key={tier} className={cn("min-w-0 truncate", tier === active && "font-medium text-foreground")}>
            {PERFORMANCE_TIERS[tier].label}
            {from[tier] > 0 ? <span className="num"> ≥{thresholdLabel(from[tier])}</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------- Rates --------------------------------- */

function rateInputs(key: RateKey, r: TieredRow): string {
  const base = `${formatNumber(r.base)} ${r.reach > 0 ? "reach" : "views"}`
  switch (key) {
    case "engagement_rate":
      return `${formatNumber(r.engagements)} ÷ ${base}`
    case "share_rate":
      return `${formatNumber(r.shares)} ÷ ${base}`
    case "save_rate":
      return `${formatNumber(r.saves)} ÷ ${base}`
    case "lead_conversion_rate":
      return r.linkClicks > 0
        ? `${formatNumber(r.leads)} ÷ ${formatNumber(r.linkClicks)} link clicks`
        : `${formatNumber(r.leads)} ÷ ${formatNumber(r.profileVisits)} profile visits`
    case "follower_conversion_rate":
      return `${formatNumber(r.followersGained)} ÷ ${formatNumber(r.profileVisits)} profile visits`
  }
}

/** Every derived rate with its formula (RATE_FIELDS) and this post's own inputs. */
export function RatesCard({ row }: { row: TieredRow }) {
  return (
    <SectionCard title="Rates" description="Derived from the latest snapshot" contentClassName="px-0 pt-2 pb-1">
      <ul className="divide-y">
        {RATE_FIELDS.map((field) => {
          const value = row.rates[field.key]
          return (
            <li key={field.key} className="flex items-start justify-between gap-4 px-4 py-2">
              <div className="min-w-0">
                <p className="text-sm">{field.label}</p>
                <p className="text-xs text-pretty text-muted-foreground">
                  {field.formula}
                  <span className="text-foreground/70 num"> · {rateInputs(field.key, row)}</span>
                </p>
              </div>
              <span className="shrink-0 pt-px text-sm font-medium num">{value === null ? "—" : formatPercent(value)}</span>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}

/* ------------------------------ Latest snapshot ---------------------------- */

export function LatestSnapshot({ metric }: { metric: ContentMetric }) {
  const watch = metric.watch_time_seconds
  const cells: { label: string; value: string }[] = [
    { label: "Views", value: formatNumber(metric.views) },
    { label: "Reach", value: formatNumber(metric.reach) },
    { label: "Likes", value: formatNumber(metric.likes) },
    { label: "Comments", value: formatNumber(metric.comments) },
    { label: "Shares", value: formatNumber(metric.shares) },
    { label: "Saves", value: formatNumber(metric.saves) },
    { label: "Followers gained", value: formatNumber(metric.followers_gained) },
    { label: "Profile visits", value: formatNumber(metric.profile_visits) },
    { label: "Link clicks", value: formatNumber(metric.link_clicks) },
    { label: "Leads", value: formatNumber(metric.leads) },
    { label: "Sales", value: formatNumber(metric.sales) },
    { label: "Watch time", value: watch === null ? "—" : formatDuration(watch) },
    { label: "Avg. retention", value: formatPercent(metric.avg_retention) },
  ]
  return (
    <SectionCard
      title="Latest snapshot"
      description={`Recorded ${formatDate(metric.recorded_at, "EEE, MMM d, yyyy")} · ${SOURCE_LABEL[metric.source] ?? metric.source}${metric.notes ? ` · ${metric.notes}` : ""}`}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{cell.label}</dt>
            <dd className="text-sm font-medium num">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}

/* ------------------------------ Snapshot history --------------------------- */

/** Every logged snapshot (newest first), with a views/reach trend once there are two or more. */
export function SnapshotHistory({ snapshots, itemId, onAdd }: { snapshots: ContentMetric[]; itemId: string; onAdd: () => void }) {
  const chart = useMemo<TrendDatum[]>(
    () =>
      [...snapshots].reverse().map((s) => ({
        date: s.recorded_at,
        views: s.views,
        reach: s.reach,
      })),
    [snapshots]
  )
  return (
    <SectionCard
      title="Snapshot history"
      description={`${pluralize(snapshots.length, "snapshot")} — each check-in records the running totals from the platform.`}
      action={
        <>
          <Button type="button" variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href={`/analytics/posts?open=${itemId}`}>Edit in Post Performance</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus aria-hidden />
            Add analytics
          </Button>
        </>
      }
      contentClassName="flex flex-col gap-4 px-0 pb-0"
    >
      {snapshots.length >= 2 ? (
        <div className="px-4">
          <TrendChart
            data={chart}
            series={[
              { key: "views", label: "Views", color: "blue" },
              { key: "reach", label: "Reach", color: "orange" },
            ]}
            height={180}
            aria-label="Views and reach at each snapshot"
          />
        </div>
      ) : null}
      <div className="overflow-x-auto border-t scrollbar-thin">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="h-8 px-4 text-left font-medium">
                Recorded
              </th>
              {["Views", "Reach", "Likes", "Comments", "Shares", "Saves", "Leads", "Eng. rate"].map((label) => (
                <th key={label} scope="col" className="h-8 px-3 text-right font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {snapshots.map((s, index) => (
              <tr key={s.id}>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {formatDate(s.recorded_at)}
                    {index === 0 ? <span className="rounded-sm bg-muted px-1 text-[11px] font-medium text-muted-foreground">Latest</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{SOURCE_LABEL[s.source] ?? s.source}</span>
                </td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.views)}</td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.reach)}</td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.likes)}</td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.comments)}</td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.shares)}</td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.saves)}</td>
                <td className="px-3 py-2 text-right num">{formatNumber(s.leads)}</td>
                <td className="px-3 py-2 text-right num">{formatPercent(computeRates(s).engagement_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
