"use client"

import Link from "next/link"
import {
  ContentThumbnail,
  PillarBadge,
  PlatformIcon,
  SectionCard,
  TierBadge,
  type IconComponent,
} from "@/components/common"
import type { TieredRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn, formatNumber, formatPercent } from "@/lib/utils"
import { reportMessages } from "./messages"
import { formatRatio } from "./report-format"

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium num">{value}</dd>
    </div>
  )
}

/** One published post: thumbnail, title → Studio, platform · pillar · date, key numbers, tier and hook. */
export function PostSummary({ row, className }: { row: TieredRow; className?: string }) {
  const t = useT(reportMessages)
  const title = row.item.title.trim() || t("untitled_content")
  const measured = Boolean(row.metric)
  const hook = row.item.hook.trim()
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <ContentThumbnail item={row.item} size="sm" aspect="square" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/studio/${row.id}`}
            title={title}
            className="line-clamp-2 text-sm font-medium text-pretty outline-none underline-offset-2 hover:underline focus-visible:underline"
          >
            {title}
          </Link>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex shrink-0 items-center gap-1">
              <PlatformIcon platform={row.platform} className="size-3.5" />
              {PLATFORMS[row.platform]?.label ?? row.platform}
            </span>
            <PillarBadge pillarId={row.pillarId} variant="plain" className="min-w-0 font-normal text-muted-foreground" />
            <span className="shrink-0 num">{formatShortDate(row.publishedAt)}</span>
          </div>
        </div>
        <TierBadge tier={row.tier} className="shrink-0" />
      </div>
      <dl className="grid grid-cols-4 gap-2 border-t pt-3">
        <Figure label={t("views")} value={measured ? formatNumber(row.views) : "—"} />
        <Figure label={t("eng_rate")} value={formatPercent(row.rates.engagement_rate)} />
        <Figure label={t("leads")} value={measured ? formatNumber(row.leads) : "—"} />
        <Figure label={t("vs_baseline")} value={formatRatio(row.ratio)} />
      </dl>
      {hook ? (
        <p className="line-clamp-2 text-xs text-pretty text-muted-foreground">
          <span className="font-medium text-foreground/80">{t("hook")}</span> “{hook}”
        </p>
      ) : null}
    </div>
  )
}

/** A titled card around one post (Best post, Worst post, Best content) with an empty state. */
export function PostHighlightCard({
  title,
  description,
  icon,
  row,
  empty,
  className,
}: {
  title: string
  description?: string
  icon: IconComponent
  row: TieredRow | null
  empty: React.ReactNode
  className?: string
}) {
  return (
    <SectionCard title={title} description={description} icon={icon} className={cn("print:break-inside-avoid", className)}>
      {row ? <PostSummary row={row} /> : empty}
    </SectionCard>
  )
}
