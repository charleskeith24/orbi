"use client"

import { ChartNoAxesColumn } from "lucide-react"
import { useMemo } from "react"
import { ContentThumbnail, keywordFilter, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { isPublishedItem, publishedAtOf } from "@/lib/analytics"
import { PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { contentItemDate, formatDate, formatShortDate } from "@/lib/dates"
import type { ContentItem, ContentMetric, ID } from "@/lib/types"

const titleOf = (item: Pick<ContentItem, "title">) => item.title.trim() || "Untitled content"

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
      <span className="min-w-0 flex-1 truncate">{titleOf(item)}</span>
      {live && !latest.has(item.id) ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <ChartNoAxesColumn className="size-3" aria-hidden />
          No numbers yet
        </span>
      ) : null}
      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground num">
        {at ? formatShortDate(new Date(at)) : live ? "" : PIPELINE_STAGE_MAP[item.stage]?.label}
      </span>
    </CommandItem>
  )

  return (
    <Command filter={keywordFilter} label="Choose a post" className="rounded-lg border bg-card dark:bg-input/20">
      <CommandInput autoFocus placeholder="Search your posts…" />
      <CommandList className="max-h-[min(18rem,45dvh)]">
        <CommandEmpty>No posts match.</CommandEmpty>
        {published.length ? <CommandGroup heading="Published">{published.map((entry) => row(entry, true))}</CommandGroup> : null}
        {upcoming.length ? (
          <CommandGroup heading="Ready or scheduled — saving marks it published">
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
  const publishedAt = isPublishedItem(item) ? publishedAtOf(item) : null
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/25 p-2.5 dark:bg-muted/15">
      <ContentThumbnail item={item} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={titleOf(item)}>
          {titleOf(item)}
        </p>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <PlatformIcon platform={item.platform} className="size-3.5" />
            {PLATFORMS[item.platform].label}
          </span>
          <span aria-hidden>·</span>
          <span>
            {publishedAt
              ? `Published ${formatDate(publishedAt, "MMM d")}`
              : `${PIPELINE_STAGE_MAP[item.stage]?.label ?? "Not live"} — saving marks it published`}
          </span>
          {previous ? (
            <>
              <span aria-hidden>·</span>
              <span>Last logged {formatDate(previous.recorded_at, "MMM d")}</span>
            </>
          ) : null}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  )
}
