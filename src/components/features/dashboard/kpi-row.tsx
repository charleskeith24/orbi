"use client"

import { CalendarCheck, CalendarClock, Layers, TrendingUp } from "lucide-react"
import { Sparkline } from "@/components/charts"
import { Delta, Meter, type StatusTone } from "@/components/common"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import type { BufferStatus, ContentBuffer } from "@/lib/analytics"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import type { DashboardData } from "./dashboard-data"
import { KpiTile, ToneText } from "./kpi-tile"

const BUFFER_TONE: Record<BufferStatus, StatusTone> = { healthy: "good", ok: "warning", low: "critical" }

function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1)
}

function PostingTile({ data }: { data: DashboardData }) {
  const { weekly, history } = data
  const counts = history.map((week) => week.published)
  const short = Math.max(0, weekly.target - weekly.published - weekly.scheduledRemaining)
  return (
    <KpiTile
      label="Posting progress"
      icon={CalendarCheck}
      href="/calendar/planner"
      value={
        <>
          {weekly.published}
          <span className="text-base font-medium text-muted-foreground"> / {weekly.target}</span>
        </>
      }
      unit={<ToneText tone={weekly.onTrack ? "good" : "warning"}>{weekly.onTrack ? "On track" : `${short} short`}</ToneText>}
      aside={
        <Sparkline
          values={counts}
          highlightLast
          className="h-6 w-16"
          aria-label={`Posts published per week, last ${counts.length} weeks: ${counts.join(", ")}`}
        />
      }
      footer={<span className="truncate">{pluralize(weekly.scheduledRemaining, "post")} scheduled for the rest of the week</span>}
    >
      <Meter
        value={weekly.published}
        max={Math.max(1, weekly.target)}
        tone={weekly.onTrack ? "good" : "warning"}
        size="sm"
        aria-label="Posts published this week"
        valueText={`${weekly.published} of ${weekly.target} posts published`}
      />
    </KpiTile>
  )
}

function DueTile({ data }: { data: DashboardData }) {
  const { dueToday, overdue, scheduledToday } = data.today
  return (
    <KpiTile
      label="Content due"
      icon={CalendarClock}
      href="/today"
      iconTone={overdue.length ? "critical" : undefined}
      value={dueToday.length}
      unit="due today"
      footer={
        <>
          {overdue.length ? (
            <ToneText tone="critical">{overdue.length} overdue</ToneText>
          ) : (
            <ToneText tone="good">Nothing overdue</ToneText>
          )}
          <span aria-hidden>·</span>
          <span className="truncate">{scheduledToday.length} scheduled today</span>
        </>
      }
    />
  )
}

function BufferBreakdown({ buffer }: { buffer: ContentBuffer }) {
  const rows: [string, number][] = [
    ["Ready to publish (counted)", buffer.breakdown.readyToPublish],
    ["Edited or in review", buffer.breakdown.edited],
    ["Ready to record", buffer.breakdown.readyToRecord],
    ["Scripts ready", buffer.breakdown.readyScripts],
    ["Validated ideas", buffer.breakdown.readyIdeas],
  ]
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-sm font-medium">Content Buffer breakdown</p>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
          {pluralize(buffer.readyCount, "post")} ready to go out ÷ {buffer.dailyRate.toFixed(1)} a day ={" "}
          {formatDays(buffer.days)} days · target {buffer.targetDays}
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
          unit={buffer.days === 1 ? "day" : "days"}
          footer={
            <>
              <ToneText tone={tone}>{buffer.label}</ToneText>
              <span aria-hidden>·</span>
              <span className="truncate">{buffer.readyCount} ready to publish</span>
            </>
          }
        >
          <Meter
            value={buffer.days}
            max={Math.max(1, buffer.targetDays)}
            tone={tone}
            size="sm"
            aria-label="Content Buffer vs target"
            valueText={`${formatDays(buffer.days)} of ${buffer.targetDays} target days`}
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
  const { current, previous, deltas, trend } = data.growth
  const gained = current.followers
  return (
    <KpiTile
      label="Growth · last 7 days"
      icon={TrendingUp}
      href="/analytics"
      value={`${gained > 0 ? "+" : ""}${formatNumber(gained)}`}
      unit="followers"
      aside={
        <Sparkline
          values={trend.map((point) => point.value)}
          highlightLast
          className="h-6 w-16"
          aria-label="Followers gained per day, last 28 days"
        />
      }
      footer={
        previous.followers > 0 ? (
          <>
            <Delta value={deltas.followers} />
            <span className="truncate">vs previous 7 days</span>
          </>
        ) : (
          <span className="truncate">No followers logged the 7 days before</span>
        )
      }
    />
  )
}

/** Posting progress · Content due · Content Buffer · Growth. */
export function KpiRow({ data, className }: { data: DashboardData; className?: string }) {
  return (
    <section aria-label="Key numbers" className={cn("grid grid-cols-2 gap-3 @4xl:grid-cols-4 @4xl:gap-4", className)}>
      <PostingTile data={data} />
      <DueTile data={data} />
      <BufferTile data={data} />
      <GrowthTile data={data} />
    </section>
  )
}
