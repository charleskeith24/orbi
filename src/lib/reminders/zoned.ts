/**
 * Wall-clock time in an IANA time zone without a date library: `Intl.DateTimeFormat` reads a zone's
 * wall clock for an instant, and `zonedToUtc` goes back from wall clock to instant.
 *
 * Pure (no workspace or DOM access) — shared by the reminder schedule, the calendar file and the cron job.
 */

export interface LocalDay {
  year: number
  /** 1–12 */
  month: number
  day: number
}

export interface ZonedParts extends LocalDay {
  hour: number
  minute: number
  second: number
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
}

export const DEFAULT_TIME_ZONE = "Asia/Manila"

const formatters = new Map<string, Intl.DateTimeFormat>()
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** The zone when this runtime knows it, otherwise `fallback` (an old or mistyped setting never crashes a job). */
export function safeTimeZone(timeZone: string | null | undefined, fallback = DEFAULT_TIME_ZONE): string {
  if (!timeZone) return fallback
  try {
    formatter(timeZone)
    return timeZone
  } catch {
    return fallback
  }
}

/** Wall clock of `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, number> = {}
  for (const part of formatter(timeZone).formatToParts(date)) {
    if (part.type === "weekday") out.weekday = WEEKDAYS[part.value] ?? 0
    else if (part.type !== "literal" && part.type !== "dayPeriod") out[part.type] = Number(part.value)
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
    weekday: out.weekday,
  }
}

/** Milliseconds the zone is ahead of UTC at `instant` (e.g. +8h for Asia/Manila). */
export function zoneOffsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(new Date(instant), timeZone)
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return wall - Math.floor(instant / 1000) * 1000
}

/**
 * The instant a wall-clock time happens in `timeZone`. Daylight-saving edge cases follow the usual
 * "compatible" rule: a time skipped by a spring-forward gap moves later (02:30 → 03:30), a time that
 * happens twice at fall-back resolves to the first occurrence.
 */
export function zonedToUtc(local: LocalDay & { hour: number; minute: number }, timeZone: string): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
  const first = zoneOffsetMs(guess, timeZone)
  const candidates = [guess - first]
  const second = zoneOffsetMs(guess - first, timeZone)
  if (second !== first) candidates.push(guess - second)
  const matches = candidates.filter((t) => {
    const p = zonedParts(new Date(t), timeZone)
    return p.year === local.year && p.month === local.month && p.day === local.day && p.hour === local.hour && p.minute === local.minute
  })
  return new Date(matches.length ? Math.min(...matches) : Math.max(...candidates))
}

/** "HH:mm" → hour and minute, or null when it isn't a valid 24-hour time. */
export function parseTime(value: string | null | undefined): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour <= 23 && minute <= 59 ? { hour, minute } : null
}

/** The calendar day `days` after `day` (negative goes back). */
export function addLocalDays(day: LocalDay, days: number): LocalDay & { weekday: number } {
  const d = new Date(Date.UTC(day.year, day.month - 1, day.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() }
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0")

/** "YYYY-MM-DD" */
export function localDateKey(day: LocalDay): string {
  return `${pad(day.year, 4)}-${pad(day.month)}-${pad(day.day)}`
}

/** "HH:mm" */
export function localTimeKey(time: { hour: number; minute: number }): string {
  return `${pad(time.hour)}:${pad(time.minute)}`
}

/** The local calendar day of an instant (a full ISO timestamp) in `timeZone`, as "YYYY-MM-DD". */
export function localDateOf(value: string | Date | null | undefined, timeZone: string): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return localDateKey(zonedParts(date, timeZone))
}
