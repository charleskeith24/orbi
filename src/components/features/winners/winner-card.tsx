"use client"

import { Lightbulb, Pin, Repeat2 } from "lucide-react"
import { ContentThumbnail, Disclosure, PillarBadge, PlatformLabel, StatusPill, TierBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { isWinnerTier } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import type { ID } from "@/lib/types"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { winnersMessages } from "./messages"
import { togglePinnedWinner } from "./winner-actions"
import { formatRatio, type WinnerEntry } from "./winners-model"

function Detail({ label, value, clamp = false }: { label: string; value: string; clamp?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-xs",
          clamp ? "line-clamp-2 text-pretty" : "truncate",
          value ? "text-foreground/90" : "text-muted-foreground"
        )}
      >
        {value || "—"}
      </dd>
    </div>
  )
}

/** One post in the Winning Content Library grid. The title is a stretched button: the whole card opens the detail sheet. */
export function WinnerCard({ entry, onOpen }: { entry: WinnerEntry; onOpen: (id: ID) => void }) {
  const t = useT(winnersMessages)
  const { row } = entry
  const { item } = row
  const pinned = item.pinned_winner

  return (
    <article className="relative flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-3 p-4 pb-3">
        <ContentThumbnail item={item} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
            {isWinnerTier(row.tier) ? <TierBadge tier={row.tier} /> : <StatusPill icon={Pin}>{t("pinned")}</StatusPill>}
            {row.ratio !== null ? (
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground num">{formatRatio(row.ratio)}</span> {t("baseline")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm leading-5 font-medium">
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className="block w-full text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
            >
              <span className="line-clamp-2 text-pretty">{item.title || t("untitled_content")}</span>
            </button>
          </h3>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <PlatformLabel platform={row.platform} className="text-xs" />
            <PillarBadge pillarId={row.pillarId} variant="plain" className="font-normal text-muted-foreground" />
            {entry.format ? <span className="min-w-0 truncate">{entry.format}</span> : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-pressed={pinned}
          aria-label={pinned ? t("unpin_aria") : t("pin_aria")}
          title={pinned ? t("unpin_title") : t("pin_title")}
          onClick={() => togglePinnedWinner(item, row.tier)}
          className="relative z-10 -mt-1 -mr-2 shrink-0 text-muted-foreground"
        >
          <Pin className={cn(pinned && "fill-current text-foreground")} aria-hidden />
        </Button>
      </div>

      <div className="mt-auto flex min-w-0 flex-col border-t px-4 py-2.5">
        <Disclosure className="relative z-10">
          <dl className="flex flex-col gap-1.5 pb-1">
            <Detail label={t("hook")} value={item.hook ? `“${item.hook}”` : ""} clamp />
            <Detail label={t("angle")} value={entry.angle} />
            <Detail label={t("topic")} value={entry.topic} />
            <Detail label={t("cta")} value={entry.cta} clamp />
          </dl>
        </Disclosure>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground num">{formatCompact(row.views)}</span> {t("views")}
        </span>
        <span title={t("engagements_title", { count: formatNumber(row.engagements) })}>
          <span className="font-medium text-foreground num">{formatPercent(row.rates.engagement_rate)}</span> {t("engagement")}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="size-3.5" aria-hidden />
            {entry.childCount ? t.plural("versions", entry.childCount, { count: formatNumber(entry.childCount) }) : t("not_repurposed")}
          </span>
          {entry.ideaCount ? (
            <span className="inline-flex items-center gap-1" title={t("ideas_saved_title")}>
              <Lightbulb className="size-3.5" aria-hidden />
              <span className="num">{formatNumber(entry.ideaCount)}</span>
              <span className="sr-only">{t.plural("ideas_saved_sr", entry.ideaCount)}</span>
            </span>
          ) : null}
        </span>
      </div>
    </article>
  )
}
