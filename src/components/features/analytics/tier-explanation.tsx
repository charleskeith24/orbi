import Link from "next/link"
import { DefinitionList, KeyValue, StatusPill, TierBadge } from "@/components/common"
import type { TieredRow } from "@/lib/analytics"
import { PERFORMANCE_TIERS, PLATFORMS, WINNER_METRIC_MAP } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { AppSettings, PerformanceTier } from "@/lib/types"
import { cn, formatNumber, formatPercent } from "@/lib/utils"
import { formatRatio } from "./format"
import { analyticsMessages } from "./messages"

type TierSettings = Pick<
  AppSettings,
  "winner_metric" | "winner_window" | "winner_min_sample" | "tier_good" | "tier_winner" | "tier_breakout"
>

function formatComparison(value: number | null, settings: TierSettings): string {
  if (value === null) return "—"
  if (settings.winner_metric === "composite") return value.toFixed(2)
  if (settings.winner_metric === "engagement_rate") return formatPercent(value)
  return formatNumber(value)
}

/** Why a post has its tier: value vs baseline, ratio, sample size and the thresholds. */
export function TierExplanation({ row, settings }: { row: TieredRow; settings: TierSettings }) {
  const t = useT(analyticsMessages)
  const platform = PLATFORMS[row.platform].label
  const metric = WINNER_METRIC_MAP[settings.winner_metric]?.label ?? "Performance"
  const composite = settings.winner_metric === "composite"
  const minSample = Math.min(settings.winner_window, settings.winner_min_sample)

  let reason: string | null = null
  if (!row.metric) reason = t("explain_no_metric")
  else if (row.ratio === null) {
    if (row.sampleSize < minSample) {
      reason = t.plural("explain_few", row.sampleSize, { count: formatNumber(row.sampleSize), platform, min: minSample })
    } else if (row.value === null) reason = t("explain_no_value", { metric: metric.toLowerCase() })
    else reason = t("explain_zero")
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {row.ratio !== null ? <TierBadge tier={row.tier} showNormal /> : <StatusPill tone="neutral">{t("not_tiered")}</StatusPill>}
        <span className="text-sm">
          {row.ratio !== null ? (
            <>
              <span className="num font-medium">{formatRatio(row.ratio)}</span> {t("the_average", { platform })}
            </>
          ) : (
            reason
          )}
        </span>
      </div>
      {row.metric ? (
        <DefinitionList layout="vertical" columns={3}>
          <KeyValue label={composite ? "Performance index" : t("this_post", { metric: metric.toLowerCase() })}>
            <span className="num">{formatComparison(row.value, settings)}</span>
          </KeyValue>
          <KeyValue label="Baseline">
            <span className="num">{formatComparison(row.baseline, settings)}</span>
            <span className="block text-xs text-muted-foreground">
              {t.plural("avg_of", row.sampleSize, { count: formatNumber(row.sampleSize) })}
            </span>
          </KeyValue>
          <KeyValue label="Ratio">
            <span className="num">{formatRatio(row.ratio)}</span>
          </KeyValue>
        </DefinitionList>
      ) : null}
      <TierScale ratio={row.ratio} active={row.ratio !== null ? row.tier : null} settings={settings} />
      <p className="text-xs text-pretty text-muted-foreground">
        {composite ? t("composite_note") : null}
        {t("compared_with", { metric: metric.toLowerCase(), window: settings.winner_window, platform, min: minSample })}{" "}
        <Link href="/settings?tab=performance" className="font-medium text-foreground underline-offset-2 hover:underline">
          {t("edit_thresholds")}
        </Link>
      </p>
    </div>
  )
}

function TierScale({ ratio, active, settings }: { ratio: number | null; active: PerformanceTier | null; settings: TierSettings }) {
  const max = Math.max(settings.tier_breakout * 1.4, (ratio ?? 0) * 1.08)
  const stops: { tier: PerformanceTier; from: number; to: number }[] = [
    { tier: "normal", from: 0, to: settings.tier_good },
    { tier: "good", from: settings.tier_good, to: settings.tier_winner },
    { tier: "winner", from: settings.tier_winner, to: settings.tier_breakout },
    { tier: "breakout", from: settings.tier_breakout, to: max },
  ]
  const span = (s: { from: number; to: number }) => `${Math.max(0.0001, s.to - s.from)} 1 0px`
  return (
    <div aria-hidden className="flex flex-col gap-1.5">
      <div className="relative flex h-2 gap-0.5">
        {stops.map((s) => (
          <div
            key={s.tier}
            className={cn("h-full first:rounded-l-[3px] last:rounded-r-[3px]", s.tier === active ? (s.tier === "normal" ? "bg-foreground/35" : "bg-good") : "bg-muted")}
            style={{ flex: span(s) }}
          />
        ))}
        {ratio !== null ? (
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
            style={{ left: `${Math.min(100, Math.max(0, (ratio / max) * 100))}%` }}
          />
        ) : null}
      </div>
      <div className="flex gap-0.5 text-[11px] text-muted-foreground">
        {stops.map((s) => (
          <span key={s.tier} className={cn("min-w-0 truncate", s.tier === active && "font-medium text-foreground")} style={{ flex: span(s) }}>
            {PERFORMANCE_TIERS[s.tier].label}
            {s.from > 0 ? <span className="num"> {formatRatio(s.from)}</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}
