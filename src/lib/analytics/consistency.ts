/**
 * Weekly posting goal, posting history, consistency score and streak (spec §2).
 * Weeks start on settings.week_starts_on.
 */
import { addDays, addWeeks, endOfDay, subDays, subWeeks } from "date-fns"
import { weekRange } from "@/lib/dates"
import type { AppSettings, Database, ISODate } from "@/lib/types"
import { calendarDays, dayKey, isPublishedItem, localWeekStart, publishedAtOf, publishedMs, timeOf } from "./shared"

/** A week counts as "consistent" at ≥ 80% of the weekly target. */
export const CONSISTENT_WEEK_SHARE = 0.8

export interface WeeklyProgress {
  published: number
  target: number
  /** published ÷ target × 100, rounded, not capped (100 when the target is 0). */
  pct: number
  remaining: number
  /** Unpublished items scheduled between now and the end of the week. */
  scheduledRemaining: number
  /** published + scheduledRemaining ≥ target. */
  onTrack: boolean
  /** Days left in the week, today included. */
  daysLeft: number
  weekStart: ISODate
  weekEnd: ISODate
}

/** Posts published this week vs weekly_post_target, plus what's already scheduled for the rest of it. */
export function weeklyPostingProgress(db: Database, now: Date, settings: AppSettings): WeeklyProgress {
  const { start, end } = weekRange(now, settings.week_starts_on)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const nowMs = now.getTime()
  let published = 0
  let scheduledRemaining = 0
  for (const item of db.content_items) {
    if (isPublishedItem(item)) {
      const at = publishedMs(item)
      if (at >= startMs && at <= endMs) published++
      continue
    }
    const at = timeOf(item, "scheduled_at")
    if (at > nowMs && at <= endMs) scheduledRemaining++
  }
  const target = Math.max(0, Math.round(settings.weekly_post_target))
  return {
    published,
    target,
    pct: target ? Math.round((published / target) * 100) : 100,
    remaining: Math.max(0, target - published),
    scheduledRemaining,
    onTrack: published + scheduledRemaining >= target,
    daysLeft: Math.max(0, calendarDays(now, end) + 1),
    weekStart: dayKey(start),
    weekEnd: dayKey(end),
  }
}

export interface PostingWeek {
  weekStart: ISODate
  weekEnd: ISODate
  published: number
  target: number
  pct: number
  /** published ≥ target. */
  hit: boolean
  /** published ≥ 80% of target. */
  consistent: boolean
  isCurrent: boolean
}

function weeklyCounts(db: Database, weekStartsOn: 0 | 1): Map<ISODate, number> {
  const counts = new Map<ISODate, number>()
  for (const item of db.content_items) {
    if (!isPublishedItem(item)) continue
    const at = publishedAtOf(item)
    if (!at) continue
    const key = dayKey(localWeekStart(at, weekStartsOn))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** `count` consecutive weeks starting with the week containing `from`. */
export function postingWeeks(db: Database, settings: AppSettings, from: Date, count: number, now: Date): PostingWeek[] {
  const weekStartsOn = settings.week_starts_on
  const counts = weeklyCounts(db, weekStartsOn)
  const target = Math.max(0, Math.round(settings.weekly_post_target))
  const currentKey = dayKey(localWeekStart(now, weekStartsOn))
  const out: PostingWeek[] = []
  let start = localWeekStart(from, weekStartsOn)
  for (let i = 0; i < count; i++) {
    const key = dayKey(start)
    const published = counts.get(key) ?? 0
    out.push({
      weekStart: key,
      weekEnd: dayKey(addDays(start, 6)),
      published,
      target,
      pct: target ? Math.round((published / target) * 100) : 100,
      hit: published >= target,
      consistent: published >= target * CONSISTENT_WEEK_SHARE,
      isCurrent: key === currentKey,
    })
    start = addWeeks(start, 1)
  }
  return out
}

/** The last `weeks` weeks, oldest first, ending with the current (partial) week. */
export function postingHistory(db: Database, now: Date, settings: AppSettings, weeks = 8): PostingWeek[] {
  const count = Math.max(1, Math.round(weeks))
  return postingWeeks(db, settings, subWeeks(localWeekStart(now, settings.week_starts_on), count - 1), count, now)
}

function firstPublishDate(db: Database, now: Date): Date | null {
  const cutoff = endOfDay(now).getTime()
  let first: Date | null = null
  for (const item of db.content_items) {
    if (!isPublishedItem(item)) continue
    const at = publishedAtOf(item)
    if (at && at.getTime() <= cutoff && (!first || at < first)) first = at
  }
  return first
}

export interface ConsistencyStats {
  /** 0–100, or null when there is history but no completed week to judge yet. */
  score: number | null
  weeksCounted: number
  weeksConsistent: number
  /** False when nothing has ever been published. */
  hasHistory: boolean
}

/** consistencyScore with the counts behind it (see consistencyScore). */
export function consistencyStats(db: Database, now: Date, settings: AppSettings, weeks = 8): ConsistencyStats {
  const first = firstPublishDate(db, now)
  if (!first) return { score: null, weeksCounted: 0, weeksConsistent: 0, hasHistory: false }
  const firstWeek = dayKey(localWeekStart(first, settings.week_starts_on))
  const completed = postingHistory(db, now, settings, Math.max(1, Math.round(weeks)) + 1).filter((w) => !w.isCurrent)
  let weightSum = 0
  let weightHit = 0
  let weeksCounted = 0
  let weeksConsistent = 0
  completed.forEach((week, i) => {
    if (week.weekStart < firstWeek) return
    const weight = i + 1
    weightSum += weight
    weeksCounted++
    if (week.consistent) {
      weightHit += weight
      weeksConsistent++
    }
  })
  return {
    score: weightSum ? Math.round((weightHit / weightSum) * 100) : null,
    weeksCounted,
    weeksConsistent,
    hasHistory: true,
  }
}

/**
 * 0–100: Σ weight·[week ≥ 80% of target] ÷ Σ weight over the last `weeks` completed weeks,
 * weight = 1 (oldest) … `weeks` (most recent); weeks before the first post are skipped; 0 without a judged week.
 */
export function consistencyScore(db: Database, now: Date, settings: AppSettings, weeks = 8): number {
  return consistencyStats(db, now, settings, weeks).score ?? 0
}

/** Consecutive days with ≥ 1 published post, counting back from today (or yesterday if nothing is out today yet). */
export function postingStreakDays(db: Database, now: Date): number {
  const cutoff = endOfDay(now).getTime()
  const days = new Set<ISODate>()
  for (const item of db.content_items) {
    if (!isPublishedItem(item)) continue
    const at = publishedAtOf(item)
    if (at && at.getTime() <= cutoff) days.add(dayKey(at))
  }
  let cursor = days.has(dayKey(now)) ? now : subDays(now, 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor = subDays(cursor, 1)
  }
  return streak
}
