/**
 * Goal progress for Strategy → Goals and the dashboard goal cards.
 */
import { endOfMonth, endOfQuarter, startOfMonth, startOfQuarter } from "date-fns"
import { GOAL_CATEGORIES } from "@/lib/constants"
import { toISODate, weekRange } from "@/lib/dates"
import type { AppSettings, ContentGoal, Database, GoalMetric, GoalPeriod, ISODate } from "@/lib/types"
import { clamp } from "@/lib/utils"
import { sharedPerformanceRows, type PerformanceRow } from "./metrics"
import { inRange, type DateRange } from "./shared"

export interface GoalProgress {
  /** target_metric, or the category's default metric when unset. */
  metric: GoalMetric
  current: number
  /** null when the goal has no positive target_value. */
  target: number | null
  /** current ÷ target × 100 (rounded, not capped); null without a target. */
  pct: number | null
  periodStart: ISODate
  periodEnd: ISODate
  /** Share of the period already elapsed, 0–100. */
  elapsedPct: number
  /** current ≥ target × elapsed share; null without a target. */
  onTrack: boolean | null
}

/** The period containing `now`: week (week_starts_on), calendar month or calendar quarter. */
export function goalPeriodRange(period: GoalPeriod, now: Date, weekStartsOn: 0 | 1): DateRange {
  switch (period) {
    case "weekly":
      return weekRange(now, weekStartsOn)
    case "quarterly":
      return { start: startOfQuarter(now), end: endOfQuarter(now) }
    case "monthly":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

/** A row's contribution to a goal metric ("posts" counts each publication once). */
export function goalMetricValue(row: PerformanceRow, metric: GoalMetric): number {
  switch (metric) {
    case "posts":
      return 1
    case "views":
      return row.views
    case "reach":
      return row.reach
    case "followers_gained":
      return row.followersGained
    case "engagements":
      return row.engagements
    case "comments":
      return row.comments
    case "shares":
      return row.shares
    case "saves":
      return row.saves
    case "profile_visits":
      return row.profileVisits
    case "link_clicks":
      return row.linkClicks
    case "leads":
      return row.leads
    case "sales":
      return row.sales
    default:
      return 0
  }
}

/** current = Σ metric over items published in the goal's current period (latest snapshots); pct = current ÷ target. */
export function goalProgress(db: Database, goal: ContentGoal, now: Date, settings: AppSettings): GoalProgress {
  const metric: GoalMetric = goal.target_metric ?? GOAL_CATEGORIES[goal.category]?.metric ?? "views"
  const range = goalPeriodRange(goal.period, now, settings.week_starts_on)
  const current = sharedPerformanceRows(db, now)
    .filter((r) => inRange(r.publishedAt, range))
    .reduce((acc, r) => acc + goalMetricValue(r, metric), 0)
  const target = goal.target_value !== null && goal.target_value > 0 ? goal.target_value : null
  const span = range.end.getTime() - range.start.getTime()
  const elapsed = span > 0 ? clamp((now.getTime() - range.start.getTime()) / span, 0, 1) : 1
  return {
    metric,
    current,
    target,
    pct: target ? Math.round((current / target) * 100) : null,
    periodStart: toISODate(range.start),
    periodEnd: toISODate(range.end),
    elapsedPct: Math.round(elapsed * 100),
    onTrack: target ? current >= target * elapsed : null,
  }
}
