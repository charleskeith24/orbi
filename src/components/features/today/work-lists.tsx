"use client"

import { addDays } from "date-fns"
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Check,
  CircleCheck,
  Clapperboard,
  ClipboardCheck,
  RotateCcw,
  Send,
  Video,
} from "lucide-react"
import Link from "next/link"
import { CopyButton, DatePicker, FormatLabel, PillarBadge, StageBadge, StatusPill, type IconComponent } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatTime, toISODate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { todayMessages } from "./messages"
import { approve, markPublished, moveMessage, moveTo, reschedule } from "./today-actions"
import { overdueLabel, slotTime, type PostCopy } from "./today-utils"
import type { TodayData } from "./use-today"
import { DateMeta, InlineEmpty, OpenButton, WorkRow, WorkSection } from "./work-section"

const studio = (item: ContentItem) => `/studio/${item.id}`

const CriticalAlarm: IconComponent = ({ className }) => <AlarmClock className={cn(className, "text-critical-fg")} aria-hidden />

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
      <Link href={href}>{children}</Link>
    </Button>
  )
}

function Pillar({ item }: { item: ContentItem }) {
  return item.pillar_id ? <PillarBadge pillarId={item.pillar_id} variant="plain" className="text-muted-foreground" /> : null
}

function MarkPublishedButton({ item }: { item: ContentItem }) {
  const t = useT(todayMessages)
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => markPublished(item)}>
      <Send aria-hidden />
      {t("mark_published")}
    </Button>
  )
}

/** Copy the caption or script; disabled with a reason when there's nothing written yet. */
function CopyPost({ copy, iconOnly = false }: { copy: PostCopy | undefined; iconOnly?: boolean }) {
  const t = useT(todayMessages)
  const text = copy?.text ?? ""
  const caption = copy?.label === "Copy caption"
  const button = (
    <CopyButton
      text={text}
      label={iconOnly ? undefined : caption ? t("copy_caption") : t("copy_script")}
      variant={iconOnly ? "ghost" : "outline"}
      successMessage={caption ? t("caption_copied") : t("script_copied")}
    />
  )
  return text ? button : <span title={t("nothing_to_copy")}>{button}</span>
}

/* ----------------------------- Today's Content ----------------------------- */

export function TodaysContentSection({ data, className }: { data: TodayData; className?: string }) {
  const t = useT(todayMessages)
  const { todays, today, copies, measured, slots } = data
  const scheduledIds = new Set(today.scheduledToday.map((item) => item.id))
  const rows = [
    ...todays.map((item) => ({ item, live: false })),
    ...today.publishedToday.map((item) => ({ item, live: true })),
  ]
  const slot = slots[0]
  const time = slot ? slotTime(slot.time) : null
  const slotLine = slot
    ? `${t("todays_slot", { slot: slot.label.trim() || t("posting_slot") })}${time ? ` · ${time}` : ""}${slots.length > 1 ? t("slot_more", { count: slots.length - 1 }) : ""}`
    : null

  return (
    <WorkSection
      id="today-content"
      title={t("todays_title")}
      icon={CalendarCheck}
      info={
        slotLine ? (
          <>
            <p className="font-medium text-foreground">{slotLine}</p>
            <p>{t("todays_info")}</p>
          </>
        ) : (
          t("todays_info")
        )
      }
      action={<SectionLink href="/calendar">Calendar</SectionLink>}
      items={rows}
      getKey={(row) => row.item.id}
      className={className}
      renderItem={({ item, live }) => (
        <WorkRow
          item={item}
          meta={
            <>
              {live ? (
                <StatusPill tone="good" icon={CircleCheck}>
                  {t("published_at", { time: formatTime(item.published_at) })}
                </StatusPill>
              ) : scheduledIds.has(item.id) ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-foreground/80">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {formatTime(item.scheduled_at)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {t("due_today")}
                </span>
              )}
              {/* A time already says "scheduled"; due-today rows show where production stands. */}
              {live || (scheduledIds.has(item.id) && item.stage === "scheduled") ? null : <StageBadge stage={item.stage} />}
              <Pillar item={item} />
            </>
          }
          actions={
            live ? (
              <>
                {measured.has(item.id) ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: item.id })}
                  >
                    <ChartColumn aria-hidden />
                    {t("add_analytics")}
                  </Button>
                )}
                <OpenButton href={studio(item)} />
              </>
            ) : (
              <>
                {copies.has(item.id) ? <CopyPost copy={copies.get(item.id)} iconOnly /> : null}
                <MarkPublishedButton item={item} />
                <OpenButton href={studio(item)} />
              </>
            )
          }
        />
      )}
      empty={
        <InlineEmpty
          icon={CalendarCheck}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/calendar/planner">{t("plan_week")}</Link>
            </Button>
          }
        >
          {slotLine ? `${t("todays_empty")} ${slotLine}` : t("todays_empty")}
        </InlineEmpty>
      }
    />
  )
}

/* ------------------------------ Content Overdue ------------------------------ */

