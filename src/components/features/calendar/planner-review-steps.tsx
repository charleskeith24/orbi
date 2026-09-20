"use client"

import { CalendarX2, CircleAlert, Lightbulb, Sparkles, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState, FormField, PlatformIcon, StatTile, TierBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatMultiple, type InsightType, type ReportHighlight, type StrategicInsight, type TieredRow, type WeeklyReport } from "@/lib/analytics"
import { aggregateMessages } from "@/lib/analytics/messages"
import { PLATFORMS } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import { useT, type Translator } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { weekLabel } from "./calendar-model"
import { plannerMessages } from "./planner-messages"

type T = Translator<typeof plannerMessages.en>

/** The weekly_plan task accepts a focus of up to 300 characters. */
export const FOCUS_MAX = 300

export interface Leaders {
  topic: ReportHighlight | null
  hook: ReportHighlight | null
  format: ReportHighlight | null
  platform: ReportHighlight | null
  pillar: ReportHighlight | null
}

const LEADER_ROWS: { key: keyof Leaders; label: `leader_${keyof Leaders}` }[] = [
  { key: "topic", label: "leader_topic" },
  { key: "hook", label: "leader_hook" },
  { key: "format", label: "leader_format" },
  { key: "platform", label: "leader_platform" },
  { key: "pillar", label: "leader_pillar" },
]

/** Which aggregate metric a highlight's label names, in either UI language (`bestGroup` translates the label). */
function metricKey(label: string): keyof typeof aggregateMessages.en | null {
  const keys = Object.keys(aggregateMessages.en) as (keyof typeof aggregateMessages.en)[]
  return keys.find((k) => aggregateMessages.en[k] === label || aggregateMessages.tl[k] === label) ?? null
}

function formatHighlight(h: ReportHighlight, t: T): string {
  switch (metricKey(h.metricLabel)) {
    case "metric_engagement_rate":
      return t("highlight_engagement", { value: formatPercent(h.value) })
    case "metric_baseline":
      return t("highlight_baseline", { value: formatMultiple(h.value) })
    case "metric_leads":
      return t("highlight_leads", { value: h.value.toFixed(1) })
    default:
      return `${formatCompact(h.value)} ${h.metricLabel}`
  }
}

/* --------------------------- Step 1 · Review week --------------------------- */

function PostHighlight({ label, row }: { label: string; row: TieredRow | null }) {
  const t = useT(plannerMessages)
  if (!row) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <span className="font-medium">{label}:</span> {t("needs_two_posts")}
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Link href={`/studio/${row.id}`} className="line-clamp-2 text-sm font-medium underline-offset-4 hover:underline">
        {row.item.title.trim() || t("untitled_content")}
      </Link>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <PlatformIcon platform={row.platform} className="size-3.5" />
          {PLATFORMS[row.platform]?.label}
        </span>
        <span className="num">{t("views", { count: formatCompact(row.views) })}</span>
        {row.ratio !== null ? <span className="num">{t("highlight_baseline", { value: formatMultiple(row.ratio) })}</span> : null}
        <TierBadge tier={row.tier} showNormal />
      </span>
    </div>
  )
}

/** Step 1: last week's numbers vs the week before, best and weakest post. */
export function ReviewStep({ report, previousFocus, now }: { report: WeeklyReport; previousFocus: string; now: Date }) {
  const tr = useT(plannerMessages)
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
        title={tr("nothing_went_out")}
        description={tr("nothing_went_out_hint", { period })}
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-muted-foreground num">
        {period} · <span title={inProgress ? tr("in_progress_hint") : undefined}>{inProgress ? tr("in_progress") : tr("compared")}</span>
      </p>
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          size="sm"
          label={tr("stat_published")}
          value={`${report.published} / ${report.target}`}
          sublabel={tr("of_target_pct", { pct: report.consistencyPct })}
          tone={report.published >= report.target ? "good" : report.consistencyPct >= 80 ? "warning" : "serious"}
        />
        <StatTile size="sm" label={tr("stat_views")} value={formatCompact(t.views)} delta={d.views} />
        <StatTile size="sm" label={tr("stat_engagement")} value={formatPercent(t.engagementRate)} delta={d.engagementRate} />
        <StatTile size="sm" label={tr("stat_followers")} value={formatNumber(t.followers)} delta={d.followers} />
        <StatTile size="sm" label={tr("stat_leads")} value={formatNumber(t.leads)} delta={d.leads} />
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <PostHighlight label={tr("best_post")} row={report.bestPost} />
        <PostHighlight label={tr("weakest_post")} row={report.worstPost} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 text-pretty">{previousFocus ? tr("that_weeks_focus", { focus: previousFocus }) : tr("no_focus_saved")}</span>
        <Button asChild size="xs" variant="ghost">
          <Link href="/reports">{tr("open_weekly_report")}</Link>
        </Button>
      </div>
    </div>
  )
}

