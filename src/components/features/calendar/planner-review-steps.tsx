"use client"

import { CalendarX2, CircleAlert, Lightbulb, Sparkles, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState, FormField, PlatformIcon, StatTile, TierBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatMultiple, type InsightType, type ReportHighlight, type StrategicInsight, type TieredRow, type WeeklyReport } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import { uiActions } from "@/lib/store"
import { cn, formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { weekLabel } from "./calendar-model"

/** The weekly_plan task accepts a focus of up to 300 characters. */
export const FOCUS_MAX = 300

export interface Leaders {
  topic: ReportHighlight | null
  hook: ReportHighlight | null
  format: ReportHighlight | null
  platform: ReportHighlight | null
  pillar: ReportHighlight | null
}

const LEADER_ROWS: { key: keyof Leaders; label: string }[] = [
  { key: "topic", label: "Topic" },
  { key: "hook", label: "Hook style" },
  { key: "format", label: "Format" },
  { key: "platform", label: "Platform" },
  { key: "pillar", label: "Pillar" },
]

function formatHighlight(h: ReportHighlight): string {
  switch (h.metricLabel) {
    case "engagement rate":
      return `${formatPercent(h.value)} engagement`
    case "× platform baseline":
      return `${formatMultiple(h.value)} baseline`
    case "leads per post":
      return `${h.value.toFixed(1)} leads per post`
    default:
      return `${formatCompact(h.value)} ${h.metricLabel}`
  }
}

/* --------------------------- Step 1 · Review week --------------------------- */

function PostHighlight({ label, row }: { label: string; row: TieredRow | null }) {
  if (!row) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <span className="font-medium">{label}:</span> needs at least two posts with analytics.
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Link href={`/studio/${row.id}`} className="line-clamp-2 text-sm font-medium underline-offset-4 hover:underline">
        {row.item.title.trim() || "Untitled content"}
      </Link>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <PlatformIcon platform={row.platform} className="size-3.5" />
          {PLATFORMS[row.platform]?.label}
        </span>
        <span className="num">{formatCompact(row.views)} views</span>
        {row.ratio !== null ? <span className="num">{formatMultiple(row.ratio)} baseline</span> : null}
        <TierBadge tier={row.tier} showNormal />
      </span>
    </div>
  )
}

/** Step 1: last week's numbers vs the week before, best and weakest post. */
export function ReviewStep({ report, previousFocus, now }: { report: WeeklyReport; previousFocus: string; now: Date }) {
  const start = parseDate(report.range.start)
  const period = start ? weekLabel(start) : ""
  const inProgress = toISODate(now) <= report.range.end
  const t = report.totals
  const d = report.deltas

  if (!report.published) {
    return (
      <EmptyState
        compact
        icon={CalendarX2}
        title="Nothing went out that week"
        description={`No posts were published ${period}. This week's plan is the way back — pick a focus and fill your posting slots.`}
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-muted-foreground">
        {period} · {inProgress ? "still in progress — changes compare the same days of the week before" : "compared with the week before"}
      </p>
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
        <StatTile
          label="Published"
          value={`${report.published} / ${report.target}`}
          sublabel={`${report.consistencyPct}% of target`}
          tone={report.published >= report.target ? "good" : report.consistencyPct >= 80 ? "warning" : "serious"}
        />
        <StatTile label="Views" value={formatCompact(t.views)} delta={d.views} />
        <StatTile label="Engagement rate" value={formatPercent(t.engagementRate)} delta={d.engagementRate} />
        <StatTile label="New followers" value={formatNumber(t.followers)} delta={d.followers} />
        <StatTile label="Leads" value={formatNumber(t.leads)} delta={d.leads} />
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <PostHighlight label="Best post" row={report.bestPost} />
        <PostHighlight label="Weakest post" row={report.worstPost} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 text-pretty">{previousFocus ? `That week's focus: “${previousFocus}”` : "No focus was saved for that week."}</span>
        <Button asChild size="xs" variant="ghost">
          <Link href="/reports">Open the Weekly Report</Link>
        </Button>
      </div>
    </div>
  )
}

/* --------------------------- Step 2 · Top performers ------------------------ */

function Leader({ h }: { h: ReportHighlight | null }) {
  if (!h) return <span className="text-xs text-muted-foreground">Not enough data</span>
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{h.label}</p>
      <p className="truncate text-xs text-muted-foreground num">
        {formatHighlight(h)} · {pluralize(h.posts, "post")}
      </p>
    </div>
  )
}

