"use client"

import { useMemo } from "react"
import { firstWeek } from "@/components/features/dashboard/first-week"
import { contentToday, weeklyPostingProgress } from "@/lib/analytics"
import { BUFFER_STAGES } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { useUiLang } from "@/lib/i18n"
import { getCurrentScript, useDb, useSettings } from "@/lib/store"
import type { ID } from "@/lib/types"
import { logForDay } from "./engagement-utils"
import { dailyRhythm, postCopy, todaySlots, todaysContent, type PostCopy } from "./today-utils"
import { useNow } from "./use-now"

/** Everything the Today page shows, computed from the workspace for `now` (refreshed each minute). */
export function useTodayData() {
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const lang = useUiLang()

  return useMemo(() => {
    const today = contentToday(db, now)
    const day = toISODate(now)
    const log = logForDay(db.engagement_logs, day)
    const todays = todaysContent(today)

    const briefs = new Map(db.content_briefs.map((brief) => [brief.content_item_id, brief]))
    const copies = new Map<ID, PostCopy>()
    for (const item of today.toPost) copies.set(item.id, postCopy(getCurrentScript(db, item.id), briefs.get(item.id)))
    for (const item of todays) {
      if (!copies.has(item.id) && BUFFER_STAGES.includes(item.stage)) {
        copies.set(item.id, postCopy(getCurrentScript(db, item.id), briefs.get(item.id)))
      }
    }

    return {
      now,
      day,
      today,
      todays,
      log,
      tasks: settings.engagement_tasks,
      week: weeklyPostingProgress(db, now, settings),
      rhythm: dailyRhythm({ db, today, now, log, tasks: settings.engagement_tasks, lang }),
      copies,
      /** Items with at least one analytics snapshot. */
      measured: new Set(db.content_metrics.map((metric) => metric.content_item_id)),
      slots: todaySlots(db.content_calendar, now),
      /** "Your first week" — Today shows its compact row while the plan is active. */
      firstWeek: firstWeek(db, now, lang),
    }
  }, [db, now, settings, lang])
}

export type TodayData = ReturnType<typeof useTodayData>
