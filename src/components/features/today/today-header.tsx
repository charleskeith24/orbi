"use client"

import { format } from "date-fns"
import { ChartColumn, Lightbulb, Plus, Send } from "lucide-react"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { uiActions } from "@/lib/store"
import { pluralize } from "@/lib/utils"
import type { TodayData } from "./use-today"

/** "Today · Sunday, Sep 13", where the week stands, and the four capture actions (2×2 on phones). */
export function TodayHeader({ data }: { data: TodayData }) {
  const { now, week, todays, today } = data
  const summary = [
    `${week.published} of ${week.target} posts out this week`,
    todays.length ? `${pluralize(todays.length, "piece")} on today's list` : "nothing scheduled or due today",
    today.overdue.length ? `${today.overdue.length} overdue` : null,
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
            Capture idea
          </Button>
          <Button size="sm" onClick={() => uiActions.openDialog({ type: "new-content" })}>
            <Plus aria-hidden />
            Create content
          </Button>
          <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
            <Send aria-hidden />
            Log published post
          </Button>
          <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
            <ChartColumn aria-hidden />
            Add analytics
          </Button>
        </div>
      }
    />
  )
}
