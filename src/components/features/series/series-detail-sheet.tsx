"use client"

import { format } from "date-fns"
import { FilePlus2, ListVideo, Pencil } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  contentDateInfo,
  DefinitionList,
  DetailSheet,
  EmptyState,
  FormatLabel,
  KeyValue,
  PillarBadge,
  PlatformIcon,
  PlatformLabel,
  StageBadge,
  TierBadge,
} from "@/components/common"
import { ColumnChart } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { PLATFORMS } from "@/lib/constants"
import { useBrand, useRow } from "@/lib/store"
import type { ContentSeries } from "@/lib/types"
import { cn, formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { episodeTitle, setSeriesActive, useCreateNextEpisode } from "./series-actions"
import { SeriesActionsMenu } from "./series-actions-menu"
import { cadenceLabel } from "./series-schedule"
import type { Episode, SeriesSummary } from "./series-summary"

const PUBLISHED_LIMIT = 8
/** ColumnChart labels every column up to 12; 8 date labels still fit a phone-width sheet. */
const CHART_EPISODES = 8

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2" title={hint}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold num">{value}</span>
    </div>
  )
}

function NextEpisodePanel({ summary }: { summary: SeriesSummary }) {
  const brand = useBrand()
  const createEpisode = useCreateNextEpisode()
  const { series, nextPlanned, suggestedNext } = summary
  const number = summary.episodes.length + 1
  const platform = series.platforms[0] ?? brand.main_platforms[0] ?? "facebook"

  return (
    <section aria-label="Next episode" className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs text-muted-foreground">{nextPlanned ? "Next planned episode" : "No upcoming episode planned"}</p>
          {nextPlanned?.date ? (
            <p className="mt-0.5 text-sm">
              <span className="font-medium">
                #{nextPlanned.number} · {format(nextPlanned.date, "EEE, MMM d")}
              </span>{" "}
              <Link
                href={`/studio/${nextPlanned.primary.id}`}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {nextPlanned.primary.title || "Untitled"}
              </Link>
            </p>
          ) : (
            <p className="mt-0.5 text-sm font-medium">Suggested: {format(suggestedNext, "EEEE, MMM d")}</p>
          )}
        </div>
        <Button type="button" size="sm" onClick={() => createEpisode(summary)}>
          <FilePlus2 aria-hidden />
          Create episode #{number}
        </Button>
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        Creates “{episodeTitle(series.name, number)}” due {format(suggestedNext, "EEE, MMM d")} on {PLATFORMS[platform].label}
        {series.hook_template ? <> with the starting hook “{series.hook_template}”</> : null}.
        {!series.is_active ? " This series is paused." : ""}
      </p>
    </section>
  )
}

function EpisodeRow({ episode, now }: { episode: Episode; now: Date }) {
  const { primary } = episode
  const info = contentDateInfo(primary, now)
  const Icon = info?.icon
  return (
    <li className="flex min-w-0 items-center gap-3 py-2">
      <span className="w-7 shrink-0 text-xs text-muted-foreground num">#{episode.number}</span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/studio/${primary.id}`}
          className="block truncate text-sm outline-none hover:underline focus-visible:underline"
          title={primary.title}
        >
          {primary.title || "Untitled content"}
        </Link>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs">
          <span className="flex shrink-0 items-center gap-1">
            {episode.items.map((item) => (
              <Link
                key={item.id}
                href={`/studio/${item.id}`}
                aria-label={`Open the ${PLATFORMS[item.platform].label} version`}
                title={PLATFORMS[item.platform].label}
                className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <PlatformIcon platform={item.platform} className="size-3.5" />
              </Link>
            ))}
          </span>
          {info && Icon ? (
            <span
              title={info.title}
              className={cn(
                "inline-flex min-w-0 items-center gap-1 truncate",
                info.overdue ? "font-medium text-critical-fg" : "text-muted-foreground"
              )}
            >
              <Icon className="size-3 shrink-0" aria-hidden />
              {info.label}
            </span>
          ) : (
            <span className="text-muted-foreground">No date yet</span>
          )}
        </div>
      </div>
      {episode.published ? (
        <>
          <TierBadge tier={episode.tier} />
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground num">
            {episode.views === null ? "No data" : `${formatCompact(episode.views)} views`}
          </span>
        </>
      ) : (
        <StageBadge stage={primary.stage} />
      )}
    </li>
  )
}

