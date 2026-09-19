"use client"

import { Disclosure, PageContainer, PageHeader } from "@/components/common"
import { useT, useUiLang } from "@/lib/i18n"
import { useBrand, useSettings } from "@/lib/store"
import type { DashboardData } from "./dashboard-data"
import { firstName, greetingFor } from "./dashboard-utils"
import { PerformancePlaceholder } from "./first-steps-card"
import { FocusHero } from "./focus-hero"
import { HealthCard } from "./health-card"
import { IncomeCard } from "./income-card"
import { InsightsCard } from "./insights-card"
import { KpiRow } from "./kpi-row"
import { dashboardMessages } from "./messages"
import { PillarDistributionCard } from "./pillar-distribution-card"
import { PillarPerformanceCard } from "./pillar-performance-card"
import { PipelineStrip } from "./pipeline-strip"
import { PlatformGrowthCard } from "./platform-growth-card"
import { TopPerformersCard } from "./top-performers-card"
import { useDashboardData } from "./use-dashboard"
import { WeekStrip } from "./week-strip"

/**
 * Home (Calm UI): a greeting, "Your focus today" — one next action — beside three KPI tiles, and this week's
 * strip. Everything else waits under "More on your week" (remembered per device): the Pipeline, insights, the
 * Content Health Score, performance and income. Today's lists live on Today; capture and new content in the top bar.
 * Layout follows the page's own width (container queries): one column on phones, side by side from 768px.
 */
export function DashboardView() {
  const brand = useBrand()
  const t = useT(dashboardMessages)
  const lang = useUiLang()
  const data = useDashboardData()
  const name = firstName(brand.name)
  const greeting = greetingFor(data.now, lang)
  const firstRun = !data.hasPublished

  return (
    <PageContainer className="@container gap-6">
      {/* No date line: the week strip marks today. */}
      <PageHeader title={name ? t("greeting_name", { greeting, name }) : greeting} />
      <div className="grid min-w-0 grid-cols-1 gap-3 @3xl:grid-cols-12 @3xl:gap-4">
        <FocusHero data={data} className={firstRun ? "@3xl:col-span-12" : "@3xl:col-span-7"} />
        {firstRun ? null : <KpiRow data={data} className="@3xl:col-span-5 @3xl:grid-cols-1 @3xl:gap-3 @3xl:self-start" />}
      </div>
      <WeekStrip days={data.weekDays} startKey={data.startKey} />
      <Disclosure variant="section" label={t("more_week")} storageKey="home-more-week">
        <MoreOnYourWeek data={data} />
      </Disclosure>
    </PageContainer>
  )
}

/**
 * The rest of Home, rendered only while "More on your week" is open: the Pipeline across the top, then two
 * independent columns (so a long card never stretches its neighbour).
 */
function MoreOnYourWeek({ data }: { data: DashboardData }) {
  const settings = useSettings()
  const firstRun = !data.hasPublished
  const showWork = !firstRun || data.hasContent
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {showWork ? <PipelineStrip pipeline={data.pipeline} /> : null}
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 @3xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 @3xl:col-span-7">
          {firstRun ? (
            <PerformancePlaceholder />
          ) : (
            <>
              <InsightsCard insights={data.insights} prompts={data.prompts} />
              <TopPerformersCard rows={data.top} winnerMetric={settings.winner_metric} />
              <PillarPerformanceCard rows={data.pillars} />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 @3xl:col-span-5">
          <HealthCard health={data.health} scored={!firstRun} />
          <IncomeCard />
          {firstRun ? null : (
            <>
              <PlatformGrowthCard rows={data.platforms} />
              <PillarDistributionCard mix={data.mix} tolerance={settings.pillar_tolerance} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
