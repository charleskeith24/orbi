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
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions, useDb, useLookup, useSettings } from "@/lib/store"
import { countBy, formatCompact, formatNumber, formatPercent, matchesQuery } from "@/lib/utils"
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
import { postMessages } from "./post-messages"
import { buildPostColumns, tierKey } from "./post-table-columns"
import { kpiTotals, scopeRows } from "./scope"

const NO_SCOPE = { platforms: [], pillars: [] }
const PAGE_EXTRA_KEYS = ["format", "tier"]

/** Tier facet values; "untiered" / "none" labels are translated where the options are built. */
const TIER_FACETS: { value: string; label: string }[] = [
  ...[...PERFORMANCE_TIER_IDS].reverse().map((tier) => ({ value: tier, label: PERFORMANCE_TIERS[tier].label })),
  { value: "untiered", label: "Not tiered yet" },
  { value: "none", label: "No analytics" },
]

/** Post Performance (spec §25): every published post with its latest snapshot; row → detail sheet (?open=). */
export function PostPerformanceView() {
  const t = useT(postMessages)
  const lang = useUiLang()
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
        label: f.name || t("untitled_format"),
        count: counts[f.id] ?? 0,
        icon: <FormatCategoryIcon category={f.category} className="size-3.5 text-muted-foreground" />,
      }))
    if (counts[NO_KEY] || formatFilter.includes(NO_KEY)) options.push({ value: NO_KEY, label: t("no_format"), count: counts[NO_KEY] ?? 0 })
    return options
  }, [scoped, formats, formatFilter, t])

  const tierOptions = useMemo<FacetOption[]>(() => {
    const counts: Partial<Record<string, number>> = countBy(scoped, tierKey)
    return TIER_FACETS.map((facet) => {
      const Icon = facet.value in TIER_ICONS ? TIER_ICONS[facet.value as keyof typeof TIER_ICONS] : null
      const label = facet.value === "untiered" ? t("tier_untiered") : facet.value === "none" ? t("tier_none") : facet.label
      return { ...facet, label, count: counts[facet.value] ?? 0, icon: Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden /> : undefined }
    })
  }, [scoped, t])

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
    toast.error(t("post_gone"))
    update((next) => next.delete("open"))
  }, [openId, openItem, update, t])

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
    t,
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
    toast.success(t.plural("exported", rows.length, { count: formatNumber(rows.length) }))
  }

  const missing = rows.length - totals.measured

  return (
    <PageContainer>
      <PageHeader
        title="Post Performance"
        info={t("page_info")}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={hrefWithFilters("/analytics", filters, OVERVIEW_DEFAULTS)}>
                <ChartColumn aria-hidden />
                {t("overview")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download aria-hidden />
              {t("export_csv")}
            </Button>
            <Button size="sm" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
              <Plus aria-hidden />
              {t("add_analytics")}
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
                <SearchInput value={query} onChange={setQuery} placeholder={t("search_posts")} className="sm:w-56" />
                <ColumnMenu visible={columnsState.visible} onToggle={columnsState.toggle} onReset={columnsState.reset} />
              </>
            }
          >
            <FacetFilter
              title={t("format")}
              icon={Shapes}
              options={formatOptions}
              value={formatFilter}
              onChange={(value) => update((next) => setParam(next, "format", value.join(",")))}
            />
            <FacetFilter
              title={t("tier")}
              icon={Trophy}
              options={tierOptions}
              value={tierFilter}
              onChange={(value) => update((next) => setParam(next, "tier", value.join(",")))}
            />
          </AnalyticsFilterBar>
        ) : null}
      </PageHeader>

      {allRows.length ? (
        <section className="flex min-w-0 flex-col gap-2" aria-label={t("posts_aria")}>
          <p className="num text-xs text-muted-foreground">
            {t.plural("summary", rows.length, {
              count: formatNumber(rows.length),
              range: describeRange(range, lang),
              views: formatCompact(totals.views),
              rate: formatPercent(totals.engagementRate),
            })}
            {missing > 0 ? t("summary_missing", { count: formatCompact(missing) }) : null}
          </p>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            onRowClick={(r) => openPost(r.id)}
            rowLabel={(r) => r.item.title || t("untitled_post")}
            defaultSort={{ id: "date", desc: true }}
            stickyHeader
            maxHeight="max(24rem, calc(100dvh - 19rem))"
            pageSize={100}
            aria-label={t("table_aria")}
            empty={
              <EmptyState
                compact
                icon={SearchX}
                title={t("no_match_title")}
                description={t("no_match_description")}
                action={
                  <Button size="sm" variant="outline" onClick={resetAll}>
                    {t("reset_filters")}
                  </Button>
                }
              />
            }
          />
        </section>
      ) : (
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
