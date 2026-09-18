"use client"

import { ChartColumn, Plus, SearchX, Table2 } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { groupByFormat, groupByFunnel, groupByHookCategory, groupByPillar, groupByPlatform, strategicInsights, tieredRows } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions, useDb, useSettings } from "@/lib/store"
import { formatNumber, sum } from "@/lib/utils"
import { AnalyticsFilterBar } from "./analytics-filter-bar"
import { FormatBreakdown, FunnelBreakdown, PillarBreakdown, PlatformBreakdown } from "./breakdown-charts"
import {
  comparisonRange,
  describeRange,
  hrefWithFilters,
  isDefaultFilters,
  NO_PILLAR,
  OVERVIEW_DEFAULTS,
  POSTS_DEFAULTS,
  resolveFilterRange,
  type AnalyticsFilters,
} from "./filters"
import { HookStyleChart } from "./hook-style-chart"
import { useAnalyticsFilters, useNow } from "./hooks"
import { InsightsCard } from "./insights-card"
import { KpiGrid } from "./kpi-grid"
import { analyticsMessages } from "./messages"
import { MissingAnalytics } from "./missing-analytics"
import { PostingHeatmap } from "./posting-heatmap"
import { bucketFor, bucketSeries, kpiTotals, postingHeatmap, scopeRows, tierSummary } from "./scope"
import { TierDistribution } from "./tier-distribution"
import { TrendCharts, type AudienceSummary } from "./trend-charts"

const NO_SCOPE = { platforms: [], pillars: [] }

/** Analytics overview (spec §25): one filter row scopes every tile, chart and table below it. */
export function AnalyticsView() {
  const t = useT(analyticsMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const { filters, setFilters, resetFilters } = useAnalyticsFilters(OVERVIEW_DEFAULTS)

  const range = useMemo(() => resolveFilterRange(filters, now), [filters, now])
  const previousRange = useMemo(() => comparisonRange(range), [range])
  const allRows = useMemo(() => tieredRows(db, settings, now), [db, settings, now])
  const inRangeRows = useMemo(() => scopeRows(allRows, NO_SCOPE, range), [allRows, range])
  const rows = useMemo(() => scopeRows(inRangeRows, filters, null), [inRangeRows, filters])
  const current = useMemo(() => kpiTotals(rows), [rows])
  const previous = useMemo(
    () => (previousRange ? kpiTotals(scopeRows(allRows, filters, previousRange)) : null),
    [allRows, filters, previousRange]
  )
  const bucket = bucketFor(range)
  const points = useMemo(() => (rows.length ? bucketSeries(rows, range, bucket) : []), [rows, range, bucket])
  const groups = useMemo(() => {
    const selectedPillars = new Set(filters.pillars)
    return {
      platform: groupByPlatform(rows),
      pillar: groupByPillar(db, rows, lang).filter((g) => !selectedPillars.size || selectedPillars.has(g.pillar?.id ?? NO_PILLAR)),
      format: groupByFormat(db, rows, lang),
      hook: groupByHookCategory(rows, lang),
      funnel: groupByFunnel(rows, lang),
    }
  }, [db, rows, filters.pillars, lang])
  const heatmap = useMemo(() => postingHeatmap(rows, settings.week_starts_on), [rows, settings.week_starts_on])
  const tiers = useMemo(() => tierSummary(rows), [rows])
  const insights = useMemo(() => strategicInsights(db, now, settings, lang), [db, now, settings, lang])
  const missing = useMemo(() => rows.filter((r) => !r.metric), [rows])
  const audience = useMemo<AudienceSummary | null>(() => {
    const platforms = db.content_platforms.filter(
      (p) => p.is_active && p.current_followers !== null && (!filters.platforms.length || filters.platforms.includes(p.platform))
    )
    return platforms.length ? { followers: sum(platforms.map((p) => p.current_followers ?? 0)), platforms: platforms.length } : null
  }, [db.content_platforms, filters.platforms])

  const postsHref = (patch: Partial<AnalyticsFilters> = {}, extra: Record<string, string> = {}) =>
    hrefWithFilters("/analytics/posts", { ...filters, ...patch }, POSTS_DEFAULTS, extra)

  const header = (
    <PageHeader
      title="Analytics"
      description={t("description")}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={postsHref()}>
              <Table2 aria-hidden />
              Post Performance
            </Link>
          </Button>
          <Button size="sm" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
            <Plus aria-hidden />
            {t("add_analytics")}
          </Button>
        </>
      }
    >
      {allRows.length ? (
        <div className="flex flex-col gap-2">
          <AnalyticsFilterBar
            filters={filters}
            onChange={setFilters}
            onReset={() => resetFilters()}
            showReset={!isDefaultFilters(filters, OVERVIEW_DEFAULTS)}
            allowAll={OVERVIEW_DEFAULTS.allowAll}
            rows={inRangeRows}
            now={now}
          />
          <p className="text-xs text-muted-foreground">
            {t.plural("scope", rows.length, { count: formatNumber(rows.length), range: describeRange(range, lang) })}
            {previousRange ? t("scope_compare", { range: describeRange(previousRange, lang) }) : null}
          </p>
        </div>
      ) : null}
    </PageHeader>
  )

  if (!allRows.length) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          icon={ChartColumn}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <Plus aria-hidden />
              {t("log_published")}
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {header}
      {rows.length ? (
        <>
          <KpiGrid current={current} previous={previous} points={points} postsHref={postsHref()} />
          <MissingAnalytics rows={missing} viewAllHref={postsHref({}, { tier: "none" })} now={now} />
          <TrendCharts points={points} bucket={bucket} audience={audience} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PlatformBreakdown groups={groups.platform} hrefFor={(platform) => postsHref({ platforms: [platform] })} />
            <PillarBreakdown groups={groups.pillar} hrefFor={(pillarId) => postsHref({ pillars: [pillarId] })} />
            <FormatBreakdown groups={groups.format} hrefFor={(formatId) => postsHref({}, { format: formatId })} />
            <HookStyleChart groups={groups.hook} />
            <FunnelBreakdown groups={groups.funnel} />
            <TierDistribution summary={tiers} settings={settings} postsHref={postsHref({}, { tier: "winner,breakout" })} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-5">
            <PostingHeatmap data={heatmap} className="lg:col-span-3" />
            <InsightsCard insights={insights} className="lg:col-span-2" />
          </div>
        </>
      ) : (
        <EmptyState
          icon={SearchX}
          title={t("no_match_title")}
          description={t("no_match_description", { range: describeRange(range, lang) })}
          action={
            <Button size="sm" variant="outline" onClick={() => resetFilters()}>
              {t("reset_filters")}
            </Button>
          }
        />
      )}
    </PageContainer>
  )
}