function SeriesPerformance({ summary }: { summary: SeriesSummary }) {
  const pillar = useRow("content_pillars", summary.series.pillar_id)
  const { totals, best } = summary
  const charted = summary.published.filter((e) => e.views !== null).slice(-CHART_EPISODES)

  if (!summary.published.length) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
        Performance appears once episodes are published and their analytics are logged.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat
          label="Episodes live"
          value={formatNumber(summary.published.length)}
          hint={`${pluralize(totals.posts, "post")} across platforms`}
        />
        <MiniStat label="Total views" value={formatCompact(totals.views)} />
        <MiniStat
          label="Views / episode"
          value={summary.avgEpisodeViews === null ? "—" : formatCompact(summary.avgEpisodeViews)}
          hint="Platform versions of an episode are added together"
        />
        <MiniStat label="Engagement rate" value={formatPercent(totals.engagementRate)} />
      </div>
      {charted.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Views per episode · last {pluralize(charted.length, "episode")} with analytics</p>
          <ColumnChart
            height={150}
            color={pillar?.color ?? "blue"}
            valueLabel="Views"
            highlight={best?.key}
            aria-label="Views per episode"
            data={charted.map((e) => ({
              id: e.key,
              label: e.date ? format(e.date, "MMM d") : `#${e.number}`,
              value: e.views ?? 0,
            }))}
          />
        </div>
      ) : null}
      {best ? (
        <p className="text-xs text-pretty text-muted-foreground">
          Best episode:{" "}
          <Link href={`/studio/${best.primary.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            {best.primary.title || "Untitled"}
          </Link>{" "}
          · {formatCompact(best.views)} views
          {best.engagementRate !== null ? ` · ${formatPercent(best.engagementRate)} engagement` : ""}
          {totals.leads ? ` · ${pluralize(totals.leads, "lead")} across the series` : ""}
        </p>
      ) : null}
    </div>
  )
}

function Episodes({ summary, now }: { summary: SeriesSummary; now: Date }) {
  const [showAll, setShowAll] = useState(false)
  const published = [...summary.published].reverse()
  const shown = showAll ? published : published.slice(0, PUBLISHED_LIMIT)

  if (!summary.episodes.length) {
    return (
      <EmptyState
        compact
        icon={ListVideo}
        title="No episodes yet"
        description="Create the first episode above — it starts with the series pillar, format, platform and hook."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {summary.upcoming.length ? (
        <div>
          <h4 className="border-b pb-1.5 text-xs font-medium text-muted-foreground">Upcoming · {summary.upcoming.length}</h4>
          <ul className="divide-y divide-border/60">
            {summary.upcoming.map((e) => (
              <EpisodeRow key={e.key} episode={e} now={now} />
            ))}
          </ul>
        </div>
      ) : null}
      {published.length ? (
        <div>
          <h4 className="border-b pb-1.5 text-xs font-medium text-muted-foreground">Published · {published.length}</h4>
          <ul className="divide-y divide-border/60">
            {shown.map((e) => (
              <EpisodeRow key={e.key} episode={e} now={now} />
            ))}
          </ul>
          {published.length > PUBLISHED_LIMIT ? (
            <Button type="button" variant="ghost" size="xs" className="mt-1 text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : `Show all ${published.length}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** `/series?open=<id>` — next episode, properties, performance and every episode of one series. */
export function SeriesDetailSheet({
  summary,
  open,
  now,
  onOpenChange,
  onEdit,
  onBeforeDelete,
}: {
  summary: SeriesSummary | null
  open: boolean
  now: Date
  onOpenChange: (open: boolean) => void
  onEdit: (series: ContentSeries) => void
  onBeforeDelete: () => void
}) {
  if (!summary) return null
  const { series } = summary

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={series.name || "Untitled series"}
      description={`${cadenceLabel(series)}${series.is_active ? "" : " · paused"} · ${pluralize(summary.episodes.length, "episode")}`}
      actions={
        <>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit series" onClick={() => onEdit(series)}>
            <Pencil aria-hidden />
          </Button>
          <SeriesActionsMenu summary={summary} onEdit={() => onEdit(series)} onBeforeDelete={onBeforeDelete} showCreate={false} />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <NextEpisodePanel summary={summary} />

        <section aria-label="Series details" className="flex flex-col gap-3">
          {series.description ? <p className="text-sm text-pretty">{series.description}</p> : null}
          <DefinitionList>
            <KeyValue label="Frequency">{cadenceLabel(series)}</KeyValue>
            <KeyValue label="Platforms">
              {series.platforms.length ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {series.platforms.map((p, i) => (
                    <PlatformLabel key={p} platform={p} className={cn(i > 0 && "text-muted-foreground")} />
                  ))}
                </span>
              ) : null}
            </KeyValue>
            <KeyValue label="Default pillar">
              <PillarBadge pillarId={series.pillar_id} />
            </KeyValue>
            <KeyValue label="Default format">
              <FormatLabel formatId={series.format_id} className="text-sm text-foreground" />
            </KeyValue>
            <KeyValue label="Hook template">
              {series.hook_template ? <span className="text-pretty">“{series.hook_template}”</span> : null}
            </KeyValue>
            <KeyValue label="Active">
              <Switch
                checked={series.is_active}
                onCheckedChange={(next) => setSeriesActive(series, next)}
                aria-label={`${series.name || "Series"} active`}
              />
              <span className="text-xs text-muted-foreground">{series.is_active ? "Active" : "Paused"}</span>
            </KeyValue>
          </DefinitionList>
        </section>

        <section aria-labelledby="series-performance" className="flex flex-col gap-3">
          <h3 id="series-performance" className="text-sm font-medium">
            Performance
          </h3>
          <SeriesPerformance summary={summary} />
        </section>

        <section aria-labelledby="series-episodes" className="flex flex-col gap-2">
          <h3 id="series-episodes" className="text-sm font-medium">
            Episodes
          </h3>
          <Episodes summary={summary} now={now} />
        </section>
      </div>
    </DetailSheet>
  )
}
