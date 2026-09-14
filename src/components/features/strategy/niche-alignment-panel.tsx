"use client"

import { Info, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Fragment, useDeferredValue, useMemo } from "react"
import { Meter, StatusPill, Token, type MeterTone, type StatusTone } from "@/components/common"
import { useDb, useSettings } from "@/lib/store"
import { pluralize } from "@/lib/utils"
import {
  ALIGNMENT_DAYS,
  HIGH_ALIGNMENT,
  LOW_ALIGNMENT,
  MIN_ALIGNMENT_SAMPLE,
  nicheAlignment,
  type AlignedItem,
  type AlignmentGroup,
  type AlignmentStatus,
} from "./niche-alignment"

const STATUS: Record<AlignmentStatus, { label: string; tone: StatusTone }> = {
  "no-niche": { label: "No niche set", tone: "neutral" },
  "not-enough": { label: "Not enough content yet", tone: "neutral" },
  low: { label: "Mostly off niche", tone: "warning" },
  mixed: { label: "Partly on niche", tone: "neutral" },
  high: { label: "On niche", tone: "good" },
}

function meterTone(share: number | null): MeterTone {
  if (share === null) return "neutral"
  return share >= HIGH_ALIGNMENT ? "good" : share < LOW_ALIGNMENT ? "warning" : "brand"
}

function AlignmentStat({ label, group, noun, emptyText }: { label: string; group: AlignmentGroup; noun: string; emptyText: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        {group.share !== null ? <span className="font-medium num">{Math.round(group.share * 100)}%</span> : null}
      </p>
      {group.total ? (
        <>
          <Meter
            value={group.aligned}
            max={group.total}
            tone={meterTone(group.share)}
            size="sm"
            aria-label={`${label}: on niche`}
            valueText={`${group.aligned} of ${group.total}`}
          />
          <p className="text-xs text-muted-foreground num">
            {group.aligned} of {pluralize(group.total, noun)} match your niche
          </p>
        </>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">{emptyText}</p>
      )}
    </div>
  )
}

/** “A”, “B” and 3 more — each title links to the post in the Studio. */
function TitleList({ items, max = 3 }: { items: AlignedItem[]; max?: number }) {
  const shown = items.slice(0, max)
  const more = items.length - shown.length
  return (
    <>
      {shown.map((item, index) => (
        <Fragment key={item.id}>
          {index ? (index === shown.length - 1 && !more ? " and " : ", ") : ""}
          <Link href={`/studio/${item.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
            “{item.title}”
          </Link>
        </Fragment>
      ))}
      {more ? ` and ${more} more` : ""}
    </>
  )
}

/**
 * Niche alignment read-out: how much of the last 30 days of published / scheduled content (and of the
 * winners) matches the niche + interests — honest keyword overlap, computed locally.
 */
export function NicheAlignmentPanel({ niche, interests, now }: { niche: string; interests: string[]; now: Date }) {
  const db = useDb()
  const settings = useSettings()
  const deferredNiche = useDeferredValue(niche)
  const deferredInterests = useDeferredValue(interests)
  const result = useMemo(
    () => nicheAlignment(db, settings, now, deferredNiche, deferredInterests),
    [db, settings, now, deferredNiche, deferredInterests]
  )
  const { recent, winners, status, topMatches } = result
  const meta = STATUS[status]

  return (
    <section aria-labelledby="niche-alignment-heading" className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/20 p-3 dark:bg-input/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <h4 id="niche-alignment-heading" className="text-sm font-medium">
            Niche alignment
          </h4>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
            How much of what you publish is about your niche — keyword overlap between your niche and interests and each post&apos;s
            title, hook, core topic and pillar.
          </p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>

      {status === "no-niche" ? (
        <p className="text-xs text-pretty text-muted-foreground">
          Add your niche and a few interests above to see how well your content matches them.
        </p>
      ) : status === "not-enough" ? (
        <p className="text-xs text-pretty text-muted-foreground">
          Publish or schedule at least {MIN_ALIGNMENT_SAMPLE} posts to see how well they match your niche —{" "}
          <span className="num">{recent.total}</span> in the last {ALIGNMENT_DAYS} days so far.{" "}
          <Link href="/calendar/planner" className="font-medium text-foreground underline-offset-2 hover:underline">
            Plan the week
          </Link>
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <AlignmentStat label={`Published or scheduled · ${ALIGNMENT_DAYS} days`} group={recent} noun="post" emptyText="" />
            <AlignmentStat
              label="Winners · all time"
              group={winners}
              noun="winner"
              emptyText="No winners yet — they appear once you log analytics for your posts."
            />
          </div>
          {topMatches.length ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span className="mr-0.5">Niche keywords you use most</span>
              {topMatches.slice(0, 5).map((match) => (
                <Token key={match.label}>
                  <span className="truncate">{match.label}</span>
                </Token>
              ))}
            </div>
          ) : null}
          {status === "low" ? (
            <p className="flex items-start gap-1.5 text-xs text-pretty">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
              <span>
                Most of your recent posts are outside your niche: <TitleList items={recent.offNiche} />. Tie them back to your niche — or
                update it if your focus has moved.
              </span>
            </p>
          ) : status === "mixed" && recent.offNiche.length ? (
            <p className="flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                Some recent posts drift from your niche: <TitleList items={recent.offNiche} />.
              </span>
            </p>
          ) : null}
          {winners.total >= MIN_ALIGNMENT_SAMPLE && winners.share !== null && winners.share < LOW_ALIGNMENT ? (
            <p className="flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>Most of your winners sit outside your niche — worth checking whether your niche line is too narrow.</span>
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
