"use client"

import { ChartColumn, Plus, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import {
  ColorDot,
  EmptyState,
  FacetFilter,
  FilterBar,
  OptionSelect,
  PageContainer,
  PageHeader,
  PlatformIcon,
  ResetFiltersButton,
  SearchInput,
  StatTile,
  type FacetOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { getWinners, inRange, resolveRange, tieredRows } from "@/lib/analytics"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions, useDb, useSettings } from "@/lib/store"
import { formatNumber, formatPercent, truncate } from "@/lib/utils"
import { winnersMessages } from "./messages"
import { WinnerCard } from "./winner-card"
import { WinnerDetailSheet } from "./winner-detail-sheet"
import { DetectionRule } from "./winner-rule"
import {
  buildWinnerEntries,
  filterWinners,
  formatRatio,
  libraryStats,
  matchesTierFilter,
  minComparisonPosts,
  NO_PILLAR,
  periodOptions,
  periodRange,
  sortOptions,
  sortWinners,
  tierFilters,
  type WinnerPeriod,
  type WinnerSort,
} from "./winners-model"

export function WinnersView() {
  const t = useT(winnersMessages)
  const lang = useUiLang()
  const router = useRouter()
  const searchParams = useSearchParams()
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())

  const [query, setQuery] = useState("")
  const [tiers, setTiers] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const [pillars, setPillars] = useState<string[]>([])
  const [period, setPeriod] = useState<WinnerPeriod>("all")
  const [sort, setSort] = useState<WinnerSort>("ratio")

  const allRows = useMemo(() => tieredRows(db, settings, now), [db, settings, now])
  const allTimeCount = useMemo(() => getWinners(db, settings, now).length, [db, settings, now])
  const library = useMemo(
    () => buildWinnerEntries(db, getWinners(db, settings, now, periodRange(period))),
    [db, settings, now, period]
  )
  const stats = useMemo(() => {
    const range = resolveRange(now, periodRange(period))
    return libraryStats(library, allRows.filter((r) => r.metric !== null && inRange(r.publishedAt, range)).length)
  }, [allRows, library, now, period])
  const filtered = useMemo(
    () => sortWinners(filterWinners(library, { query, tiers, platforms, pillars }), sort),
    [library, query, tiers, platforms, pillars, sort]
  )

  // `?open=<itemId>` drives the detail sheet; keep the last row mounted while the sheet animates out.
  const openId = searchParams.get("open")
  const openRow = openId ? (allRows.find((r) => r.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<string | null>(openId)
  if (openRow && openId !== shownId) setShownId(openId)
  const shownRow = shownId ? (allRows.find((r) => r.id === shownId) ?? null) : null

  const setOpen = useCallback(
    (id: string | null) => router.replace(id ? `/winners?open=${id}` : "/winners", { scroll: false }),
    [router]
  )

  const periods = periodOptions(lang)
  const tierOptions: FacetOption[] = tierFilters(lang).map((option) => ({
    ...option,
    count: library.filter((e) => matchesTierFilter(e, [option.value])).length,
  }))
  const platformOptions: FacetOption[] = PLATFORM_IDS.filter(
    (p) => platforms.includes(p) || library.some((e) => e.row.platform === p)
  ).map((p) => ({
    value: p,
    label: PLATFORMS[p].label,
    count: library.filter((e) => e.row.platform === p).length,
    icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
  }))
  const pillarOptions: FacetOption[] = [...db.content_pillars]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((p) => pillars.includes(p.id) || library.some((e) => e.row.pillarId === p.id))
    .map((p) => ({
      value: p.id,
      label: p.name || t("untitled_pillar"),
      count: library.filter((e) => e.row.pillarId === p.id).length,
      icon: <ColorDot color={p.color} />,
    }))
  const unassigned = library.filter((e) => !e.row.pillarId).length
  if (unassigned || pillars.includes(NO_PILLAR)) pillarOptions.push({ value: NO_PILLAR, label: t("no_pillar"), count: unassigned })

  const filtering = Boolean(query || tiers.length || platforms.length || pillars.length || period !== "all")
  const resetFilters = () => {
    setQuery("")
    setTiers([])
    setPlatforms([])
    setPillars([])
    setPeriod("all")
  }

  const breakdown = [
    stats.breakouts ? t.plural("breakouts", stats.breakouts, { count: formatNumber(stats.breakouts) }) : "",
    stats.winners ? t.plural("winners", stats.winners, { count: formatNumber(stats.winners) }) : "",
    stats.pinnedOnly ? t("pinned_count", { count: formatNumber(stats.pinnedOnly) }) : "",
  ]
    .filter(Boolean)
    .join(" · ")

  const addAnalytics = (
    <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
      <ChartColumn aria-hidden />
      {t("add_analytics")}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Winning Content Library"
        description={t("description")}
        actions={addAnalytics}
      >
        <DetectionRule settings={settings} />
      </PageHeader>

      {allTimeCount ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label={t("in_library")} value={formatNumber(stats.total)} sublabel={breakdown || t("nothing_period")} />
            <StatTile
              label={t("win_rate")}
              value={stats.winRate === null ? "—" : formatPercent(stats.winRate, 0)}
              sublabel={
                stats.measured ? t.plural("of_measured", stats.measured, { count: formatNumber(stats.measured) }) : t("no_measured_period")
              }
            />
            <StatTile
              label={t("best_multiple")}
              value={stats.best ? formatRatio(stats.best.row.ratio) : "—"}
              sublabel={stats.best ? truncate(stats.best.row.item.title || t("untitled_content"), 44) : t("no_tiered_period")}
              href={stats.best ? `/winners?open=${stats.best.row.id}` : undefined}
            />
            <StatTile
              label={t("not_repurposed_stat")}
              value={formatNumber(stats.notRepurposed)}
              sublabel={!stats.total ? t("nothing_period") : stats.notRepurposed ? t("safest") : t("every_repurposed")}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <>
                  <span className="text-xs text-muted-foreground num">
                    {filtered.length === library.length
                      ? t.plural("posts", library.length, { count: formatNumber(library.length) })
                      : t("shown_of", { shown: filtered.length, total: library.length })}
                  </span>
                  <OptionSelect<WinnerSort>
                    value={sort}
                    onChange={(next) => setSort(next ?? "ratio")}
                    options={sortOptions(lang)}
                    size="sm"
                    aria-label={t("sort_aria")}
                    className="w-40"
                  />
                </>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder={t("search_placeholder")} />
              <FacetFilter title={t("facet_tier")} options={tierOptions} value={tiers} onChange={setTiers} />
              <FacetFilter title={t("facet_platform")} options={platformOptions} value={platforms} onChange={setPlatforms} />
              <FacetFilter title={t("facet_pillar")} options={pillarOptions} value={pillars} onChange={setPillars} />
              <OptionSelect<WinnerPeriod>
                value={period}
                onChange={(next) => setPeriod(next ?? "all")}
                options={periods}
                size="sm"
                aria-label={t("period_aria")}
                className="w-36"
              />
              <ResetFiltersButton show={filtering} onClick={resetFilters} />
            </FilterBar>

            {filtered.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((entry) => (
                  <WinnerCard key={entry.row.id} entry={entry} onOpen={setOpen} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Trophy}
                title={library.length ? t("no_match") : t("no_period")}
                description={
                  library.length
                    ? t("no_match_description")
                    : t.plural("outside_period", allTimeCount, {
                        count: formatNumber(allTimeCount),
                        period: periods.find((p) => p.value === period)?.label.toLowerCase() ?? t("this_period"),
                      })
                }
                action={
                  <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                    {library.length ? t("reset_filters") : t("show_all_time")}
                  </Button>
                }
              />
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Trophy}
          title={t("no_winners")}
          description={
            allRows.length
              ? t("no_winners_rows", { multiple: settings.tier_winner, min: minComparisonPosts(settings) })
              : t("no_winners_empty", { count: minComparisonPosts(settings) + 1 })
          }
          action={
            allRows.length ? (
              <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
                <ChartColumn aria-hidden />
                {t("add_analytics")}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
                <Plus aria-hidden />
                {t("log_published")}
              </Button>
            )
          }
          secondaryAction={
            allRows.length ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/analytics/posts">{t("open_post_performance")}</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <WinnerDetailSheet
        row={shownRow}
        open={Boolean(openRow)}
        now={now}
        onOpenChange={(open) => {
          if (!open) setOpen(null)
        }}
      />
    </PageContainer>
  )
}
