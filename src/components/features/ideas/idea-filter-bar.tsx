"use client"

import { ArrowDownUp, Columns3, LayoutGrid, ListFilter, Rows3, Target } from "lucide-react"
import { useMemo, useState } from "react"
import {
  ColorDot,
  FacetFilter,
  FilterBar,
  FormatCategoryIcon,
  PlatformIcon,
  PriorityIcon,
  ResetFiltersButton,
  SearchInput,
  ViewToggle,
  type FacetOption,
  type ViewOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n"
import { IDEA_SOURCES, PLATFORM_IDS, PLATFORMS, PRIORITIES } from "@/lib/constants"
import type { ContentIdea, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ACTIVE_STATUSES,
  countByStatus,
  EMPTY_FACETS,
  FACET_KEYS,
  facetCounts,
  filterIdeas,
  hasActiveFilters,
  IDEA_SORTS,
  NONE,
  type FacetKey,
  type IdeaBankState,
  type IdeaSort,
  type IdeaView,
} from "./idea-model"
import { IdeaStatusFilter } from "./idea-status-filter"
import type { IdeaLookups } from "./idea-table"
import { ideaBankMessages } from "./messages"

const VIEW_ICONS: Record<IdeaView, ViewOption<IdeaView>["icon"]> = { table: Rows3, cards: LayoutGrid, kanban: Columns3 }

const NoneDot = () => <span aria-hidden className="size-2 shrink-0 rounded-full border border-dashed border-muted-foreground/70" />

type Criteria = Pick<IdeaBankState, "q" | "status" | "facets">

/** Search, status and facet filters (left) with sort and view switches (right). */
export function IdeaFilterBar({
  ideas,
  tagIndex,
  lookups,
  criteria,
  sort,
  view,
  onChange,
}: {
  ideas: ContentIdea[]
  tagIndex: Map<ID, string[]>
  lookups: IdeaLookups
  criteria: Criteria
  sort: IdeaSort
  view: IdeaView
  onChange: (patch: Partial<IdeaBankState>) => void
}) {
  const t = useT(ideaBankMessages)
  const [showFacets, setShowFacets] = useState(false)
  const viewOptions = useMemo<ViewOption<IdeaView>[]>(
    () => (["table", "cards", "kanban"] as const).map((value) => ({ value, label: t(`view_${value}`), icon: VIEW_ICONS[value] })),
    [t]
  )

  const counts = useMemo(
    () => Object.fromEntries(FACET_KEYS.map((key) => [key, facetCounts(ideas, criteria, key, tagIndex)])) as Record<FacetKey, Map<string, number>>,
    [ideas, criteria, tagIndex]
  )
  const statusCounts = useMemo(() => countByStatus(filterIdeas(ideas, criteria, { tagIndex, ignore: "status" })), [ideas, criteria, tagIndex])
  const used = useMemo(() => {
    const out = { format: new Set<string>(), goal: new Set<string>(), source: new Set<string>() }
    for (const idea of ideas) {
      if (idea.format_id) out.format.add(idea.format_id)
      if (idea.goal_id) out.goal.add(idea.goal_id)
      out.source.add(idea.source)
    }
    return out
  }, [ideas])

  const options = useMemo(() => {
    const { facets } = criteria
    const count = (key: FacetKey, value: string) => counts[key].get(value) ?? 0
    const withNone = (key: FacetKey, list: FacetOption[], label: string): FacetOption[] =>
      count(key, NONE) || facets[key].includes(NONE) ? [...list, { value: NONE, label, count: count(key, NONE), icon: <NoneDot /> }] : list
    const keep = (key: FacetKey, id: string, relevant: boolean) => relevant || facets[key].includes(id)

    const pillars = [...lookups.pillars.values()]
      .filter((p) => keep("pillar", p.id, p.is_active || count("pillar", p.id) > 0))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ value: p.id, label: p.name || t("untitled_pillar"), count: count("pillar", p.id), icon: <ColorDot color={p.color} /> }))
    const personas = [...lookups.personas.values()]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name))
      .map((p) => ({ value: p.id, label: p.name || t("untitled_persona"), count: count("persona", p.id), icon: <ColorDot color={p.color} /> }))
    const formats = [...lookups.formats.values()]
      .filter((f) => keep("format", f.id, used.format.has(f.id)))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((f) => ({
        value: f.id,
        label: f.name || t("untitled_format"),
        count: count("format", f.id),
        icon: <FormatCategoryIcon category={f.category} className="size-3.5 text-muted-foreground" />,
      }))
    const goals = [...lookups.goals.values()]
      .filter((g) => keep("goal", g.id, g.is_active || used.goal.has(g.id)))
      .map((g) => ({
        value: g.id,
        label: g.name || t("untitled_goal"),
        count: count("goal", g.id),
        icon: <Target className="size-3.5 text-muted-foreground" aria-hidden />,
      }))

    return {
      pillar: withNone("pillar", pillars, t("no_pillar")),
      persona: withNone("persona", personas, t("no_persona")),
      format: withNone("format", formats, t("no_format")),
      goal: withNone("goal", goals, t("no_goal")),
      platform: withNone(
        "platform",
        PLATFORM_IDS.map((p) => ({
          value: p,
          label: PLATFORMS[p].label,
          count: count("platform", p),
          icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
        })),
        t("no_platform")
      ),
      priority: PRIORITIES.map((p) => ({
        value: p.id,
        label: p.label,
        count: count("priority", p.id),
        icon: <PriorityIcon priority={p.id} className="text-muted-foreground" />,
      })),
      source: IDEA_SOURCES.filter((s) => keep("source", s.id, used.source.has(s.id))).map((s) => ({
        value: s.id,
        label: s.label,
        count: count("source", s.id),
      })),
    } satisfies Record<FacetKey, FacetOption[]>
  }, [counts, criteria, lookups, used, t])

  const setFacet = (key: FacetKey, values: string[]) => onChange({ facets: { ...criteria.facets, [key]: values } })
  const facetCount = FACET_KEYS.reduce((acc, key) => acc + (criteria.facets[key].length ? 1 : 0), 0)
  const sortLabel = t(`sort_${IDEA_SORTS.includes(sort) ? sort : "score"}`)

  return (
    <FilterBar
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label={t("sort_by_label", { label: sortLabel })}>
                <ArrowDownUp className="text-muted-foreground" aria-hidden />
                {sortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t("sort_by")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(next) => onChange({ sort: next as IdeaSort })}>
                {IDEA_SORTS.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    <span className="flex min-w-0 flex-col">
                      <span>{t(`sort_${option}`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`sort_${option}_description`)}</span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ViewToggle value={view} onChange={(next) => onChange({ view: next })} options={viewOptions} aria-label={t("view_label")} />
        </>
      }
    >
      <SearchInput value={criteria.q} onChange={(q) => onChange({ q })} placeholder={t("search_placeholder")} className="sm:w-56" />
      <IdeaStatusFilter value={criteria.status} counts={statusCounts} onChange={(status) => onChange({ status })} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="sm:hidden"
        aria-expanded={showFacets}
        onClick={() => setShowFacets((v) => !v)}
      >
        <ListFilter className="text-muted-foreground" aria-hidden />
        {t("filters")}
        {facetCount ? <span className="rounded-sm bg-muted px-1 text-xs font-medium num">{facetCount}</span> : null}
      </Button>
      <div className={cn("contents", !showFacets && "max-sm:hidden")}>
        <FacetFilter title="Pillar" options={options.pillar} value={criteria.facets.pillar} onChange={(v) => setFacet("pillar", v)} />
        <FacetFilter title="Platform" options={options.platform} value={criteria.facets.platform} onChange={(v) => setFacet("platform", v)} />
        <FacetFilter title="Persona" options={options.persona} value={criteria.facets.persona} onChange={(v) => setFacet("persona", v)} />
        <FacetFilter title="Format" options={options.format} value={criteria.facets.format} onChange={(v) => setFacet("format", v)} />
        <FacetFilter title="Goal" options={options.goal} value={criteria.facets.goal} onChange={(v) => setFacet("goal", v)} />
        <FacetFilter title="Priority" options={options.priority} value={criteria.facets.priority} onChange={(v) => setFacet("priority", v)} />
        <FacetFilter title="Source" options={options.source} value={criteria.facets.source} onChange={(v) => setFacet("source", v)} />
      </div>
      <ResetFiltersButton
        show={hasActiveFilters({ ...criteria, view, sort, open: null })}
        onClick={() => onChange({ q: "", status: ACTIVE_STATUSES, facets: EMPTY_FACETS })}
      />
    </FilterBar>
  )
}
