"use client"

import { format } from "date-fns"
import { PageHeader } from "@/components/common"
import { useT } from "@/lib/i18n"
import { todayMessages } from "./messages"
import type { TodayData } from "./use-today"

/**
 * "Today · Sunday, Sep 13", the week in numbers (posts out vs target, overdue) and the page's ⓘ (Calm UI).
 * Capture, new content, log a post and add analytics live in the top bar's ＋ New (the ＋ tab on phones).
 */
export function TodayHeader({ data }: { data: TodayData }) {
  const t = useT(todayMessages)
  const { now, week, today } = data
  const overdue = today.overdue.length
  return (
    <PageHeader
      title={`Today · ${format(now, "EEEE, MMM d")}`}
      info={t("info")}
      infoTitle="Today"
      description={
        <span className="num">
          {t("summary_week", { published: week.published, target: week.target })}
          {overdue ? (
            <>
              {" · "}
              <a href="#overdue" className="rounded-sm text-critical-fg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                {t("summary_overdue", { count: overdue })}
              </a>
            </>
          ) : null}
        </span>
      }
    />
  )
}
