"use client"

import { Plus, Repeat } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import {
  EmptyState,
  FacetFilter,
  FilterBar,
  PageContainer,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  StatTile,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { SERIES_FREQUENCIES } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import type { ContentSeries } from "@/lib/types"
import { formatCompact, formatNumber, matchesQuery } from "@/lib/utils"
import { seriesMessages } from "./messages"
import { SeriesDetailSheet } from "./series-detail-sheet"
import { SeriesFormDialog } from "./series-form-dialog"
import { relativeDayLabel } from "./series-schedule"
import { SeriesTable } from "./series-table"
import { nextEpisodeInfo, recentEpisodes, summarizeAllSeries } from "./series-summary"

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const STATUS_OPTIONS = [
  { value: "active", label: "status_active" },
  { value: "paused", label: "status_paused" },
] as const

export function SeriesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useT(seriesMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())

  const [query, setQuery] = useState("")
  const [statuses, setStatuses] = useState<string[]>([])
  const [frequencies, setFrequencies] = useState<string[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; series: ContentSeries | null }>({ open: false, series: null })

  const summaries = useMemo(() => summarizeAllSeries(db, now, settings), [db, now, settings])

  // `?open=<id>` drives the detail sheet; keep the last one mounted while the sheet animates out.
  const openId = searchParams.get("open")
  const openSummary = openId ? (summaries.find((s) => s.series.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<string | null>(openId)
  if (openSummary && openId !== shownId) setShownId(openId)
  const shownSummary = summaries.find((s) => s.series.id === shownId) ?? null

  const setOpen = useCallback(
    (id: string | null) => router.replace(id ? `/series?open=${id}` : "/series", { scroll: false }),
    [router]
  )

  const stats = useMemo(() => {
    const active = summaries.filter((s) => s.series.is_active)
    const published = summaries.flatMap((s) => s.published)
    const recent = summaries.reduce((acc, s) => acc + recentEpisodes(s, now), 0)
    const withViews = published.filter((e) => e.views !== null)
    const views = withViews.reduce((acc, e) => acc + (e.views ?? 0), 0)
    const next = active
      .map((s) => ({ summary: s, info: nextEpisodeInfo(s) }))
      .sort((a, b) => a.info.date.getTime() - b.info.date.getTime())[0]
    return {
      active: active.length,
      paused: summaries.length - active.length,
      published: published.length,
      recent,
      measured: withViews.length,
      views,
      next,
    }
  }, [summaries, now])

  const filtered = useMemo(
    () =>
      summaries.filter(
        (s) =>
          (!statuses.length || statuses.includes(s.series.is_active ? "active" : "paused")) &&
          (!frequencies.length || frequencies.includes(s.series.frequency)) &&
          matchesQuery(query, s.series.name, s.series.description, s.series.hook_template)
      ),
    [summaries, statuses, frequencies, query]
  )

  const statusOptions = STATUS_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.label),
    count: summaries.filter((s) => (s.series.is_active ? "active" : "paused") === o.value).length,
  }))
  const frequencyOptions = SERIES_FREQUENCIES.map((f) => ({
    value: f.id,
    label: f.label,
    count: summaries.filter((s) => s.series.frequency === f.id).length,
  }))
  const filtering = Boolean(query || statuses.length || frequencies.length)
  const resetFilters = () => {
    setQuery("")
    setStatuses([])
    setFrequencies([])
  }

  const openCreate = () => setDialog({ open: true, series: null })
  const openEdit = useCallback((series: ContentSeries) => setDialog({ open: true, series }), [])

  return (
    <PageContainer>
      <PageHeader
        title="Series"
        info={t("info")}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            {t("new_series")}
          </Button>
        }
      />

      {summaries.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              size="sm"
              label={t("stat_active")}
              value={formatNumber(stats.active)}
              sublabel={stats.paused ? t("stat_paused", { count: stats.paused }) : undefined}
            />
            <StatTile
              size="sm"
              label={t("stat_published")}
              value={formatNumber(stats.published)}
              sublabel={t("stat_recent", { count: formatNumber(stats.recent) })}
            />
            <StatTile
              size="sm"
              label={t("stat_next")}
              value={stats.next ? capitalize(relativeDayLabel(stats.next.info.date, now, lang)) : "—"}
              sublabel={stats.next ? stats.next.summary.series.name : t("stat_no_active")}
              href={stats.next ? `/series?open=${stats.next.summary.series.id}` : undefined}
            />
            <StatTile
              size="sm"
              label={t("stat_avg_views")}
              value={stats.measured ? formatCompact(stats.views / stats.measured) : "—"}
              sublabel={stats.measured ? t("stat_measured", { count: formatNumber(stats.measured) }) : t("stat_no_analytics")}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === summaries.length
                    ? t("count_series", { count: summaries.length })
                    : t("count_of", { shown: filtered.length, total: summaries.length })}
                </span>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder={t("search_placeholder")} />
              <FacetFilter title={t("facet_status")} options={statusOptions} value={statuses} onChange={setStatuses} />
              <FacetFilter title={t("facet_frequency")} options={frequencyOptions} value={frequencies} onChange={setFrequencies} />
              <ResetFiltersButton show={filtering} onClick={resetFilters} />
            </FilterBar>
            <SeriesTable
              rows={filtered}
              now={now}
              onOpen={setOpen}
              onEdit={openEdit}
              empty={
                <EmptyState
                  compact
                  icon={Repeat}
                  title={t("no_matches_title")}
                  description={t("no_matches_description")}
                  action={
                    <Button size="sm" variant="outline" onClick={resetFilters}>
                      {t("reset_filters")}
                    </Button>
                  }
                />
              }
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Repeat}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden />
              {t("new_series")}
            </Button>
          }
        />
      )}

      <SeriesDetailSheet
        summary={shownSummary}
        open={Boolean(openSummary)}
        now={now}
        onOpenChange={(open) => {
          if (!open) setOpen(null)
        }}
        onEdit={openEdit}
        onBeforeDelete={() => setOpen(null)}
      />

      <SeriesFormDialog
        open={dialog.open}
        series={dialog.series}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={(row, created) => {
          if (created) setOpen(row.id)
        }}
      />
    </PageContainer>
  )
}
