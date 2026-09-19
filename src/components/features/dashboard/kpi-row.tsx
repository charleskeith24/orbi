"use client"

import { Meter, type StatusTone } from "@/components/common"
import type { BufferStatus } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import type { DashboardData } from "./dashboard-data"
import { KpiTile, ToneText } from "./kpi-tile"
import { dashboardMessages } from "./messages"

const BUFFER_TONE: Record<BufferStatus, StatusTone> = { healthy: "good", ok: "warning", low: "critical" }

function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1)
}

/** Posts this week vs the target: on track, or how many short (scheduled posts count toward it). */
function PostingTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { weekly } = data
  const short = Math.max(0, weekly.target - weekly.published - weekly.scheduledRemaining)
  return (
    <KpiTile
      label={t("posting_progress")}
      href="/calendar/planner"
      value={
        <>
          {weekly.published}
          <span className="text-sm font-medium text-muted-foreground">{`/${weekly.target}`}</span>
        </>
      }
      status={
        <>
          <ToneText tone={weekly.onTrack ? "good" : "warning"}>{weekly.onTrack ? t("on_track") : t("short", { count: short })}</ToneText>
          {weekly.scheduledRemaining ? (
            <span className="truncate @max-xl:hidden">{t("scheduled_more", { count: formatNumber(weekly.scheduledRemaining) })}</span>
          ) : null}
        </>
      }
    >
      <Meter
        value={weekly.published}
        max={Math.max(1, weekly.target)}
        tone={weekly.onTrack ? "good" : "warning"}
        size="sm"
        aria-label={t("published_week_aria")}
        valueText={t("published_week_value", { published: weekly.published, target: weekly.target })}
      />
    </KpiTile>
  )
}

/** Due today, with overdue as the one status. */
function DueTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { dueToday, overdue } = data.today
  return (
    <KpiTile
      label={t("group_due_today")}
      href="/today"
      value={formatNumber(dueToday.length)}
      status={
        overdue.length ? (
          <ToneText tone="critical">{t("overdue_count", { count: overdue.length })}</ToneText>
        ) : (
          <ToneText tone="good">{t("nothing_overdue")}</ToneText>
        )
      }
    />
  )
}

/** Days of ready content at the current pace; the breakdown lives on the Pipeline. */
function BufferTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { buffer } = data
  const tone = BUFFER_TONE[buffer.status]
  return (
    <KpiTile
      label="Content Buffer"
      href="/pipeline"
      value={formatDays(buffer.days)}
      unit={t.plural("unit_day", buffer.days)}
      status={<ToneText tone={tone}>{buffer.label}</ToneText>}
    >
      <Meter
        value={buffer.days}
        max={Math.max(1, buffer.targetDays)}
        tone={tone}
        size="sm"
        aria-label={t("buffer_aria")}
        valueText={t("buffer_value", { days: formatDays(buffer.days), target: buffer.targetDays })}
      />
    </KpiTile>
  )
}

/** Posting progress · Due today · Content Buffer. */
export function KpiRow({ data, className }: { data: DashboardData; className?: string }) {
  const t = useT(dashboardMessages)
  return (
    <section aria-label={t("key_numbers")} className={cn("grid min-w-0 grid-cols-3 gap-2 @xl:gap-3", className)}>
      <PostingTile data={data} />
      <DueTile data={data} />
      <BufferTile data={data} />
    </section>
  )
}
