"use client"

import { useDroppable } from "@dnd-kit/core"
import { format } from "date-fns"
import { CalendarPlus } from "lucide-react"
import { catVar, EmptyState } from "@/components/common"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { useT, type Translator } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import type { ContentPillar, ID } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { useCalendarActions } from "./calendar-actions"
import { CalendarItem, type ItemVariant } from "./calendar-item"
import { dayDropId, isFillable, type CalendarDay, type Placement } from "./calendar-model"
import { calendarMessages } from "./messages"
import { SlotChip, SlotLane, SlotLine, type SlotPillar } from "./slot-lane"

type T = Translator<typeof calendarMessages.en>

export interface DayContext {
  pillars: Map<ID, ContentPillar>
  /** Drag and drop is on (pointer devices). */
  dnd: boolean
  /** Show posting slots (lanes, chips, lines). */
  showSlots: boolean
  /** Filters are on: posts list flat and slots shrink to status lines, so no lane hides a filtered post. */
  filtering: boolean
  highlightId: ID | null
}

const MONTH_ITEM_LIMIT = 3

function pillarOf(ctx: DayContext, id: ID | null, t: T): SlotPillar | null {
  const pillar = id ? ctx.pillars.get(id) : undefined
  return pillar ? { name: pillar.name || t("untitled_pillar"), color: pillar.color } : null
}

const dayLabel = (day: CalendarDay, t: T) => `${format(day.date, "EEEE, MMMM d")}${day.isToday ? t("today_suffix") : ""}`

function PlacedItem({ placement, ctx, variant }: { placement: Placement; ctx: DayContext; variant: ItemVariant }) {
  const t = useT(calendarMessages)
  const pillar = pillarOf(ctx, placement.item.pillar_id, t)
  return (
    <CalendarItem
      item={placement.item}
      kind={placement.kind}
      at={placement.at}
      pillarColor={pillar?.color ?? null}
      pillarName={pillar?.name ?? null}
      variant={variant}
      dnd={ctx.dnd}
      highlighted={ctx.highlightId === placement.item.id}
    />
  )
}

/** A day as a drop target (past days don't take drops). */
function DropZone({ day, ctx, className, children }: { day: CalendarDay; ctx: DayContext; className?: string; children: React.ReactNode }) {
  const t = useT(calendarMessages)
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.key), disabled: !ctx.dnd || day.isPast })
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={dayLabel(day, t)}
      aria-current={day.isToday ? "date" : undefined}
      data-drop-over={isOver || undefined}
      className={cn(className, isOver && "bg-brand-soft ring-2 ring-brand/50 ring-inset")}
    >
      {children}
    </div>
  )
}

/** "2 posts · 1 open slot · 1 due" for a day. */
export function daySummary(day: CalendarDay, showSlots: boolean, t: T): string {
  const open = showSlots ? day.slots.filter((s) => isFillable(s, day.isPast)).length : 0
  const parts = [t.plural("posts", day.posts.length, { count: formatNumber(day.posts.length) })]
  if (open) parts.push(t.plural("stat_open_slots", open, { count: formatNumber(open) }))
  if (day.due.length) parts.push(t("stat_due", { count: day.due.length }))
  return parts.join(" · ")
}

/* ---------------------------------- Month ---------------------------------- */

export function MonthGrid({
  days,
  weekdays,
  ctx,
  onOpenDay,
}: {
  days: CalendarDay[]
  weekdays: number[]
  ctx: DayContext
  onOpenDay: (date: Date) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div aria-hidden className="grid grid-cols-7 border-b bg-muted/40 dark:bg-muted/20">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {DAYS_OF_WEEK[d]?.short}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
        {days.map((day) => (
          <MonthCell key={day.key} day={day} ctx={ctx} onOpenDay={onOpenDay} />
        ))}
      </div>
    </div>
  )
}

function MonthCell({ day, ctx, onOpenDay }: { day: CalendarDay; ctx: DayContext; onOpenDay: (date: Date) => void }) {
  const t = useT(calendarMessages)
  const actions = useCalendarActions()
  const entries = [...day.posts, ...day.due]
  // An item opened via ?open= is never hidden behind "+N more".
  const highlighted = entries.findIndex((p) => p.item.id === ctx.highlightId)
  if (highlighted >= MONTH_ITEM_LIMIT) entries.unshift(...entries.splice(highlighted, 1))
  const shown = entries.slice(0, MONTH_ITEM_LIMIT)
  const hidden = entries.length - shown.length
  const fillable = ctx.showSlots ? day.slots.filter((s) => isFillable(s, day.isPast)) : []

  return (
    <DropZone
      day={day}
      ctx={ctx}
      className={cn("flex min-h-32 min-w-0 flex-col gap-1 border-r border-b p-1.5", !day.inPeriod && "bg-muted/35 dark:bg-muted/15")}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          aria-label={t("open_in_day_view", { day: dayLabel(day, t) })}
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium num outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
            !day.inPeriod && "text-muted-foreground",
            day.isToday && "bg-brand text-brand-foreground hover:bg-brand/90"
          )}
        >
          {format(day.date, day.date.getDate() === 1 ? "MMM d" : "d")}
        </button>
      </div>
      {shown.map((p) => (
        <PlacedItem key={p.item.id} placement={p} ctx={ctx} variant="chip" />
      ))}
      {fillable.map((s) => (
        <SlotChip key={s.slot.id} daySlot={s} pillar={pillarOf(ctx, s.slot.pillar_id, t)} onFill={() => actions.fillSlot(day.date, s)} />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          className="self-start rounded-sm px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {t("more", { count: hidden })}
        </button>
      ) : null}
    </DropZone>
  )
}

