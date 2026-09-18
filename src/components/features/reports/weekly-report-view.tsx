"use client"

import { CalendarRange, Clock, FileText, ListOrdered, Plus, Printer, TrendingDown, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { hasPublishedContent } from "@/components/features/dashboard/first-run"
import { Button } from "@/components/ui/button"
import { rankRows, scopedRows, weeklyReport } from "@/lib/analytics"
import { parseDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions, useDb, useSettings } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { BestOfWeekCard } from "./best-of-week"
import { ContentMixCard } from "./content-mix-card"
import { reportMessages } from "./messages"
import { PeriodNav } from "./period-nav"
import { PostHighlightCard } from "./post-summary"
import { ReportPostsTable } from "./posts-table"
import { printReport } from "./print-report"
import { rankedByLabel } from "./report-format"
import { adjacentWeeks, resolveWeekParam, weekKeyOf, weekOptions, weekPeriod } from "./report-periods"
import { ReviewHistory, type HistoryEntry } from "./review-history"
import { findWeeklyReview, weeklyReviewState, type ReviewState } from "./review-model"
import { useNow } from "./use-now"
import { WeeklyKpis } from "./weekly-kpis"
import { weeklyReportMessages } from "./weekly-messages"
import { WeeklyReviewEditor } from "./weekly-review-editor"

const STATE_HINT: Record<ReviewState, "hint_reviewed" | "hint_draft" | "hint_planned" | undefined> = {
  final: "hint_reviewed",
  draft: "hint_draft",
  plan: "hint_planned",
  unsaved: undefined,
}

/**
 * Weekly Content Report (spec §33) for `?week=<week start>` (default: the last completed week; this week
 * to date allowed): numbers, highlights, mix, posts, the AI-drafted review (saved per week) and history.
 */
export function WeeklyReportView() {
  const t = useT(weeklyReportMessages)
  const r = useT(reportMessages)
  const lang = useUiLang()
  const now = useNow()
  const db = useDb()
  const settings = useSettings()
  const router = useRouter()
  const searchParams = useSearchParams()
  const weekStartsOn = settings.week_starts_on
  const weekParam = searchParams.get("week")

  const period = useMemo(() => resolveWeekParam(weekParam, now, weekStartsOn), [weekParam, now, weekStartsOn])
  const report = useMemo(() => weeklyReport(db, period.start, settings, now, lang), [db, period, settings, now, lang])
  const posts = useMemo(() => {
    const asOf = now < period.end ? now : period.end
    const rows = scopedRows(db, asOf, { start: period.start, end: period.end, settings })
    const ranked = rankRows(rows, settings.winner_metric)
    const measured = new Set(ranked.map((r) => r.id))
    const unmeasured = rows
      .filter((r) => !measured.has(r.id))
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    return [...ranked, ...unmeasured]
  }, [db, period, settings, now])

  const reviews = db.weekly_reviews
  const saved = useMemo(() => findWeeklyReview(reviews, period), [reviews, period])
  const options = useMemo(() => {
    const hints = new Map<string, string>()
    for (const review of reviews) {
      const key = weekKeyOf(review.week_start, weekStartsOn)
      const hint = STATE_HINT[weeklyReviewState(review)]
      if (key && hint) hints.set(key, r(hint))
    }
    return weekOptions(now, weekStartsOn, period, hints, 12, lang)
  }, [reviews, now, weekStartsOn, period, r, lang])
  const history = useMemo<HistoryEntry[]>(
    () =>
      [...reviews]
        .sort((a, b) => (a.week_start < b.week_start ? 1 : a.week_start > b.week_start ? -1 : 0))
        .map((review) => {
          const week = weekPeriod(parseDate(review.week_start) ?? now, now, weekStartsOn)
          const focus = review.focus.trim()
          return {
            id: review.id,
            href: `/reports?week=${week.key}`,
            label: week.label,
            state: weeklyReviewState(review),
            snippet: review.what_worked.trim() || (focus ? t("focus", { focus }) : ""),
            active: week.key === period.key,
          }
        }),
    [reviews, now, weekStartsOn, period, t]
  )

  const goToWeek = useCallback((key: string) => router.replace(`/reports?week=${key}`, { scroll: false }), [router])
  const { prev, next } = adjacentWeeks(period)
  const rankedBy = rankedByLabel(report.rankedBy)

  // A brand-new workspace has no week to report on — a page of zeros would only discourage.
  if (!hasPublishedContent(db.content_items) && !reviews.length) {
    return (
      <PageContainer>
        <PageHeader icon={FileText} title="Weekly Content Report" description={t("empty_page_description")} />
        <EmptyState
          icon={FileText}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <Plus aria-hidden />
              {r("log_post")}
            </Button>
          }
          secondaryAction={
            <Button asChild size="sm" variant="outline">
              <Link href="/calendar/planner">{t("plan_this_week")}</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        icon={FileText}
        title="Weekly Content Report"
        description={
          <>
            <span className="num">{period.label}</span>
            {period.isCurrent ? t("week_to_date") : ""}
            {r("ranked_by", { metric: rankedBy })}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PeriodNav unit="week" options={options} value={period.key} prev={prev} next={next} onChange={goToWeek} />
            <Button type="button" variant="outline" size="sm" onClick={printReport}>
              <Printer aria-hidden />
              {r("print")}
            </Button>
            <Button size="sm" asChild>
              <Link href="/calendar/planner">
                <CalendarRange aria-hidden />
                {t("plan_next_week")}
              </Link>
            </Button>
          </div>
        }
      />

      {period.isCurrent ? (
        <p className="-mt-3 flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
          <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("in_progress_note")}
        </p>
      ) : null}

      <WeeklyKpis report={report} period={period} />

      <div className="grid gap-4 lg:grid-cols-3">
        <PostHighlightCard
          title={t("best_post")}
          description={r("highest_by", { metric: rankedBy })}
          icon={Trophy}
          row={report.bestPost}
          empty={
            <EmptyState
              compact
              icon={Trophy}
              title={report.published ? r("no_analytics_yet") : t("nothing_published")}
              description={report.published ? t("log_this_week") : r("published_show_here")}
              action={
                report.published ? (
                  <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
                    {r("add_analytics")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
                    {r("log_post")}
                  </Button>
                )
              }
            />
          }
        />
        <PostHighlightCard
          title={t("worst_post")}
          description={t("lowest_by", { metric: rankedBy })}
          icon={TrendingDown}
          row={report.worstPost}
          empty={
            <EmptyState
              compact
              icon={TrendingDown}
              title={t("not_enough_measured")}
              description={t("worst_needs_two")}
            />
          }
        />
        <BestOfWeekCard report={report} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <ContentMixCard
          pillars={report.contentMix.pillars}
          funnel={report.contentMix.funnel}
          description={t("mix_description")}
          className="xl:col-span-2"
        />
        <ReportPostsTable
          rows={posts}
          title={t("posts_this_week")}
          description={t.plural("posts_ranked", posts.length, { count: formatNumber(posts.length), metric: rankedBy })}
          icon={ListOrdered}
          emptyTitle={t("nothing_published")}
          emptyDescription={t("log_to_build")}
          className="xl:col-span-3"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <WeeklyReviewEditor key={period.key} db={db} report={report} period={period} saved={saved} now={now} />
        <ReviewHistory
          title={r("saved_reviews")}
          description={t("history_description")}
          entries={history}
          emptyTitle={r("no_saved_reviews")}
          emptyDescription={t("history_empty")}
        />
      </div>
    </PageContainer>
  )
}
