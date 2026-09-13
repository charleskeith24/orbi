/**
 * Pure calendar helpers: visible ranges, where each item lands, posting-slot seats per day,
 * filters and drop times. No React, no store access.
 */
import { addDays, addMonths, addWeeks, differenceInCalendarDays, endOfMonth, format, startOfDay, startOfMonth } from "date-fns"
import { BUFFER_STAGES, PIPELINE_STAGE_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { combineDateTime, parseDate, startOfWeek, toISODate } from "@/lib/dates"
import type { ContentItem, ID, ISODate, PlatformId, PostingSlot, StageGroup } from "@/lib/types"

/* --------------------------------- Views ---------------------------------- */

export type CalendarView = "month" | "week" | "day"

export function isCalendarView(value: unknown): value is CalendarView {
  return value === "month" || value === "week" || value === "day"
}

/** Local midnights a view shows: whole weeks covering the month, one week, or one day. */
export function visibleDays(view: CalendarView, anchor: Date, weekStartsOn: 0 | 1): Date[] {
  if (view === "day") return [startOfDay(anchor)]
  if (view === "week") {
    const start = startOfWeek(anchor, weekStartsOn)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }
  const first = startOfWeek(startOfMonth(anchor), weekStartsOn)
  const lastRow = startOfWeek(endOfMonth(anchor), weekStartsOn)
  const weeks = Math.round(differenceInCalendarDays(lastRow, first) / 7) + 1
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i))
}

export function shiftAnchor(view: CalendarView, anchor: Date, step: number): Date {
  if (view === "month") return addMonths(anchor, step)
  if (view === "week") return addWeeks(anchor, step)
  return addDays(anchor, step)
}

