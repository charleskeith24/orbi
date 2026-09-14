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
import { uiActions, useDb, useSettings } from "@/lib/store"
import { formatNumber, formatPercent, pluralize, truncate } from "@/lib/utils"
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
  PERIOD_OPTIONS,
  periodRange,
  SORT_OPTIONS,
  sortWinners,
  TIER_FILTERS,
  type WinnerPeriod,
  type WinnerSort,
} from "./winners-model"

export function WinnersView() {
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

  const tierOptions: FacetOption[] = TIER_FILTERS.map((t) => ({
    ...t,
    count: library.filter((e) => matchesTierFilter(e, [t.value])).length,
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
      label: p.name || "Untitled pillar",
      count: library.filter((e) => e.row.pillarId === p.id).length,
      icon: <ColorDot color={p.color} />,
    }))
  const unassigned = library.filter((e) => !e.row.pillarId).length
  if (unassigned || pillars.includes(NO_PILLAR)) pillarOptions.push({ value: NO_PILLAR, label: "No pillar", count: unassigned })

  const filtering = Boolean(query || tiers.length || platforms.length || pillars.length || period !== "all")
  const resetFilters = () => {
    setQuery("")
    setTiers([])
    setPlatforms([])
    setPillars([])
    setPeriod("all")
  }

  const breakdown = [
    stats.breakouts ? pluralize(stats.breakouts, "breakout") : "",
    stats.winners ? pluralize(stats.winners, "winner") : "",
    stats.pinnedOnly ? `${formatNumber(stats.pinnedOnly)} pinned` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  const addAnalytics = (
    <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
      <ChartColumn aria-hidden />
      Add analytics
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Winning Content Library"
        description="Your best posts, detected from your own analytics. Study why they worked, then replicate and repurpose them."
        actions={addAnalytics}
      >
        <DetectionRule settings={settings} />
      </PageHeader>

      {allTimeCount ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="In the library" value={formatNumber(stats.total)} sublabel={breakdown || "Nothing in this period"} />
            <StatTile
              label="Win rate"
              value={stats.winRate === null ? "—" : formatPercent(stats.winRate, 0)}
              sublabel={stats.measured ? `of ${pluralize(stats.measured, "measured post")}` : "No measured posts in this period"}
            />
            <StatTile
              label="Best multiple"
              value={stats.best ? formatRatio(stats.best.row.ratio) : "—"}
              sublabel={stats.best ? truncate(stats.best.row.item.title || "Untitled content", 44) : "No tiered posts in this period"}
              href={stats.best ? `/winners?open=${stats.best.row.id}` : undefined}
            />
            <StatTile
              label="Not yet repurposed"
              value={formatNumber(stats.notRepurposed)}
              sublabel={
                !stats.total
                  ? "Nothing in this period"
                  : stats.notRepurposed
                    ? "Your safest repurposing candidates"
                    : "Every winner has a repurposed version"
              }
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <>
                  <span className="text-xs text-muted-foreground num">
                    {filtered.length === library.length ? pluralize(library.length, "post") : `${filtered.length} of ${library.length}`}
                  </span>
                  <OptionSelect<WinnerSort>
                    value={sort}
                    onChange={(next) => setSort(next ?? "ratio")}
                    options={SORT_OPTIONS}
                    size="sm"
                    aria-label="Sort winners"
                    className="w-40"
                  />
                </>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder="Search winners…" />
              <FacetFilter title="Tier" options={tierOptions} value={tiers} onChange={setTiers} />
              <FacetFilter title="Platform" options={platformOptions} value={platforms} onChange={setPlatforms} />
              <FacetFilter title="Pillar" options={pillarOptions} value={pillars} onChange={setPillars} />
              <OptionSelect<WinnerPeriod>
                value={period}
                onChange={(next) => setPeriod(next ?? "all")}
                options={PERIOD_OPTIONS}
                size="sm"
                aria-label="Published in"
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
                title={library.length ? "No winners match" : "No winners in this period"}
                description={
                  library.length
                    ? "Try a different search, tier, platform or pillar."
                    : `${pluralize(allTimeCount, "post")} made the library outside ${PERIOD_OPTIONS.find((p) => p.value === period)?.label.toLowerCase() ?? "this period"}.`
                }
                action={
                  <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                    {library.length ? "Reset filters" : "Show all time"}
                  </Button>
                }
              />
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Trophy}
          title="No winners yet"
          description={
            allRows.length
              ? `A post becomes a winner at ${settings.tier_winner}× the average of your earlier posts on the same platform — tiers start once a platform has ${minComparisonPosts(settings)} earlier posts with analytics. Pinned posts always show here.`
              : `Winners appear after you publish and log analytics for about ${minComparisonPosts(settings) + 1} posts per platform — each post is compared with your own earlier posts, never with anyone else's.`
          }
          action={
            allRows.length ? (
              <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
                <ChartColumn aria-hidden />
                Add analytics
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
                <Plus aria-hidden />
                Log a published post
              </Button>
            )
          }
          secondaryAction={
            allRows.length ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/analytics/posts">Open Post Performance</Link>
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
