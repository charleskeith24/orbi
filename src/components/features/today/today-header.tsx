"use client"

import { format } from "date-fns"
import { ChartColumn, Lightbulb, Plus, Send } from "lucide-react"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { todayMessages } from "./messages"
import type { TodayData } from "./use-today"

/** "Today · Sunday, Sep 13", where the week stands, and the four capture actions (2×2 on phones). */
export function TodayHeader({ data }: { data: TodayData }) {
  const t = useT(todayMessages)
  const { now, week, todays, today } = data
  const summary = [
    t("summary_week", { published: week.published, target: week.target }),
    todays.length ? t.plural("summary_list", todays.length, { count: formatNumber(todays.length) }) : t("summary_nothing"),
    today.overdue.length ? t("summary_overdue", { count: today.overdue.length }) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PageHeader
      title={`Today · ${format(now, "EEEE, MMM d")}`}
      description={summary}
      actions={
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
            <Lightbulb aria-hidden />
            {t("capture_idea")}
          </Button>
          <Button size="sm" onClick={() => uiActions.openDialog({ type: "new-content" })}>
            <Plus aria-hidden />
            {t("create_content")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
            <Send aria-hidden />
            {t("log_published")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
            <ChartColumn aria-hidden />
            {t("add_analytics")}
          </Button>
        </div>
      }
    />
  )
}
