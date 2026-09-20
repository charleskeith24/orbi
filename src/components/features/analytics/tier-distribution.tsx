"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { ChartFrame, FunnelBars } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { PERFORMANCE_TIERS, WINNER_METRIC_MAP } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { AppSettings, PerformanceTier } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { formatRatio } from "./format"
import { analyticsMessages } from "./messages"
import { TIERS_DESC, type TierSummary } from "./scope"

function thresholdLabel(tier: PerformanceTier, s: AppSettings): string {
  switch (tier) {
    case "breakout":
      return `≥ ${formatRatio(s.tier_breakout)}`
    case "winner":
      return `${formatRatio(s.tier_winner)} – ${formatRatio(s.tier_breakout)}`
    case "good":
      return `${formatRatio(s.tier_good)} – ${formatRatio(s.tier_winner)}`
    case "normal":
      return `< ${formatRatio(s.tier_good)}`
  }
}

/** Winner detection outcome (Normal / Good / Winner / Breakout) for the posts in scope. */
export function TierDistribution({ summary, settings, postsHref }: { summary: TierSummary; settings: AppSettings; postsHref: string }) {
  const t = useT(analyticsMessages)
  const metric = WINNER_METRIC_MAP[settings.winner_metric]?.label.toLowerCase() ?? "performance"
  const notes = [
    summary.untiered
      ? t.plural("untiered", summary.untiered, { count: formatNumber(summary.untiered), min: settings.winner_min_sample })
      : null,
    summary.unmeasured ? t.plural("unmeasured", summary.unmeasured, { count: formatNumber(summary.unmeasured) }) : null,
  ].filter(Boolean)

  return (
    <ChartFrame
      title={t("tier_title")}
      info={t("tier_info", { metric, window: settings.winner_window })}
      actions={
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/winners">
            Winners
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
      table={{
        columns: ["Tier", t("col_threshold"), "Posts", t("col_share")],
        rows: TIERS_DESC.map((tier) => [
          PERFORMANCE_TIERS[tier].label,
          thresholdLabel(tier, settings),
          summary.counts[tier],
          summary.tiered ? formatPercent((summary.counts[tier] / summary.tiered) * 100) : "—",
        ]),
      }}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span>{notes.length ? `${notes.join(" · ")}.` : t("all_tiered")}</span>
          {summary.counts.winner + summary.counts.breakout > 0 ? (
            <Link href={postsHref} className="font-medium text-foreground underline-offset-2 hover:underline">
              {t("see_winning")}
            </Link>
          ) : null}
        </div>
      }
    >
      <FunnelBars
        stages={
          summary.tiered
            ? TIERS_DESC.map((tier) => ({
                id: tier,
                label: PERFORMANCE_TIERS[tier].label,
                value: summary.counts[tier],
                sublabel: thresholdLabel(tier, settings),
              }))
            : []
        }
        emptyMessage={t("tier_empty", { min: settings.winner_min_sample })}
        aria-label={t("tier_aria")}
      />
    </ChartFrame>
  )
}
