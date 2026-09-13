"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { ChartFrame, FunnelBars } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { PERFORMANCE_TIERS, WINNER_METRIC_MAP } from "@/lib/constants"
import type { AppSettings, PerformanceTier } from "@/lib/types"
import { formatPercent, pluralize } from "@/lib/utils"
import { formatRatio } from "./format"
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
  const metric = WINNER_METRIC_MAP[settings.winner_metric]?.label.toLowerCase() ?? "performance"
  const notes = [
    summary.untiered ? `${pluralize(summary.untiered, "post")} not tiered yet (fewer than ${settings.winner_min_sample} earlier posts on the platform)` : null,
    summary.unmeasured ? `${pluralize(summary.unmeasured, "post")} without analytics` : null,
  ].filter(Boolean)

  return (
    <ChartFrame
      title="Tier distribution"
      description={`Each post vs the average ${metric} of the previous ${settings.winner_window} posts on its platform`}
      actions={
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/winners">
            Winners
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
      table={{
        columns: ["Tier", "Threshold", "Posts", "Share"],
        rows: TIERS_DESC.map((tier) => [
          PERFORMANCE_TIERS[tier].label,
          thresholdLabel(tier, settings),
          summary.counts[tier],
          summary.tiered ? formatPercent((summary.counts[tier] / summary.tiered) * 100) : "—",
        ]),
      }}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span>{notes.length ? `${notes.join(" · ")}.` : "Every post in scope is tiered."}</span>
          {summary.counts.winner + summary.counts.breakout > 0 ? (
            <Link href={postsHref} className="font-medium text-foreground underline-offset-2 hover:underline">
              See winning posts
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
        emptyMessage={`No tiered posts yet — a post is tiered once it has analytics and ${settings.winner_min_sample}+ earlier posts on its platform.`}
        aria-label="Posts per performance tier"
      />
    </ChartFrame>
  )
}
