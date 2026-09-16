/**
 * Reminder schedule — pure. From the `reminders_*` settings, the Posting Schedule and the workspace
 * time zone, computes when each reminder fires:
 *
 * - daily digest    every day at `reminders_daily_time`
 * - slot heads-up   `reminders_slot_lead_minutes` before each active Posting Schedule slot that has a time
 * - weekly review   on `reminders_review_day` at `reminders_review_time`
 *
 * `describeReminder` turns one occurrence into notification text from the workspace (posts scheduled
 * today, what's ready for a slot, this week's published count). Used by Settings → Reminders (preview),
 * the calendar file and the cron job that sends push notifications.
 */
import { PLATFORMS, PUBLISHED_STAGES } from "@/lib/constants"
import { translator, type Translator, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, ContentItem, PostingSlot } from "@/lib/types"
import { reminderMessages } from "./messages"
import {
  addLocalDays,
  localDateKey,
  localDateOf,
  localTimeKey,
  parseTime,
  safeTimeZone,
  zonedParts,
  zonedToUtc,
  type LocalDay,
} from "./zoned"

export type ReminderKind = "daily" | "slot" | "review"

export type ReminderSettings = Pick<
  AppSettings,
  | "timezone"
  | "week_starts_on"
  | "weekly_post_target"
  | "reminders_daily_enabled"
  | "reminders_daily_time"
  | "reminders_slot_enabled"
  | "reminders_slot_lead_minutes"
  | "reminders_review_enabled"
  | "reminders_review_day"
  | "reminders_review_time"
>

export type ReminderSlot = Pick<PostingSlot, "id" | "day_of_week" | "label" | "platforms" | "time" | "is_active" | "sort_order">
export type ReminderItem = Pick<ContentItem, "id" | "title" | "stage" | "scheduled_at" | "due_date" | "published_at">

export interface ReminderOccurrence {
  /** Stable id for this occurrence — `daily:2026-09-16`, `slot:<slot id>:2026-09-16`, `review:2026-09-20`. */
  key: string
  kind: ReminderKind
  /** When the reminder is due. */
  fireAt: Date
  /** After this, sending it no longer helps (a slot heads-up after the slot, a digest hours late). */
  expiresAt: Date
  /** The local day it belongs to (for a slot: the slot's day). */
  localDate: string
  /** Local "HH:mm" when it fires. */
  localTime: string
  slotId?: string
  /** For slots: when the slot itself starts. */
  eventAt?: Date
}

/** Minutes of lead time allowed (matches the migration's CHECK). */
export const SLOT_LEAD_LIMITS = { min: 0, max: 1440 } as const

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAILY_STALE_AFTER = 3 * HOUR
const REVIEW_STALE_AFTER = 6 * HOUR
/** A slot reminder with no lead time stays useful for a short while after the slot starts. */
const SLOT_GRACE = 15 * MINUTE
/** Longest a reminder stays sendable — the cron job looks back this far. */
export const MAX_STALENESS_MS = REVIEW_STALE_AFTER

const PUBLISHED = new Set<string>(PUBLISHED_STAGES)

export function clampLead(minutes: number): number {
  if (!Number.isFinite(minutes)) return 30
  return Math.min(SLOT_LEAD_LIMITS.max, Math.max(SLOT_LEAD_LIMITS.min, Math.round(minutes)))
}

/** Active slots that can have a reminder (a slot needs a time), in schedule order. */
export function timedSlots<T extends ReminderSlot>(slots: readonly T[]): T[] {
  return slots
    .filter((slot) => slot.is_active && parseTime(slot.time) !== null)
    .sort((a, b) => a.day_of_week - b.day_of_week || (a.time ?? "").localeCompare(b.time ?? "") || a.sort_order - b.sort_order)
}

export function anyReminderEnabled(settings: ReminderSettings): boolean {
  return settings.reminders_daily_enabled || settings.reminders_slot_enabled || settings.reminders_review_enabled
}

