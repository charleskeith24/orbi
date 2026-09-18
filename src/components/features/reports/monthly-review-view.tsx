"use client"

import { Clock, FileText, ListOrdered, Plus, Printer, Trophy } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { hasPublishedContent } from "@/components/features/dashboard/first-run"
import { Button } from "@/components/ui/button"
import { monthlyReport } from "@/lib/analytics"
import { parseDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions, useDb, useSettings } from "@/lib/store"
import { ConsistencyCard } from "./consistency-card"
import { AudienceGrowthCard, FollowerGrowthCard } from "./growth-cards"
import { BusinessOpportunitiesCard, LeadGenerationCard } from "./leads-business"
import { reportMessages } from "./messages"
import { MonthlyKpis } from "./monthly-kpis"
import { monthlyReviewMessages } from "./monthly-messages"
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
  const t = useT(monthlyReviewMessages)
  const r = useT(reportMessages)
  const lang = useUiLang()
  const now = useNow()
  const db = useDb()
  const settings = useSettings()
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get("month")

  const period = useMemo(() => resolveMonthParam(monthParam, now), [monthParam, now])
  const report = useMemo(() => monthlyReport(db, period.start, settings, now, lang), [db, period, settings, now, lang])
  const reviews = db.monthly_reviews
  const saved = useMemo(() => findMonthlyReview(reviews, period), [reviews, period])
  const options = useMemo(() => {
    const hints = new Map<string, string>()
    for (const review of reviews) hints.set(review.month.slice(0, 7), review.status === "final" ? r("hint_reviewed") : r("hint_draft"))
    return monthOptions(now, period, hints, 12, lang)
  }, [reviews, now, period, r, lang])
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
        <PageHeader icon={FileText} title="Monthly Review" description={t("empty_page_description")} />
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
            {period.isCurrent ? t("month_to_date") : ""}
            {r("ranked_by", { metric: rankedBy })}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PeriodNav unit="month" options={options} value={period.key} prev={prev} next={next} onChange={goToMonth} />
            <Button type="button" variant="outline" size="sm" onClick={printReport}>
              <Printer aria-hidden />
              {r("print")}
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

      <MonthlyKpis report={report} now={now} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <FollowerGrowthCard report={report} className="lg:col-span-2" />
        <AudienceGrowthCard report={report} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <PostHighlightCard
          title={t("best_content")}
          description={r("highest_by", { metric: rankedBy })}
          icon={Trophy}
          row={report.bestContent}
          empty={
            <EmptyState
              compact
              icon={Trophy}
              title={published ? r("no_analytics_yet") : t("nothing_published")}
              description={published ? t("log_this_month") : r("published_show_here")}
              action={
                published ? (
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
        <ReportPostsTable
          rows={report.top10}
          title={t("top_10")}
          description={t("measured_ranked", { metric: rankedBy })}
          icon={ListOrdered}
          emptyTitle={published ? t("no_measured") : t("nothing_published")}
          emptyDescription={published ? t("appear_when_logged") : t("log_to_build")}
          emptyAction={
            published ? (
              <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
                {r("add_analytics")}
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
