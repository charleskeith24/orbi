"use client"

import { format } from "date-fns"
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
import { useDb, useSettings } from "@/lib/store"
import type { ContentSeries } from "@/lib/types"
import { formatCompact, formatNumber, matchesQuery } from "@/lib/utils"
import { SeriesDetailSheet } from "./series-detail-sheet"
import { SeriesFormDialog } from "./series-form-dialog"
import { relativeDayLabel } from "./series-schedule"
import { SeriesTable } from "./series-table"
import { nextEpisodeInfo, recentEpisodes, summarizeAllSeries } from "./series-summary"

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
]

export function SeriesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    ...o,
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
        description="Recurring formats your audience can look forward to — each episode starts from the series defaults."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            New series
          </Button>
        }
      />

      {summaries.length ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Active series"
              value={formatNumber(stats.active)}
              sublabel={stats.paused ? `${stats.paused} paused` : "None paused"}
            />
            <StatTile
              label="Episodes published"
              value={formatNumber(stats.published)}
              sublabel={`${formatNumber(stats.recent)} in the last 30 days`}
            />
            <StatTile
              label="Next episode"
              value={stats.next ? capitalize(relativeDayLabel(stats.next.info.date, now)) : "—"}
              sublabel={
                stats.next
                  ? `${stats.next.summary.series.name} · ${format(stats.next.info.date, "EEE, MMM d")}`
                  : "No active series"
              }
              href={stats.next ? `/series?open=${stats.next.summary.series.id}` : undefined}
            />
            <StatTile
              label="Avg. views per episode"
              value={stats.measured ? formatCompact(stats.views / stats.measured) : "—"}
              sublabel={stats.measured ? `${formatNumber(stats.measured)} episodes with analytics` : "No analytics logged yet"}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === summaries.length ? `${summaries.length} series` : `${filtered.length} of ${summaries.length}`}
                </span>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder="Search series…" />
              <FacetFilter title="Status" options={statusOptions} value={statuses} onChange={setStatuses} />
              <FacetFilter title="Frequency" options={frequencyOptions} value={frequencies} onChange={setFrequencies} />
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
                  title="No series match"
                  description="Try a different search, status or frequency."
                  action={
                    <Button size="sm" variant="outline" onClick={resetFilters}>
                      Reset filters
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
          title="No series yet"
          description="A series is a recurring format — a weekly lesson, a Friday diary — that builds habit in your audience and makes planning automatic."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden />
              New series
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
