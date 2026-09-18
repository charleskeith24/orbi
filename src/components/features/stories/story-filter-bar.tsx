"use client"

import { LayoutGrid, List, Star } from "lucide-react"
import { useMemo } from "react"
import {
  ColorDot,
  FacetFilter,
  FilterBar,
  OptionSelect,
  ResetFiltersButton,
  SearchInput,
  ViewToggle,
  type FacetOption,
  type ViewOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { STORY_TYPES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { ContentPillar, ID, Story } from "@/lib/types"
import { cn } from "@/lib/utils"
import { storyVaultMessages } from "./messages"
import { STORY_TYPE_ICONS } from "./story-badges"
import {
  hasStoryFilters,
  NO_PILLAR,
  STORY_SORTS,
  usageCount,
  type SourceUsage,
  type StoryFilters,
  type StorySort,
  type StoryUrlState,
  type StoryView,
} from "./story-model"

const VIEW_ICONS = { grid: LayoutGrid, list: List } as const

/** Search, type / pillar / usage facets, favourites, sort and view — all mirrored to the URL. */
export function StoryFilterBar({
  stories,
  usage,
  pillars,
  filters,
  sort,
  view,
  onChange,
  onReset,
}: {
  stories: readonly Story[]
  usage: ReadonlyMap<ID, SourceUsage>
  pillars: ReadonlyMap<ID, ContentPillar>
  filters: StoryFilters
  sort: StorySort
  view: StoryView
  onChange: (patch: Partial<StoryUrlState>) => void
  onReset: () => void
}) {
  const t = useT(storyVaultMessages)
  const viewOptions = useMemo<ViewOption<StoryView>[]>(
    () => (["grid", "list"] as const).map((value) => ({ value, label: t(`view_${value}`), icon: VIEW_ICONS[value] })),
    [t]
  )
  const sortOptions = useMemo(() => STORY_SORTS.map((s) => ({ value: s.value, label: t(`sort_${s.value}`) })), [t])
  const typeOptions = useMemo<FacetOption[]>(() => {
    const counts = new Map<string, number>()
    for (const story of stories) counts.set(story.type, (counts.get(story.type) ?? 0) + 1)
    return STORY_TYPES.map((type) => {
      const Icon = STORY_TYPE_ICONS[type.id]
      return {
        value: type.id,
        label: type.label,
        count: counts.get(type.id) ?? 0,
        icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden />,
      }
    })
  }, [stories])

  const pillarOptions = useMemo<FacetOption[]>(() => {
    const counts = new Map<string, number>()
    for (const story of stories) {
      const key = story.pillar_id ?? NO_PILLAR
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const options: FacetOption[] = [...pillars.values()]
      .filter((p) => p.is_active || counts.has(p.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ value: p.id, label: p.name || t("untitled_pillar"), count: counts.get(p.id) ?? 0, icon: <ColorDot color={p.color} /> }))
    if (counts.has(NO_PILLAR)) options.push({ value: NO_PILLAR, label: t("no_pillar"), count: counts.get(NO_PILLAR) ?? 0 })
    return options
  }, [stories, pillars, t])

  const usageOptions = useMemo<FacetOption[]>(() => {
    const used = stories.filter((s) => usageCount(usage, s.id) > 0).length
    return [
      { value: "used", label: t("used_in_ideas"), count: used },
      { value: "unused", label: t("not_used"), count: stories.length - used },
    ]
  }, [stories, usage, t])

  return (
    <FilterBar
      actions={
        <>
          <OptionSelect
            size="sm"
            options={sortOptions}
            value={sort}
            onChange={(next) => {
              if (next) onChange({ sort: next === "recent" ? "" : next })
            }}
            aria-label={t("sort_label")}
            className="w-40"
          />
          <ViewToggle value={view} onChange={(next) => onChange({ view: next === "grid" ? "" : next })} options={viewOptions} aria-label={t("view_label")} />
        </>
      }
    >
      <SearchInput value={filters.q} onChange={(q) => onChange({ q })} placeholder={t("search")} />
      <FacetFilter title={t("facet_type")} options={typeOptions} value={filters.types} onChange={(value) => onChange({ type: value.join(",") })} />
      <FacetFilter title={t("facet_pillar")} options={pillarOptions} value={filters.pillars} onChange={(value) => onChange({ pillar: value.join(",") })} />
      <FacetFilter title={t("facet_usage")} options={usageOptions} value={filters.usage} onChange={(value) => onChange({ usage: value.join(",") })} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={filters.favorites}
        onClick={() => onChange({ fav: filters.favorites ? "" : "1" })}
        className={cn(!filters.favorites && "border-dashed")}
      >
        <Star className={cn(filters.favorites ? "fill-current" : "text-muted-foreground")} aria-hidden />
        {t("favourites")}
      </Button>
      <ResetFiltersButton show={hasStoryFilters(filters)} onClick={onReset} />
    </FilterBar>
  )
}
