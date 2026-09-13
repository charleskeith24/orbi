"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import { CalendarDays, ListChecks, Plus, Target } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { uiActions, useLookup, useSettings, useTable } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { CalendarActionsProvider, useCalendarActions } from "./calendar-actions"
import { CompactMonthGrid, DayAgenda, MonthGrid, WeekColumns, WeekList, WeekStrip, type DayContext } from "./calendar-days"
import { collisionDetection, screenReaderInstructions } from "./calendar-dnd"
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
import { CalendarFilterBar, CalendarToolbar } from "./calendar-toolbar"
import { UnscheduledTray, type TrayGroup } from "./unscheduled-tray"
import { PREF_KEYS, useCalendarNav, usePref, writePref } from "./use-calendar-nav"
import { useCalendarDnd } from "./use-calendar-dnd"
import { useNow } from "./use-now"
import { useRevealItem } from "./use-reveal-item"

function statsText(stats: PeriodStats): string {
  const parts = [`${stats.published} published`, `${stats.scheduled} scheduled`]
  if (stats.due) parts.push(`${stats.due} due`)
  if (stats.openSlots) parts.push(pluralize(stats.openSlots, "open slot"))
  if (stats.missedSlots) parts.push(`${stats.missedSlots} missed`)
  if (stats.slotsTotal && !stats.openSlots && !stats.missedSlots) parts.push("all slots filled")
  return parts.join(" · ")
}

/**
 * Calendar (spec §19): Month / Week / Day with posting slots as lanes, drag-and-drop rescheduling and the
 * Unscheduled tray. URL: `?view=&date=YYYY-MM-DD&open=<itemId>` (open reveals and highlights an item).
 */
export function CalendarView() {
  return (
    <CalendarActionsProvider>
      <CalendarScreen />
    </CalendarActionsProvider>
  )
}

function CalendarScreen() {
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
  const { view, anchor } = nav
  const weekStartsOn = settings.week_starts_on
  const filtering = hasFilters(filters)
  const dnd = !isMobile

  const byDay = useMemo(() => placementsByDay(items), [items])
  const dayDates = useMemo(() => visibleDays(view, anchor, weekStartsOn), [view, anchor, weekStartsOn])
  // An item opened via ?open= stays visible whatever the filters say.
  const visible = useCallback((item: ContentItem) => item.id === nav.openId || matchesFilters(item, filters), [filters, nav.openId])
  const days = useMemo(
    () => buildCalendarDays(dayDates, byDay, slots, now, { month: view === "month" ? anchor : undefined, visible }),
    [dayDates, byDay, slots, now, view, anchor, visible]
  )
  const stripDays = useMemo(
    () => (view === "day" ? buildCalendarDays(visibleDays("week", anchor, weekStartsOn), byDay, slots, now, { visible }) : []),
    [view, anchor, weekStartsOn, byDay, slots, now, visible]
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
    return TRAY_GROUPS.map((g) => ({ ...g, items: (buckets.get(g.id) ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) }))
  }, [items, visible])
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
      <PageHeader
        title="Calendar"
        icon={CalendarDays}
        description="What goes out when — scheduled, published and due content with your posting targets as lanes. Drag to reschedule."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/calendar/planner">
                <ListChecks aria-hidden />
                Weekly Planner
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/calendar/schedule">
                <Target aria-hidden />
                Posting Schedule
              </Link>
            </Button>
            <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "new-content" })}>
              <Plus aria-hidden />
              New content
            </Button>
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-3">
        <CalendarToolbar
          view={view}
          label={periodLabel(view, anchor, weekStartsOn)}
          anchor={anchor}
          isTodayAnchor={nav.isTodayAnchor}
          weekStartsOn={weekStartsOn}
          showSlots={showSlots}
          onShowSlotsChange={(show) => writePref(PREF_KEYS.slots, show ? "on" : "off")}
          onViewChange={nav.setView}
          onShift={nav.shift}
          onToday={nav.goToday}
          onPick={nav.setAnchor}
        />
        <CalendarFilterBar
          filters={filters}
          options={facetOptions}
          onChange={setFilters}
          summary={<span className="text-xs text-muted-foreground num">{statsText(stats)}</span>}
        />
      </div>

      {!hasActiveSlots && showSlots ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed bg-card/50 px-3 py-2.5 text-sm">
          <Target className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-pretty text-muted-foreground">
            No posting targets yet — set up your weekly Posting Schedule so every day shows what to post.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/calendar/schedule">Set up Posting Schedule</Link>
          </Button>
        </div>
      ) : null}

      <DndContext
        sensors={drag.sensors}
        collisionDetection={collisionDetection}
        accessibility={{ announcements: drag.announcements, screenReaderInstructions }}
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