/* --------------------------- Step 2 · Top performers ------------------------ */

function Leader({ h }: { h: ReportHighlight | null }) {
  const t = useT(plannerMessages)
  if (!h) return <span className="text-xs text-muted-foreground">{t("not_enough_data")}</span>
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{h.label}</p>
      <p className="truncate text-xs text-muted-foreground num">
        {formatHighlight(h, t)} · {t.plural("posts", h.posts, { count: formatNumber(h.posts) })}
      </p>
    </div>
  )
}

/** Step 2: the best topic, hook style, format, platform and pillar — last week and the last 30 days. */
export function WinnersStep({ lastWeek, recent, top }: { lastWeek: Leaders; recent: Leaders; top: TieredRow[] }) {
  const t = useT(plannerMessages)
  return (
    <div className="grid min-w-0 gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground dark:bg-muted/20">
            <tr>
              <th scope="col" className="w-32 px-3 py-2 font-medium">
                {t("what_worked")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("last_week")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("last_30_days")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {LEADER_ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">
                  {t(row.label)}
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
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("top_posts")}</h3>
        {top.length ? (
          <ol className="grid min-w-0 gap-1.5">
            {top.map((row, index) => (
              <li key={row.id} className="flex min-w-0 items-center gap-2.5 rounded-md border px-3 py-2 text-sm">
                <span className="w-4 shrink-0 text-xs text-muted-foreground num">{index + 1}</span>
                <PlatformIcon platform={row.platform} label className="size-4 shrink-0 text-muted-foreground" />
                <Link href={`/studio/${row.id}`} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                  {row.item.title.trim() || t("untitled_content")}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground num">{t("views", { count: formatCompact(row.views) })}</span>
                <TierBadge tier={row.tier} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">{t("no_top_posts")}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => uiActions.askStrategist(t("strategist_question"))}>
          <Sparkles className="text-brand" aria-hidden />
          {t("ask_strategist")}
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

const INSIGHT_LABELS: Record<InsightType, `insight_${InsightType}`> = {
  double_down: "insight_double_down",
  fix: "insight_fix",
  opportunity: "insight_opportunity",
  warning: "insight_warning",
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
  const t = useT(plannerMessages)
  const length = focus.trim().length
  const error = length > FOCUS_MAX ? t("focus_too_long", { max: FOCUS_MAX }) : null
  return (
    <div className="grid min-w-0 gap-4">
      <FormField
        label={t("focus_label")}
        htmlFor="planner-focus"
        description={<span className="num">{t("focus_count", { length, max: FOCUS_MAX })}</span>}
        error={error}
      >
        <Textarea
          id="planner-focus"
          value={focus}
          rows={3}
          aria-invalid={Boolean(error)}
          placeholder={t("focus_placeholder")}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormField>
      {previousFocus && previousFocus !== focus.trim() ? (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="min-w-0 text-pretty">{t("last_weeks_focus", { focus: previousFocus })}</span>
          <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={() => onChange(previousFocus)}>
            {t("reuse_it")}
          </Button>
        </p>
      ) : null}
      <div className="grid min-w-0 gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("quick_picks")}</p>
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
                    <span className="shrink-0 pt-px text-xs text-muted-foreground">{t(INSIGHT_LABELS[insight.type])}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("no_insights")}</p>
        )}
      </div>
    </div>
  )
}
