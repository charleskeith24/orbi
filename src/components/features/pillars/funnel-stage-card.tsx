"use client"

import Link from "next/link"
import { SeriesKey } from "@/components/charts"
import { Disclosure, FunnelBadge, InfoHint, Meter, PlatformIcon } from "@/components/common"
import { funnelGoalMessages } from "@/components/common/messages"
import type { FunnelAggregate, FunnelMixRow } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { contentItemDate, formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { FunnelStage } from "@/lib/types"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { funnelMessages } from "./funnel-messages"
import { FUNNEL_COLORS, type StageContent } from "./funnel-utils"
import { MixStatusPill } from "./mix-status"
import { pillarMessages } from "./pillar-messages"

/** One funnel stage: its job (examples behind the ⓘ), share vs target, published performance and recent pieces. */
export function FunnelStageCard({
  stage,
  mix,
  perf,
  target,
  content,
  enoughData,
  scaleMax,
  windowLabel,
}: {
  stage: FunnelStage
  mix: FunnelMixRow | undefined
  perf: FunnelAggregate | undefined
  /** Raw target from settings (0–100). */
  target: number
  content: StageContent
  enoughData: boolean
  scaleMax: number
  windowLabel: string
}) {
  const t = useT(funnelMessages)
  const p = useT(pillarMessages)
  const goal = useT(funnelGoalMessages)
  const meta = FUNNEL_STAGES[stage]
  const actual = mix?.actualPct ?? 0

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SeriesKey color={FUNNEL_COLORS[stage]} />
            <h3 className="text-sm leading-5 font-semibold">{meta.name}</h3>
            <FunnelBadge stage={stage} />
            <InfoHint title={meta.name} label={t("examples_aria", { label: meta.label })}>
              <p>{goal(stage)}</p>
              <p>
                <span className="font-medium text-foreground">{t("examples")}</span> {meta.examples.join(", ")}
              </p>
            </InfoHint>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{goal(stage)}</p>
        </div>
        <MixStatusPill status={mix?.status} deviation={mix?.deviation ?? 0} enoughData={enoughData} className="shrink-0" />
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="num text-base leading-none font-semibold text-foreground">{Math.round(actual)}%</span> {p("actual_word")}
          <span aria-hidden> · </span>
          {p("target_word")} <span className="num font-medium text-foreground">{target}%</span>
          <span aria-hidden> · </span>
          {p.plural("items", mix?.count ?? 0, { count: formatNumber(mix?.count ?? 0) })}
        </p>
        <Meter
          value={actual}
          max={scaleMax}
          target={target}
          color={FUNNEL_COLORS[stage]}
          aria-label={p("share_aria", { name: meta.label })}
          valueText={p("actual_value", { actual: Math.round(actual), target })}
        />
      </div>

      <dl className="grid grid-cols-4 gap-3 border-t pt-3" aria-label={p("performance_aria", { window: windowLabel })}>
        <MiniStat label={p("posts")} value={formatNumber(perf?.posts ?? 0)} />
        <MiniStat label={p("avg_views")} value={formatCompact(perf?.avgViews ?? null)} />
        <MiniStat label={p("engagement")} value={formatPercent(perf?.engagementRate ?? null)} />
        <MiniStat label={p("leads")} value={formatNumber(perf?.leads ?? 0)} />
      </dl>

      <div className="mt-auto flex min-w-0 items-start justify-between gap-2 border-t pt-2.5">
        {content.recent.length ? (
          <Disclosure label={t("recently_published")} meta={`· ${content.recent.length}`} className="min-w-0 flex-1">
            <ul className="-mx-2 flex flex-col">
              {content.recent.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/studio/${item.id}`}
                    className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title || p("untitled_content")}</span>
                    <span className="num shrink-0 text-xs text-muted-foreground">{formatShortDate(contentItemDate(item))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : (
          <p className="py-0.5 text-xs text-muted-foreground">{t("nothing_published")}</p>
        )}
        <span className="num shrink-0 py-0.5 text-xs text-muted-foreground">{t("in_production", { count: formatNumber(content.inProduction) })}</span>
      </div>
    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="num truncate text-sm font-medium">{value}</dd>
    </div>
  )
}