/** Every reminder whose `fireAt` falls in [from, to), sorted by time. */
export function reminderOccurrences({
  settings,
  slots,
  from,
  to,
}: {
  settings: ReminderSettings
  slots: readonly ReminderSlot[]
  from: Date
  to: Date
}): ReminderOccurrence[] {
  const tz = safeTimeZone(settings.timezone)
  const daily = settings.reminders_daily_enabled ? parseTime(settings.reminders_daily_time) : null
  const review = settings.reminders_review_enabled ? parseTime(settings.reminders_review_time) : null
  const lead = clampLead(settings.reminders_slot_lead_minutes)
  const slotList = settings.reminders_slot_enabled ? timedSlots(slots) : []

  // Local days that can hold an occurrence in range: a slot reminder fires up to a day before its slot.
  const first = addLocalDays(zonedParts(from, tz), -1)
  const last = zonedParts(new Date(to.getTime() + SLOT_LEAD_LIMITS.max * MINUTE), tz)
  const lastKey = localDateKey(addLocalDays(last, 1))

  const out: ReminderOccurrence[] = []
  const push = (occurrence: ReminderOccurrence) => {
    if (occurrence.fireAt >= from && occurrence.fireAt < to) out.push(occurrence)
  }
  const at = (day: LocalDay, time: { hour: number; minute: number }) => zonedToUtc({ ...day, ...time }, tz)

  for (let day = first, guard = 0; localDateKey(day) <= lastKey && guard < 400; day = addLocalDays(day, 1), guard++) {
    const date = localDateKey(day)
    if (daily) {
      const fireAt = at(day, daily)
      push({ key: `daily:${date}`, kind: "daily", fireAt, expiresAt: new Date(fireAt.getTime() + DAILY_STALE_AFTER), localDate: date, localTime: localTimeKey(daily) })
    }
    if (review && day.weekday === settings.reminders_review_day) {
      const fireAt = at(day, review)
      push({ key: `review:${date}`, kind: "review", fireAt, expiresAt: new Date(fireAt.getTime() + REVIEW_STALE_AFTER), localDate: date, localTime: localTimeKey(review) })
    }
    for (const slot of slotList) {
      if (slot.day_of_week !== day.weekday) continue
      const eventAt = at(day, parseTime(slot.time)!)
      const fireAt = new Date(eventAt.getTime() - lead * MINUTE)
      push({
        key: `slot:${slot.id}:${date}`,
        kind: "slot",
        fireAt,
        expiresAt: new Date(eventAt.getTime() + (lead === 0 ? SLOT_GRACE : 0)),
        localDate: date,
        localTime: localTimeKey(zonedParts(fireAt, tz)),
        slotId: slot.id,
        eventAt,
      })
    }
  }
  const order: Record<ReminderKind, number> = { daily: 0, slot: 1, review: 2 }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || order[a.kind] - order[b.kind] || a.key.localeCompare(b.key))
}

/** The next `count` reminders from `now` (looks up to two weeks ahead). */
export function upcomingReminders(settings: ReminderSettings, slots: readonly ReminderSlot[], now: Date, count = 5): ReminderOccurrence[] {
  return reminderOccurrences({ settings, slots, from: now, to: new Date(now.getTime() + 14 * 24 * HOUR) }).slice(0, count)
}

/**
 * Reminders to send at `now`: already due (up to `lookbackMs` ago), not yet stale, and not due before
 * `notBefore` (e.g. when the device subscribed — no backlog on a fresh subscription).
 */
export function dueReminders({
  settings,
  slots,
  now,
  lookbackMs = MAX_STALENESS_MS,
  notBefore,
}: {
  settings: ReminderSettings
  slots: readonly ReminderSlot[]
  now: Date
  lookbackMs?: number
  notBefore?: Date | null
}): ReminderOccurrence[] {
  const from = new Date(Math.max(now.getTime() - lookbackMs, notBefore?.getTime() ?? -Infinity))
  return reminderOccurrences({ settings, slots, from, to: new Date(now.getTime() + 1) }).filter((r) => r.expiresAt > now)
}

/* ------------------------------ Notification text ------------------------------ */

export interface ReminderMessage {
  title: string
  body: string
  /** Same-origin path the notification opens. */
  url: string
  /** Notification tag: a repeat of the same reminder replaces the old notification. */
  tag: string
}

