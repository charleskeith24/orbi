"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import { CalendarDays, Target } from "lucide-react"
import Link from "next/link"
import { useCallback, useId, useMemo, useState } from "react"
import { PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { workspaceStartKey } from "@/components/features/dashboard/first-run"
import { useBrand, useLookup, useSettings, useTable } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { useT, type Translator } from "@/lib/i18n"
import { formatNumber } from "@/lib/utils"
import { CalendarActionsProvider, useCalendarActions } from "./calendar-actions"
import { CompactMonthGrid, DayAgenda, MonthGrid, WeekColumns, WeekList, WeekStrip, type DayContext } from "./calendar-days"
import { collisionDetection } from "./calendar-dnd"
import { useCalendarFacets } from "./calendar-facets"
import { ItemBody } from "./calendar-item"
import {
  buildCalendarDays,
  EMPTY_FILTERS,
  hasFilters,
  matchesFilters,
  periodLabel,
  periodStats,
  placementOf,
  placementsByDay,
  TRAY_GROUPS,
  trayGroupOf,
  visibleDays,
  weekdayOrder,
  type CalendarFilters,
  type PeriodStats,
  type TrayGroupId,
} from "./calendar-model"
import { CalendarFilterBar, CalendarNav, CalendarViewControls, FiltersToggle } from "./calendar-toolbar"
import { UnscheduledTray, type TrayGroup } from "./unscheduled-tray"
import { PREF_KEYS, useCalendarNav, usePref, writePref } from "./use-calendar-nav"
import { calendarMessages } from "./messages"
import { useCalendarDnd } from "./use-calendar-dnd"
import { useNow } from "./use-now"
import { useRevealItem } from "./use-reveal-item"

function statsText(stats: PeriodStats, t: Translator<typeof calendarMessages.en>): string {
  const parts = [t("stat_published", { count: stats.published }), t("stat_scheduled", { count: stats.scheduled })]
  if (stats.due) parts.push(t("stat_due", { count: stats.due }))
  if (stats.openSlots) parts.push(t.plural("stat_open_slots", stats.openSlots, { count: formatNumber(stats.openSlots) }))
  if (stats.missedSlots) parts.push(t("stat_missed", { count: stats.missedSlots }))
  if (stats.slotsTotal && !stats.openSlots && !stats.missedSlots) parts.push(t("stat_all_filled"))
  return parts.join(" · ")
}

/**
 * Calendar (spec §19): Month / Week / Day with posting slots as lanes, drag-and-drop rescheduling and the
 * Unscheduled tray. URL: `?view=&date=YYYY-MM-DD&open=<itemId>` (open reveals and highlights an item).
 * Calm UI: the title's ⓘ explains the page (lanes, dragging, the tray); view controls sit in the header, then one
 * toolbar row — period, facets (behind "Filters" on phones) and the period in numbers. New content is in ＋ New.
 */
export function CalendarView() {
  return (
    <CalendarActionsProvider>
      <CalendarScreen />
    </CalendarActionsProvider>
  )
}

function CalendarScreen() {
  const t = useT(calendarMessages)
  const now = useNow()
  const isMobile = useIsMobile()
  const settings = useSettings()
  const items = useTable("content_items")
  const slots = useTable("content_calendar")
  const pillars = useLookup("content_pillars")
  const actions = useCalendarActions()
  const nav = useCalendarNav(now)
  const drag = useCalendarDnd(actions, slots)
  const showSlots = usePref(PREF_KEYS.slots) !== "off"
  const trayPref = usePref(PREF_KEYS.tray)
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersId = useId()
  const { view, anchor } = nav
  const weekStartsOn = settings.week_starts_on
  const filtering = hasFilters(filters)
  const dnd = !isMobile

  const brand = useBrand()
  const ideas = useTable("content_ideas")
  // Posting slots before the workspace existed were never missed.
  const startKey = useMemo(
    () => workspaceStartKey({ app_settings: [settings], brand_profiles: [brand], content_items: items, content_ideas: ideas }),
    [settings, brand, items, ideas]
  )
  const byDay = useMemo(() => placementsByDay(items), [items])
  const dayDates = useMemo(() => visibleDays(view, anchor, weekStartsOn), [view, anchor, weekStartsOn])
  // An item opened via ?open= stays visible whatever the filters say.
  const visible = useCallback((item: ContentItem) => item.id === nav.openId || matchesFilters(item, filters), [filters, nav.openId])
  const days = useMemo(
    () => buildCalendarDays(dayDates, byDay, slots, now, { month: view === "month" ? anchor : undefined, visible, startKey }),
    [dayDates, byDay, slots, now, view, anchor, visible, startKey]
  )
  const stripDays = useMemo(
    () => (view === "day" ? buildCalendarDays(visibleDays("week", anchor, weekStartsOn), byDay, slots, now, { visible, startKey }) : []),
    [view, anchor, weekStartsOn, byDay, slots, now, visible, startKey]
  )
  const stats = useMemo(() => periodStats(days), [days])
  const selectedDay = days.find((d) => d.key === nav.dateKey) ?? days[0]
  const facetOptions = useCalendarFacets(dayDates, byDay, items)

  const trayGroups = useMemo<TrayGroup[]>(() => {
    const buckets = new Map<TrayGroupId, ContentItem[]>()
    for (const item of items) {
      const group = trayGroupOf(item)
      if (!group || !visible(item)) continue
      const list = buckets.get(group)
      if (list) list.push(item)
      else buckets.set(group, [item])
    }
    return TRAY_GROUPS.map((g) => ({
      ...g,
      label: t(`group_${g.id}`),
      hint: t(`group_${g.id}_hint`),
      items: (buckets.get(g.id) ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    }))
  }, [items, visible, t])
  const readyCount = trayGroups.find((g) => g.id === "ready")?.items.length ?? 0
  const openInTray = nav.openId ? trayGroups.some((g) => g.items.some((i) => i.id === nav.openId)) : false
  const trayOpen = openInTray || (trayPref ? trayPref === "open" : readyCount > 0)
  const setTrayOpen = useCallback((open: boolean) => writePref(PREF_KEYS.tray, open ? "open" : "closed"), [])

  const ctx = useMemo<DayContext>(
    () => ({ pillars, dnd, showSlots, filtering, highlightId: nav.openId }),
    [pillars, dnd, showSlots, filtering, nav.openId]
  )

  useRevealItem({ openId: nav.openId, view, dateKey: nav.dateKey, dayDates, clearOpen: nav.clearOpen, replaceParams: nav.replaceParams })

  const draggedItem = drag.dragging ? items.find((i) => i.id === drag.dragging?.id) : undefined
  const draggedPillar = draggedItem?.pillar_id ? pillars.get(draggedItem.pillar_id) : undefined
  const weekdays = weekdayOrder(weekStartsOn)
  const hasActiveSlots = slots.some((s) => s.is_active)
  const viewControls = (
    <CalendarViewControls
      view={view}
      showSlots={showSlots}
      onShowSlotsChange={(show) => writePref(PREF_KEYS.slots, show ? "on" : "off")}
      onViewChange={nav.setView}
    />
  )

  const grid =
    view === "month" ? (
      isMobile ? (
        <>
          <CompactMonthGrid days={days} weekdays={weekdays} ctx={ctx} selectedKey={nav.dateKey} onSelect={nav.setAnchor} />
          {selectedDay ? <DayAgenda day={selectedDay} ctx={ctx} /> : null}
        </>
      ) : (
        <MonthGrid days={days} weekdays={weekdays} ctx={ctx} onOpenDay={nav.openDay} />
      )
    ) : view === "week" ? (
      isMobile ? (
        <WeekList days={days} ctx={ctx} onOpenDay={nav.openDay} />
      ) : (
        <WeekColumns days={days} ctx={ctx} onOpenDay={nav.openDay} />
      )
    ) : (
      <>
        <WeekStrip days={stripDays} selectedKey={nav.dateKey} ctx={ctx} onSelect={nav.setAnchor} />
        {days[0] ? <DayAgenda day={days[0]} ctx={ctx} /> : null}
      </>
    )
  const tray = (
    <UnscheduledTray
      groups={trayGroups}
      pillars={pillars}
      dnd={dnd}
      open={trayOpen}
      onOpenChange={setTrayOpen}
      dragKind={drag.dragging?.kind ?? null}
      highlightId={nav.openId}
      layout={isMobile ? "list" : "dock"}
    />
  )

  return (
    <PageContainer className="gap-4">
      <PageHeader title="Calendar" info={t("info")} actions={isMobile ? undefined : viewControls}>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <CalendarNav
              view={view}
              label={periodLabel(view, anchor, weekStartsOn)}
              anchor={anchor}
              isTodayAnchor={nav.isTodayAnchor}
              weekStartsOn={weekStartsOn}
              onShift={nav.shift}
              onToday={nav.goToday}
              onPick={nav.setAnchor}
            />
            {isMobile ? (
              // Phones: Filters and the view controls share one row under the period.
              <div className="flex w-full min-w-0 items-center justify-between gap-2">
                <FiltersToggle filters={filters} open={filtersOpen} onOpenChange={setFiltersOpen} controls={filtersId} />
                {viewControls}
              </div>
            ) : (
              <CalendarFilterBar filters={filters} options={facetOptions} onChange={setFilters} />
            )}
            <span className="text-xs text-muted-foreground num lg:ml-auto">{statsText(stats, t)}</span>
          </div>
          {isMobile && filtersOpen ? (
            <CalendarFilterBar id={filtersId} filters={filters} options={facetOptions} onChange={setFilters} className="pt-1" />
          ) : null}
        </div>
      </PageHeader>

      {!hasActiveSlots && showSlots ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed bg-card/50 px-3 py-2 text-sm">
          <Target className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-pretty text-muted-foreground">{t("no_targets")}</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/calendar/schedule">{t("setup_schedule")}</Link>
          </Button>
        </div>
      ) : !items.length && showSlots ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed bg-card/50 px-3 py-2 text-sm">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-pretty text-muted-foreground">{t("nothing_yet")}</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/calendar/planner">{t("plan_week")}</Link>
          </Button>
        </div>
      ) : null}

      <DndContext
        sensors={drag.sensors}
        collisionDetection={collisionDetection}
        accessibility={{ announcements: drag.announcements, screenReaderInstructions: { draggable: t("dnd_instructions") } }}
        onDragStart={drag.onDragStart}
        onDragCancel={drag.onDragCancel}
        onDragEnd={drag.onDragEnd}
      >
        <div className="flex min-w-0 flex-col gap-3" onClickCapture={drag.onClickCapture}>
          {isMobile ? (
            <>
              {grid}
              {tray}
            </>
          ) : (
            <>
              {tray}
              {grid}
            </>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {draggedItem && drag.dragging ? (
            <div className="w-56">
              <ItemBody
                item={draggedItem}
                kind={drag.dragging.kind}
                at={placementOf(draggedItem)?.at ?? null}
                pillarColor={draggedPillar?.color ?? null}
                pillarName={draggedPillar?.name ?? null}
                variant="chip"
                overlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </PageContainer>
  )
}
