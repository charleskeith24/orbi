"use client"

import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import Link from "next/link"
import { useMemo } from "react"
import { catVar, PlatformIcon } from "@/components/common"
import { EmptyChart } from "@/components/charts"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PIPELINE_STAGE_MAP, PLATFORM_IDS, PLATFORMS, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate, parseDate, startOfWeek, toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useSettings } from "@/lib/store"
import type { CategoricalColor, ContentCampaign, ContentItem, PlatformId } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { campaignDetailMessages } from "./messages"

const LANE_HEIGHT = 34
/** Same-day marks in one lane stack around the lane centre. */
const STACK_OFFSETS = [0, -8, 8]

interface Mark {
  item: ContentItem
  date: Date
  left: number
  top: number
  published: boolean
}

interface TimelineModel {
  lanes: { platform: PlatformId; marks: Mark[] }[]
  ticks: { key: string; left: number; label: string }[]
  window: { left: number; width: number }
  today: number | null
  undated: number
}

function buildTimeline(campaign: ContentCampaign, items: ContentItem[], now: Date, weekStartsOn: 0 | 1): TimelineModel | null {
  const start = parseDate(campaign.start_date)
  const end = parseDate(campaign.end_date)
  if (!start || !end) return null

  const dated = items
    .map((item) => ({ item, date: contentItemDate(item) }))
    .filter((d): d is { item: ContentItem; date: Date } => d.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  // The domain covers the campaign window and every dated piece, so nothing is hidden.
  let domainStart = startOfDay(start)
  let domainEnd = startOfDay(end)
  for (const { date } of dated) {
    const day = startOfDay(date)
    if (day < domainStart) domainStart = day
    if (day > domainEnd) domainEnd = day
  }
  // Until the campaign is over, keep today on the axis so lead time before the start is visible.
  const todayDay = startOfDay(now)
  if (todayDay <= domainEnd && todayDay < domainStart) domainStart = todayDay
  const total = differenceInCalendarDays(domainEnd, domainStart) + 1
  const edge = (date: Date) => (differenceInCalendarDays(startOfDay(date), domainStart) / total) * 100
  const centre = (date: Date) => ((differenceInCalendarDays(startOfDay(date), domainStart) + 0.5) / total) * 100

  const platforms = PLATFORM_IDS.filter((p) => campaign.platforms.includes(p) || dated.some((d) => d.item.platform === p))
  const lanes = platforms.map((platform) => {
    const perDay = new Map<string, number>()
    const marks = dated
      .filter((d) => d.item.platform === platform)
      .map(({ item, date }) => {
        const key = toISODate(date)
        const n = perDay.get(key) ?? 0
        perDay.set(key, n + 1)
        return {
          item,
          date,
          left: centre(date),
          top: LANE_HEIGHT / 2 + (STACK_OFFSETS[n] ?? 0),
          published: PUBLISHED_STAGES.includes(item.stage),
        }
      })
    return { platform, marks }
  })

  const weeks = Math.ceil(total / 7)
  const every = Math.max(1, Math.ceil(weeks / 8))
  const ticks: TimelineModel["ticks"] = []
  let index = 0
  for (let d = startOfWeek(domainStart, weekStartsOn); d <= domainEnd; d = addDays(d, 7), index++) {
    if (d >= domainStart && index % every === 0) ticks.push({ key: toISODate(d), left: edge(d), label: format(d, "MMM d") })
  }

  return {
    lanes,
    ticks,
    window: { left: edge(start), width: ((differenceInCalendarDays(end, start) + 1) / total) * 100 },
    today: todayDay >= domainStart && todayDay <= domainEnd ? centre(todayDay) : null,
    undated: items.length - dated.length,
  }
}

function TimelineMark({ mark, color }: { mark: Mark; color: CategoricalColor }) {
  const t = useT(campaignDetailMessages)
  const title = mark.item.title || t("untitled_content")
  const stage = PIPELINE_STAGE_MAP[mark.item.stage]?.label ?? mark.item.stage
  const when = format(mark.date, "EEE, MMM d")
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/studio/${mark.item.id}`}
          aria-label={t("mark_aria", { title, platform: PLATFORMS[mark.item.platform].label, stage, when })}
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-offset-1 ring-offset-card transition-transform outline-none hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            left: `${mark.left}%`,
            top: mark.top,
            ...(mark.published
              ? { backgroundColor: catVar(color) }
              : { border: `2px solid ${catVar(color)}`, backgroundColor: "var(--card)" }),
          }}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <p className="font-medium">{title}</p>
        <p className="opacity-80">
          {PLATFORMS[mark.item.platform].label} · {stage} · {when}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Swimlane timeline across the campaign window: one lane per platform, each piece placed on its
 * publish (or planned / due) date. Filled = published, ring = planned. The pieces list is its table twin.
 */
export function CampaignTimeline({ campaign, items, now }: { campaign: ContentCampaign; items: ContentItem[]; now: Date }) {
  const settings = useSettings()
  const t = useT(campaignDetailMessages)
  const c = useT(commonMessages)
  const model = useMemo(() => buildTimeline(campaign, items, now, settings.week_starts_on), [campaign, items, now, settings.week_starts_on])

  if (!model) return <EmptyChart message={t("timeline_no_dates")} height={140} />
  if (!model.lanes.some((l) => l.marks.length)) {
    return (
      <EmptyChart
        message={
          items.length ? t("timeline_undated") : t("timeline_empty")
        }
        height={140}
      />
    )
  }

  const color = campaign.color
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[640px] px-4">
          <div className="flex">
            <div className="w-24 shrink-0" />
            <div className="relative h-6 flex-1">
              {model.ticks.map((t) => (
                <span
                  key={t.key}
                  className="absolute top-0.5 pl-1 text-[11px] whitespace-nowrap text-muted-foreground num"
                  style={{ left: `${t.left}%` }}
                >
                  {t.label}
                </span>
              ))}
              {model.today !== null ? (
                <span
                  className="absolute top-0.5 z-10 -translate-x-1/2 rounded-sm bg-card px-1 text-[11px] font-medium text-foreground"
                  style={{ left: `${model.today}%` }}
                >
                  {c("today")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex">
            <div className="w-24 shrink-0">
              {model.lanes.map((lane) => (
                <div
                  key={lane.platform}
                  className="flex items-center gap-1.5 pr-2 text-xs text-muted-foreground"
                  style={{ height: LANE_HEIGHT }}
                >
                  <PlatformIcon platform={lane.platform} className="size-3.5" />
                  <span className="truncate">{PLATFORMS[lane.platform].label}</span>
                </div>
              ))}
            </div>
            <div className="relative flex-1 border-l">
              <div
                aria-hidden
                className="absolute inset-y-0 bg-muted/60 dark:bg-muted/25"
                style={{ left: `${model.window.left}%`, width: `${model.window.width}%` }}
              />
              {model.ticks.map((t) => (
                <div key={t.key} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${t.left}%` }} />
              ))}
              {model.today !== null ? (
                <div aria-hidden className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${model.today}%` }} />
              ) : null}
              {model.lanes.map((lane) => (
                <div
                  key={lane.platform}
                  role="list"
                  aria-label={t("lane_aria", {
                    platform: PLATFORMS[lane.platform].label,
                    pieces: t.plural("pieces", lane.marks.length, { count: formatNumber(lane.marks.length) }),
                  })}
                  className="relative border-b border-border/60 last:border-b-0"
                  style={{ height: LANE_HEIGHT }}
                >
                  {lane.marks.map((mark) => (
                    <div key={mark.item.id} role="listitem">
                      <TimelineMark mark={mark} color={color} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: catVar(color) }} />
          {t("legend_published")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border-2 bg-card" style={{ borderColor: catVar(color) }} />
          {t("legend_planned")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-px bg-foreground/60" />
          {c("today")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-4 rounded-[2px] bg-muted dark:bg-muted/50" />
          {t("legend_window")}
        </span>
        {model.undated ? (
          <span className="sm:ml-auto">{t.plural("undated_not_shown", model.undated, { count: formatNumber(model.undated) })}</span>
        ) : null}
      </div>
    </div>
  )
}
