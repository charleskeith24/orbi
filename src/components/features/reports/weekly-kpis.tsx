"use client"

import { Clock, Eye, Heart, Magnet, Send, Trophy, UserPlus, Users, type LucideIcon } from "lucide-react"
import { StatTile, type StatusTone } from "@/components/common"
import { CONSISTENT_WEEK_SHARE, type WeeklyReport } from "@/lib/analytics"
import { formatNumber, formatPercent } from "@/lib/utils"
import { countLabel } from "./report-format"
import type { ReportPeriod } from "./report-periods"

function consistencyStatus(report: WeeklyReport, inProgress: boolean): { tone: StatusTone; icon?: LucideIcon; label: string } {
  const { published, target } = report
  if (!target) return { tone: "neutral", icon: Clock, label: "No weekly target set" }
  if (published >= target) return { tone: "good", label: "Target hit" }
  if (inProgress) return { tone: "neutral", icon: Clock, label: `In progress · ${target - published} to go` }
  if (published >= target * CONSISTENT_WEEK_SHARE) return { tone: "warning", label: "Close to target" }
  return { tone: "serious", label: `${countLabel(target - published, "post")} short` }
}

/** Content published, consistency, views, reach, engagement, followers, leads and winners for the week. */
export function WeeklyKpis({ report, period }: { report: WeeklyReport; period: ReportPeriod }) {
  const t = report.totals
  const d = report.deltas
  const vs = "vs last week"
  const status = consistencyStatus(report, period.isCurrent)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
      <StatTile
        label="Content published"
        icon={Send}
        value={
          <>
            {formatNumber(report.published)}
            <span className="text-base font-normal text-muted-foreground"> / {formatNumber(report.target)}</span>
          </>
        }
        delta={d.posts}
        deltaLabel={vs}
      />
      <StatTile
        label="Posting consistency"
        value={`${formatNumber(report.consistencyPct)}%`}
        tone={status.tone}
        icon={status.icon}
        sublabel={status.label}
      />
      <StatTile label="Total views" icon={Eye} value={formatNumber(t.views)} delta={d.views} deltaLabel={vs} />
      <StatTile label="Total reach" icon={Users} value={formatNumber(t.reach)} delta={d.reach} deltaLabel={vs} />
      <StatTile
        label="Total engagement"
        icon={Heart}
        value={formatNumber(t.engagements)}
        delta={d.engagements}
        deltaLabel={vs}
        sublabel={t.engagementRate === null ? undefined : `${formatPercent(t.engagementRate)} rate`}
      />
      <StatTile label="New followers" icon={UserPlus} value={formatNumber(t.followers)} delta={d.followers} deltaLabel={vs} />
      <StatTile
        label="Leads"
        icon={Magnet}
        value={formatNumber(t.leads)}
        delta={d.leads}
        deltaLabel={vs}
        sublabel={t.sales ? countLabel(t.sales, "sale") : undefined}
      />
      <StatTile
        label="Winners"
        icon={Trophy}
        value={formatNumber(report.winners)}
        sublabel="Winner or Breakout posts"
        href="/winners"
      />
    </div>
  )
}
