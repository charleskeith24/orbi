/**
 * Series cadence math (pure, local calendar days). The next episode lands one interval
 * after the latest dated episode, snapped to the series weekday, and never in the past.
 */
import { addDays, addMonths, differenceInCalendarDays, startOfDay } from "date-fns"
import { DAYS_OF_WEEK, SERIES_FREQUENCY_MAP } from "@/lib/constants"
import type { ContentSeries, SeriesFrequency } from "@/lib/types"

/** First date on or after `date` that falls on `day` (0 = Sunday). `null` day → `date` itself. */
export function nextOnOrAfter(date: Date, day: number | null): Date {
  const base = startOfDay(date)
  if (day === null) return base
  return addDays(base, (day - base.getDay() + 7) % 7)
}

/** The occurrence of `day` closest to `date` (ties go forward). `null` day → `date` itself. */
export function snapToWeekday(date: Date, day: number | null): Date {
  const base = startOfDay(date)
  if (day === null) return base
  const forward = (day - base.getDay() + 7) % 7
  return addDays(base, forward <= 3 ? forward : forward - 7)
}

function step(date: Date, frequency: SeriesFrequency): Date {
  switch (frequency) {
    case "daily":
      return addDays(date, 1)
    case "weekly":
      return addDays(date, 7)
    case "biweekly":
      return addDays(date, 14)
    case "monthly":
      return addMonths(date, 1)
  }
}

/**
 * Next episode date for a series.
 * - No dated episode yet → the first series weekday from today (daily: today).
 * - Otherwise latest episode + one interval, snapped to the weekday (daily ignores the weekday).
 * - A lapsed series (result before today) restarts at the first weekday from today.
 */
export function nextEpisodeDate(
  series: Pick<ContentSeries, "frequency" | "day_of_week">,
  latestEpisode: Date | null,
  now: Date
): Date {
  const today = startOfDay(now)
  const day = series.frequency === "daily" ? null : series.day_of_week
  if (!latestEpisode) return nextOnOrAfter(today, day)
  const candidate = snapToWeekday(step(startOfDay(latestEpisode), series.frequency), day)
  return candidate < today ? nextOnOrAfter(today, day) : candidate
}

/** "today", "tomorrow", "in 12 days", "22 days ago" — never falls back to a date. */
export function relativeDayLabel(date: Date, now: Date): string {
  const diff = differenceInCalendarDays(date, now)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}

/** "Weekly · Mondays", "Every 2 weeks · Wednesdays", "Daily". */
export function cadenceLabel(series: Pick<ContentSeries, "frequency" | "day_of_week">, short = false): string {
  const frequency = SERIES_FREQUENCY_MAP[series.frequency]?.label ?? series.frequency
  if (series.frequency === "daily" || series.day_of_week === null) return frequency
  const day = DAYS_OF_WEEK.find((d) => d.value === series.day_of_week)
  if (!day) return frequency
  return `${frequency} · ${short ? day.short : `${day.label}s`}`
}
