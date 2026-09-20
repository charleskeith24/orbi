"use client"

import { CalendarCheck, Eye, Heart, Magnet, Send, Trophy, UserPlus, Users } from "lucide-react"
import { StatTile, type StatusTone } from "@/components/common"
import type { MonthlyReport } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import { useT, type Translator } from "@/lib/i18n"
import { formatNumber, formatPercent } from "@/lib/utils"
import { reportMessages } from "./messages"
import { monthlyReviewMessages } from "./monthly-messages"

/** Tone from the weeks that are already over (a month in progress isn't judged on weeks still to come). */
function consistencyStatus(
  report: MonthlyReport,
  now: Date,
  m: Translator<(typeof monthlyReviewMessages)["en"]>
): { tone: StatusTone; label: string } {
  const today = toISODate(now)
  const completed = report.consistency.weeks.filter((w) => w.weekEnd < today)
  if (!completed.length) return { tone: "neutral", label: m("no_completed_weeks") }
  const share = completed.filter((w) => w.hit).length / completed.length
  if (share >= 0.75) return { tone: "good", label: m("on_target_most") }
  if (share >= 0.5) return { tone: "warning", label: m("missed_some") }
  return { tone: "serious", label: m("missed_most") }
}

/** Audience growth, reach, content, views, engagement rate, leads, consistency and winners for the month. */
export function MonthlyKpis({ report, now }: { report: MonthlyReport; now: Date }) {
  const m = useT(monthlyReviewMessages)
  const r = useT(reportMessages)
  const t = report.totals
  const d = report.deltas
  const c = report.consistency
  const status = consistencyStatus(report, now, m)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
      <StatTile label={m("audience_growth")} icon={UserPlus} value={formatNumber(report.audienceGrowth.total)} delta={d.followers} />
      <StatTile label={m("total_reach")} icon={Users} value={formatNumber(report.totalReach)} delta={d.reach} />
      <StatTile label={m("total_content")} icon={Send} value={formatNumber(report.totalContent)} delta={d.posts} />
      <StatTile label={m("total_views")} icon={Eye} value={formatNumber(t.views)} delta={d.views} />
      <StatTile
        label={m("engagement_rate")}
        icon={Heart}
        value={formatPercent(t.engagementRate)}
        delta={d.engagementRate}
        sublabel={m("engagements", { count: formatNumber(t.engagements) })}
      />
      <StatTile
        label={m("leads")}
        icon={Magnet}
        value={formatNumber(t.leads)}
        delta={d.leads}
        sublabel={t.sales ? r.plural("sales", t.sales, { count: formatNumber(t.sales) }) : undefined}
      />
      <StatTile
        label={m("content_consistency")}
        value={
          <>
            {formatNumber(c.weeksHit)}
            <span className="text-base font-normal text-muted-foreground"> / {m.plural("weeks", c.weeksTotal, { count: formatNumber(c.weeksTotal) })}</span>
          </>
        }
        tone={status.tone}
        icon={status.tone === "neutral" ? CalendarCheck : undefined}
        sublabel={status.label}
      />
      <StatTile label={m("winners")} icon={Trophy} value={formatNumber(report.winners)} info={m("winners_info")} href="/winners" />
    </div>
  )
}
