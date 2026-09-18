/**
 * Date helpers. All calendar logic works in the browser's local time.
 * ISODate strings ('YYYY-MM-DD') are parsed as local midnight.
 */
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek as dfStartOfWeek,
} from "date-fns"
// The pure i18n core only — never the "@/lib/i18n" React barrel.
import { translate, type UiLang } from "@/lib/i18n/core"
import { relativeDayMessages } from "@/lib/i18n/messages/dates"
import type { ContentItem, ISODate, ISODateTime } from "@/lib/types"

export type DateInput = Date | ISODate | ISODateTime | null | undefined

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Fast paths for the two shapes the workspace stores; anything else goes through date-fns. */
export function parseDate(value: DateInput): Date | null {
  if (!value) return null
  if (value instanceof Date) return isValid(value) ? value : null
  const dateOnly = ISO_DATE_ONLY.exec(value)
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    return isValid(d) ? d : null
  }
  // ES parses ISO date-times with an offset as absolute and without one as local — same as parseISO.
  const d = ISO_DATE_TIME.test(value) ? new Date(value) : parseISO(value)
  return isValid(d) ? d : null
}

/** Local calendar date → 'YYYY-MM-DD'. */
export function toISODate(date: Date): ISODate {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${String(date.getFullYear()).padStart(4, "0")}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now)
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  return dfStartOfWeek(date, { weekStartsOn })
}

export function weekRange(date: Date, weekStartsOn: 0 | 1 = 1): { start: Date; end: Date } {
  return { start: dfStartOfWeek(date, { weekStartsOn }), end: endOfWeek(date, { weekStartsOn }) }
}

export function formatDate(value: DateInput, pattern = "MMM d, yyyy"): string {
  const d = parseDate(value)
  return d ? format(d, pattern) : "—"
}

export function formatShortDate(value: DateInput): string {
  return formatDate(value, "MMM d")
}

export function formatDateTime(value: DateInput): string {
  return formatDate(value, "MMM d, h:mm a")
}

export function formatTime(value: DateInput): string {
  return formatDate(value, "h:mm a")
}

/**
 * "Today", "Tomorrow", "Yesterday", "in 3 days", "5 days ago", or a short date beyond two weeks.
 * `lang: "tl"` gives "Ngayon", "Bukas", "Kahapon", "sa 3 araw", "5 araw ang nakalipas"; the short date
 * stays date-fns "MMM d" in both languages.
 */
export function formatRelativeDay(value: DateInput, now: Date = new Date(), lang: UiLang = "en"): string {
  const d = parseDate(value)
  if (!d) return "—"
  const diff = differenceInCalendarDays(d, now)
  if (diff === 0) return translate(relativeDayMessages, lang, "today")
  if (diff === 1) return translate(relativeDayMessages, lang, "tomorrow")
  if (diff === -1) return translate(relativeDayMessages, lang, "yesterday")
  if (diff > 1 && diff <= 14) return translate(relativeDayMessages, lang, "in_days", { count: diff })
  if (diff < -1 && diff >= -14) return translate(relativeDayMessages, lang, "days_ago", { count: -diff })
  return format(d, "MMM d")
}

export function daysBetween(from: DateInput, to: DateInput): number | null {
  const a = parseDate(from)
  const b = parseDate(to)
  return a && b ? differenceInCalendarDays(b, a) : null
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const da = parseDate(a)
  const db = parseDate(b)
  return !!da && !!db && differenceInCalendarDays(da, db) === 0
}

/** Inclusive list of days from start to end. */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

/**
 * The date a content item lives on in calendars and timelines:
 * published → published_at, otherwise the planned publish time, otherwise the production deadline.
 */
export function contentItemDate(item: Pick<ContentItem, "published_at" | "scheduled_at" | "due_date">): Date | null {
  return parseDate(item.published_at) ?? parseDate(item.scheduled_at) ?? parseDate(item.due_date)
}

/** Combine a local calendar day with an "HH:mm" time into an ISO timestamp. */
export function combineDateTime(day: Date | ISODate, time: string | null | undefined): ISODateTime {
  const base = parseDate(day) ?? new Date()
  const [h, m] = (time ?? "09:00").split(":").map((n) => Number.parseInt(n, 10))
  const d = new Date(base)
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0)
  return d.toISOString()
}
