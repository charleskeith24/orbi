"use client"

import { Clock, Eye, Heart, Magnet, Send, Trophy, UserPlus, Users, type LucideIcon } from "lucide-react"
import { StatTile, type StatusTone } from "@/components/common"
import { CONSISTENT_WEEK_SHARE, type WeeklyReport } from "@/lib/analytics"
import { useT, type Translator } from "@/lib/i18n"
import { formatNumber, formatPercent } from "@/lib/utils"
import { reportMessages } from "./messages"
import type { ReportPeriod } from "./report-periods"
import { weeklyReportMessages } from "./weekly-messages"

type WeeklyT = Translator<(typeof weeklyReportMessages)["en"]>

function consistencyStatus(report: WeeklyReport, inProgress: boolean, t: WeeklyT): { tone: StatusTone; icon?: LucideIcon; label: string } {
  const { published, target } = report
  if (!target) return { tone: "neutral", icon: Clock, label: t("no_target") }
  if (published >= target) return { tone: "good", label: t("target_hit") }
  if (inProgress) return { tone: "neutral", icon: Clock, label: t("to_go", { count: target - published }) }
  if (published >= target * CONSISTENT_WEEK_SHARE) return { tone: "warning", label: t("close_to_target") }
  return { tone: "serious", label: t.plural("short", target - published, { count: formatNumber(target - published) }) }
}

/** Content published, consistency, views, reach, engagement, followers, leads and winners for the week. */
export function WeeklyKpis({ report, period }: { report: WeeklyReport; period: ReportPeriod }) {
  const w = useT(weeklyReportMessages)
  const r = useT(reportMessages)
  const t = report.totals
  const d = report.deltas
  const vs = w("vs_last_week")
  const status = consistencyStatus(report, period.isCurrent, w)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
      <StatTile
        label={w("content_published")}
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
        label={w("posting_consistency")}
        value={`${formatNumber(report.consistencyPct)}%`}
        tone={status.tone}
        icon={status.icon}
        sublabel={status.label}
      />
      <StatTile label={w("total_views")} icon={Eye} value={formatNumber(t.views)} delta={d.views} deltaLabel={vs} />
      <StatTile label={w("total_reach")} icon={Users} value={formatNumber(t.reach)} delta={d.reach} deltaLabel={vs} />
      <StatTile
        label={w("total_engagement")}
        icon={Heart}
        value={formatNumber(t.engagements)}
        delta={d.engagements}
        deltaLabel={vs}
        sublabel={t.engagementRate === null ? undefined : w("rate", { rate: formatPercent(t.engagementRate) })}
      />
      <StatTile label={w("new_followers")} icon={UserPlus} value={formatNumber(t.followers)} delta={d.followers} deltaLabel={vs} />
      <StatTile
        label={w("leads")}
        icon={Magnet}
        value={formatNumber(t.leads)}
        delta={d.leads}
        deltaLabel={vs}
        sublabel={t.sales ? r.plural("sales", t.sales, { count: formatNumber(t.sales) }) : undefined}
      />
      <StatTile
        label={w("winners")}
        icon={Trophy}
        value={formatNumber(report.winners)}
        sublabel={w("winners_sublabel")}
        href="/winners"
      />
    </div>
  )
}
