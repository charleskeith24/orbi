"use client"

import { format } from "date-fns"
import Link from "next/link"
import { useMemo } from "react"
import { DataTable, FormatLabel, PillarBadge, PlatformIcon, type DataTableColumn } from "@/components/common"
import { Switch } from "@/components/ui/switch"
import { DAYS_OF_WEEK, SERIES_FREQUENCY_MAP } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import type { ContentSeries } from "@/lib/types"
import { formatCompact, formatNumber } from "@/lib/utils"
import { seriesMessages } from "./messages"
import { setSeriesActive } from "./series-actions"
import { SeriesActionsMenu } from "./series-actions-menu"
import { cadenceLabel, relativeDayLabel } from "./series-schedule"
import { nextEpisodeInfo, type SeriesSummary } from "./series-summary"

const XL_ONLY = "hidden xl:table-cell"

function NextCell({ summary, now }: { summary: SeriesSummary; now: Date }) {
  const t = useT(seriesMessages)
  const lang = useUiLang()
  const next = nextEpisodeInfo(summary)
  const note = !summary.series.is_active ? t("note_paused") : next.planned ? t("note_planned") : t("note_suggested")
  return (
    <div className="flex w-28 flex-col">
      <span className="text-sm num">{format(next.date, "EEE, MMM d")}</span>
      <span className="text-xs text-muted-foreground">
        {relativeDayLabel(next.date, now, lang)} · {note}
      </span>
    </div>
  )
}

function CadenceCell({ series }: { series: ContentSeries }) {
  const t = useT(seriesMessages)
  const day = series.frequency !== "daily" && series.day_of_week !== null ? DAYS_OF_WEEK.find((d) => d.value === series.day_of_week) : null
  return (
    <div className="flex w-28 flex-col gap-1">
      <span className="truncate text-sm">{SERIES_FREQUENCY_MAP[series.frequency]?.label ?? series.frequency}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {day ? <span title={t("day_plural", { day: day.label })}>{day.short}</span> : null}
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
  const t = useT(seriesMessages)
  const lang = useUiLang()
  const columns = useMemo<DataTableColumn<SeriesSummary>[]>(
    () => [
      {
        id: "name",
        header: t("col_series"),
        className: "w-full max-w-0 min-w-36",
        sortValue: (r) => r.series.name.toLowerCase(),
        cell: (r) => (
          <div className="min-w-0">
            <Link
              href={`/series?open=${r.series.id}`}
              scroll={false}
              className="line-clamp-2 font-medium break-words whitespace-normal outline-none hover:underline focus-visible:underline"
            >
              {r.series.name || t("untitled_series")}
            </Link>
            <p className="text-xs text-pretty whitespace-normal text-muted-foreground lg:hidden">
              {t("cadence_next", { cadence: cadenceLabel(r.series, true, lang), when: relativeDayLabel(nextEpisodeInfo(r).date, now, lang) })}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground lg:block" title={r.series.description || undefined}>
              {r.series.description || t("no_description")}
            </p>
          </div>
        ),
      },
      {
        id: "cadence",
        header: t("col_cadence"),
        hideBelow: "lg",
        sortValue: (r) => `${r.series.frequency}-${r.series.day_of_week ?? 9}`,
        cell: (r) => <CadenceCell series={r.series} />,
      },
      {
        id: "defaults",
        header: t("col_defaults"),
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
        header: t("col_episodes"),
        hideBelow: "sm",
        sortValue: (r) => r.published.length,
        cell: (r) => (
          <div className="flex w-24 flex-col" title={t.plural("posts_across", r.posts, { count: formatNumber(r.posts) })}>
            <span className="text-sm num">{t("published_count", { count: r.published.length })}</span>
            <span className="text-xs text-muted-foreground num">{t("planned_count", { count: r.upcoming.length })}</span>
          </div>
        ),
      },
      {
        id: "last",
        header: t("col_last"),
        hideBelow: "md",
        sortValue: (r) => r.lastPublished?.date?.getTime() ?? null,
        cell: (r) =>
          r.lastPublished?.date ? (
            <div className="flex w-24 flex-col">
              <span className="text-sm num">{format(r.lastPublished.date, "MMM d")}</span>
              <span className="text-xs text-muted-foreground">{relativeDayLabel(r.lastPublished.date, now, lang)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t("none_yet")}</span>
          ),
      },
      {
        id: "next",
        header: t("col_next"),
        hideBelow: "md",
        sortValue: (r) => nextEpisodeInfo(r).date.getTime(),
        cell: (r) => <NextCell summary={r} now={now} />,
      },
      {
        id: "avgViews",
        header: t("col_avg_views"),
        align: "right",
        hideBelow: "lg",
        sortValue: (r) => r.avgEpisodeViews,
        cell: (r) =>
          r.avgEpisodeViews === null ? <span className="text-muted-foreground">—</span> : formatCompact(r.avgEpisodeViews),
      },
      {
        id: "active",
        header: t("col_active"),
        sortValue: (r) => r.series.is_active,
        cell: (r) => (
          <Switch
            checked={r.series.is_active}
            onCheckedChange={(next) => setSeriesActive(r.series, next)}
            aria-label={t("active_aria", { name: r.series.name || t("series_fallback") })}
          />
        ),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("col_actions")}</span>,
        className: "w-10 pl-0",
        headerClassName: "w-10",
        cell: (r) => <SeriesActionsMenu summary={r} onEdit={() => onEdit(r.series)} />,
      },
    ],
    [now, onEdit, t, lang]
  )

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(r) => r.series.id}
      onRowClick={(r) => onOpen(r.series.id)}
      rowLabel={(r) => t("open_row", { name: r.series.name || t("series_lower") })}
      rowClassName={(r) => (r.series.is_active ? undefined : "text-muted-foreground")}
      empty={empty}
      aria-label={t("table_label")}
    />
  )
}
