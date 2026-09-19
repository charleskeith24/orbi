"use client"

import { AlarmClock, BellRing, Blend, CalendarCheck } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { PlatformIcon } from "@/components/common"
import { InlineEmpty, OpenButton, WorkSection } from "@/components/features/today/work-section"
import { Button } from "@/components/ui/button"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import { markFollowedUp } from "./collab-actions"
import { collabFollowUps, isOpenCollab, nextFollowUp, partnerLabel, type CollabFollowUp } from "./collab-model"
import { CollabTypeBadge, useCollabName } from "./collab-ui"
import { collabLinkMessages } from "./messages"

/**
 * Today → "Collab follow-ups": collabs waiting for a reply whose follow-up date has come, plus scheduled
 * collabs happening today. Hidden until the creator has a collab in progress.
 */
export function CollabFollowUpsSection({ now, className }: { now: Date; className?: string }) {
  const t = useT(collabLinkMessages)
  const name = useCollabName()
  const collabs = useTable("collabs")
  const rows = useMemo(() => collabFollowUps(collabs, now), [collabs, now])
  const next = useMemo(() => nextFollowUp(collabs, now), [collabs, now])
  if (!rows.length && !collabs.some(isOpenCollab)) return null

  const meta = ({ collab, reason, daysLate }: CollabFollowUp) =>
    reason === "today" ? (
      <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-foreground/80">
        <CalendarCheck className="size-3.5" aria-hidden />
        {t("happening_today")}
      </span>
    ) : (
      <span className={daysLate ? "inline-flex items-center gap-1 font-medium whitespace-nowrap text-critical-fg" : "inline-flex items-center gap-1 whitespace-nowrap"}>
        <AlarmClock className="size-3.5" aria-hidden />
        {daysLate ? t.plural("follow_up_late", daysLate) : t("follow_up_today")}
        {collab.follow_up_on && daysLate ? <span className="sr-only">{formatDate(collab.follow_up_on)}</span> : null}
      </span>
    )

  return (
    <WorkSection
      id="collab-follow-ups"
      title={t("today_title")}
      icon={Blend}
      description={t("today_description")}
      action={
        <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
          <Link href="/collabs">Collabs</Link>
        </Button>
      }
      items={rows}
      getKey={(row) => row.collab.id}
      className={className}
      renderItem={(row) => {
        const { collab } = row
        const title = name(collab)
        const partner = partnerLabel(collab)
        return (
          <div className="flex min-w-0 flex-col gap-2 px-4 py-2.5 @lg/work:flex-row @lg/work:items-center @lg/work:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {collab.partner_platform ? (
                <PlatformIcon platform={collab.partner_platform} label={PLATFORMS[collab.partner_platform].label} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Blend className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/collabs?open=${collab.id}`}
                  className="line-clamp-2 rounded-sm text-sm leading-snug font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {title}
                </Link>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  {meta(row)}
                  {partner && partner !== title ? <span className="truncate">{partner}</span> : null}
                  <CollabTypeBadge type={collab.type} />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-6.5 @lg/work:pl-0">
              {row.reason === "follow_up" ? (
                <Button type="button" size="sm" variant="outline" onClick={() => markFollowedUp(collab, now)}>
                  <BellRing aria-hidden />
                  {t("followed_up")}
                </Button>
              ) : null}
              <OpenButton href={`/collabs?open=${collab.id}`} label={t("open_collab", { title })} />
            </div>
          </div>
        )
      }}
      empty={
        <InlineEmpty icon={BellRing}>{next ? t("today_empty_next", { date: formatDate(next, "EEE, MMM d") }) : t("today_empty")}</InlineEmpty>
      }
    />
  )
}
