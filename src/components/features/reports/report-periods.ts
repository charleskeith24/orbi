/**
 * Report periods for `/reports?week=` and `/reports/monthly?month=`: parsing (default = the last completed
 * period; future periods clamp to the current one), labels and picker options. Pure — pass `now`.
 */
import { addMonths, addWeeks, endOfMonth, format, startOfMonth, subMonths, subWeeks } from "date-fns"
import { parseDate, startOfWeek, toISODate, weekRange } from "@/lib/dates"
import type { ISODate } from "@/lib/types"

export interface ReportPeriod {
  /** URL value — week: its first day 'YYYY-MM-DD'; month: 'YYYY-MM'. */
  key: string
  /** First day (local midnight). */
  start: Date
  /** Last millisecond of the final day. */
  end: Date
  startISO: ISODate
  endISO: ISODate
  /** The period contains `now` (still in progress). */
  isCurrent: boolean
  label: string
}

export interface PeriodOption {
  value: string
  label: string
  hint?: string
}

/** "Sep 7 – 13, 2026", "Aug 31 – Sep 6, 2026", "Dec 29, 2025 – Jan 4, 2026". */
export function formatDayRange(start: Date, end: Date): string {
  if (start.getFullYear() !== end.getFullYear()) return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`
  if (start.getMonth() !== end.getMonth()) return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
  return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
}

/** "Sep 7 – 13", "Aug 31 – Sep 6" (no year). */
export function formatShortRange(startISO: ISODate, endISO: ISODate): string {
  const start = parseDate(startISO)
  const end = parseDate(endISO)
  if (!start || !end) return `${startISO} – ${endISO}`
  if (start.getMonth() !== end.getMonth()) return `${format(start, "MMM d")} – ${format(end, "MMM d")}`
  return `${format(start, "MMM d")} – ${format(end, "d")}`
}

/* ---------------------------------- Weeks ---------------------------------- */

export function weekPeriod(date: Date, now: Date, weekStartsOn: 0 | 1): ReportPeriod {
  const { start, end } = weekRange(date, weekStartsOn)
  const startISO = toISODate(start)
  return {
    key: startISO,
    start,
    end,
    startISO,
    endISO: toISODate(end),
    isCurrent: startISO === toISODate(startOfWeek(now, weekStartsOn)),
    label: formatDayRange(start, end),
  }
}

/** Normalised week start for any day ('YYYY-MM-DD'), or null when unparseable. */
export function weekKeyOf(day: ISODate, weekStartsOn: 0 | 1): ISODate | null {
  const date = parseDate(day)
  return date ? toISODate(startOfWeek(date, weekStartsOn)) : null
}

/** `?week=` → its week; missing/invalid → the last completed week; later than this week → this week. */
export function resolveWeekParam(param: string | null | undefined, now: Date, weekStartsOn: 0 | 1): ReportPeriod {
  const current = startOfWeek(now, weekStartsOn)
  const requested = param ? parseDate(param) : null
  if (!requested) return weekPeriod(subWeeks(current, 1), now, weekStartsOn)
  const start = startOfWeek(requested, weekStartsOn)
  return weekPeriod(start > current ? current : start, now, weekStartsOn)
}

/** The previous / next week keys (next is null for the current week). */
export function adjacentWeeks(period: ReportPeriod): { prev: string; next: string | null } {
  return {
    prev: toISODate(subWeeks(period.start, 1)),
    next: period.isCurrent ? null : toISODate(addWeeks(period.start, 1)),
  }
}

/**
 * The last `count` weeks (this week first), plus weeks carrying a hint (saved reviews) and the selected week.
 * `hints` is keyed by normalised week start.
 */
export function weekOptions(
  now: Date,
  weekStartsOn: 0 | 1,
  selected: ReportPeriod,
  hints: Map<string, string> = new Map(),
  count = 12
): PeriodOption[] {
  const current = startOfWeek(now, weekStartsOn)
  const currentKey = toISODate(current)
  const lastKey = toISODate(subWeeks(current, 1))
  const keys = new Set<string>([selected.key])
  for (let i = 0; i < count; i++) keys.add(toISODate(subWeeks(current, i)))
  for (const key of hints.keys()) if (key <= currentKey) keys.add(key)
  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .flatMap((key) => {
      const start = parseDate(key)
      if (!start) return []
      const { end } = weekRange(start, weekStartsOn)
      const hint = key === currentKey ? "This week" : key === lastKey ? "Last week" : hints.get(key)
      return [{ value: key, label: formatDayRange(start, end), hint }]
    })
}

/* ---------------------------------- Months --------------------------------- */

export function monthPeriod(date: Date, now: Date): ReportPeriod {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const key = format(start, "yyyy-MM")
  return {
    key,
    start,
    end,
    startISO: toISODate(start),
    endISO: toISODate(end),
    isCurrent: key === format(now, "yyyy-MM"),
    label: format(start, "MMMM yyyy"),
  }
}

const MONTH_PARAM = /^(\d{4})-(\d{2})(?:-\d{2})?$/

/** `?month=YYYY-MM` (a full date works too) → its month; missing/invalid → last month; future → this month. */
export function resolveMonthParam(param: string | null | undefined, now: Date): ReportPeriod {
  const current = startOfMonth(now)
  const match = param ? MONTH_PARAM.exec(param) : null
  const month = match ? Number(match[2]) : 0
  if (!match || month < 1 || month > 12) return monthPeriod(subMonths(current, 1), now)
  const start = new Date(Number(match[1]), month - 1, 1)
  return monthPeriod(start > current ? current : start, now)
}

export function adjacentMonths(period: ReportPeriod): { prev: string; next: string | null } {
  return {
    prev: format(subMonths(period.start, 1), "yyyy-MM"),
    next: period.isCurrent ? null : format(addMonths(period.start, 1), "yyyy-MM"),
  }
}

/** The last `count` months (this month first), plus months carrying a hint and the selected month. */
export function monthOptions(now: Date, selected: ReportPeriod, hints: Map<string, string> = new Map(), count = 12): PeriodOption[] {
  const current = startOfMonth(now)
  const currentKey = format(current, "yyyy-MM")
  const lastKey = format(subMonths(current, 1), "yyyy-MM")
  const keys = new Set<string>([selected.key])
  for (let i = 0; i < count; i++) keys.add(format(subMonths(current, i), "yyyy-MM"))
  for (const key of hints.keys()) if (MONTH_PARAM.test(key) && key <= currentKey) keys.add(key)
  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((key) => {
      const [y, m] = key.split("-").map(Number)
      const hint = key === currentKey ? "This month" : key === lastKey ? "Last month" : hints.get(key)
      return { value: key, label: format(new Date(y, m - 1, 1), "MMMM yyyy"), hint }
    })
}
