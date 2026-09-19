/**
 * Everything the Home dashboard shows, computed in one pass from (db, settings, now).
 * Pure — the view memoises it per workspace change and per minute.
 */
import { subDays } from "date-fns"
import {
  comparePeriods,
  contentBuffer,
  contentHealthScore,
  contentToday,
  periodTotals,
  pillarMix,
  pillarPerformance,
  pipelineCounts,
  platformPerformance,
  postingHistory,
  strategicInsights,
  timeSeries,
  topPerformers,
  weeklyPostingProgress,
} from "@/lib/analytics"
import { weekRange } from "@/lib/dates"
import type { UiLang } from "@/lib/i18n/core"
import type { AppSettings, Database } from "@/lib/types"
import { buildWeekDays, platformGrowthRows, strategistPrompts } from "./dashboard-utils"
import { firstSteps, hasPublishedContent, workspaceStartKey } from "./first-run"
import { firstWeek } from "./first-week"

/** Trailing window for performance sections (top content, pillars, platforms). */
export const PERFORMANCE_DAYS = 30

export function computeDashboard(db: Database, settings: AppSettings, now: Date, lang: UiLang = "en") {
  const weekly = weeklyPostingProgress(db, now, settings)
  const top = topPerformers(db, settings, now, { days: PERFORMANCE_DAYS, limit: 5 })
  const pillars = pillarPerformance(db, now, { days: PERFORMANCE_DAYS, settings, lang })
  const mix = pillarMix(db, now, settings, { lang })
  const growthCurrent = periodTotals(db, subDays(now, 6), now)
  const growthPrevious = periodTotals(db, subDays(now, 13), subDays(now, 7))
  const platformsNow = platformPerformance(db, now, { days: PERFORMANCE_DAYS, settings })
  const platformsBefore = platformPerformance(db, now, {
    start: subDays(now, PERFORMANCE_DAYS * 2 - 1),
    end: subDays(now, PERFORMANCE_DAYS),
    settings,
  })

  // Setup's starter ideas aren't "captured today" (same rule as the first-week plan).
  const today = contentToday(db, now)
  return {
    now,
    week: weekRange(now, settings.week_starts_on),
    weekly,
    history: postingHistory(db, now, settings, 8),
    today,
    buffer: contentBuffer(db, now, settings, lang),
    growth: {
      current: growthCurrent,
      previous: growthPrevious,
      deltas: comparePeriods(growthCurrent, growthPrevious),
      trend: timeSeries(db, now, { days: 28, metric: "followers_gained" }),
    },
    health: contentHealthScore(db, now, settings, lang),
    pipeline: pipelineCounts(db, now),
    top,
    pillars,
    mix,
    platforms: platformGrowthRows(platformsNow, platformsBefore),
    insights: strategicInsights(db, now, settings, lang),
    weekDays: buildWeekDays(db, now, settings.week_starts_on),
    prompts: strategistPrompts({ mixWarning: mix.warnings[0], pillars, top: top[0], weekly }, lang),
    /** Nothing published yet: Home shows first steps instead of scores built on zeros. */
    hasPublished: hasPublishedContent(db.content_items),
    hasContent: db.content_items.length > 0,
    startKey: workspaceStartKey(db),
    steps: firstSteps(db, lang),
    /** "Your first week": replaces `steps` on Home while it's visible (`isFirstWeekVisible`). */
    firstWeek: firstWeek(db, now, lang),
  }
}

export type DashboardData = ReturnType<typeof computeDashboard>
