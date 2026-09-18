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
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useBrand, useRow } from "@/lib/store"
import type { ContentSeries } from "@/lib/types"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { seriesMessages } from "./messages"
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
  const t = useT(seriesMessages)
  const brand = useBrand()
  const createEpisode = useCreateNextEpisode()
  const { series, nextPlanned, suggestedNext } = summary
  const number = summary.episodes.length + 1
  const platform = series.platforms[0] ?? brand.main_platforms[0] ?? "facebook"

  return (
    <section aria-label={t("next_episode")} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs text-muted-foreground">{nextPlanned ? t("next_planned") : t("none_planned")}</p>
          {nextPlanned?.date ? (
            <p className="mt-0.5 text-sm">
              <span className="font-medium">
                #{nextPlanned.number} · {format(nextPlanned.date, "EEE, MMM d")}
              </span>{" "}
              <Link
                href={`/studio/${nextPlanned.primary.id}`}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {nextPlanned.primary.title || t("untitled")}
              </Link>
            </p>
          ) : (
            <p className="mt-0.5 text-sm font-medium">{t("suggested", { date: format(suggestedNext, "EEEE, MMM d") })}</p>
          )}
        </div>
        <Button type="button" size="sm" onClick={() => createEpisode(summary)}>
          <FilePlus2 aria-hidden />
          {t("create_episode", { number })}
        </Button>
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {t("creates_episode", {
          title: episodeTitle(series.name, number),
          date: format(suggestedNext, "EEE, MMM d"),
          platform: PLATFORMS[platform].label,
          hook: series.hook_template ? t("creates_hook", { hook: series.hook_template }) : "",
        })}
        {!series.is_active ? t("creates_paused") : ""}
      </p>
    </section>
  )
}

function EpisodeRow({ episode, now }: { episode: Episode; now: Date }) {
  const t = useT(seriesMessages)
  const lang = useUiLang()
  const { primary } = episode
  const info = contentDateInfo(primary, now, lang)
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
          {primary.title || t("untitled_content")}
        </Link>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs">
          <span className="flex shrink-0 items-center gap-1">
            {episode.items.map((item) => (
              <Link
                key={item.id}
                href={`/studio/${item.id}`}
                aria-label={t("open_version", { platform: PLATFORMS[item.platform].label })}
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
            <span className="text-muted-foreground">{t("no_date_yet")}</span>
          )}
        </div>
      </div>
      {episode.published ? (
        <>
          <TierBadge tier={episode.tier} />
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground num">
            {episode.views === null ? t("no_data") : t("views", { count: formatCompact(episode.views) })}
          </span>
        </>
      ) : (
        <StageBadge stage={primary.stage} />
      )}
    </li>
  )
}

