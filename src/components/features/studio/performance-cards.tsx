"use client"

import { Plus, Trophy } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { TrendChart, type TrendDatum } from "@/components/charts"
import { SectionCard, StatusPill, TierBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { computeRates, isWinnerTier, type TieredRow } from "@/lib/analytics"
import { useT, type Translator } from "@/lib/i18n"
import { PERFORMANCE_TIERS, PLATFORMS, RATE_FIELDS, WINNER_METRIC_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { AppSettings, ContentMetric, PerformanceTier, RateKey } from "@/lib/types"
import { cn, formatDuration, formatNumber, formatPercent } from "@/lib/utils"
import { performanceMessages } from "./performance-messages"

type PerformanceT = Translator<(typeof performanceMessages)["en"]>

const sourceLabel = (t: PerformanceT, source: ContentMetric["source"]) =>
  source === "manual" || source === "import" || source === "integration" ? t(`source_${source}`) : source

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
  const t = useT(performanceMessages)
  const platform = PLATFORMS[row.platform].label
  const metric = (WINNER_METRIC_MAP[settings.winner_metric]?.label ?? "Views").toLowerCase()
  const minSample = Math.min(settings.winner_window, settings.winner_min_sample)
  const tiered = row.ratio !== null
  let reason = ""
  if (!tiered) {
    if (row.sampleSize < minSample) {
      reason = row.sampleSize
        ? t.plural("only_earlier", row.sampleSize, { count: formatNumber(row.sampleSize), platform, min: minSample })
        : t("no_earlier", { platform, min: minSample })
    } else if (row.value === null) {
      reason = t("no_metric", { metric })
    } else {
      reason = t("zero_average")
    }
  }
  const composite = settings.winner_metric === "composite"

  return (
    <SectionCard
      title={t("winner_detection")}
      description={t("compared_with", { metric, window: settings.winner_window, platform })}
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/settings?tab=performance">{t("thresholds")}</Link>
        </Button>
      }
      contentClassName="flex flex-col gap-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {tiered ? <TierBadge tier={row.tier} showNormal /> : <StatusPill tone="neutral">{t("not_tiered")}</StatusPill>}
        <span className="text-sm text-pretty">
          {tiered && row.ratio !== null ? (
            <>
              <span className="font-medium num">{ratioLabel(row.ratio)}</span> {t("your_average", { platform })}
            </>
          ) : (
            reason
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{composite ? t("performance_index") : t("this_post")}</dt>
          <dd className="text-sm font-medium num">{comparisonLabel(row.value, settings)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{t("baseline")}</dt>
          <dd className="text-sm font-medium num">
            {comparisonLabel(row.baseline, settings)}
            <span className="block text-xs font-normal text-muted-foreground">
              {t.plural("avg_of", row.sampleSize, { count: formatNumber(row.sampleSize) })}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{t("ratio")}</dt>
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
          <span className="min-w-0 flex-1">{t("in_library")}</span>
          <span className="shrink-0 font-medium">{t("replicate")}</span>
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

function rateInputs(key: RateKey, r: TieredRow, t: PerformanceT): string {
  const base = `${formatNumber(r.base)} ${r.reach > 0 ? t("reach_unit") : t("views_unit")}`
  switch (key) {
    case "engagement_rate":
      return `${formatNumber(r.engagements)} ÷ ${base}`
    case "share_rate":
      return `${formatNumber(r.shares)} ÷ ${base}`
    case "save_rate":
      return `${formatNumber(r.saves)} ÷ ${base}`
    case "lead_conversion_rate":
      return r.linkClicks > 0
        ? `${formatNumber(r.leads)} ÷ ${formatNumber(r.linkClicks)} ${t("link_clicks_unit")}`
        : `${formatNumber(r.leads)} ÷ ${formatNumber(r.profileVisits)} ${t("profile_visits_unit")}`
    case "follower_conversion_rate":
      return `${formatNumber(r.followersGained)} ÷ ${formatNumber(r.profileVisits)} ${t("profile_visits_unit")}`
  }
}

/** Every derived rate with its formula (RATE_FIELDS) and this post's own inputs. */
export function RatesCard({ row }: { row: TieredRow }) {
  const t = useT(performanceMessages)
  return (
    <SectionCard title={t("rates")} description={t("rates_description")} contentClassName="px-0 pt-2 pb-1">
      <ul className="divide-y">
        {RATE_FIELDS.map((field) => {
          const value = row.rates[field.key]
          return (
            <li key={field.key} className="flex items-start justify-between gap-4 px-4 py-2">
              <div className="min-w-0">
                <p className="text-sm">{field.label}</p>
                <p className="text-xs text-pretty text-muted-foreground">
                  {field.formula}
                  <span className="text-foreground/70 num"> · {rateInputs(field.key, row, t)}</span>
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
  const t = useT(performanceMessages)
  const watch = metric.watch_time_seconds
  const cells: { label: string; value: string }[] = [
    { label: t("views"), value: formatNumber(metric.views) },
    { label: t("reach"), value: formatNumber(metric.reach) },
    { label: t("likes"), value: formatNumber(metric.likes) },
    { label: t("comments"), value: formatNumber(metric.comments) },
    { label: t("shares"), value: formatNumber(metric.shares) },
    { label: t("saves"), value: formatNumber(metric.saves) },
    { label: t("followers_gained"), value: formatNumber(metric.followers_gained) },
    { label: t("profile_visits"), value: formatNumber(metric.profile_visits) },
    { label: t("link_clicks"), value: formatNumber(metric.link_clicks) },
    { label: t("leads"), value: formatNumber(metric.leads) },
    { label: t("sales"), value: formatNumber(metric.sales) },
    { label: t("watch_time"), value: watch === null ? "—" : formatDuration(watch) },
    { label: t("avg_retention"), value: formatPercent(metric.avg_retention) },
  ]
  return (
    <SectionCard
      title={t("latest_snapshot")}
      description={t("snapshot_description", {
        date: formatDate(metric.recorded_at, "EEE, MMM d, yyyy"),
        source: sourceLabel(t, metric.source),
        notes: metric.notes ? ` · ${metric.notes}` : "",
      })}
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
  const t = useT(performanceMessages)
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
      title={t("snapshot_history")}
      description={t.plural("snapshots", snapshots.length, { count: formatNumber(snapshots.length) })}
      action={
        <>
          <Button type="button" variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href={`/analytics/posts?open=${itemId}`}>{t("edit_in_post_performance")}</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus aria-hidden />
            {t("add_analytics")}
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
              { key: "views", label: t("views"), color: "blue" },
              { key: "reach", label: t("reach"), color: "orange" },
            ]}
            height={180}
            aria-label={t("chart_aria")}
          />
        </div>
      ) : null}
      <div className="overflow-x-auto border-t scrollbar-thin">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="h-8 px-4 text-left font-medium">
                {t("recorded")}
              </th>
              {[t("views"), t("reach"), t("likes"), t("comments"), t("shares"), t("saves"), t("leads"), t("eng_rate_short")].map((label) => (
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
                    {index === 0 ? <span className="rounded-sm bg-muted px-1 text-[11px] font-medium text-muted-foreground">{t("latest")}</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{sourceLabel(t, s.source)}</span>
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
