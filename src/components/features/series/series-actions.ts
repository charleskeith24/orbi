"use client"

import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useCallback } from "react"
import { toast } from "sonner"
import { PLATFORMS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { commonMessages } from "@/lib/i18n/messages/common"
import { getUiLang, translate, useT } from "@/lib/i18n"
import { createContentItem, dataActions, useBrand } from "@/lib/store"
import type { ContentItem, ContentSeries, PlatformId } from "@/lib/types"
import { seriesMessages } from "./messages"
import type { SeriesSummary } from "./series-summary"

export function episodeTitle(seriesName: string, number: number): string {
  return `${seriesName.trim() || "Series"} #${number}`
}

/**
 * New content item for the next episode: series defaults (pillar, format, first platform,
 * hook template as the starting hook), due on the next date per frequency and weekday.
 */
export function createNextEpisode(summary: SeriesSummary, fallbackPlatform: PlatformId): ContentItem {
  const { series } = summary
  return createContentItem(
    {
      title: episodeTitle(series.name, summary.episodes.length + 1),
      series_id: series.id,
      pillar_id: series.pillar_id,
      format_id: series.format_id,
      platform: series.platforms[0] ?? fallbackPlatform,
      hook: series.hook_template,
      stage: "brief",
      due_date: toISODate(summary.suggestedNext),
    },
    { objective: series.description }
  )
}

/** Creates the next episode with a toast that links to it in the Content Studio. */
export function useCreateNextEpisode() {
  const router = useRouter()
  const brand = useBrand()
  const t = useT(seriesMessages)
  const c = useT(commonMessages)
  return useCallback(
    (summary: SeriesSummary) => {
      const number = summary.episodes.length + 1
      const item = createNextEpisode(summary, brand.main_platforms[0] ?? "facebook")
      toast.success(t("episode_created", { number }), {
        description: t("episode_created_description", {
          title: item.title,
          date: format(summary.suggestedNext, "EEE, MMM d"),
          platform: PLATFORMS[item.platform].label,
        }),
        action: { label: c("open"), onClick: () => router.push(`/studio/${item.id}`) },
      })
      return item
    },
    [router, brand, t, c]
  )
}

export function setSeriesActive(series: ContentSeries, active: boolean) {
  if (series.is_active === active) return
  dataActions.update("content_series", series.id, { is_active: active })
  toast.success(translate(seriesMessages, getUiLang(), active ? "series_resumed" : "series_paused"), { description: series.name || undefined })
}
