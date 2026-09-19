"use client"

import { AlarmClock, Blend, Send } from "lucide-react"
import { useMemo } from "react"
import { PlatformIcon } from "@/components/common"
import { collabLift, formatMultiple, type CollabLift } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useDb } from "@/lib/store"
import type { ID } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { collabFollowUps, isOpenCollab, nextFollowUp } from "./collab-model"
import { useCollabName } from "./collab-ui"
import { collabLiftMessages } from "./messages"

/** Page header row: collab lift, collabs in progress and follow-ups due. */
export function CollabSummary({ now, onOpen }: { now: Date; onOpen: (id: ID) => void }) {
  const t = useT(collabLiftMessages)
  const name = useCollabName()
  const db = useDb()
  const lift = useMemo(() => collabLift(db, now), [db, now])
  const inProgress = db.collabs.filter(isOpenCollab).length
  const followUps = useMemo(() => collabFollowUps(db.collabs, now).filter((f) => f.reason === "follow_up"), [db.collabs, now])
  const next = useMemo(() => nextFollowUp(db.collabs, now), [db.collabs, now])

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <LiftCard lift={lift} className="col-span-2 xl:col-span-1" />
      <section className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">{t("in_progress")}</span>
          <Send className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <span className="text-2xl font-semibold num">{formatNumber(inProgress)}</span>
        <span className="text-xs text-pretty text-muted-foreground">{t("in_progress_help")}</span>
      </section>
      <section className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">{t("follow_ups")}</span>
          <AlarmClock className={cn("size-4 shrink-0", followUps.length ? "text-warning-fg" : "text-muted-foreground")} aria-hidden />
        </div>
        <span className="text-2xl font-semibold num">{formatNumber(followUps.length)}</span>
        {followUps.length ? (
          <ul className="flex min-w-0 flex-col gap-0.5">
            {followUps.slice(0, 2).map(({ collab }) => (
              <li key={collab.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(collab.id)}
                  className="w-full truncate rounded-sm text-left text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {name(collab)}
                </button>
              </li>
            ))}
            {followUps.length > 2 ? <li className="text-xs text-muted-foreground">{t("and_more", { count: followUps.length - 2 })}</li> : null}
          </ul>
        ) : (
          <span className="text-xs text-muted-foreground">{next ? t("next_follow_up", { date: formatDate(next, "EEE, MMM d") }) : t("none_due")}</span>
        )}
      </section>
    </div>
  )
}

/** Collab lift: collab posts vs solo posts (same platform, last 90 days, median per post) — or what's missing. */
export function LiftCard({ lift, className }: { lift: CollabLift; className?: string }) {
  const t = useT(collabLiftMessages)
  const followers = lift.followers
  const views = lift.views

  return (
    <section className={cn("flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4", className)} aria-labelledby="collab-lift-title">
      <div className="flex min-w-0 items-baseline justify-between gap-x-3 gap-y-0.5 max-sm:flex-col">
        <h2 id="collab-lift-title" className="truncate text-xs font-medium text-muted-foreground">
          {t("title")}
        </h2>
        <span className="text-xs text-muted-foreground" title={t("how", { days: lift.windowDays })}>
          {t("how_short", { days: lift.windowDays })}
        </span>
      </div>

      {lift.enough && followers && views ? (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="shrink-0 text-3xl font-semibold num">
            {followers.lift !== null ? formatMultiple(followers.lift) : `+${formatNumber(Math.round(followers.collab))}`}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-pretty">
              {followers.lift !== null
                ? t("lift_followers", { multiple: formatMultiple(followers.lift) })
                : t("lift_followers_no_baseline", { count: formatNumber(Math.round(followers.collab)) })}
            </p>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{views.lift !== null ? t("lift_views", { multiple: formatMultiple(views.lift) }) : t("lift_views_none")}</span>
              <span aria-hidden>·</span>
              <span className="num">{t("sample", { collab: lift.collabPosts, solo: lift.soloPosts })}</span>
              <span className="inline-flex items-center gap-1">
                {lift.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} label={PLATFORMS[p].label} className="size-3" />
                ))}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-start gap-3">
          <Blend className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium">{t("not_enough_title")}</p>
            <p className="text-xs text-pretty text-muted-foreground">
              {t("not_enough", { collab: lift.collabPosts, solo: lift.soloPosts, days: lift.windowDays })}
            </p>
            {lift.unmatchedCollabPosts ? <p className="text-xs text-pretty text-muted-foreground">{t.plural("unmatched", lift.unmatchedCollabPosts)}</p> : null}
          </div>
        </div>
      )}
    </section>
  )
}
