"use client"

import { Clock, FileText, ListOrdered, Plus, Printer, Trophy } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { hasPublishedContent } from "@/components/features/dashboard/first-run"
import { Button } from "@/components/ui/button"
import { monthlyReport } from "@/lib/analytics"
import { parseDate } from "@/lib/dates"
import { uiActions, useDb, useSettings } from "@/lib/store"
import { ConsistencyCard } from "./consistency-card"
import { AudienceGrowthCard, FollowerGrowthCard } from "./growth-cards"
import { BusinessOpportunitiesCard, LeadGenerationCard } from "./leads-business"
import { MonthlyKpis } from "./monthly-kpis"
import { MonthlyRecommendations } from "./monthly-recommendations"
import { PerformanceBreakdowns } from "./performance-breakdowns"
import { PeriodNav } from "./period-nav"
import { PostHighlightCard } from "./post-summary"
import { ReportPostsTable } from "./posts-table"
import { printReport } from "./print-report"
import { rankedByLabel } from "./report-format"
import { adjacentMonths, monthOptions, monthPeriod, resolveMonthParam } from "./report-periods"
import { ReviewHistory, type HistoryEntry } from "./review-history"
import { findMonthlyReview, monthlyReviewState } from "./review-model"
import { useNow } from "./use-now"

/**
 * Monthly Personal Brand Review (spec §34) for `?month=YYYY-MM` (default: last month; this month to date
 * allowed): growth, reach, content, best / top 10 posts, performance breakdowns, leads, business
 * opportunities, consistency, the AI-drafted strategic recommendations (saved per month) and history.
 */
export function MonthlyReviewView() {
  const now = useNow()
  const db = useDb()
  const settings = useSettings()
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get("month")

  const period = useMemo(() => resolveMonthParam(monthParam, now), [monthParam, now])
  const report = useMemo(() => monthlyReport(db, period.start, settings, now), [db, period, settings, now])
  const reviews = db.monthly_reviews
  const saved = useMemo(() => findMonthlyReview(reviews, period), [reviews, period])
  const options = useMemo(() => {
    const hints = new Map<string, string>()
    for (const r of reviews) hints.set(r.month.slice(0, 7), r.status === "final" ? "Reviewed" : "Draft")
    return monthOptions(now, period, hints)
  }, [reviews, now, period])
  const history = useMemo<HistoryEntry[]>(
    () =>
      [...reviews]
        .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
        .map((r) => {
          const month = monthPeriod(parseDate(r.month) ?? now, now)
          return {
            id: r.id,
            href: `/reports/monthly?month=${month.key}`,
            label: month.label,
            state: monthlyReviewState(r),
            snippet: r.summary.trim() || r.continue_doing[0]?.trim() || "",
            active: month.key === period.key,
          }
        }),
    [reviews, now, period]
  )

  const goToMonth = useCallback((key: string) => router.replace(`/reports/monthly?month=${key}`, { scroll: false }), [router])
  const { prev, next } = adjacentMonths(period)
  const rankedBy = rankedByLabel(report.rankedBy)
  const published = report.totalContent > 0

  // A brand-new workspace has no month to review — a page of zeros would only discourage.
  if (!hasPublishedContent(db.content_items) && !reviews.length) {
    return (
      <PageContainer>
        <PageHeader icon={FileText} title="Monthly Review" description="Your month in growth, reach, content and leads — and what to change next." />
        <EmptyState
          icon={FileText}
          title="No monthly review yet"
          description="Your first Monthly Review appears after your first month of publishing — audience growth, reach, your top 10 posts, leads and strategic recommendations, all from the analytics you log."
          action={
            <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <Plus aria-hidden />
              Log a published post
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
        title="Monthly Review"
        description={
          <>
            <span className="num">{period.label}</span>
            {period.isCurrent ? " · month to date" : ""} · posts ranked by {rankedBy}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PeriodNav unit="month" options={options} value={period.key} prev={prev} next={next} onChange={goToMonth} />
            <Button type="button" variant="outline" size="sm" onClick={printReport}>
              <Printer aria-hidden />
              Print
            </Button>
          </div>
        }
      />

      {period.isCurrent ? (
        <p className="-mt-3 flex items-start gap-1.5 text-xs text-pretty text-muted-foreground">
          <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
          This month is still in progress — totals run through today and changes compare the same days of last month.
        </p>
      ) : null}

      <MonthlyKpis report={report} now={now} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <FollowerGrowthCard report={report} className="lg:col-span-2" />
        <AudienceGrowthCard report={report} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <PostHighlightCard
          title="Best Content"
          description={`Highest by ${rankedBy}`}
          icon={Trophy}
          row={report.bestContent}
          empty={
            <EmptyState
              compact
              icon={Trophy}
              title={published ? "No analytics logged yet" : "Nothing published this month"}
              description={
                published
                  ? "Log views and engagement for this month's posts to find your best content."
                  : "Published posts and their numbers show up here."
              }
              action={
                published ? (
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
        <ReportPostsTable
          rows={report.top10}
          title="Top 10 Posts"
          description={`Measured posts ranked by ${rankedBy}`}
          icon={ListOrdered}
          emptyTitle={published ? "No measured posts this month" : "Nothing published this month"}
          emptyDescription={
            published ? "Posts appear here once their analytics are logged." : "Log what you published to build the review."
          }
          emptyAction={
            published ? (
              <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
                Add analytics
              </Button>
            ) : undefined
          }
          className="xl:col-span-2"
        />
      </div>

      <PerformanceBreakdowns report={report} />

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LeadGenerationCard report={report} />
        <BusinessOpportunitiesCard report={report} />
        <ConsistencyCard report={report} now={now} className="md:col-span-2 xl:col-span-1" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <MonthlyRecommendations key={period.key} db={db} report={report} period={period} saved={saved} now={now} />
        <ReviewHistory
          title="Saved reviews"
          description="Monthly reviews, newest first"
          entries={history}
          emptyTitle="No saved reviews yet"
          emptyDescription="Save this month's recommendations to start your history."
        />
      </div>
    </PageContainer>
  )
}
