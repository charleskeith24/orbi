"use client"

import { CalendarCheck, CircleDashed, Clock, type LucideIcon } from "lucide-react"
import { Meter, SectionCard, StatusPill, type MeterTone, type StatusTone } from "@/components/common"
import type { MonthlyReport, PostingWeek } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { countLabel } from "./report-format"
import { formatShortRange } from "./report-periods"

type WeekState = "hit" | "close" | "missed" | "current" | "upcoming"

const STATE_COPY: Record<WeekState, { label: string; tone: StatusTone; icon?: LucideIcon; meter: MeterTone }> = {
  hit: { label: "Hit", tone: "good", meter: "good" },
  close: { label: "Close", tone: "warning", meter: "warning" },
  missed: { label: "Missed", tone: "serious", meter: "serious" },
  current: { label: "In progress", tone: "neutral", icon: Clock, meter: "brand" },
  upcoming: { label: "Upcoming", tone: "neutral", icon: CircleDashed, meter: "neutral" },
}

function weekState(week: PostingWeek, today: string): WeekState {
  if (week.weekStart > today) return "upcoming"
  if (week.hit) return "hit"
  if (week.isCurrent) return "current"
  return week.consistent ? "close" : "missed"
}

/** Every week overlapping the month: posts vs the weekly target. */
export function ConsistencyCard({ report, now, className }: { report: MonthlyReport; now: Date; className?: string }) {
  const { weeks, weeksHit, weeksConsistent, weeksTotal } = report.consistency
  const today = toISODate(now)
  const target = weeks[0]?.target ?? 0
  return (
    <SectionCard
      title="Content Consistency"
      description={`${weeksHit} of ${weeksTotal} weeks on target · ${countLabel(target, "post")} a week`}
      icon={CalendarCheck}
      className={cn("print:break-inside-avoid", className)}
      footer={`${countLabel(weeksConsistent, "consistent week")} (at least 80% of target). Weeks overlapping the month count in full.`}
    >
      <ul className="flex flex-col divide-y">
        {weeks.map((week) => {
          const copy = STATE_COPY[weekState(week, today)]
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
                aria-label={`${range}: ${week.published} of ${week.target} posts`}
              />
              <StatusPill tone={copy.tone} icon={copy.icon} className="justify-self-end">
                {copy.label}
              </StatusPill>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