export function OverdueSection({ data, className }: { data: TodayData; className?: string }) {
  const t = useT(todayMessages)
  const lang = useUiLang()
  const { today, now } = data
  const count = today.overdue.length
  const todayIso = toISODate(now)
  const tomorrow = toISODate(addDays(now, 1))
  return (
    <WorkSection
      id="overdue"
      title={t("overdue_title")}
      icon={count ? CriticalAlarm : AlarmClock}
      urgent
      info={t("overdue_info")}
      items={today.overdue}
      getKey={(item) => item.id}
      className={className}
      renderItem={(item) => (
        <WorkRow
          item={item}
          meta={
            <>
              <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-critical-fg">
                <AlarmClock className="size-3.5" aria-hidden />
                {overdueLabel(item, now, lang)}
              </span>
              <StageBadge stage={item.stage} />
              <Pillar item={item} />
            </>
          }
          actions={
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => reschedule(item, tomorrow)}>
                {t("tomorrow")}
              </Button>
              <DatePicker
                value={null}
                size="sm"
                clearable={false}
                placeholder={t("pick_date")}
                minDate={todayIso}
                className="w-auto"
                aria-label={t("reschedule_aria", { title: item.title.trim() || t("untitled_content") })}
                onChange={(day) => {
                  if (day) reschedule(item, day)
                }}
              />
              <OpenButton href={studio(item)} />
            </>
          }
        />
      )}
      empty={<InlineEmpty icon={CircleCheck}>{t("overdue_empty")}</InlineEmpty>}
    />
  )
}

/* ------------------------------ Content to Post ------------------------------ */

export function ToPostSection({ data, className }: { data: TodayData; className?: string }) {
  const t = useT(todayMessages)
  const { today, copies, now } = data
  return (
    <WorkSection
      id="to-post"
      title={t("to_post_title")}
      icon={Send}
      info={t("to_post_info")}
      action={<SectionLink href="/pipeline">Pipeline</SectionLink>}
      items={today.toPost}
      getKey={(item) => item.id}
      className={className}
      renderItem={(item) => (
        <WorkRow
          item={item}
          meta={
            <>
              <StageBadge stage={item.stage} />
              <DateMeta item={item} now={now} />
              <Pillar item={item} />
            </>
          }
          actions={
            <>
              <CopyPost copy={copies.get(item.id)} />
              <MarkPublishedButton item={item} />
              <OpenButton href={studio(item)} />
            </>
          }
        />
      )}
      empty={
        <InlineEmpty
          icon={Send}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/pipeline">{t("open_pipeline")}</Link>
            </Button>
          }
        >
          {t("to_post_empty")}
        </InlineEmpty>
      }
    />
  )
}

/* ----------------------------- Content to Review ----------------------------- */

export function ToReviewSection({ data, className }: { data: TodayData; className?: string }) {
  const t = useT(todayMessages)
  const { today, now } = data
  return (
    <WorkSection
      id="to-review"
      title={t("to_review_title")}
      icon={ClipboardCheck}
      info={t("to_review_info")}
      action={<SectionLink href="/pipeline">Pipeline</SectionLink>}
      items={today.toReview}
      getKey={(item) => item.id}
      className={className}
      renderItem={(item) => (
        <WorkRow
          item={item}
          meta={
            <>
              {item.stage === "revision" ? (
                <StatusPill tone="warning" icon={RotateCcw}>
                  {t("changes_requested")}
                </StatusPill>
              ) : (
                <StageBadge stage={item.stage} />
              )}
              <DateMeta item={item} now={now} />
              {item.owner.trim() ? <span className="truncate">{item.owner.trim()}</span> : null}
            </>
          }
          actions={
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => approve(item)}>
                <Check aria-hidden />
                {t("approve")}
              </Button>
              {item.stage === "review" ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => moveTo(item, "revision", moveMessage("changes_requested"))}>
                  {t("request_revision")}
                </Button>
              ) : null}
              <OpenButton href={studio(item)} />
            </>
          }
        />
      )}
      empty={<InlineEmpty icon={ClipboardCheck}>{t("to_review_empty")}</InlineEmpty>}
    />
  )
}

/* ----------------------------- Content to Record ----------------------------- */

export function ToRecordSection({ data, className }: { data: TodayData; className?: string }) {
  const t = useT(todayMessages)
  const { today, now } = data
  return (
    <WorkSection
      id="to-record"
      title={t("to_record_title")}
      icon={Clapperboard}
      info={t("to_record_info")}
      action={<SectionLink href="/pipeline">Pipeline</SectionLink>}
      items={today.toRecord}
      getKey={(item) => item.id}
      className={className}
      renderItem={(item) => (
        <WorkRow
          item={item}
          meta={
            <>
              <StageBadge stage={item.stage} />
              <DateMeta item={item} now={now} />
              {item.format_id ? <FormatLabel formatId={item.format_id} /> : null}
            </>
          }
          actions={
            <>
              {item.stage === "recording" ? (
                <Button type="button" size="sm" variant="outline" onClick={() => moveTo(item, "editing", moveMessage("recorded"))}>
                  <Check aria-hidden />
                  {t("done")}
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => moveTo(item, "recording", moveMessage("recording_started"))}>
                  <Video aria-hidden />
                  {t("start_recording")}
                </Button>
              )}
              <OpenButton href={studio(item)} />
            </>
          }
        />
      )}
      empty={
        <InlineEmpty
          icon={Clapperboard}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/pipeline">{t("open_pipeline")}</Link>
            </Button>
          }
        >
          {t("to_record_empty")}
        </InlineEmpty>
      }
    />
  )
}
