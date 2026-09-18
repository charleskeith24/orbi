"use client"

import { Columns3 } from "lucide-react"
import { useMemo } from "react"
import {
  ColorDot,
  FacetFilter,
  FilterBar,
  FormatCategoryIcon,
  PlatformIcon,
  PriorityIcon,
  ResetFiltersButton,
  SearchInput,
  StageIcon,
  type FacetOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT, type Translator } from "@/lib/i18n"
import { PIPELINE_STAGES, PLATFORM_IDS, PLATFORMS, PRIORITIES } from "@/lib/constants"
import { useTable } from "@/lib/store"
import type { ContentItem, PipelineStage } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import {
  countFacet,
  FACET_KEYS,
  hasActiveFilters,
  NONE,
  STAGE_IDS,
  type FacetKey,
  type PipelineFilters,
  type StageColumnData,
} from "./board-model"
import { pipelineMessages } from "./messages"

const FACETS: { key: FacetKey; title: `facet_${FacetKey}` }[] = [
  { key: "platform", title: "facet_platform" },
  { key: "pillar", title: "facet_pillar" },
  { key: "owner", title: "facet_owner" },
  { key: "priority", title: "facet_priority" },
  { key: "campaign", title: "facet_campaign" },
  { key: "format", title: "facet_format" },
]

type PipelineT = Translator<(typeof pipelineMessages)["en"]>

/** Facet options with counts over the board's cards; options with no cards are hidden unless selected. */
function useFacetOptions(pool: ContentItem[], owners: string[], filters: PipelineFilters, t: PipelineT) {
  const pillars = useTable("content_pillars")
  const campaigns = useTable("content_campaigns")
  const formats = useTable("content_formats")

  return useMemo(() => {
    const counts = Object.fromEntries(FACET_KEYS.map((key) => [key, countFacet(pool, key)])) as Record<
      FacetKey,
      Map<string, number>
    >
    const count = (key: FacetKey, value: string) => counts[key].get(value) ?? 0
    const keep = (key: FacetKey, value: string) => count(key, value) > 0 || filters[key].includes(value)
    const none = (key: FacetKey, label: string): FacetOption[] =>
      keep(key, NONE) ? [{ value: NONE, label, count: count(key, NONE) }] : []

    const options: Record<FacetKey, FacetOption[]> = {
      platform: PLATFORM_IDS.filter((p) => keep("platform", p)).map((p) => ({
        value: p,
        label: PLATFORMS[p].label,
        count: count("platform", p),
        icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
      })),
      pillar: [
        ...[...pillars]
          .sort((a, b) => a.sort_order - b.sort_order)
          .filter((p) => keep("pillar", p.id))
          .map((p) => ({
            value: p.id,
            label: p.name || t("untitled_pillar"),
            count: count("pillar", p.id),
            icon: <ColorDot color={p.color} />,
          })),
        ...none("pillar", t("no_pillar")),
      ],
      owner: [
        ...owners.filter((o) => keep("owner", o)).map((o) => ({ value: o, label: o, count: count("owner", o) })),
        ...none("owner", t("unassigned")),
      ],
      priority: PRIORITIES.map((p) => ({
        value: p.id,
        label: p.label,
        count: count("priority", p.id),
        icon: <PriorityIcon priority={p.id} className={p.id === "high" ? "text-serious-fg" : "text-muted-foreground"} />,
      })),
      campaign: [
        ...[...campaigns]
          .sort((a, b) => b.start_date.localeCompare(a.start_date))
          .filter((c) => keep("campaign", c.id))
          .map((c) => ({
            value: c.id,
            label: c.name || t("untitled_campaign"),
            count: count("campaign", c.id),
            icon: <ColorDot color={c.color} shape="square" />,
          })),
        ...none("campaign", t("no_campaign")),
      ],
      format: [
        ...[...formats]
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          .filter((f) => keep("format", f.id))
          .map((f) => ({
            value: f.id,
            label: f.name || t("untitled_format"),
            count: count("format", f.id),
            icon: <FormatCategoryIcon category={f.category} className="size-3.5 text-muted-foreground" />,
          })),
        ...none("format", t("no_format")),
      ],
    }
    return options
  }, [pool, owners, filters, pillars, campaigns, formats, t])
}

export function PipelineFilterBar({
  pool,
  owners,
  filters,
  shown,
  onSearch,
  onFacet,
  onReset,
  actions,
}: {
  /** Every card on the board, before filters. */
  pool: ContentItem[]
  owners: string[]
  filters: PipelineFilters
  shown: number
  onSearch: (q: string) => void
  onFacet: (key: FacetKey, values: string[]) => void
  onReset: () => void
  actions?: React.ReactNode
}) {
  const t = useT(pipelineMessages)
  const options = useFacetOptions(pool, owners, filters, t)
  const active = hasActiveFilters(filters)
  const cards = t.plural("cards", pool.length, { count: formatNumber(pool.length) })

  return (
    <FilterBar
      actions={
        <>
          <span className="text-xs text-muted-foreground num" aria-live="polite">
            {active ? t("shown_of", { shown: formatNumber(shown), cards }) : cards}
          </span>
          {actions}
        </>
      }
    >
      <SearchInput value={filters.q} onChange={onSearch} placeholder={t("search_placeholder")} />
      {FACETS.map((facet) => (
        <FacetFilter
          key={facet.key}
          title={t(facet.title)}
          options={options[facet.key]}
          value={filters[facet.key]}
          onChange={(values) => onFacet(facet.key, values)}
        />
      ))}
      <ResetFiltersButton show={active} onClick={onReset} />
    </FilterBar>
  )
}

/** Which columns are expanded (persisted per browser). */
export function ColumnsMenu({
  columns,
  collapsed,
  onToggle,
  onSetAll,
}: {
  columns: Record<PipelineStage, StageColumnData>
  collapsed: Set<PipelineStage>
  onToggle: (stage: PipelineStage, collapsed: boolean) => void
  onSetAll: (stages: PipelineStage[]) => void
}) {
  const t = useT(pipelineMessages)
  const empty = STAGE_IDS.filter((stage) => !columns[stage].items.length)
  const expanded = STAGE_IDS.length - collapsed.size
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Columns3 aria-hidden />
          {t("columns")}
          {collapsed.size ? (
            <span className="text-xs text-muted-foreground num">
              {expanded}/{STAGE_IDS.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("expanded_columns")}</DropdownMenuLabel>
        {PIPELINE_STAGES.map((stage) => (
          <DropdownMenuCheckboxItem
            key={stage.id}
            checked={!collapsed.has(stage.id)}
            onCheckedChange={(checked) => onToggle(stage.id, !checked)}
            onSelect={(event) => event.preventDefault()}
          >
            <StageIcon stage={stage.id} />
            <span className="min-w-0 flex-1 truncate">{stage.label}</span>
            <span className="text-xs text-muted-foreground num">{formatNumber(columns[stage.id].items.length)}</span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!collapsed.size} onSelect={() => onSetAll([])}>
          {t("expand_all")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={empty.every((stage) => collapsed.has(stage))}
          onSelect={() => onSetAll([...new Set([...collapsed, ...empty])])}
        >
          {t("collapse_empty")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
