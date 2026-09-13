"use client"

import { ChartColumn, Download, Plus, Shapes, SearchX, Trophy } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  DataTable,
  EmptyState,
  FacetFilter,
  FormatCategoryIcon,
  PageContainer,
  PageHeader,
  SearchInput,
  TIER_ICONS,
  type FacetOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { NO_KEY, tieredRows, type TieredRow } from "@/lib/analytics"
import { PERFORMANCE_TIER_IDS, PERFORMANCE_TIERS, PLATFORMS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { uiActions, useDb, useLookup, useSettings } from "@/lib/store"
import { countBy, formatCompact, formatPercent, matchesQuery, pluralize } from "@/lib/utils"
import { AnalyticsFilterBar } from "./analytics-filter-bar"
import { ColumnMenu, useColumnVisibility } from "./column-menu"
import { downloadCsv } from "./csv"
import {
  describeRange,
  hrefWithFilters,
  isDefaultFilters,
  OVERVIEW_DEFAULTS,
  POSTS_DEFAULTS,
  readListParam,
  resolveFilterRange,
  setParam,
} from "./filters"
import { useAnalyticsFilters, useNow } from "./hooks"
import { postsCsv, type PostLookups } from "./post-csv"
import { PostDetailSheet } from "./post-detail-sheet"
import { buildPostColumns, tierKey } from "./post-table-columns"
import { kpiTotals, scopeRows } from "./scope"

const NO_SCOPE = { platforms: [], pillars: [] }
const PAGE_EXTRA_KEYS = ["format", "tier"]

const TIER_FACETS: { value: string; label: string }[] = [
  ...[...PERFORMANCE_TIER_IDS].reverse().map((tier) => ({ value: tier, label: PERFORMANCE_TIERS[tier].label })),
  { value: "untiered", label: "Not tiered yet" },
  { value: "none", label: "No analytics" },
]

/** Post Performance (spec §25): every published post with its latest snapshot; row → detail sheet (?open=). */
export function PostPerformanceView() {
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const { filters, setFilters, resetFilters, params, update } = useAnalyticsFilters(POSTS_DEFAULTS)
  const formatFilter = useMemo(() => readListParam(params, "format"), [params])
  const tierFilter = useMemo(() => readListParam(params, "tier").filter((v) => TIER_FACETS.some((t) => t.value === v)), [params])
  const [query, setQuery] = useState("")
  const columnsState = useColumnVisibility()
  const pillars = useLookup("content_pillars")
  const formats = useLookup("content_formats")
  const lookups = useMemo<PostLookups>(() => ({ pillars, formats }), [pillars, formats])

  const allRows = useMemo(() => tieredRows(db, settings, now), [db, settings, now])
  const range = useMemo(() => resolveFilterRange(filters, now), [filters, now])
  const inRangeRows = useMemo(() => scopeRows(allRows, NO_SCOPE, range), [allRows, range])
  const scoped = useMemo(() => scopeRows(inRangeRows, filters, null), [inRangeRows, filters])
  const rows = useMemo(() => {
    const formatSet = new Set(formatFilter)
    const tierSet = new Set(tierFilter)
    return scoped.filter((r) => {
      if (formatSet.size && !formatSet.has(r.formatId && formats.has(r.formatId) ? r.formatId : NO_KEY)) return false
      if (tierSet.size && !tierSet.has(tierKey(r))) return false
      const pillar = r.pillarId ? pillars.get(r.pillarId)?.name : ""
      const format = r.formatId ? formats.get(r.formatId)?.name : ""
      return matchesQuery(query, r.item.title, r.item.hook, pillar, format, PLATFORMS[r.platform].label)
    })
  }, [scoped, formatFilter, tierFilter, query, pillars, formats])
  const totals = useMemo(() => kpiTotals(rows), [rows])

  const formatOptions = useMemo<FacetOption[]>(() => {
    const counts: Partial<Record<string, number>> = countBy(scoped, (r) => (r.formatId && formats.has(r.formatId) ? r.formatId : NO_KEY))
    const options: FacetOption[] = [...formats.values()]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .filter((f) => counts[f.id] || formatFilter.includes(f.id))
      .map((f) => ({
        value: f.id,
        label: f.name || "Untitled format",
        count: counts[f.id] ?? 0,
        icon: <FormatCategoryIcon category={f.category} className="size-3.5 text-muted-foreground" />,
      }))
    if (counts[NO_KEY] || formatFilter.includes(NO_KEY)) options.push({ value: NO_KEY, label: "No format", count: counts[NO_KEY] ?? 0 })
    return options
  }, [scoped, formats, formatFilter])

  const tierOptions = useMemo<FacetOption[]>(() => {
    const counts: Partial<Record<string, number>> = countBy(scoped, tierKey)
    return TIER_FACETS.map((t) => {
      const Icon = t.value in TIER_ICONS ? TIER_ICONS[t.value as keyof typeof TIER_ICONS] : null
      return { ...t, count: counts[t.value] ?? 0, icon: Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden /> : undefined }
    })
  }, [scoped])

  // Detail sheet follows ?open= (also when it changes while the page is open, e.g. from ⌘K).
  const openId = params.get("open")
  const openItem = openId ? db.content_items.find((i) => i.id === openId) : undefined
  const [sheetItemId, setSheetItemId] = useState<string | null>(openItem ? openItem.id : null)
  const [autoAddId, setAutoAddId] = useState<string | null>(null)
  const [sheetNonce, setSheetNonce] = useState(0)
  if (openItem && openItem.id !== sheetItemId) setSheetItemId(openItem.id)
  const sheetItem = sheetItemId ? db.content_items.find((i) => i.id === sheetItemId) : undefined
  const sheetRow = sheetItem ? (allRows.find((r) => r.id === sheetItem.id) ?? null) : null

  const staleOpenId = useRef<string | null>(null)
  useEffect(() => {
    if (!openId || openItem || staleOpenId.current === openId) return
    staleOpenId.current = openId
    toast.error("That post no longer exists")
    update((next) => next.delete("open"))
  }, [openId, openItem, update])

  const openPost = (id: string, addSnapshot = false) => {
    setAutoAddId(addSnapshot ? id : null)
    if (addSnapshot) setSheetNonce((n) => n + 1)
    update((next) => next.set("open", id))
  }
  const closePost = () => {
    setAutoAddId(null)
    update((next) => next.delete("open"))
  }

  const columns = buildPostColumns({
    visible: columnsState.visible,
    lookups,
    onAddAnalytics: (row: TieredRow) => openPost(row.id, true),
  })

  const filtered = !isDefaultFilters(filters, POSTS_DEFAULTS) || formatFilter.length > 0 || tierFilter.length > 0 || query.trim() !== ""
  const resetAll = () => {
    setQuery("")
    resetFilters(PAGE_EXTRA_KEYS)
  }

  function exportCsv() {
    if (!rows.length) return
    downloadCsv(`post-performance-${toISODate(now)}.csv`, postsCsv(rows, lookups))
    toast.success(`Exported ${pluralize(rows.length, "post")} to CSV`)
  }

  const missing = rows.length - totals.measured

  return (
    <PageContainer>
      <PageHeader
        title="Post Performance"
        description="Every published post with its latest analytics snapshot. Open a post for its history, rates and tier."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={hrefWithFilters("/analytics", filters, OVERVIEW_DEFAULTS)}>
                <ChartColumn aria-hidden />
                Overview
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download aria-hidden />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
              <Plus aria-hidden />
              Add analytics
            </Button>
          </>
        }
      >
        {allRows.length ? (
          <AnalyticsFilterBar
            filters={filters}
            onChange={setFilters}
            onReset={resetAll}
            showReset={filtered}
            allowAll={POSTS_DEFAULTS.allowAll}
            rows={inRangeRows}
            now={now}
            actions={
              <>
                <SearchInput value={query} onChange={setQuery} placeholder="Search posts…" className="sm:w-56" />
                <ColumnMenu visible={columnsState.visible} onToggle={columnsState.toggle} onReset={columnsState.reset} />
              </>
            }
          >
            <FacetFilter
              title="Format"
              icon={Shapes}
              options={formatOptions}
              value={formatFilter}
              onChange={(value) => update((next) => setParam(next, "format", value.join(",")))}
            />
            <FacetFilter
              title="Tier"
              icon={Trophy}
              options={tierOptions}
              value={tierFilter}
              onChange={(value) => update((next) => setParam(next, "tier", value.join(",")))}
            />
          </AnalyticsFilterBar>
        ) : null}
      </PageHeader>

      {allRows.length ? (
        <section className="flex min-w-0 flex-col gap-2" aria-label="Posts">
          <p className="num text-xs text-muted-foreground">
            {describeRange(range)} · {pluralize(rows.length, "post")} · {formatCompact(totals.views)} views ·{" "}
            {formatPercent(totals.engagementRate)} engagement rate
            {missing > 0 ? ` · ${formatCompact(missing)} without analytics` : null}
          </p>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            onRowClick={(r) => openPost(r.id)}
            rowLabel={(r) => r.item.title || "Untitled post"}
            defaultSort={{ id: "date", desc: true }}
            stickyHeader
            maxHeight="max(24rem, calc(100dvh - 19rem))"
            pageSize={100}
            aria-label="Post performance"
            empty={
              <EmptyState
                compact
                icon={SearchX}
                title="No posts match these filters"
                description="Widen the date range or clear a filter to see more posts."
                action={
                  <Button size="sm" variant="outline" onClick={resetAll}>
                    Reset filters
                  </Button>
                }
              />
            }
          />
        </section>
      ) : (
        <EmptyState
          icon={ChartColumn}
          title="No published posts yet"
          description="Posts appear here once they're live. Log a post you published elsewhere to start tracking it."
          action={
            <Button size="sm" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <Plus aria-hidden />
              Log a published post
            </Button>
          }
        />
      )}

      {sheetItem ? (
        <PostDetailSheet
          key={`${sheetItem.id}:${sheetNonce}`}
          item={sheetItem}
          row={sheetRow}
          open={Boolean(openItem)}
          onOpenChange={(next) => {
            if (!next) closePost()
          }}
          settings={settings}
          now={now}
          autoAdd={autoAddId === sheetItem.id}
        />
      ) : null}
    </PageContainer>
  )
}
