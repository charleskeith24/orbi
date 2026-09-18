"use client"

import { subDays } from "date-fns"
import { Layers, MonitorSmartphone } from "lucide-react"
import { useMemo } from "react"
import { ColorDot, DatePicker, FacetFilter, FilterBar, PlatformIcon, ResetFiltersButton, type FacetOption } from "@/components/common"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { PerformanceRow } from "@/lib/analytics"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import type { PlatformId } from "@/lib/types"
import { countBy } from "@/lib/utils"
import { NO_PILLAR, rangeOptions, type AnalyticsFilters, type RangePreset } from "./filters"
import { analyticsMessages } from "./messages"

const asPlatforms = (values: string[]) => values.filter((v): v is PlatformId => (PLATFORM_IDS as string[]).includes(v))

/** Date range presets (+ custom), platform and pillar — the row that scopes every analytics view. */
export function AnalyticsFilterBar({
  filters,
  onChange,
  onReset,
  showReset,
  allowAll,
  rows,
  now,
  children,
  actions,
}: {
  filters: AnalyticsFilters
  onChange: (patch: Partial<AnalyticsFilters>) => void
  onReset: () => void
  showReset: boolean
  allowAll: boolean
  /** Rows inside the selected date range — used for facet counts. */
  rows: PerformanceRow[]
  now: Date
  /** Extra facets placed after Platform and Pillar. */
  children?: React.ReactNode
  actions?: React.ReactNode
}) {
  const t = useT(analyticsMessages)
  const pillars = useTable("content_pillars")

  const platformOptions = useMemo<FacetOption[]>(() => {
    const counts: Partial<Record<string, number>> = countBy(rows, (r) => r.platform)
    return PLATFORM_IDS.filter((p) => counts[p] || filters.platforms.includes(p)).map((p) => ({
      value: p,
      label: PLATFORMS[p].label,
      count: counts[p] ?? 0,
      icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
    }))
  }, [rows, filters.platforms])

  const pillarOptions = useMemo<FacetOption[]>(() => {
    const counts: Partial<Record<string, number>> = countBy(rows, (r) => r.pillarId ?? NO_PILLAR)
    const options: FacetOption[] = [...pillars]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .filter((p) => p.is_active || counts[p.id] || filters.pillars.includes(p.id))
      .map((p) => ({ value: p.id, label: p.name || t("untitled_pillar"), count: counts[p.id] ?? 0, icon: <ColorDot color={p.color} /> }))
    if (counts[NO_PILLAR] || filters.pillars.includes(NO_PILLAR)) {
      options.push({ value: NO_PILLAR, label: t("no_pillar"), count: counts[NO_PILLAR] ?? 0, icon: <ColorDot color={null} /> })
    }
    return options
  }, [rows, pillars, filters.pillars, t])

  return (
    <FilterBar actions={actions}>
      <RangeControl filters={filters} onChange={onChange} allowAll={allowAll} now={now} />
      <FacetFilter
        title={t("platform")}
        icon={MonitorSmartphone}
        options={platformOptions}
        value={filters.platforms}
        onChange={(value) => onChange({ platforms: asPlatforms(value) })}
      />
      <FacetFilter title={t("pillar")} icon={Layers} options={pillarOptions} value={filters.pillars} onChange={(value) => onChange({ pillars: value })} />
      {children}
      <ResetFiltersButton show={showReset} onClick={onReset} />
    </FilterBar>
  )
}

function RangeControl({
  filters,
  onChange,
  allowAll,
  now,
}: {
  filters: AnalyticsFilters
  onChange: (patch: Partial<AnalyticsFilters>) => void
  allowAll: boolean
  now: Date
}) {
  const t = useT(analyticsMessages)
  const lang = useUiLang()
  const today = toISODate(now)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={filters.range}
        onValueChange={(value) => {
          if (!value || value === filters.range) return
          if (value === "custom") {
            onChange({ range: "custom", from: filters.from ?? toISODate(subDays(now, 29)), to: filters.to ?? today })
          } else onChange({ range: value as RangePreset })
        }}
        aria-label={t("date_range")}
      >
        {rangeOptions(allowAll, lang).map((option) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            aria-label={option.description}
            title={option.description}
            className="num px-2 text-xs"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {filters.range === "custom" ? (
        <div className="flex items-center gap-1.5">
          <DatePicker
            size="sm"
            className="w-36"
            value={filters.from}
            maxDate={filters.to ?? today}
            clearable={false}
            aria-label={t("from")}
            onChange={(from) => {
              if (from) onChange({ from })
            }}
          />
          <span aria-hidden className="text-xs text-muted-foreground">
            –
          </span>
          <DatePicker
            size="sm"
            className="w-36"
            value={filters.to}
            minDate={filters.from ?? undefined}
            maxDate={today}
            clearable={false}
            aria-label={t("to")}
            onChange={(to) => onChange({ to: to ?? today })}
          />
        </div>
      ) : null}
    </div>
  )
}
