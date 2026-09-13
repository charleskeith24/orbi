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

const VIEW_OPTIONS: ViewOption<IdeaView>[] = [
  { value: "table", label: "Table", icon: Rows3 },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "kanban", label: "Kanban", icon: Columns3 },
]

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
  const [showFacets, setShowFacets] = useState(false)

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
      .map((p) => ({ value: p.id, label: p.name || "Untitled pillar", count: count("pillar", p.id), icon: <ColorDot color={p.color} /> }))
    const personas = [...lookups.personas.values()]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name))
      .map((p) => ({ value: p.id, label: p.name || "Untitled persona", count: count("persona", p.id), icon: <ColorDot color={p.color} /> }))
    const formats = [...lookups.formats.values()]
      .filter((f) => keep("format", f.id, used.format.has(f.id)))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((f) => ({
        value: f.id,
        label: f.name || "Untitled format",
        count: count("format", f.id),
        icon: <FormatCategoryIcon category={f.category} className="size-3.5 text-muted-foreground" />,
      }))
    const goals = [...lookups.goals.values()]
      .filter((g) => keep("goal", g.id, g.is_active || used.goal.has(g.id)))
      .map((g) => ({
        value: g.id,
        label: g.name || "Untitled goal",
        count: count("goal", g.id),
        icon: <Target className="size-3.5 text-muted-foreground" aria-hidden />,
      }))

    return {
      pillar: withNone("pillar", pillars, "No pillar"),
      persona: withNone("persona", personas, "No persona"),
      format: withNone("format", formats, "No format"),
      goal: withNone("goal", goals, "No goal"),
      platform: withNone(
        "platform",
        PLATFORM_IDS.map((p) => ({
          value: p,
          label: PLATFORMS[p].label,
          count: count("platform", p),
          icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
        })),
        "No platform"
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
  }, [counts, criteria, lookups, used])

  const setFacet = (key: FacetKey, values: string[]) => onChange({ facets: { ...criteria.facets, [key]: values } })
  const facetCount = FACET_KEYS.reduce((acc, key) => acc + (criteria.facets[key].length ? 1 : 0), 0)
  const sortLabel = IDEA_SORTS.find((s) => s.id === sort)?.label ?? "Idea Score"

  return (
    <FilterBar
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label={`Sort by ${sortLabel}`}>
                <ArrowDownUp className="text-muted-foreground" aria-hidden />
                {sortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(next) => onChange({ sort: next as IdeaSort })}>
                {IDEA_SORTS.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    <span className="flex min-w-0 flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ViewToggle value={view} onChange={(next) => onChange({ view: next })} options={VIEW_OPTIONS} aria-label="Idea Bank view" />
        </>
      }
    >
      <SearchInput value={criteria.q} onChange={(q) => onChange({ q })} placeholder="Search ideas…" className="sm:w-56" />
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
        Filters
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
