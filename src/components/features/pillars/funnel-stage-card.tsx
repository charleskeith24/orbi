"use client"

import Link from "next/link"
import { SeriesKey } from "@/components/charts"
import { FunnelBadge, Meter, PlatformIcon, Token } from "@/components/common"
import type { FunnelAggregate, FunnelMixRow } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { contentItemDate, formatShortDate } from "@/lib/dates"
import type { FunnelStage } from "@/lib/types"
import { formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { FUNNEL_COLORS, type StageContent } from "./funnel-utils"
import { MixStatusPill } from "./mix-status"

/** One funnel stage: its job, examples, share vs target, published performance and recent pieces. */
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
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.goal}</p>
        </div>
        <MixStatusPill status={mix?.status} deviation={mix?.deviation ?? 0} enoughData={enoughData} className="shrink-0" />
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="num text-base leading-none font-semibold text-foreground">{Math.round(actual)}%</span> actual
          <span aria-hidden> · </span>
          target <span className="num font-medium text-foreground">{target}%</span>
          <span aria-hidden> · </span>
          {pluralize(mix?.count ?? 0, "item")}
        </p>
        <Meter
          value={actual}
          max={scaleMax}
          target={target}
          color={FUNNEL_COLORS[stage]}
          aria-label={`${meta.label} share of content`}
          valueText={`${Math.round(actual)}% actual, target ${target}%`}
        />
      </div>

      <dl className="grid grid-cols-4 gap-3 border-t pt-3" aria-label={`Published performance, ${windowLabel}`}>
        <MiniStat label="Posts" value={formatNumber(perf?.posts ?? 0)} />
        <MiniStat label="Avg views" value={formatCompact(perf?.avgViews ?? null)} />
        <MiniStat label="Engagement" value={formatPercent(perf?.engagementRate ?? null)} />
        <MiniStat label="Leads" value={formatNumber(perf?.leads ?? 0)} />
      </dl>

      <div className="flex min-w-0 flex-wrap gap-1" aria-label={`${meta.label} examples`}>
        {meta.examples.map((example) => (
          <Token key={example} className="font-normal text-foreground/85">
            {example}
          </Token>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t pt-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Recently published</span>
          <span className="num text-muted-foreground">{formatNumber(content.inProduction)} in production</span>
        </div>
        {content.recent.length ? (
          <ul className="-mx-2 flex flex-col">
            {content.recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/studio/${item.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{item.title || "Untitled content"}</span>
                  <span className="num shrink-0 text-xs text-muted-foreground">{formatShortDate(contentItemDate(item))}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-xs text-muted-foreground">Nothing published at this stage yet.</p>
        )}
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