/** Step 2: the best topic, hook style, format, platform and pillar — last week and the last 30 days. */
export function WinnersStep({ lastWeek, recent, top }: { lastWeek: Leaders; recent: Leaders; top: TieredRow[] }) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground dark:bg-muted/20">
            <tr>
              <th scope="col" className="w-32 px-3 py-2 font-medium">
                What worked
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Last week
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Last 30 days
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {LEADER_ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                <td className="max-w-0 px-3 py-2">
                  <Leader h={lastWeek[row.key]} />
                </td>
                <td className="max-w-0 px-3 py-2">
                  <Leader h={recent[row.key]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid min-w-0 gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Top posts · last 30 days</h3>
        {top.length ? (
          <ol className="grid min-w-0 gap-1.5">
            {top.map((row, index) => (
              <li key={row.id} className="flex min-w-0 items-center gap-2.5 rounded-md border px-3 py-2 text-sm">
                <span className="w-4 shrink-0 text-xs text-muted-foreground num">{index + 1}</span>
                <PlatformIcon platform={row.platform} label className="size-4 shrink-0 text-muted-foreground" />
                <Link href={`/studio/${row.id}`} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                  {row.item.title.trim() || "Untitled content"}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground num">{formatCompact(row.views)} views</span>
                <TierBadge tier={row.tier} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">No posts with analytics in the last 30 days yet.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => uiActions.askStrategist("What should I double down on this week, based on my recent winners?")}>
          <Sparkles className="text-brand" aria-hidden />
          Ask the strategist what to double down on
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/winners">Winning Content Library</Link>
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------- Step 3 · Focus -------------------------------- */

const INSIGHT_ICONS: Record<InsightType, LucideIcon> = {
  double_down: TrendingUp,
  fix: CircleAlert,
  opportunity: Lightbulb,
  warning: TriangleAlert,
}

const INSIGHT_LABELS: Record<InsightType, string> = {
  double_down: "Double down",
  fix: "Fix",
  opportunity: "Opportunity",
  warning: "Warning",
}

/** Step 3: one sentence the week serves, with quick picks from the strategic insights. */
export function FocusStep({
  focus,
  onChange,
  insights,
  previousFocus,
}: {
  focus: string
  onChange: (focus: string) => void
  insights: StrategicInsight[]
  previousFocus: string
}) {
  const length = focus.trim().length
  const error = length > FOCUS_MAX ? `Keep it under ${FOCUS_MAX} characters — one sentence the week serves.` : null
  return (
    <div className="grid min-w-0 gap-4">
      <FormField
        label="This week's strategic focus"
        htmlFor="planner-focus"
        description={`It steers the AI draft and is saved with the plan · ${length}/${FOCUS_MAX}`}
        error={error}
      >
        <Textarea
          id="planner-focus"
          value={focus}
          rows={3}
          aria-invalid={Boolean(error)}
          placeholder="e.g. Bring Leadership back to its 15% share with two story-led posts, and repurpose last week's winner."
          onChange={(event) => onChange(event.target.value)}
        />
      </FormField>
      {previousFocus && previousFocus !== focus.trim() ? (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="min-w-0 text-pretty">Last week&apos;s focus: “{previousFocus}”</span>
          <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={() => onChange(previousFocus)}>
            Reuse it
          </Button>
        </p>
      ) : null}
      <div className="grid min-w-0 gap-2">
        <p className="text-xs font-medium text-muted-foreground">Quick picks from your data</p>
        {insights.length ? (
          <ul className="grid min-w-0 gap-1.5">
            {insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.type]
              const selected = focus.trim() === insight.text
              return (
                <li key={insight.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(insight.text)}
                    className={cn(
                      "flex w-full min-w-0 items-start gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50",
                      selected && "border-brand/50 bg-brand-soft hover:bg-brand-soft"
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 text-pretty">{insight.text}</span>
                    <span className="shrink-0 pt-px text-xs text-muted-foreground">{INSIGHT_LABELS[insight.type]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No insights yet — they appear once you publish and log analytics.</p>
        )}
      </div>
    </div>
  )
}
