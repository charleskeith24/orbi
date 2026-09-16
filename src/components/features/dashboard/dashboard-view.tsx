"use client"

import { PageContainer } from "@/components/common"
import { WhatToPost } from "@/components/features/recommendations/what-to-post"
import { useBrand, useSettings } from "@/lib/store"
import { ContentTodayCard } from "./content-today-card"
import { DashboardHeader } from "./dashboard-header"
import { FirstStepsCard, PerformancePlaceholder } from "./first-steps-card"
import { HealthCard } from "./health-card"
import { IncomeCard } from "./income-card"
import { InsightsCard } from "./insights-card"
import { KpiRow } from "./kpi-row"
import { PillarDistributionCard } from "./pillar-distribution-card"
import { PillarPerformanceCard } from "./pillar-performance-card"
import { PipelineStrip } from "./pipeline-strip"
import { PlatformGrowthCard } from "./platform-growth-card"
import { QuickCaptureCard } from "./quick-capture-card"
import { TopPerformersCard } from "./top-performers-card"
import { useDashboardData } from "./use-dashboard"
import { WeekCalendar } from "./week-calendar"

/**
 * Home — the executive dashboard. Layout follows the page's own width (container queries):
 * one column with Today, the KPIs and Quick Capture first; two columns from 768px; the full
 * 12-column grid from 1024px. DOM order is the desktop order; `order-*` sets the mobile stack.
 * Until something is published, first steps replace the KPIs and the performance cards collapse into one.
 */
export function DashboardView() {
  const brand = useBrand()
  const settings = useSettings()
  const data = useDashboardData()
  const todaySlots = data.weekDays.find((day) => day.isToday)?.slots ?? []
  const firstRun = !data.hasPublished
  const showWork = !firstRun || data.hasContent

  return (
    <PageContainer className="@container gap-4">
      <DashboardHeader ownerName={brand.name} now={data.now} weekStart={data.week.start} weekEnd={data.week.end} />
      <div className="grid min-w-0 grid-cols-1 gap-4 @3xl:grid-cols-12">
        {firstRun ? (
          <FirstStepsCard steps={data.steps} className="order-first @3xl:order-1 @3xl:col-span-12" />
        ) : (
          <KpiRow data={data} className="order-2 @3xl:order-1 @3xl:col-span-12" />
        )}
        {showWork ? <PipelineStrip pipeline={data.pipeline} className="order-5 @3xl:order-2 @3xl:col-span-12" /> : null}
        <ContentTodayCard
          today={data.today}
          slots={todaySlots}
          now={data.now}
          className="order-1 @3xl:order-3 @3xl:col-span-7 @5xl:col-span-5"
        />
        <div className="order-3 flex min-w-0 flex-col gap-4 @3xl:order-5 @3xl:col-span-12 @3xl:grid @3xl:grid-cols-2 @3xl:items-start @5xl:order-4 @5xl:col-span-4 @5xl:flex">
          <div className="flex min-w-0 flex-col gap-4">
            <QuickCaptureCard capturedToday={data.today.ideasCapturedToday.length} />
            <WhatToPost variant="card" />
            <IncomeCard />
          </div>
          {showWork ? <InsightsCard insights={data.insights} prompts={data.prompts} className="@5xl:flex-1" /> : null}
        </div>
        <HealthCard
          health={data.health}
          scored={!firstRun}
          className="order-4 @3xl:order-4 @3xl:col-span-5 @5xl:order-5 @5xl:col-span-3"
        />
        <WeekCalendar days={data.weekDays} startKey={data.startKey} className="order-6 @3xl:col-span-12" />
        {firstRun ? (
          <PerformancePlaceholder className="order-7 @3xl:col-span-12" />
        ) : (
          <>
            <TopPerformersCard
              rows={data.top}
              winnerMetric={settings.winner_metric}
              className="order-7 @3xl:col-span-12 @5xl:col-span-7"
            />
            <PlatformGrowthCard rows={data.platforms} className="order-10 @3xl:order-9 @3xl:col-span-6 @5xl:order-8 @5xl:col-span-5" />
            <PillarPerformanceCard rows={data.pillars} className="order-8 @3xl:col-span-12 @5xl:order-9 @5xl:col-span-7" />
            <PillarDistributionCard
              mix={data.mix}
              tolerance={settings.pillar_tolerance}
              className="order-9 @3xl:order-10 @3xl:col-span-6 @5xl:col-span-5"
            />
          </>
        )}
      </div>
    </PageContainer>
  )
}
