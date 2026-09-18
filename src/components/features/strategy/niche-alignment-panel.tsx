"use client"

import { Info, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Fragment, useDeferredValue, useMemo } from "react"
import { Meter, StatusPill, Token, type MeterTone, type StatusTone } from "@/components/common"
import { useT, useUiLang } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { nicheAlignmentMessages } from "./brand-messages"
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

const STATUS = {
  "no-niche": { label: "status_no_niche", tone: "neutral" },
  "not-enough": { label: "status_not_enough", tone: "neutral" },
  low: { label: "status_low", tone: "warning" },
  mixed: { label: "status_mixed", tone: "neutral" },
  high: { label: "status_high", tone: "good" },
} as const satisfies Record<AlignmentStatus, { label: string; tone: StatusTone }>

function meterTone(share: number | null): MeterTone {
  if (share === null) return "neutral"
  return share >= HIGH_ALIGNMENT ? "good" : share < LOW_ALIGNMENT ? "warning" : "brand"
}

function AlignmentStat({
  label,
  group,
  noun,
  emptyText,
}: {
  label: string
  group: AlignmentGroup
  noun: "posts_match" | "winners_match"
  emptyText: string
}) {
  const t = useT(nicheAlignmentMessages)
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
            aria-label={t("on_niche_aria", { label })}
            valueText={t("value_text", { aligned: group.aligned, total: group.total })}
          />
          <p className="text-xs text-muted-foreground num">
            {t.plural(noun, group.total, { aligned: group.aligned, count: formatNumber(group.total) })}
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
  const t = useT(nicheAlignmentMessages)
  const shown = items.slice(0, max)
  const more = items.length - shown.length
  return (
    <>
      {shown.map((item, index) => (
        <Fragment key={item.id}>
          {index ? (index === shown.length - 1 && !more ? t("list_and") : ", ") : ""}
          <Link href={`/studio/${item.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
            “{item.title || t("untitled")}”
          </Link>
        </Fragment>
      ))}
      {more ? t("list_more", { count: more }) : ""}
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
  const t = useT(nicheAlignmentMessages)
  const lang = useUiLang()
  const deferredNiche = useDeferredValue(niche)
  const deferredInterests = useDeferredValue(interests)
  const result = useMemo(
    () => nicheAlignment(db, settings, now, deferredNiche, deferredInterests, lang),
    [db, settings, now, deferredNiche, deferredInterests, lang]
  )
  const { recent, winners, status, topMatches } = result
  const meta = STATUS[status]

  return (
    <section aria-labelledby="niche-alignment-heading" className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/20 p-3 dark:bg-input/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <h4 id="niche-alignment-heading" className="text-sm font-medium">
            {t("title")}
          </h4>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{t("description")}</p>
        </div>
        <StatusPill tone={meta.tone}>{t(meta.label)}</StatusPill>
      </div>

      {status === "no-niche" ? (
        <p className="text-xs text-pretty text-muted-foreground">{t("no_niche")}</p>
      ) : status === "not-enough" ? (
        <p className="text-xs text-pretty text-muted-foreground">
          {t("not_enough_before", { min: MIN_ALIGNMENT_SAMPLE })}
          <span className="num">{recent.total}</span>
          {t("not_enough_after", { days: ALIGNMENT_DAYS })}
          <Link href="/calendar/planner" className="font-medium text-foreground underline-offset-2 hover:underline">
            {t("plan_week")}
          </Link>
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <AlignmentStat label={t("recent_label", { days: ALIGNMENT_DAYS })} group={recent} noun="posts_match" emptyText="" />
            <AlignmentStat label={t("winners_label")} group={winners} noun="winners_match" emptyText={t("winners_empty")} />
          </div>
          {topMatches.length ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span className="mr-0.5">{t("top_keywords")}</span>
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
                {t("low_before")}
                <TitleList items={recent.offNiche} />
                {t("low_after")}
              </span>
            </p>
          ) : status === "mixed" && recent.offNiche.length ? (
            <p className="flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                {t("mixed_before")}
                <TitleList items={recent.offNiche} />
                {t("mixed_after")}
              </span>
            </p>
          ) : null}
          {winners.total >= MIN_ALIGNMENT_SAMPLE && winners.share !== null && winners.share < LOW_ALIGNMENT ? (
            <p className="flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>{t("winners_outside")}</span>
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
