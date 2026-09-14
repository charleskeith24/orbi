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
import { uiActions, useDb, useSettings } from "@/lib/store"
import { BestOfWeekCard } from "./best-of-week"
import { ContentMixCard } from "./content-mix-card"
import { PeriodNav } from "./period-nav"
import { PostHighlightCard } from "./post-summary"
import { ReportPostsTable } from "./posts-table"
import { printReport } from "./print-report"
import { countLabel, rankedByLabel } from "./report-format"
import { adjacentWeeks, resolveWeekParam, weekKeyOf, weekOptions, weekPeriod } from "./report-periods"
import { ReviewHistory, type HistoryEntry } from "./review-history"
import { findWeeklyReview, weeklyReviewState, type ReviewState } from "./review-model"
import { useNow } from "./use-now"
import { WeeklyKpis } from "./weekly-kpis"
import { WeeklyReviewEditor } from "./weekly-review-editor"

const STATE_HINT: Record<ReviewState, string | undefined> = { final: "Reviewed", draft: "Draft", plan: "Planned", unsaved: undefined }

/**
 * Weekly Content Report (spec §33) for `?week=<week start>` (default: the last completed week; this week
 * to date allowed): numbers, highlights, mix, posts, the AI-drafted review (saved per week) and history.
 */
export function WeeklyReportView() {
  const now = useNow()
  const db = useDb()
  const settings = useSettings()
  const router = useRouter()
  const searchParams = useSearchParams()
  const weekStartsOn = settings.week_starts_on
  const weekParam = searchParams.get("week")

  const period = useMemo(() => resolveWeekParam(weekParam, now, weekStartsOn), [weekParam, now, weekStartsOn])
  const report = useMemo(() => weeklyReport(db, period.start, settings, now), [db, period, settings, now])
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
    for (const r of reviews) {
      const key = weekKeyOf(r.week_start, weekStartsOn)
      const hint = STATE_HINT[weeklyReviewState(r)]
      if (key && hint) hints.set(key, hint)
    }
    return weekOptions(now, weekStartsOn, period, hints)
  }, [reviews, now, weekStartsOn, period])
  const history = useMemo<HistoryEntry[]>(
    () =>
      [...reviews]
        .sort((a, b) => (a.week_start < b.week_start ? 1 : a.week_start > b.week_start ? -1 : 0))
        .map((r) => {
          const week = weekPeriod(parseDate(r.week_start) ?? now, now, weekStartsOn)
          const focus = r.focus.trim()
          return {
            id: r.id,
            href: `/reports?week=${week.key}`,
            label: week.label,
            state: weeklyReviewState(r),
            snippet: r.what_worked.trim() || (focus ? `Focus: ${focus}` : ""),
            active: week.key === period.key,
          }
        }),
    [reviews, now, weekStartsOn, period]
  )

  const goToWeek = useCallback((key: string) => router.replace(`/reports?week=${key}`, { scroll: false }), [router])
  const { prev, next } = adjacentWeeks(period)
  const rankedBy = rankedByLabel(report.rankedBy)

  // A brand-new workspace has no week to report on — a page of zeros would only discourage.
  if (!hasPublishedContent(db.content_items) && !reviews.length) {
    return (
      <PageContainer>
        <PageHeader icon={FileText} title="Weekly Content Report" description="What went out each week, how it performed and what to do next." />
        <EmptyState
          icon={FileText}
          title="No weekly report yet"
          description="Your first weekly report appears after your first published week — posting consistency, your best and worst posts, the content mix and an AI-drafted review, all from the posts and analytics you log."
          action={
            <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <Plus aria-hidden />
              Log a published post
            </Button>
          }
          secondaryAction={
            <Button asChild size="sm" variant="outline">
              <Link href="/calendar/planner">Plan this week</Link>
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
            {period.isCurrent ? " · week to date" : ""} · posts ranked by {rankedBy}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PeriodNav unit="week" options={options} value={period.key} prev={prev} next={next} onChange={goToWeek} />
            <Button type="button" variant="outline" size="sm" onClick={printReport}>
              <Printer aria-hidden />
              Print
            </Button>
            <Button size="sm" asChild>
              <Link href="/calendar/planner">
                <CalendarRange aria-hidden />
                Plan next week
              </Link>
            </Button>
          </div>
        }
      />

      {period.isCurrent ? (
        <p className="-mt-3 flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
          <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
          This week is still in progress — totals run through today and changes compare the same days of last week.
        </p>
      ) : null}

      <WeeklyKpis report={report} period={period} />

      <div className="grid gap-4 lg:grid-cols-3">
        <PostHighlightCard
          title="Best post"
          description={`Highest by ${rankedBy}`}
          icon={Trophy}
          row={report.bestPost}
          empty={
            <EmptyState
              compact
              icon={Trophy}
              title={report.published ? "No analytics logged yet" : "Nothing published this week"}
              description={
                report.published
                  ? "Log views and engagement for this week's posts to see what worked."
                  : "Published posts and their numbers show up here."
              }
              action={
                report.published ? (
                  <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
                    Add analytics
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
                    Log a published post
                  </Button>
                )
              }
            />
          }
        />
        <PostHighlightCard
          title="Worst post"
          description={`Lowest by ${rankedBy}`}
          icon={TrendingDown}
          row={report.worstPost}
          empty={
            <EmptyState
              compact
              icon={TrendingDown}
              title="Not enough measured posts"
              description="The worst post needs at least two posts with analytics this week."
            />
          }
        />
        <BestOfWeekCard report={report} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <ContentMixCard
          pillars={report.contentMix.pillars}
          funnel={report.contentMix.funnel}
          description="Published this week vs your pillar and funnel targets"
          className="xl:col-span-2"
        />
        <ReportPostsTable
          rows={posts}
          title="Posts this week"
          description={`${countLabel(posts.length, "post")} · ranked by ${rankedBy}`}
          icon={ListOrdered}
          emptyTitle="Nothing published this week"
          emptyDescription="Log what you published to build the report."
          className="xl:col-span-3"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <WeeklyReviewEditor key={period.key} db={db} report={report} period={period} saved={saved} now={now} />
        <ReviewHistory
          title="Saved reviews"
          description="Weekly reviews, newest first"
          entries={history}
          emptyTitle="No saved reviews yet"
          emptyDescription="Save this week's review to start your history."
        />
      </div>
    </PageContainer>
  )
}
