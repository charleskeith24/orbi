"use client"

import { CalendarCheck, CalendarClock, Layers, TrendingUp } from "lucide-react"
import { Sparkline } from "@/components/charts"
import { Delta, Meter, type StatusTone } from "@/components/common"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import type { BufferStatus, ContentBuffer } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import type { DashboardData } from "./dashboard-data"
import { KpiTile, ToneText } from "./kpi-tile"
import { dashboardMessages } from "./messages"

const BUFFER_TONE: Record<BufferStatus, StatusTone> = { healthy: "good", ok: "warning", low: "critical" }

function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1)
}

function PostingTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { weekly, history } = data
  const counts = history.map((week) => week.published)
  const short = Math.max(0, weekly.target - weekly.published - weekly.scheduledRemaining)
  return (
    <KpiTile
      label={t("posting_progress")}
      icon={CalendarCheck}
      href="/calendar/planner"
      value={
        <>
          {weekly.published}
          <span className="text-base font-medium text-muted-foreground"> / {weekly.target}</span>
        </>
      }
      unit={<ToneText tone={weekly.onTrack ? "good" : "warning"}>{weekly.onTrack ? t("on_track") : t("short", { count: short })}</ToneText>}
      aside={
        <Sparkline
          values={counts}
          highlightLast
          className="h-6 w-16"
          aria-label={t("posts_per_week_aria", { count: counts.length, values: counts.join(", ") })}
        />
      }
      footer={
        <span className="truncate">
          {t.plural("scheduled_rest", weekly.scheduledRemaining, { count: formatNumber(weekly.scheduledRemaining) })}
        </span>
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

function DueTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { dueToday, overdue, scheduledToday } = data.today
  return (
    <KpiTile
      label={t("content_due")}
      icon={CalendarClock}
      href="/today"
      iconTone={overdue.length ? "critical" : undefined}
      value={dueToday.length}
      unit={t("due_today_unit")}
      footer={
        <>
          {overdue.length ? (
            <ToneText tone="critical">{t("overdue_count", { count: overdue.length })}</ToneText>
          ) : (
            <ToneText tone="good">{t("nothing_overdue")}</ToneText>
          )}
          <span aria-hidden>·</span>
          <span className="truncate">{t("scheduled_today_count", { count: scheduledToday.length })}</span>
        </>
      }
    />
  )
}

function BufferBreakdown({ buffer }: { buffer: ContentBuffer }) {
  const t = useT(dashboardMessages)
  const rows: [string, number][] = [
    [t("buffer_ready_counted"), buffer.breakdown.readyToPublish],
    [t("buffer_edited"), buffer.breakdown.edited],
    [t("buffer_ready_record"), buffer.breakdown.readyToRecord],
    [t("buffer_scripts"), buffer.breakdown.readyScripts],
    [t("buffer_ideas"), buffer.breakdown.readyIdeas],
  ]
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-sm font-medium">{t("buffer_breakdown")}</p>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
          {t.plural("buffer_formula", buffer.readyCount, {
            count: formatNumber(buffer.readyCount),
            rate: buffer.dailyRate.toFixed(1),
            days: formatDays(buffer.days),
            target: buffer.targetDays,
          })}
        </p>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, value], i) => (
          <div key={label} className="contents">
            <dt className={cn("text-muted-foreground", i === 0 && "font-medium text-foreground")}>{label}</dt>
            <dd className={cn("text-right num", i === 0 && "font-medium")}>{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function BufferTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { buffer } = data
  const tone = BUFFER_TONE[buffer.status]
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <KpiTile
          label="Content Buffer"
          icon={Layers}
          href="/pipeline"
          iconTone={buffer.status === "healthy" ? undefined : tone}
          value={formatDays(buffer.days)}
          unit={t.plural("unit_day", buffer.days)}
          footer={
            <>
              <ToneText tone={tone}>{buffer.label}</ToneText>
              <span aria-hidden>·</span>
              <span className="truncate">{t("ready_to_publish_count", { count: buffer.readyCount })}</span>
            </>
          }
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
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <BufferBreakdown buffer={buffer} />
      </HoverCardContent>
    </HoverCard>
  )
}

function GrowthTile({ data }: { data: DashboardData }) {
  const t = useT(dashboardMessages)
  const { current, previous, deltas, trend } = data.growth
  const gained = current.followers
  return (
    <KpiTile
      label={t("growth_title")}
      icon={TrendingUp}
      href="/analytics"
      value={`${gained > 0 ? "+" : ""}${formatNumber(gained)}`}
      unit={t("followers_unit")}
      aside={
        <Sparkline
          values={trend.map((point) => point.value)}
          highlightLast
          className="h-6 w-16"
          aria-label={t("followers_trend_aria")}
        />
      }
      footer={
        previous.followers > 0 ? (
          <>
            <Delta value={deltas.followers} />
            <span className="truncate">{t("vs_previous_7")}</span>
          </>
        ) : (
          <span className="truncate">{t("no_followers_before")}</span>
        )
      }
    />
  )
}

/** Posting progress · Content due · Content Buffer · Growth. */
export function KpiRow({ data, className }: { data: DashboardData; className?: string }) {
  const t = useT(dashboardMessages)
  return (
    <section aria-label={t("key_numbers")} className={cn("grid grid-cols-2 gap-3 @4xl:grid-cols-4 @4xl:gap-4", className)}>
      <PostingTile data={data} />
      <DueTile data={data} />
      <BufferTile data={data} />
      <GrowthTile data={data} />
    </section>
  )
}