/** "Sep 14 – 20, 2026", "Aug 31 – Sep 6, 2026", "Dec 28, 2026 – Jan 3, 2027". */
export function weekLabel(start: Date): string {
  const end = addDays(start, 6)
  if (start.getFullYear() !== end.getFullYear()) return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`
  if (start.getMonth() !== end.getMonth()) return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
  return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
}

/** "September 2026" · "Sep 14 – 20, 2026" · "Monday, Sep 14, 2026". */
export function periodLabel(view: CalendarView, anchor: Date, weekStartsOn: 0 | 1): string {
  if (view === "month") return format(anchor, "MMMM yyyy")
  if (view === "day") return format(anchor, "EEEE, MMM d, yyyy")
  return weekLabel(startOfWeek(anchor, weekStartsOn))
}

/** Weekday indexes (0 = Sunday) in display order. */
export function weekdayOrder(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)
}

/* ------------------------------- Placement -------------------------------- */

export type PlacementKind = "published" | "scheduled" | "due"

export interface Placement {
  item: ContentItem
  kind: PlacementKind
  at: Date
  key: ISODate
}

export const isLiveItem = (item: Pick<ContentItem, "stage">) => PUBLISHED_STAGES.includes(item.stage)

/**
 * Where an item sits on the calendar (contentItemDate): published → go-live date; unpublished → its publish
 * time, else its production deadline. Ready to Post / Scheduled items without a publish time have met their
 * deadline, so they wait in the Unscheduled tray instead of on their due date.
 */
export function placementOf(item: ContentItem): Placement | null {
  if (isLiveItem(item)) {
    const at = parseDate(item.published_at) ?? parseDate(item.scheduled_at) ?? parseDate(item.due_date)
    return at ? { item, kind: "published", at, key: toISODate(at) } : null
  }
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled) return { item, kind: "scheduled", at: scheduled, key: toISODate(scheduled) }
  if (BUFFER_STAGES.includes(item.stage)) return null
  const due = parseDate(item.due_date)
  return due ? { item, kind: "due", at: due, key: toISODate(due) } : null
}

export function placementsByDay(items: ContentItem[]): Map<ISODate, Placement[]> {
  const out = new Map<ISODate, Placement[]>()
  for (const item of items) {
    const placement = placementOf(item)
    if (!placement) continue
    const list = out.get(placement.key)
    if (list) list.push(placement)
    else out.set(placement.key, [placement])
  }
  return out
}

/* --------------------------------- Tray ----------------------------------- */

export type TrayGroupId = "ready" | "production" | "early"

export const TRAY_GROUPS: { id: TrayGroupId; label: string; hint: string }[] = [
  { id: "ready", label: "Ready to post", hint: "Approved — give it a publish time" },
  { id: "production", label: "In production", hint: "No publish date or deadline yet" },
  { id: "early", label: "Early stage", hint: "Ideas and selected items on the board" },
]

/** Unscheduled tray bucket for an unpublished item with no calendar date (null = not in the tray). */
export function trayGroupOf(item: ContentItem): TrayGroupId | null {
  if (isLiveItem(item) || placementOf(item)) return null
  if (BUFFER_STAGES.includes(item.stage)) return "ready"
  if (item.stage === "idea" || item.stage === "selected") return "early"
  return "production"
}

/* --------------------------------- Slots ---------------------------------- */

export type SlotStatus = "filled" | "partial" | "open" | "missed"

export interface SlotSeat {
  /** null = the slot names no platform, so any post fills it. */
  platform: PlatformId | null
  post: Placement | null
}

export interface DaySlot {
  slot: PostingSlot
  /** The slot's time on this day (09:00 when the slot has none). */
  at: Date
  seats: SlotSeat[]
  /** Posts filling the slot, in seat order. */
  posts: Placement[]
  /** Slot platforms still without a post. */
  missing: PlatformId[]
  status: SlotStatus
}

export const DEFAULT_SLOT_TIME = "09:00"

/** Schedule order: the user's order (sort_order), then time. */
export function compareSlots(a: PostingSlot, b: PostingSlot): number {
  return a.sort_order - b.sort_order || (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.label.localeCompare(b.label)
}

export function slotsForWeekday(slots: PostingSlot[], weekday: number): PostingSlot[] {
  return slots.filter((s) => s.is_active && s.day_of_week === weekday).sort(compareSlots)
}

type SeatRule = (seat: SlotSeat, slot: PostingSlot, item: ContentItem) => boolean

/** Strongest match first: same platform and pillar → same platform → any-platform slot (pillar first). */
const SEAT_RULES: SeatRule[] = [
  (seat, slot, item) => seat.platform === item.platform && Boolean(slot.pillar_id) && slot.pillar_id === item.pillar_id,
  (seat, _slot, item) => seat.platform === item.platform,
  (seat, slot, item) => seat.platform === null && Boolean(slot.pillar_id) && slot.pillar_id === item.pillar_id,
  (seat) => seat.platform === null,
]

/**
 * One day's posting slots with the posts that fill them. A slot has one seat per platform (one seat when it
 * names none); each post fills at most one seat, nearest in time first. Unfilled slots are missed before
 * today and open from today on.
 */
export function fillSlots(daySlots: PostingSlot[], posts: Placement[], day: Date, todayKey: ISODate): { slots: DaySlot[]; used: Set<ID> } {
  const key = toISODate(day)
  const drafts = daySlots.map((slot) => ({
    slot,
    at: parseDate(combineDateTime(day, slot.time ?? DEFAULT_SLOT_TIME)) ?? day,
    seats: (slot.platforms.length ? slot.platforms : [null]).map((platform): SlotSeat => ({ platform, post: null })),
  }))
  const used = new Set<ID>()
  for (const rule of SEAT_RULES) {
    for (const draft of drafts) {
      for (const seat of draft.seats) {
        if (seat.post) continue
        let best: Placement | null = null
        for (const post of posts) {
          if (used.has(post.item.id) || !rule(seat, draft.slot, post.item)) continue
          const distance = Math.abs(post.at.getTime() - draft.at.getTime())
          if (!best || distance < Math.abs(best.at.getTime() - draft.at.getTime())) best = post
        }
        if (best) {
          seat.post = best
          used.add(best.item.id)
        }
      }
    }
  }
  const slots = drafts.map(({ slot, at, seats }): DaySlot => {
    const filled = seats.filter((s) => s.post).length
    const status: SlotStatus = filled === seats.length ? "filled" : filled > 0 ? "partial" : key < todayKey ? "missed" : "open"
    return {
      slot,
      at,
      seats,
      posts: seats.flatMap((s) => (s.post ? [s.post] : [])),
      missing: seats.flatMap((s) => (!s.post && s.platform ? [s.platform] : [])),
      status,
    }
  })
  return { slots, used }
}

/** A slot that still takes a post: open, or partly filled and not in the past. */
export function isFillable(daySlot: DaySlot, isPast: boolean): boolean {
  return !isPast && (daySlot.status === "open" || daySlot.status === "partial")
}

/* ---------------------------------- Days ---------------------------------- */

export interface CalendarDay {
  key: ISODate
  date: Date
  isToday: boolean
  isPast: boolean
  /** Inside the month being shown (always true for week and day views). */
  inPeriod: boolean
  slots: DaySlot[]
  /** Visible published + scheduled posts, earliest first. */
  posts: Placement[]
  /** Visible posts that don't fill a posting slot. */
  extraPosts: Placement[]
  /** Visible production deadlines (work due this day without a publish time). */
  due: Placement[]
}

const byTime = (a: Placement, b: Placement) => a.at.getTime() - b.at.getTime() || a.item.title.localeCompare(b.item.title)

/**
 * Days of a view with their slots and items. Slots are always filled from every post (a filter never
 * empties a posting target); `visible` only decides which items are listed.
 */
export function buildCalendarDays(
  days: Date[],
  byDay: Map<ISODate, Placement[]>,
  slots: PostingSlot[],
  now: Date,
  options: { month?: Date; visible?: (item: ContentItem) => boolean } = {}
): CalendarDay[] {
  const todayKey = toISODate(now)
  const visible = options.visible ?? (() => true)
  return days.map((date) => {
    const key = toISODate(date)
    const placements = byDay.get(key) ?? []
    const allPosts = placements.filter((p) => p.kind !== "due").sort(byTime)
    const { slots: daySlots, used } = fillSlots(slotsForWeekday(slots, date.getDay()), allPosts, date, todayKey)
    const posts = allPosts.filter((p) => visible(p.item))
    return {
      key,
      date,
      isToday: key === todayKey,
      isPast: key < todayKey,
      inPeriod: options.month ? date.getMonth() === options.month.getMonth() && date.getFullYear() === options.month.getFullYear() : true,
      slots: daySlots,
      posts,
      extraPosts: posts.filter((p) => !used.has(p.item.id)),
      due: placements.filter((p) => p.kind === "due" && visible(p.item)).sort(byTime),
    }
  })
}

export interface PeriodStats {
  published: number
  scheduled: number
  due: number
  /** Posting slots today or later still taking a post. */
  openSlots: number
  /** Posting slots before today that went unfilled. */
  missedSlots: number
  slotsTotal: number
}

export function periodStats(days: CalendarDay[]): PeriodStats {
  const stats: PeriodStats = { published: 0, scheduled: 0, due: 0, openSlots: 0, missedSlots: 0, slotsTotal: 0 }
  for (const day of days) {
    if (!day.inPeriod) continue
    for (const post of day.posts) {
      if (post.kind === "published") stats.published++
      else stats.scheduled++
    }
    stats.due += day.due.length
    stats.slotsTotal += day.slots.length
    for (const s of day.slots) {
      if (isFillable(s, day.isPast)) stats.openSlots++
      else if (day.isPast && s.status === "missed") stats.missedSlots++
    }
  }
  return stats
}

/* -------------------------------- Filters --------------------------------- */

export const NONE_KEY = "none"

export interface CalendarFilters {
  platform: string[]
  pillar: string[]
  goal: string[]
  format: string[]
  status: string[]
}

export type FilterKey = keyof CalendarFilters

export const FILTER_KEYS: FilterKey[] = ["platform", "pillar", "goal", "format", "status"]

export const EMPTY_FILTERS: CalendarFilters = { platform: [], pillar: [], goal: [], format: [], status: [] }

export function stageGroupOf(item: Pick<ContentItem, "stage">): StageGroup {
  return PIPELINE_STAGE_MAP[item.stage]?.group ?? "idea"
}

export function filterValue(item: ContentItem, key: FilterKey): string {
  switch (key) {
    case "platform":
      return item.platform
    case "pillar":
      return item.pillar_id ?? NONE_KEY
    case "goal":
      return item.goal_id ?? NONE_KEY
    case "format":
      return item.format_id ?? NONE_KEY
    case "status":
      return stageGroupOf(item)
  }
}

export function matchesFilters(item: ContentItem, filters: CalendarFilters): boolean {
  return FILTER_KEYS.every((key) => !filters[key].length || filters[key].includes(filterValue(item, key)))
}

export function hasFilters(filters: CalendarFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key].length > 0)
}

/* ------------------------------ Drag and drop ----------------------------- */

export const TRAY_DROP_ID = "tray"

export const dayDropId = (key: ISODate) => `day:${key}`

export function dayKeyFromDrop(id: unknown): ISODate | null {
  return typeof id === "string" && id.startsWith("day:") ? id.slice(4) : null
}

/** The day's slot time on the item's platform (same pillar preferred), or null. */
export function slotTimeFor(item: Pick<ContentItem, "platform" | "pillar_id">, day: Date, slots: PostingSlot[]): string | null {
  const candidates = slotsForWeekday(slots, day.getDay()).filter((s) => !s.platforms.length || s.platforms.includes(item.platform))
  const best = candidates.find((s) => s.pillar_id && s.pillar_id === item.pillar_id) ?? candidates[0]
  return best?.time ?? null
}

/** The next :00 or :30 at least 15 minutes from now. */
export function nextHalfHour(now: Date): Date {
  const d = new Date(now.getTime() + 15 * 60_000)
  d.setSeconds(0, 0)
  const minutes = d.getMinutes()
  if (minutes !== 0 && minutes !== 30) d.setMinutes(minutes < 30 ? 30 : 60)
  return d
}

/**
 * Publish time for an item dropped on `day`: its current time of day, else the day's slot time on its platform,
 * else 09:00 — pushed to the next half hour when that moment has already passed.
 */
export function dropTime(item: ContentItem, day: Date, slots: PostingSlot[], now: Date): Date {
  const current = parseDate(item.scheduled_at)
  const time = current ? format(current, "HH:mm") : (slotTimeFor(item, day, slots) ?? DEFAULT_SLOT_TIME)
  const at = parseDate(combineDateTime(day, time)) ?? day
  return at.getTime() > now.getTime() ? at : nextHalfHour(now)
}

/* ---------------------------- Slot suggestions ---------------------------- */

export interface SlotSuggestion {
  at: Date
  label: string
  slotId: ID
}

/** Upcoming posting slots (next `days` days) that still take a post on the item's platform. */
export function openSlotSuggestions(
  slots: PostingSlot[],
  items: ContentItem[],
  item: Pick<ContentItem, "id" | "platform">,
  now: Date,
  options: { limit?: number; days?: number } = {}
): SlotSuggestion[] {
  const limit = options.limit ?? 4
  const horizon = options.days ?? 14
  if (!slots.some((s) => s.is_active)) return []
  const byDay = placementsByDay(items.filter((i) => i.id !== item.id))
  const todayKey = toISODate(now)
  const today = startOfDay(now)
  const out: SlotSuggestion[] = []
  for (let offset = 0; offset < horizon && out.length < limit; offset++) {
    const day = addDays(today, offset)
    const posts = (byDay.get(toISODate(day)) ?? []).filter((p) => p.kind !== "due")
    const { slots: daySlots } = fillSlots(slotsForWeekday(slots, day.getDay()), posts, day, todayKey)
    for (const daySlot of daySlots) {
      if (daySlot.at.getTime() <= now.getTime()) continue
      const takes = daySlot.slot.platforms.length ? daySlot.missing.includes(item.platform) : daySlot.status === "open"
      if (!takes) continue
      out.push({ at: daySlot.at, label: daySlot.slot.label, slotId: daySlot.slot.id })
      if (out.length >= limit) break
    }
  }
  return out
}

/** "18:30" → "6:30 PM"; null when unset or malformed. */
export function formatSlotTime(time: string | null | undefined): string | null {
  const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null
  if (!match) return null
  const hours = Number(match[1])
  if (hours > 23) return null
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`
}
