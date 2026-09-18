"use client"

import { CalendarCheck, CircleDashed, Clock, type LucideIcon } from "lucide-react"
import { Meter, SectionCard, StatusPill, type MeterTone, type StatusTone } from "@/components/common"
import type { MonthlyReport, PostingWeek } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import { monthlyReviewMessages } from "./monthly-messages"
import { formatShortRange } from "./report-periods"

type WeekState = "hit" | "close" | "missed" | "current" | "upcoming"

/** Labels: `state_<state>` in `monthly-messages.ts`. */
const STATE_COPY: Record<WeekState, { tone: StatusTone; icon?: LucideIcon; meter: MeterTone }> = {
  hit: { tone: "good", meter: "good" },
  close: { tone: "warning", meter: "warning" },
  missed: { tone: "serious", meter: "serious" },
  current: { tone: "neutral", icon: Clock, meter: "brand" },
  upcoming: { tone: "neutral", icon: CircleDashed, meter: "neutral" },
}

function weekState(week: PostingWeek, today: string): WeekState {
  if (week.weekStart > today) return "upcoming"
  if (week.hit) return "hit"
  if (week.isCurrent) return "current"
  return week.consistent ? "close" : "missed"
}

/** Every week overlapping the month: posts vs the weekly target. */
export function ConsistencyCard({ report, now, className }: { report: MonthlyReport; now: Date; className?: string }) {
  const t = useT(monthlyReviewMessages)
  const { weeks, weeksHit, weeksConsistent, weeksTotal } = report.consistency
  const today = toISODate(now)
  const target = weeks[0]?.target ?? 0
  return (
    <SectionCard
      title={t("consistency_title")}
      description={t.plural("consistency_description", target, { hit: weeksHit, total: weeksTotal, count: formatNumber(target) })}
      icon={CalendarCheck}
      className={cn("print:break-inside-avoid", className)}
      footer={t.plural("consistency_footer", weeksConsistent, { count: formatNumber(weeksConsistent) })}
    >
      <ul className="flex flex-col divide-y">
        {weeks.map((week) => {
          const state = weekState(week, today)
          const copy = STATE_COPY[state]
          const range = formatShortRange(week.weekStart, week.weekEnd)
          return (
            <li key={week.weekStart} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2 first:pt-0 last:pb-0">
              <span className="truncate text-sm num">{range}</span>
              <Meter
                value={week.published}
                max={Math.max(week.target, week.published, 1)}
                target={week.target > 0 && week.published > week.target ? week.target : undefined}
                tone={copy.meter}
                size="sm"
                showValue
                valueText={`${week.published}/${week.target}`}
                aria-label={t("week_aria", { range, published: week.published, target: week.target })}
              />
              <StatusPill tone={copy.tone} icon={copy.icon} className="justify-self-end">
                {t(`state_${state}`)}
              </StatusPill>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
