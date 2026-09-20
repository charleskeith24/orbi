"use client"

import { AlarmClock } from "lucide-react"
import { useMemo } from "react"
import { InfoHint, PlatformIcon, StatTile } from "@/components/common"
import { collabLift, formatMultiple, type CollabLift } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useDb } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { collabFollowUps, isOpenCollab, nextFollowUp } from "./collab-model"
import { useCollabName } from "./collab-ui"
import { collabLiftMessages } from "./messages"

/** A tile label with its ⓘ (the tiles carry numbers; the explanation waits behind the ⓘ). */
function TileLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span className="truncate">{label}</span>
      <InfoHint title={label}>{children}</InfoHint>
    </span>
  )
}

/**
 * The row above the board (Calm UI): Collab lift, collabs in progress and follow-ups due — three compact
 * tiles. How the lift is measured, its sample and what's missing sit in the lift tile's ⓘ.
 */
export function CollabSummary({ now, onOpen }: { now: Date; onOpen: (id: ID) => void }) {
  const t = useT(collabLiftMessages)
  const name = useCollabName()
  const db = useDb()
  const lift = useMemo(() => collabLift(db, now), [db, now])
  const inProgress = db.collabs.filter(isOpenCollab).length
  const followUps = useMemo(() => collabFollowUps(db.collabs, now).filter((f) => f.reason === "follow_up"), [db.collabs, now])
  const next = useMemo(() => nextFollowUp(db.collabs, now), [db.collabs, now])
  const first = followUps[0]?.collab

  return (
    <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
      <LiftTile lift={lift} />
      <StatTile
        size="sm"
        label={<TileLabel label={t("in_progress")}>{t("in_progress_help")}</TileLabel>}
        value={<span className="num">{formatNumber(inProgress)}</span>}
      />
      <StatTile
        size="sm"
        label={t("follow_ups")}
        icon={AlarmClock}
        tone={followUps.length ? "warning" : undefined}
        value={<span className="num">{formatNumber(followUps.length)}</span>}
        sublabel={
          first ? (
            <button
              type="button"
              onClick={() => onOpen(first.id)}
              className="max-w-full truncate rounded-sm text-left underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 max-sm:hidden"
            >
              {name(first)}
              {followUps.length > 1 ? ` ${t("and_more", { count: followUps.length - 1 })}` : ""}
            </button>
          ) : next ? (
            <span className="max-sm:hidden">{t("next_follow_up", { date: formatDate(next, "MMM d") })}</span>
          ) : undefined
        }
      />
    </div>
  )
}

/** Collab lift: collab vs solo posts (same platform, last 90 days, median followers per post) — or "—" and why. */
function LiftTile({ lift }: { lift: CollabLift }) {
  const t = useT(collabLiftMessages)
  const followers = lift.followers
  const views = lift.views
  const enough = lift.enough && followers && views

  const info = (
    <>
      {enough ? (
        <p className="text-foreground">
          {followers.lift !== null
            ? t("lift_followers", { multiple: formatMultiple(followers.lift) })
            : t("lift_followers_no_baseline", { count: formatNumber(Math.round(followers.collab)) })}
        </p>
      ) : (
        <p className="text-foreground">{t("not_enough", { collab: lift.collabPosts, solo: lift.soloPosts, days: lift.windowDays })}</p>
      )}
      <p>{t("how", { days: lift.windowDays })}</p>
      {enough ? (
        <p className="flex flex-wrap items-center gap-x-1.5 num">
          {t("sample", { collab: lift.collabPosts, solo: lift.soloPosts })}
          {lift.platforms.map((p) => (
            <PlatformIcon key={p} platform={p} label={PLATFORMS[p].label} className="size-3" />
          ))}
        </p>
      ) : null}
      {lift.unmatchedCollabPosts ? <p>{t.plural("unmatched", lift.unmatchedCollabPosts)}</p> : null}
    </>
  )

  return (
    <StatTile
      size="sm"
      label={<TileLabel label={t("title")}>{info}</TileLabel>}
      value={
        enough ? (
          <span className="num">{followers.lift !== null ? formatMultiple(followers.lift) : `+${formatNumber(Math.round(followers.collab))}`}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      }
      sublabel={
        <span className="max-sm:hidden">
          {enough ? (views.lift !== null ? t("lift_views", { multiple: formatMultiple(views.lift) }) : t("lift_views_none")) : t("not_enough_title")}
        </span>
      }
    />
  )
}
