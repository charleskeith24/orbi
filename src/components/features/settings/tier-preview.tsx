"use client"

import { ArrowRight, Trophy } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { EmptyState, Meter, PlatformIcon, SectionCard, TierBadge } from "@/components/common"
import { computeTiers, itemPerformanceRows, type TierInfo } from "@/lib/analytics"
import { PERFORMANCE_TIERS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import type { AppSettings, ID, PerformanceTier } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { performanceMessages } from "./performance-messages"
import type { PerformanceValues } from "./sections"

const TIER_ORDER: PerformanceTier[] = ["breakout", "winner", "good", "normal"]
const TIER_RANK: Record<PerformanceTier, number> = { normal: 0, good: 1, winner: 2, breakout: 3 }

/** 1.5 → "1.5×". */
export function formatTimes(value: number): string {
  return `${Number(value.toFixed(2))}×`
}

type TierCounts = Record<PerformanceTier, number> & { untiered: number }

function countTiers(tiers: Map<ID, TierInfo>): TierCounts {
  const counts: TierCounts = { normal: 0, good: 0, winner: 0, breakout: 0, untiered: 0 }
  for (const info of tiers.values()) {
    if (info.ratio === null) counts.untiered++
    else counts[info.tier]++
  }
  return counts
}

type TierFields = Pick<AppSettings, "winner_metric" | "winner_window" | "winner_min_sample" | "tier_good" | "tier_winner" | "tier_breakout">

/** Tier settings from the form, or null while any of them is invalid. */
export function tierFieldsFrom(v: PerformanceValues): TierFields | null {
  const { winner_window: w, winner_min_sample: m, tier_good: g, tier_winner: wi, tier_breakout: b } = v
  if (w === null || m === null || g === null || wi === null || b === null) return null
  if (!Number.isInteger(w) || !Number.isInteger(m) || w < 1 || m < 1 || m > w || g <= 1 || wi <= g || b <= wi) return null
  return { winner_metric: v.winner_metric, winner_window: w, winner_min_sample: m, tier_good: g, tier_winner: wi, tier_breakout: b }
}

/** Live count of published posts per tier with the edited (unsaved) settings, and which posts move. */
export function TierPreview({ fields, dirty, now, className }: { fields: TierFields | null; dirty: boolean; now: Date; className?: string }) {
  const db = useDb()
  const settings = useSettings()
  const t = useT(performanceMessages)
  const published = useMemo(() => itemPerformanceRows(db, now), [db, now])
  const savedTiers = useMemo(() => computeTiers(db, settings, now), [db, settings, now])
  const draftTiers = useMemo(() => (fields ? computeTiers(db, { ...settings, ...fields }, now) : null), [db, settings, fields, now])

  const saved = useMemo(() => countTiers(savedTiers), [savedTiers])
  const draft = useMemo(() => (draftTiers ? countTiers(draftTiers) : null), [draftTiers])
  const changes = useMemo(() => {
    if (!draftTiers) return []
    const byId = new Map(published.map((r) => [r.id, r]))
    const out: { id: ID; title: string; platform: (typeof published)[number]["platform"]; from: PerformanceTier | null; to: PerformanceTier | null }[] = []
    for (const [id, info] of draftTiers) {
      const before = savedTiers.get(id)
      const from = before && before.ratio !== null ? before.tier : null
      const to = info.ratio !== null ? info.tier : null
      const row = byId.get(id)
      if (from !== to && row) out.push({ id, title: row.item.title || t("untitled"), platform: row.platform, from, to })
    }
    return out.sort((a, b) => TIER_RANK[b.to ?? "normal"] - TIER_RANK[a.to ?? "normal"] || a.title.localeCompare(b.title))
  }, [draftTiers, savedTiers, published, t])

  const counts = draft ?? saved
  const measured = savedTiers.size
  const tiered = measured - counts.untiered
  const minSample = fields ? Math.min(fields.winner_window, fields.winner_min_sample) : Math.min(settings.winner_window, settings.winner_min_sample)

  return (
    <SectionCard
      title={t("preview_title")}
      description={!fields ? t("preview_invalid") : dirty ? t("preview_dirty") : t("preview_saved")}
      className={className}
    >
      {!published.length ? (
        <EmptyState
          compact
          icon={Trophy}
          title={t("preview_empty_title")}
          description={t("preview_empty_description")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2.5" aria-label={t("per_tier_aria")}>
            {TIER_ORDER.map((tier) => {
              const value = counts[tier]
              const delta = draft ? draft[tier] - saved[tier] : 0
              return (
                <li key={tier} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <TierBadge tier={tier} showNormal />
                    <span className="flex items-baseline gap-1.5 text-sm">
                      {delta ? (
                        <span className="text-xs text-muted-foreground num">
                          {delta > 0 ? "+" : "−"}
                          {Math.abs(delta)}
                        </span>
                      ) : null}
                      <span className="font-medium num">{formatNumber(value)}</span>
                    </span>
                  </div>
                  <Meter
                    value={value}
                    max={Math.max(1, tiered)}
                    size="sm"
                    tone={tier === "normal" ? "neutral" : "good"}
                    aria-label={t("tier_posts_aria", { tier: PERFORMANCE_TIERS[tier].label })}
                    valueText={t("tier_value", { value, total: tiered })}
                  />
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-pretty text-muted-foreground">
            {counts.untiered
              ? `${t.plural("untiered", counts.untiered, { count: formatNumber(counts.untiered), min: minSample })} `
              : ""}
            {published.length - measured
              ? t.plural("no_analytics", published.length - measured, { count: formatNumber(published.length - measured) })
              : t("all_analytics")}
          </p>
          {draft && dirty ? (
            <div className="flex flex-col gap-2 border-t pt-3">
              <p className="text-xs font-medium">
                {changes.length ? t.plural("changes", changes.length, { count: formatNumber(changes.length) }) : t("no_changes")}
              </p>
              {changes.length ? (
                <ul className="flex flex-col gap-1.5">
                  {changes.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex min-w-0 items-center gap-2 text-xs">
                      <PlatformIcon platform={c.platform} className="size-3.5 text-muted-foreground" />
                      <Link
                        href={`/analytics/posts?open=${c.id}`}
                        className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                        title={c.title}
                      >
                        {c.title}
                      </Link>
                      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                        {c.from ? PERFORMANCE_TIERS[c.from].label : t("untiered")}
                        <ArrowRight className="size-3" aria-label={t("arrow_to")} />
                        <span className={cn(c.to && c.to !== "normal" && "font-medium text-foreground")}>
                          {c.to ? PERFORMANCE_TIERS[c.to].label : t("untiered")}
                        </span>
                      </span>
                    </li>
                  ))}
                  {changes.length > 5 ? <li className="text-xs text-muted-foreground">{t("and_more", { count: changes.length - 5 })}</li> : null}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}

/** Normal | Good | Winner | Breakout as four equal bands, each labelled with where it starts. */
export function TierScale({ good, winner, breakout }: { good: number; winner: number; breakout: number }) {
  const t = useT(performanceMessages)
  const stops: { tier: PerformanceTier; label: string; fill: string }[] = [
    { tier: "normal", label: `< ${formatTimes(good)}`, fill: "bg-muted-foreground/25" },
    { tier: "good", label: `≥ ${formatTimes(good)}`, fill: "bg-good/45" },
    { tier: "winner", label: `≥ ${formatTimes(winner)}`, fill: "bg-good/75" },
    { tier: "breakout", label: `≥ ${formatTimes(breakout)}`, fill: "bg-good" },
  ]
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <p className="sr-only">
        {t("scale_sr", { good: formatTimes(good), winner: formatTimes(winner), breakout: formatTimes(breakout) })}
      </p>
      <div aria-hidden className="grid grid-cols-4 gap-0.5">
        {stops.map((s) => (
          <div key={s.tier} className={cn("h-1.5 first:rounded-l-[3px] last:rounded-r-[3px]", s.fill)} />
        ))}
      </div>
      <div aria-hidden className="grid grid-cols-4 gap-0.5 text-[11px] leading-4 text-muted-foreground">
        {stops.map((s) => (
          <span key={s.tier} className="min-w-0 truncate">
            <span className="text-foreground/80">{PERFORMANCE_TIERS[s.tier].label}</span> <span className="num">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