/** Phone month: date + pillar dots per day; the selected day's agenda renders below. */
export function CompactMonthGrid({
  days,
  weekdays,
  ctx,
  selectedKey,
  onSelect,
}: {
  days: CalendarDay[]
  weekdays: number[]
  ctx: DayContext
  selectedKey: string
  onSelect: (date: Date) => void
}) {
  const t = useT(calendarMessages)
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div aria-hidden className="grid grid-cols-7 border-b bg-muted/40 dark:bg-muted/20">
        {weekdays.map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground">
            {DAYS_OF_WEEK[d]?.short}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
        {days.map((day) => {
          const selected = day.key === selectedKey
          const entries = [...day.posts, ...day.due]
          const open = ctx.showSlots && day.slots.some((s) => isFillable(s, day.isPast))
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-pressed={selected}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={t(open ? "day_items_open_aria" : "day_items_aria", {
                day: dayLabel(day, t),
                items: t.plural("items", entries.length, { count: formatNumber(entries.length) }),
              })}
              className={cn(
                "flex h-14 min-w-0 flex-col items-center gap-1 border-r border-b pt-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                !day.inPeriod && "bg-muted/35 text-muted-foreground dark:bg-muted/15",
                selected && "bg-brand-soft"
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium num",
                  day.isToday && "bg-brand text-brand-foreground",
                  selected && !day.isToday && "ring-1 ring-brand/60"
                )}
              >
                {format(day.date, "d")}
              </span>
              <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                {entries.slice(0, 3).map((p) => {
                  const color = catVar(ctx.pillars.get(p.item.pillar_id ?? "")?.color)
                  return (
                    <span
                      key={p.item.id}
                      className={cn("size-1.5 rounded-full", p.kind === "published" && "opacity-45", p.kind === "due" && "border")}
                      style={p.kind === "due" ? { borderColor: color } : { backgroundColor: color }}
                    />
                  )
                })}
                {open ? <span className="size-1.5 rounded-full border border-dashed border-muted-foreground" /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------- Week ----------------------------------- */

function DayHeader({ day, onOpenDay }: { day: CalendarDay; onOpenDay: (date: Date) => void }) {
  const t = useT(calendarMessages)
  const c = useT(commonMessages)
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-1 border-b px-2 py-1.5", day.isToday && "bg-brand-soft")}>
      <button
        type="button"
        onClick={() => onOpenDay(day.date)}
        aria-label={t("open_in_day_view", { day: dayLabel(day, t) })}
        className="flex items-baseline gap-1.5 rounded-sm text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={cn("font-medium tracking-wide uppercase", day.isToday ? "text-brand" : "text-muted-foreground")}>
          {format(day.date, "EEE")}
        </span>
        <span className={cn("text-sm font-semibold num", day.isPast && "text-muted-foreground")}>{format(day.date, "d")}</span>
      </button>
      {day.isToday ? <span className="text-[11px] font-medium text-brand">{c("today")}</span> : null}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-1 pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</p>
}

/** Slots (as lanes holding their posts), the remaining posts and the day's deadlines. */
function DayContent({ day, ctx, variant }: { day: CalendarDay; ctx: DayContext; variant: "card" | "row" }) {
  const t = useT(calendarMessages)
  const actions = useCalendarActions()
  const lanes = ctx.showSlots && !ctx.filtering
  const loose = lanes ? day.extraPosts : day.posts
  const slotsShown = ctx.showSlots && day.slots.length > 0
  const rows = variant === "row"

  return (
    <>
      {slotsShown
        ? day.slots.map((s) =>
            lanes ? (
              <SlotLane
                key={s.slot.id}
                daySlot={s}
                isPast={day.isPast}
                pillar={pillarOf(ctx, s.slot.pillar_id, t)}
                size={rows ? "md" : "sm"}
                onFill={() => actions.fillSlot(day.date, s)}
              >
                {s.posts.map((p) => (
                  <PlacedItem key={p.item.id} placement={p} ctx={ctx} variant={variant} />
                ))}
              </SlotLane>
            ) : (
              <SlotLine
                key={s.slot.id}
                daySlot={s}
                isPast={day.isPast}
                pillar={pillarOf(ctx, s.slot.pillar_id, t)}
                onFill={() => actions.fillSlot(day.date, s)}
              />
            )
          )
        : null}
      {loose.length && rows && slotsShown ? <GroupLabel>{lanes ? t("other_posts") : t("posts")}</GroupLabel> : null}
      {loose.map((p) => (
        <PlacedItem key={p.item.id} placement={p} ctx={ctx} variant={variant} />
      ))}
      {day.due.length && rows ? <GroupLabel>{t("due_no_time")}</GroupLabel> : null}
      {day.due.map((p) => (
        <PlacedItem key={p.item.id} placement={p} ctx={ctx} variant={variant} />
      ))}
      {!slotsShown && !loose.length && !day.due.length ? (
        <p className="px-1 py-0.5 text-[11px] text-muted-foreground">{t("nothing_planned")}</p>
      ) : null}
    </>
  )
}

export function WeekColumns({ days, ctx, onOpenDay }: { days: CalendarDay[]; ctx: DayContext; onOpenDay: (date: Date) => void }) {
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border bg-card">
      {days.map((day, i) => (
        <DropZone key={day.key} day={day} ctx={ctx} className={cn("flex min-h-[24rem] min-w-0 flex-col", i < days.length - 1 && "border-r")}>
          <DayHeader day={day} onOpenDay={onOpenDay} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-1.5">
            <DayContent day={day} ctx={ctx} variant="card" />
          </div>
        </DropZone>
      ))}
    </div>
  )
}

/** Phone week: one stacked section per day. */
export function WeekList({ days, ctx, onOpenDay }: { days: CalendarDay[]; ctx: DayContext; onOpenDay: (date: Date) => void }) {
  return (
    <ol className="flex min-w-0 flex-col gap-2">
      {days.map((day) => (
        <li key={day.key} className="min-w-0">
          <DropZone day={day} ctx={ctx} className="overflow-hidden rounded-lg border bg-card">
            <DayHeader day={day} onOpenDay={onOpenDay} />
            <div className="flex min-w-0 flex-col gap-1.5 p-2">
              <DayContent day={day} ctx={ctx} variant="row" />
            </div>
          </DropZone>
        </li>
      ))}
    </ol>
  )
}

/* ----------------------------------- Day ----------------------------------- */

/** The week around the day being viewed, for one-tap switching. */
export function WeekStrip({
  days,
  selectedKey,
  ctx,
  onSelect,
}: {
  days: CalendarDay[]
  selectedKey: string
  ctx: DayContext
  onSelect: (date: Date) => void
}) {
  const t = useT(calendarMessages)
  return (
    <div role="group" aria-label={t("days_of_week")} className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const selected = day.key === selectedKey
        const count = day.posts.length + day.due.length
        const open = ctx.showSlots ? day.slots.filter((s) => isFillable(s, day.isPast)).length : 0
        return (
          <button
            key={day.key}
            type="button"
            aria-pressed={selected}
            aria-current={day.isToday ? "date" : undefined}
            aria-label={t("day_summary_aria", { day: dayLabel(day, t), summary: daySummary(day, ctx.showSlots, t) })}
            onClick={() => onSelect(day.date)}
            className={cn(
              "flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "border-brand/50 bg-brand-soft hover:bg-brand-soft" : "bg-card"
            )}
          >
            <span className={cn("text-[11px] tracking-wide uppercase", day.isToday ? "font-medium text-brand" : "text-muted-foreground")}>
              {format(day.date, "EEE")}
            </span>
            <span className={cn("text-sm font-semibold num", day.isPast && !selected && "text-muted-foreground")}>{format(day.date, "d")}</span>
            <span className="flex h-4 items-center gap-1 text-[11px] text-muted-foreground num">
              {count || "—"}
              {open ? <span aria-hidden className="size-1.5 rounded-full border border-dashed border-muted-foreground" /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function DayAgenda({ day, ctx, className }: { day: CalendarDay; ctx: DayContext; className?: string }) {
  const t = useT(calendarMessages)
  const c = useT(commonMessages)
  const empty = !day.posts.length && !day.due.length && !(ctx.showSlots && day.slots.length)
  return (
    <DropZone day={day} ctx={ctx} className={cn("flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 md:p-4", className)}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">
          {format(day.date, "EEEE, MMMM d")}
          {day.isToday ? <span className="ml-2 text-xs font-medium text-brand">{c("today")}</span> : null}
        </h2>
        <p className="text-xs text-muted-foreground num">{daySummary(day, ctx.showSlots, t)}</p>
      </div>
      {empty ? (
        <EmptyState
          compact
          icon={CalendarPlus}
          title={t("nothing_planned")}
          description={day.isPast ? t("empty_past") : ctx.dnd ? t("empty_drag") : t("empty_touch")}
        />
      ) : (
        <DayContent day={day} ctx={ctx} variant="row" />
      )}
    </DropZone>
  )
}
