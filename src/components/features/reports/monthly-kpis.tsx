"use client"

import { CalendarCheck, Eye, Heart, Magnet, Send, Trophy, UserPlus, Users } from "lucide-react"
import { StatTile, type StatusTone } from "@/components/common"
import type { MonthlyReport } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import { formatNumber, formatPercent } from "@/lib/utils"
import { countLabel } from "./report-format"

/** Tone from the weeks that are already over (a month in progress isn't judged on weeks still to come). */
function consistencyStatus(report: MonthlyReport, now: Date): { tone: StatusTone; label: string } {
  const today = toISODate(now)
  const completed = report.consistency.weeks.filter((w) => w.weekEnd < today)
  if (!completed.length) return { tone: "neutral", label: "No completed weeks yet" }
  const share = completed.filter((w) => w.hit).length / completed.length
  if (share >= 0.75) return { tone: "good", label: "On target most weeks" }
  if (share >= 0.5) return { tone: "warning", label: "Missed some weeks" }
  return { tone: "serious", label: "Missed most weeks" }
}

/** Audience growth, reach, content, views, engagement rate, leads, consistency and winners for the month. */
export function MonthlyKpis({ report, now }: { report: MonthlyReport; now: Date }) {
  const t = report.totals
  const d = report.deltas
  const c = report.consistency
  const vs = "vs last month"
  const status = consistencyStatus(report, now)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
      <StatTile label="Audience growth" icon={UserPlus} value={formatNumber(report.audienceGrowth.total)} delta={d.followers} deltaLabel={vs} />
      <StatTile label="Total reach" icon={Users} value={formatNumber(report.totalReach)} delta={d.reach} deltaLabel={vs} />
      <StatTile label="Total content" icon={Send} value={formatNumber(report.totalContent)} delta={d.posts} deltaLabel={vs} />
      <StatTile label="Total views" icon={Eye} value={formatNumber(t.views)} delta={d.views} deltaLabel={vs} />
      <StatTile
        label="Engagement rate"
        icon={Heart}
        value={formatPercent(t.engagementRate)}
        delta={d.engagementRate}
        deltaLabel={vs}
        sublabel={`${formatNumber(t.engagements)} engagements`}
      />
      <StatTile
        label="Leads"
        icon={Magnet}
        value={formatNumber(t.leads)}
        delta={d.leads}
        deltaLabel={vs}
        sublabel={t.sales ? countLabel(t.sales, "sale") : undefined}
      />
      <StatTile
        label="Content consistency"
        value={
          <>
            {formatNumber(c.weeksHit)}
            <span className="text-base font-normal text-muted-foreground"> / {countLabel(c.weeksTotal, "week")}</span>
          </>
        }
        tone={status.tone}
        icon={status.tone === "neutral" ? CalendarCheck : undefined}
        sublabel={status.label}
      />
      <StatTile label="Winners" icon={Trophy} value={formatNumber(report.winners)} sublabel="Winner or Breakout posts" href="/winners" />
    </div>
  )
}
