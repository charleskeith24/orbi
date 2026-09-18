"use client"

import { useMemo } from "react"
import { DataTable, PillarBadge, Token, type DataTableColumn } from "@/components/common"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ContentPillar, ID, Story } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { storyVaultMessages } from "./messages"
import { useStoryActions } from "./story-actions"
import { StoryActionsMenu } from "./story-actions-menu"
import { FavoriteToggle, StoryTypeBadge } from "./story-badges"
import { storyDay, storyTypeLabel, usageCount, type SourceUsage } from "./story-model"

/** List view: sortable columns, row opens the story. */
export function StoryTable({
  stories,
  usage,
  pillars,
}: {
  stories: Story[]
  usage: ReadonlyMap<ID, SourceUsage>
  pillars: ReadonlyMap<ID, ContentPillar>
}) {
  const actions = useStoryActions()
  const t = useT(storyVaultMessages)
  const columns = useMemo<DataTableColumn<Story>[]>(
    () => [
      {
        id: "title",
        header: t("col_story"),
        sortValue: (s) => s.title.toLowerCase(),
        cell: (s) => (
          <div className="flex max-w-[26rem] min-w-48 flex-col">
            <span className="truncate font-medium">{s.title || t("untitled")}</span>
            <span className="truncate text-xs text-muted-foreground">{s.lesson || t("no_lesson")}</span>
          </div>
        ),
      },
      {
        id: "type",
        header: t("col_type"),
        sortValue: (s) => storyTypeLabel(s.type),
        cell: (s) => <StoryTypeBadge type={s.type} />,
        hideBelow: "sm",
      },
      {
        id: "pillar",
        header: t("col_pillar"),
        sortValue: (s) => (s.pillar_id ? (pillars.get(s.pillar_id)?.name ?? null) : null),
        cell: (s) => <PillarBadge pillar={s.pillar_id ? (pillars.get(s.pillar_id) ?? null) : null} variant="plain" />,
        hideBelow: "md",
      },
      {
        id: "keywords",
        header: t("col_keywords"),
        cell: (s) =>
          s.keywords.length ? (
            <span className="flex max-w-56 flex-wrap gap-1">
              {s.keywords.slice(0, 2).map((keyword) => (
                <Token key={keyword} className="max-w-28 font-normal text-muted-foreground">
                  <span className="truncate">{keyword}</span>
                </Token>
              ))}
              {s.keywords.length > 2 ? <span className="text-xs text-muted-foreground num">+{s.keywords.length - 2}</span> : null}
            </span>
          ) : null,
        hideBelow: "lg",
      },
      {
        id: "date",
        header: t("col_date"),
        sortValue: (s) => storyDay(s),
        cell: (s) => <span className="whitespace-nowrap text-muted-foreground num">{formatDate(storyDay(s), "MMM d, yyyy")}</span>,
        hideBelow: "sm",
      },
      {
        id: "ideas",
        header: t("col_ideas"),
        align: "right",
        sortValue: (s) => usageCount(usage, s.id),
        cell: (s) => {
          const count = usageCount(usage, s.id)
          return count ? formatNumber(count) : <span className="text-muted-foreground">—</span>
        },
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("col_actions")}</span>,
        className: "w-16",
        cell: (s) => (
          <div className="flex items-center justify-end">
            <FavoriteToggle story={s} />
            <StoryActionsMenu story={s} />
          </div>
        ),
      },
    ],
    [pillars, usage, t]
  )

  return (
    <DataTable
      rows={stories}
      columns={columns}
      getRowId={(s) => s.id}
      onRowClick={(s) => actions.open(s.id)}
      rowLabel={(s) => t("open_row", { title: s.title || t("story_fallback") })}
      aria-label={t("stories_label")}
    />
  )
}
