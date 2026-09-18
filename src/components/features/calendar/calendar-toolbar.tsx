"use client"

import { CalendarCheck2, CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Target } from "lucide-react"
import { useMemo, useState } from "react"
import { FacetFilter, FilterBar, ResetFiltersButton, ViewToggle, type FacetOption, type ViewOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cn } from "@/lib/utils"
import { EMPTY_FILTERS, hasFilters, type CalendarFilters, type CalendarView, type FilterKey } from "./calendar-model"
import { calendarMessages } from "./messages"

const VIEW_ICONS = { month: CalendarDays, week: CalendarRange, day: CalendarCheck2 } as const

/** Today · previous / next · period label (jump to a date) · posting targets · view switch. */
export function CalendarToolbar({
  view,
  label,
  anchor,
  isTodayAnchor,
  weekStartsOn,
  showSlots,
  onShowSlotsChange,
  onViewChange,
  onShift,
  onToday,
  onPick,
}: {
  view: CalendarView
  label: string
  anchor: Date
  isTodayAnchor: boolean
  weekStartsOn: 0 | 1
  showSlots: boolean
  onShowSlotsChange: (show: boolean) => void
  onViewChange: (view: CalendarView) => void
  onShift: (step: number) => void
  onToday: () => void
  onPick: (date: Date) => void
}) {
  const t = useT(calendarMessages)
  const c = useT(commonMessages)
  const [open, setOpen] = useState(false)
  const viewOptions = useMemo<ViewOption<CalendarView>[]>(
    () => (["month", "week", "day"] as const).map((value) => ({ value, label: t(`view_${value}`), icon: VIEW_ICONS[value] })),
    [t]
  )
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onToday} disabled={isTodayAnchor}>
        {c("today")}
      </Button>
      <div className="flex items-center">
        <Button type="button" size="icon-sm" variant="ghost" aria-label={t(`previous_${view}`)} onClick={() => onShift(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={t(`next_${view}`)} onClick={() => onShift(1)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 max-w-full min-w-0 px-2 text-base font-semibold tracking-tight"
            aria-label={t("jump_to_date", { label })}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto gap-0 p-0">
          <Calendar
            mode="single"
            selected={anchor}
            defaultMonth={anchor}
            weekStartsOn={weekStartsOn}
            autoFocus
            onSelect={(date) => {
              if (date) onPick(date)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={showSlots}
          title={showSlots ? t("hide_targets") : t("show_targets")}
          onClick={() => onShowSlotsChange(!showSlots)}
          className={cn(showSlots && "border-brand/45 bg-brand-soft hover:bg-brand-soft dark:bg-brand-soft")}
        >
          <Target aria-hidden />
          <span className="hidden sm:inline">{t("posting_targets")}</span>
          <span className="sr-only sm:hidden">{t("posting_targets")}</span>
        </Button>
        <ViewToggle value={view} onChange={onViewChange} options={viewOptions} aria-label={t("calendar_view")} />
      </div>
    </div>
  )
}

export function CalendarFilterBar({
  filters,
  options,
  summary,
  onChange,
}: {
  filters: CalendarFilters
  options: Record<FilterKey, FacetOption[]>
  summary?: React.ReactNode
  onChange: (next: CalendarFilters) => void
}) {
  const t = useT(calendarMessages)
  const set = (key: FilterKey) => (value: string[]) => onChange({ ...filters, [key]: value })
  return (
    <FilterBar actions={summary}>
      <FacetFilter title={t("facet_platform")} options={options.platform} value={filters.platform} onChange={set("platform")} />
      <FacetFilter title={t("facet_pillar")} options={options.pillar} value={filters.pillar} onChange={set("pillar")} />
      <FacetFilter title={t("facet_goal")} options={options.goal} value={filters.goal} onChange={set("goal")} />
      <FacetFilter title={t("facet_format")} options={options.format} value={filters.format} onChange={set("format")} />
      <FacetFilter title={t("facet_status")} options={options.status} value={filters.status} onChange={set("status")} />
      <ResetFiltersButton show={hasFilters(filters)} onClick={() => onChange(EMPTY_FILTERS)} />
    </FilterBar>
  )
}
