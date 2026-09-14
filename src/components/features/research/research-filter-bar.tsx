"use client"

import { LayoutGrid, Table2 } from "lucide-react"
import { useMemo } from "react"
import {
  ColorDot,
  FacetFilter,
  FilterBar,
  PlatformIcon,
  ResetFiltersButton,
  SearchInput,
  ViewToggle,
  type FacetOption,
  type ViewOption,
} from "@/components/common"
import { PLATFORM_IDS, PLATFORMS, RESEARCH_STATUSES, RESEARCH_TYPES } from "@/lib/constants"
import type { ContentPillar, ID, ResearchItem } from "@/lib/types"
import { RESEARCH_STATUS_ICONS, RESEARCH_TYPE_ICONS } from "./research-badges"
import { hasResearchFilters, NONE, type ResearchFilters, type ResearchUrlState, type ResearchView } from "./research-model"

const VIEW_OPTIONS: ViewOption<ResearchView>[] = [
  { value: "table", label: "Table", icon: Table2 },
  { value: "cards", label: "Cards", icon: LayoutGrid },
]

function countBy(items: readonly ResearchItem[], key: (item: ResearchItem) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/** Search and type / status / platform / pillar facets, mirrored to the URL. */
export function ResearchFilterBar({
  items,
  pillars,
  filters,
  view,
  onChange,
  onReset,
}: {
  items: readonly ResearchItem[]
  pillars: ReadonlyMap<ID, ContentPillar>
  filters: ResearchFilters
  view: ResearchView
  onChange: (patch: Partial<ResearchUrlState>) => void
  onReset: () => void
}) {
  const typeOptions = useMemo<FacetOption[]>(() => {
    const counts = countBy(items, (i) => i.type)
    return RESEARCH_TYPES.map((type) => {
      const Icon = RESEARCH_TYPE_ICONS[type.id]
      return { value: type.id, label: type.label, count: counts.get(type.id) ?? 0, icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden /> }
    })
  }, [items])

  const statusOptions = useMemo<FacetOption[]>(() => {
    const counts = countBy(items, (i) => i.status)
    return RESEARCH_STATUSES.map((status) => {
      const Icon = RESEARCH_STATUS_ICONS[status.id]
      return { value: status.id, label: status.label, count: counts.get(status.id) ?? 0, icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden /> }
    })
  }, [items])

  const platformOptions = useMemo<FacetOption[]>(() => {
    const counts = countBy(items, (i) => i.platform ?? NONE)
    const options: FacetOption[] = PLATFORM_IDS.filter((p) => counts.has(p) || filters.platforms.includes(p)).map((p) => ({
      value: p,
      label: PLATFORMS[p].label,
      count: counts.get(p) ?? 0,
      icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
    }))
    if (counts.has(NONE)) options.push({ value: NONE, label: "No platform", count: counts.get(NONE) ?? 0 })
    return options
  }, [items, filters.platforms])

  const pillarOptions = useMemo<FacetOption[]>(() => {
    const counts = countBy(items, (i) => i.pillar_id ?? NONE)
    const options: FacetOption[] = [...pillars.values()]
      .filter((p) => p.is_active || counts.has(p.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ value: p.id, label: p.name || "Untitled pillar", count: counts.get(p.id) ?? 0, icon: <ColorDot color={p.color} /> }))
    if (counts.has(NONE)) options.push({ value: NONE, label: "No pillar", count: counts.get(NONE) ?? 0 })
    return options
  }, [items, pillars])

  return (
    <FilterBar actions={<ViewToggle value={view} onChange={(next) => onChange({ view: next })} options={VIEW_OPTIONS} aria-label="Research view" />}>
      <SearchInput value={filters.q} onChange={(q) => onChange({ q })} placeholder="Search references…" />
      <FacetFilter title="Type" options={typeOptions} value={filters.types} onChange={(value) => onChange({ type: value.join(",") })} />
      <FacetFilter title="Status" options={statusOptions} value={filters.statuses} onChange={(value) => onChange({ status: value.join(",") })} />
      <FacetFilter title="Platform" options={platformOptions} value={filters.platforms} onChange={(value) => onChange({ platform: value.join(",") })} />
      <FacetFilter title="Pillar" options={pillarOptions} value={filters.pillars} onChange={(value) => onChange({ pillar: value.join(",") })} />
      <ResetFiltersButton show={hasResearchFilters(filters)} onClick={onReset} />
    </FilterBar>
  )
}
