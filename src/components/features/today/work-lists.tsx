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
import { uiActions } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { approve, markPublished, moveTo, reschedule } from "./today-actions"
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
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => markPublished(item)}>
      <Send aria-hidden />
      Mark published
    </Button>
  )
}

/** Copy the caption or script; disabled with a reason when there's nothing written yet. */
function CopyPost({ copy, iconOnly = false }: { copy: PostCopy | undefined; iconOnly?: boolean }) {
  const text = copy?.text ?? ""
  const label = copy?.label ?? "Copy script"
  const button = (
    <CopyButton
      text={text}
      label={iconOnly ? undefined : label}
      variant={iconOnly ? "ghost" : "outline"}
      successMessage={label === "Copy caption" ? "Caption copied" : "Script copied"}
    />
  )
  return text ? button : <span title="No caption or script yet — write it in the Studio">{button}</span>
}

/* ----------------------------- Today's Content ----------------------------- */

export function TodaysContentSection({ data, className }: { data: TodayData; className?: string }) {
  const { todays, today, copies, measured, slots } = data
  const scheduledIds = new Set(today.scheduledToday.map((item) => item.id))
  const rows = [
    ...todays.map((item) => ({ item, live: false })),
    ...today.publishedToday.map((item) => ({ item, live: true })),
  ]
  const slot = slots[0]
  const time = slot ? slotTime(slot.time) : null
  const description = slot
    ? `Today's slot: ${slot.label.trim() || "Posting slot"}${time ? ` · ${time}` : ""}${slots.length > 1 ? ` (+${slots.length - 1} more)` : ""}`
    : "Scheduled and due today, then what already went out"

  return (
    <WorkSection
      id="today-content"
      title="Today's Content"
      icon={CalendarCheck}
      description={description}
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
                  Published {formatTime(item.published_at)}
                </StatusPill>
              ) : scheduledIds.has(item.id) ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-foreground/80">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {formatTime(item.scheduled_at)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Due today
                </span>
              )}
              {live ? null : <StageBadge stage={item.stage} />}
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
                    Add analytics
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
              <Link href="/calendar/planner">Plan the week</Link>
            </Button>
          }
        >
          Nothing scheduled or due today. Plan the week so every day has something going out.
        </InlineEmpty>
      }
    />
  )
}

/* ------------------------------ Content Overdue ------------------------------ */

export function OverdueSection({ data, className }: { data: TodayData; className?: string }) {
  const { today, now } = data
  const count = today.overdue.length
  const todayIso = toISODate(now)
  const tomorrow = toISODate(addDays(now, 1))
  return (
    <WorkSection
      id="overdue"
      title="Content Overdue"
      icon={count ? CriticalAlarm : AlarmClock}
      urgent
      description={count ? "Missed publish times and production deadlines — move them or cut them." : "Missed publish times and deadlines show up here."}
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
                {overdueLabel(item, now)}
              </span>
              <StageBadge stage={item.stage} />
              <Pillar item={item} />
            </>
          }
          actions={
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => reschedule(item, tomorrow)}>
                Tomorrow
              </Button>
              <DatePicker
                value={null}
                size="sm"
                clearable={false}
                placeholder="Pick date"
                minDate={todayIso}
                className="w-auto"
                aria-label={`Reschedule “${item.title.trim() || "Untitled content"}”`}
                onChange={(day) => {
                  if (day) reschedule(item, day)
                }}
              />
              <OpenButton href={studio(item)} />
            </>
          }
        />
      )}
      empty={<InlineEmpty icon={CircleCheck}>Nothing overdue — every deadline and publish time is on track.</InlineEmpty>}
    />
  )
}

/* ------------------------------ Content to Post ------------------------------ */

export function ToPostSection({ data, className }: { data: TodayData; className?: string }) {
  const { today, copies, now } = data
  return (
    <WorkSection
      id="to-post"
      title="Content to Post"
      icon={Send}
      description="Approved and ready — copy the caption, post it, mark it published."
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
              <Link href="/pipeline">Open Pipeline</Link>
            </Button>
          }
        >
          Nothing is ready to post. Approved content lands here with its caption ready to copy.
        </InlineEmpty>
      }
    />
  )
}

/* ----------------------------- Content to Review ----------------------------- */

export function ToReviewSection({ data, className }: { data: TodayData; className?: string }) {
  const { today, now } = data
  return (
    <WorkSection
      id="to-review"
      title="Content to Review"
      icon={ClipboardCheck}
      description="Approve what's good to go, or send it back with changes."
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
                  Changes requested
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
                Approve
              </Button>
              {item.stage === "review" ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => moveTo(item, "revision", "Changes requested")}>
                  Request revision
                </Button>
              ) : null}
              <OpenButton href={studio(item)} />
            </>
          }
        />
      )}
      empty={<InlineEmpty icon={ClipboardCheck}>Review queue clear — nothing is waiting for approval.</InlineEmpty>}
    />
  )
}

/* ----------------------------- Content to Record ----------------------------- */

export function ToRecordSection({ data, className }: { data: TodayData; className?: string }) {
  const { today, now } = data
  return (
    <WorkSection
      id="to-record"
      title="Content to Record"
      icon={Clapperboard}
      description="Scripts approved for production — start the shoot, then hand it to editing."
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
                <Button type="button" size="sm" variant="outline" onClick={() => moveTo(item, "editing", "Recorded · moved to Editing")}>
                  <Check aria-hidden />
                  Done
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => moveTo(item, "recording", "Recording started")}>
                  <Video aria-hidden />
                  Start recording
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
              <Link href="/pipeline">Open Pipeline</Link>
            </Button>
          }
        >
          Nothing waiting to be recorded. Approved scripts show up here, ready to shoot.
        </InlineEmpty>
      }
    />
  )
}
