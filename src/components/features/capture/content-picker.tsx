"use client"

import { ChartNoAxesColumn } from "lucide-react"
import { useMemo } from "react"
import { ContentThumbnail, keywordFilter, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { isPublishedItem, publishedAtOf } from "@/lib/analytics"
import { PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { contentItemDate, formatDate, formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ContentItem, ContentMetric, ID } from "@/lib/types"
import { captureMessages } from "./capture-messages"

const titleOf = (item: Pick<ContentItem, "title">, untitled: string) => item.title.trim() || untitled

/**
 * Searchable post picker: published posts first (newest first), then anything ready or scheduled.
 * A chart glyph marks posts that already have analytics.
 */
export function ContentPicker({
  items,
  latest,
  onSelect,
}: {
  items: ContentItem[]
  latest: Map<ID, ContentMetric>
  onSelect: (id: ID) => void
}) {
  const t = useT(captureMessages)
  const { published, upcoming } = useMemo(() => {
    const dated = (item: ContentItem, date: Date | null) => ({ item, at: date?.getTime() ?? 0 })
    return {
      published: items
        .filter(isPublishedItem)
        .map((item) => dated(item, publishedAtOf(item)))
        .sort((a, b) => b.at - a.at),
      upcoming: items
        .filter((item) => !isPublishedItem(item))
        .map((item) => dated(item, contentItemDate(item)))
        .sort((a, b) => a.at - b.at),
    }
  }, [items])

  const row = ({ item, at }: { item: ContentItem; at: number }, live: boolean) => (
    <CommandItem
      key={item.id}
      value={item.id}
      keywords={[item.title, PLATFORMS[item.platform].label]}
      onSelect={() => onSelect(item.id)}
      className="gap-2.5"
    >
      <PlatformIcon platform={item.platform} label className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{titleOf(item, t("untitled_content"))}</span>
      {live && !latest.has(item.id) ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <ChartNoAxesColumn className="size-3" aria-hidden />
          {t("no_numbers")}
        </span>
      ) : null}
      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground num">
        {at ? formatShortDate(new Date(at)) : live ? "" : PIPELINE_STAGE_MAP[item.stage]?.label}
      </span>
    </CommandItem>
  )

  return (
    <Command filter={keywordFilter} label={t("choose_post")} className="rounded-lg border bg-card dark:bg-input/20">
      <CommandInput autoFocus placeholder={t("search_posts")} />
      <CommandList className="max-h-[min(18rem,45dvh)]">
        <CommandEmpty>{t("no_posts")}</CommandEmpty>
        {published.length ? <CommandGroup heading={t("group_published")}>{published.map((entry) => row(entry, true))}</CommandGroup> : null}
        {upcoming.length ? (
          <CommandGroup heading={t("group_upcoming")}>
            {upcoming.map((entry) => row(entry, false))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}

/** The chosen post, with where it stands and when numbers were last logged. */
export function SelectedContent({
  item,
  previous,
  onChange,
}: {
  item: ContentItem
  previous?: ContentMetric
  onChange: () => void
}) {
  const t = useT(captureMessages)
  const publishedAt = isPublishedItem(item) ? publishedAtOf(item) : null
  const title = titleOf(item, t("untitled_content"))
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/25 p-2.5 dark:bg-muted/15">
      <ContentThumbnail item={item} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <PlatformIcon platform={item.platform} className="size-3.5" />
            {PLATFORMS[item.platform].label}
          </span>
          <span aria-hidden>·</span>
          <span>
            {publishedAt
              ? t("published_on", { date: formatDate(publishedAt, "MMM d") })
              : t("marks_published", { stage: PIPELINE_STAGE_MAP[item.stage]?.label ?? t("not_live") })}
          </span>
          {previous ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("last_logged", { date: formatDate(previous.recorded_at, "MMM d") })}</span>
            </>
          ) : null}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange}>
        {t("change")}
      </Button>
    </div>
  )
}