function SeriesPerformance({ summary }: { summary: SeriesSummary }) {
  const t = useT(seriesMessages)
  const pillar = useRow("content_pillars", summary.series.pillar_id)
  const { totals, best } = summary
  const charted = summary.published.filter((e) => e.views !== null).slice(-CHART_EPISODES)

  if (!summary.published.length) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
        {t("performance_empty")}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat
          label={t("episodes_live")}
          value={formatNumber(summary.published.length)}
          hint={t.plural("posts_across", totals.posts, { count: formatNumber(totals.posts) })}
        />
        <MiniStat label={t("total_views")} value={formatCompact(totals.views)} />
        <MiniStat
          label={t("views_per_episode")}
          value={summary.avgEpisodeViews === null ? "—" : formatCompact(summary.avgEpisodeViews)}
          hint={t("views_per_episode_hint")}
        />
        <MiniStat label={t("engagement_rate")} value={formatPercent(totals.engagementRate)} />
      </div>
      {charted.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t.plural("chart_title", charted.length, { count: formatNumber(charted.length) })}</p>
          <ColumnChart
            height={150}
            color={pillar?.color ?? "blue"}
            valueLabel={t("chart_value")}
            highlight={best?.key}
            aria-label={t("chart_aria")}
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
          {t("best_episode")}{" "}
          <Link href={`/studio/${best.primary.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            {best.primary.title || t("untitled")}
          </Link>{" "}
          {t("best_views", { count: formatCompact(best.views) })}
          {best.engagementRate !== null ? t("best_engagement", { rate: formatPercent(best.engagementRate) }) : ""}
          {totals.leads ? t.plural("best_leads", totals.leads, { count: formatNumber(totals.leads) }) : ""}
        </p>
      ) : null}
    </div>
  )
}

function Episodes({ summary, now }: { summary: SeriesSummary; now: Date }) {
  const t = useT(seriesMessages)
  const c = useT(commonMessages)
  const [showAll, setShowAll] = useState(false)
  const published = [...summary.published].reverse()
  const shown = showAll ? published : published.slice(0, PUBLISHED_LIMIT)

  if (!summary.episodes.length) {
    return (
      <EmptyState
        compact
        icon={ListVideo}
        title={t("no_episodes")}
        description={t("no_episodes_description")}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {summary.upcoming.length ? (
        <div>
          <h4 className="border-b pb-1.5 text-xs font-medium text-muted-foreground">{t("upcoming_count", { count: summary.upcoming.length })}</h4>
          <ul className="divide-y divide-border/60">
            {summary.upcoming.map((e) => (
              <EpisodeRow key={e.key} episode={e} now={now} />
            ))}
          </ul>
        </div>
      ) : null}
      {published.length ? (
        <div>
          <h4 className="border-b pb-1.5 text-xs font-medium text-muted-foreground">{t("published_heading", { count: published.length })}</h4>
          <ul className="divide-y divide-border/60">
            {shown.map((e) => (
              <EpisodeRow key={e.key} episode={e} now={now} />
            ))}
          </ul>
          {published.length > PUBLISHED_LIMIT ? (
            <Button type="button" variant="ghost" size="xs" className="mt-1 text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
              {showAll ? c("show_less") : t("show_all", { count: published.length })}
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
  const t = useT(seriesMessages)
  const lang = useUiLang()
  if (!summary) return null
  const { series } = summary

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={series.name || t("untitled_series")}
      description={t.plural("sheet_description", summary.episodes.length, {
        cadence: cadenceLabel(series, false, lang),
        paused: series.is_active ? "" : t("paused_suffix"),
        count: formatNumber(summary.episodes.length),
      })}
      actions={
        <>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("edit_series_aria")} onClick={() => onEdit(series)}>
            <Pencil aria-hidden />
          </Button>
          <SeriesActionsMenu summary={summary} onEdit={() => onEdit(series)} onBeforeDelete={onBeforeDelete} showCreate={false} />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <NextEpisodePanel summary={summary} />

        <section aria-label={t("details_aria")} className="flex flex-col gap-3">
          {series.description ? <p className="text-sm text-pretty">{series.description}</p> : null}
          <DefinitionList>
            <KeyValue label={t("frequency")}>{cadenceLabel(series, false, lang)}</KeyValue>
            <KeyValue label={t("platforms")}>
              {series.platforms.length ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {series.platforms.map((p, i) => (
                    <PlatformLabel key={p} platform={p} className={cn(i > 0 && "text-muted-foreground")} />
                  ))}
                </span>
              ) : null}
            </KeyValue>
            <KeyValue label={t("default_pillar")}>
              <PillarBadge pillarId={series.pillar_id} />
            </KeyValue>
            <KeyValue label={t("default_format")}>
              <FormatLabel formatId={series.format_id} className="text-sm text-foreground" />
            </KeyValue>
            <KeyValue label={t("hook_template")}>
              {series.hook_template ? <span className="text-pretty">“{series.hook_template}”</span> : null}
            </KeyValue>
            <KeyValue label={t("active")}>
              <Switch
                checked={series.is_active}
                onCheckedChange={(next) => setSeriesActive(series, next)}
                aria-label={t("active_aria", { name: series.name || t("series_fallback") })}
              />
              <span className="text-xs text-muted-foreground">{series.is_active ? t("active") : t("paused")}</span>
            </KeyValue>
          </DefinitionList>
        </section>

        <section aria-labelledby="series-performance" className="flex flex-col gap-3">
          <h3 id="series-performance" className="text-sm font-medium">
            {t("performance")}
          </h3>
          <SeriesPerformance summary={summary} />
        </section>

        <section aria-labelledby="series-episodes" className="flex flex-col gap-2">
          <h3 id="series-episodes" className="text-sm font-medium">
            {t("episodes")}
          </h3>
          <Episodes summary={summary} now={now} />
        </section>
      </div>
    </DetailSheet>
  )
}