export interface ReminderContent {
  settings: ReminderSettings
  slots: readonly ReminderSlot[]
  items: readonly ReminderItem[]
  lang: UiLang
}

const isOpen = (item: ReminderItem) => !PUBLISHED.has(item.stage)

function slotLabel(slot: ReminderSlot | undefined, t: Translator<typeof reminderMessages.en>): string {
  return slot?.label.trim() || t("slot_unnamed")
}

export function platformList(platforms: readonly string[]): string {
  return platforms.map((id) => PLATFORMS[id as keyof typeof PLATFORMS]?.label ?? id).join(", ")
}

/** Where the reminder's local week starts (`week_starts_on`), as "YYYY-MM-DD". */
export function weekStartKey(localDate: string, weekStartsOn: number): string {
  const [year, month, day] = localDate.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const back = (weekday - (weekStartsOn === 1 ? 1 : 0) + 7) % 7
  return localDateKey(addLocalDays({ year, month, day }, -back))
}

export function describeReminder(occurrence: ReminderOccurrence, { settings, slots, items, lang }: ReminderContent): ReminderMessage {
  const t = translator(reminderMessages, lang)
  const tz = safeTimeZone(settings.timezone)
  const date = occurrence.localDate
  const tag = `orbi-${occurrence.key}`
  const open = items.filter(isOpen)

  if (occurrence.kind === "daily") {
    const scheduled = open.filter((item) => localDateOf(item.scheduled_at, tz) === date)
    const due = open.filter((item) => item.due_date === date && localDateOf(item.scheduled_at, tz) !== date)
    const overdue = open.filter((item) => {
      const scheduledDay = localDateOf(item.scheduled_at, tz)
      return scheduledDay ? scheduledDay < date : Boolean(item.due_date && item.due_date < date)
    })
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    const todaysSlots = slots.filter((slot) => slot.is_active && slot.day_of_week === weekday)
    const parts = [
      scheduled.length ? t.plural("daily_scheduled", scheduled.length) : "",
      due.length ? t.plural("daily_due", due.length) : "",
      overdue.length ? t.plural("daily_overdue", overdue.length) : "",
      todaysSlots.length ? t("daily_slot", { label: slotLabel(todaysSlots[0], t) }) : "",
    ].filter(Boolean)
    return { title: t("daily_title"), body: parts.length ? parts.join(" · ") : t("daily_empty"), url: "/today", tag }
  }

  if (occurrence.kind === "slot") {
    const slot = slots.find((s) => s.id === occurrence.slotId)
    const lead = clampLead(settings.reminders_slot_lead_minutes)
    const title = lead > 0 ? t("slot_title_lead", { minutes: lead }) : t("slot_title_now")
    const heading = [slotLabel(slot, t), slot?.platforms.length ? platformList(slot.platforms) : ""].filter(Boolean).join(" · ")
    // The post for this slot: scheduled that day (closest to the slot time), else due that day.
    const eventMs = occurrence.eventAt?.getTime() ?? occurrence.fireAt.getTime()
    const candidates = open
      .filter((item) => localDateOf(item.scheduled_at, tz) === date)
      .sort((a, b) => Math.abs(Date.parse(a.scheduled_at!) - eventMs) - Math.abs(Date.parse(b.scheduled_at!) - eventMs))
    const ready = candidates[0] ?? open.find((item) => !item.scheduled_at && item.due_date === date)
    return {
      title,
      body: `${heading}\n${ready ? t("slot_ready", { title: ready.title || "—" }) : t("slot_nothing_ready")}`,
      url: ready ? `/studio/${ready.id}` : "/today",
      tag,
    }
  }

  const weekStart = weekStartKey(date, settings.week_starts_on)
  const published = items.filter((item) => {
    if (!PUBLISHED.has(item.stage)) return false
    const day = localDateOf(item.published_at, tz)
    return Boolean(day && day >= weekStart && day <= date)
  }).length
  return {
    title: t("review_title"),
    body: t.plural("review_body", published, { target: settings.weekly_post_target }),
    url: "/reports",
    tag,
  }
}
