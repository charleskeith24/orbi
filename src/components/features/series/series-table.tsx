"use client"

import { format } from "date-fns"
import Link from "next/link"
import { useMemo } from "react"
import { DataTable, FormatLabel, PillarBadge, PlatformIcon, type DataTableColumn } from "@/components/common"
import { Switch } from "@/components/ui/switch"
import { DAYS_OF_WEEK, SERIES_FREQUENCY_MAP } from "@/lib/constants"
import type { ContentSeries } from "@/lib/types"
import { formatCompact, pluralize } from "@/lib/utils"
import { setSeriesActive } from "./series-actions"
import { SeriesActionsMenu } from "./series-actions-menu"
import { cadenceLabel, relativeDayLabel } from "./series-schedule"
import { nextEpisodeInfo, type SeriesSummary } from "./series-summary"

const XL_ONLY = "hidden xl:table-cell"

function NextCell({ summary, now }: { summary: SeriesSummary; now: Date }) {
  const next = nextEpisodeInfo(summary)
  const note = !summary.series.is_active ? "series paused" : next.planned ? "planned" : "suggested"
  return (
    <div className="flex w-28 flex-col">
      <span className="text-sm num">{format(next.date, "EEE, MMM d")}</span>
      <span className="text-xs text-muted-foreground">
        {relativeDayLabel(next.date, now)} · {note}
      </span>
    </div>
  )
}

function CadenceCell({ series }: { series: ContentSeries }) {
  const day = series.frequency !== "daily" && series.day_of_week !== null ? DAYS_OF_WEEK.find((d) => d.value === series.day_of_week) : null
  return (
    <div className="flex w-28 flex-col gap-1">
      <span className="truncate text-sm">{SERIES_FREQUENCY_MAP[series.frequency]?.label ?? series.frequency}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {day ? <span title={`${day.label}s`}>{day.short}</span> : null}
        {series.platforms.map((p) => (
          <PlatformIcon key={p} platform={p} label className="size-3.5" />
        ))}
      </span>
    </div>
  )
}

export function SeriesTable({
  rows,
  now,
  onOpen,
  onEdit,
  empty,
}: {
  rows: SeriesSummary[]
  now: Date
  onOpen: (id: string) => void
  onEdit: (series: ContentSeries) => void
  empty?: React.ReactNode
}) {
  const columns = useMemo<DataTableColumn<SeriesSummary>[]>(
    () => [
      {
        id: "name",
        header: "Series",
        className: "w-full max-w-0 min-w-36",
        sortValue: (r) => r.series.name.toLowerCase(),
        cell: (r) => (
          <div className="min-w-0">
            <Link
              href={`/series?open=${r.series.id}`}
              scroll={false}
              className="line-clamp-2 font-medium break-words whitespace-normal outline-none hover:underline focus-visible:underline"
            >
              {r.series.name || "Untitled series"}
            </Link>
            <p className="text-xs text-pretty whitespace-normal text-muted-foreground lg:hidden">
              {cadenceLabel(r.series, true)} · next {relativeDayLabel(nextEpisodeInfo(r).date, now)}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground lg:block" title={r.series.description || undefined}>
              {r.series.description || "No description yet"}
            </p>
          </div>
        ),
      },
      {
        id: "cadence",
        header: "Cadence",
        hideBelow: "lg",
        sortValue: (r) => `${r.series.frequency}-${r.series.day_of_week ?? 9}`,
        cell: (r) => <CadenceCell series={r.series} />,
      },
      {
        id: "defaults",
        header: "Pillar & format",
        className: XL_ONLY,
        headerClassName: XL_ONLY,
        cell: (r) => (
          <div className="flex w-36 flex-col items-start gap-1">
            <PillarBadge pillarId={r.series.pillar_id} variant="plain" className="max-w-full" />
            <FormatLabel formatId={r.series.format_id} className="max-w-full" />
          </div>
        ),
      },
      {
        id: "episodes",
        header: "Episodes",
        hideBelow: "sm",
        sortValue: (r) => r.published.length,
        cell: (r) => (
          <div className="flex w-24 flex-col" title={`${pluralize(r.posts, "post")} across platforms`}>
            <span className="text-sm num">{r.published.length} published</span>
            <span className="text-xs text-muted-foreground num">{r.upcoming.length} planned</span>
          </div>
        ),
      },
      {
        id: "last",
        header: "Last episode",
        hideBelow: "md",
        sortValue: (r) => r.lastPublished?.date?.getTime() ?? null,
        cell: (r) =>
          r.lastPublished?.date ? (
            <div className="flex w-24 flex-col">
              <span className="text-sm num">{format(r.lastPublished.date, "MMM d")}</span>
              <span className="text-xs text-muted-foreground">{relativeDayLabel(r.lastPublished.date, now)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">None yet</span>
          ),
      },
      {
        id: "next",
        header: "Next episode",
        hideBelow: "md",
        sortValue: (r) => nextEpisodeInfo(r).date.getTime(),
        cell: (r) => <NextCell summary={r} now={now} />,
      },
      {
        id: "avgViews",
        header: "Views / ep.",
        align: "right",
        hideBelow: "lg",
        sortValue: (r) => r.avgEpisodeViews,
        cell: (r) =>
          r.avgEpisodeViews === null ? <span className="text-muted-foreground">—</span> : formatCompact(r.avgEpisodeViews),
      },
      {
        id: "active",
        header: "Active",
        sortValue: (r) => r.series.is_active,
        cell: (r) => (
          <Switch
            checked={r.series.is_active}
            onCheckedChange={(next) => setSeriesActive(r.series, next)}
            aria-label={`${r.series.name || "Series"} active`}
          />
        ),
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-10 pl-0",
        headerClassName: "w-10",
        cell: (r) => <SeriesActionsMenu summary={r} onEdit={() => onEdit(r.series)} />,
      },
    ],
    [now, onEdit]
  )

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(r) => r.series.id}
      onRowClick={(r) => onOpen(r.series.id)}
      rowLabel={(r) => `Open ${r.series.name || "series"}`}
      rowClassName={(r) => (r.series.is_active ? undefined : "text-muted-foreground")}
      empty={empty}
      aria-label="Series"
    />
  )
}
