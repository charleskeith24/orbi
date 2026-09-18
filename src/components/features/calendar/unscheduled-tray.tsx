"use client"

import { useDroppable } from "@dnd-kit/core"
import { ChevronDown, Inbox } from "lucide-react"
import { Fragment, useState } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import type { ContentItem, ContentPillar, ID } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { useCalendarActions } from "./calendar-actions"
import { CalendarItem, type ItemKind } from "./calendar-item"
import { TRAY_DROP_ID, type TrayGroupId } from "./calendar-model"
import { calendarMessages } from "./messages"

export interface TrayGroup {
  id: TrayGroupId
  label: string
  hint: string
  items: ContentItem[]
}

const GROUP_LIMIT = 8

/**
 * Unscheduled tray: Ready to Post and other undated work. Desktop ("dock"): drag a chip onto a day to
 * schedule it; drop a scheduled post here to unschedule it. Phones ("list"): rows with a Schedule button.
 */
export function UnscheduledTray({
  groups,
  pillars,
  dnd,
  open,
  onOpenChange,
  dragKind,
  highlightId,
  layout,
}: {
  groups: TrayGroup[]
  pillars: Map<ID, ContentPillar>
  dnd: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kind of the item being dragged — only scheduled posts can be dropped here. */
  dragKind: ItemKind | null
  highlightId: ID | null
  layout: "dock" | "list"
}) {
  const t = useT(calendarMessages)
  const actions = useCalendarActions()
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROP_ID, disabled: !dnd })
  const [expanded, setExpanded] = useState<TrayGroupId[]>([])
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const ready = groups.find((g) => g.id === "ready")?.items.length ?? 0
  const accepting = dragKind === "scheduled"
  const dock = layout === "dock"
  const summary = accepting
    ? t("tray_drop")
    : [
        ready ? t("tray_ready", { count: ready }) : t("tray_nothing_ready"),
        t.plural("tray_without_date", total, { count: formatNumber(total) }),
        dock && total ? t("tray_drag_hint") : "",
      ]
        .filter(Boolean)
        .join(" · ")

  const renderGroup = (group: TrayGroup) => {
    // An item opened via ?open= is never hidden behind "Show all".
    const forced = group.items.findIndex((i) => i.id === highlightId) >= GROUP_LIMIT
    const all = forced || expanded.includes(group.id)
    const shown = all ? group.items : group.items.slice(0, GROUP_LIMIT)
    return (
      <>
        {shown.map((item) => {
          const pillar = item.pillar_id ? pillars.get(item.pillar_id) : undefined
          return (
            <CalendarItem
              key={item.id}
              item={item}
              kind="unscheduled"
              at={null}
              pillarColor={pillar?.color ?? null}
              pillarName={pillar?.name ?? null}
              variant={dock ? "chip" : "row"}
              dnd={dnd}
              highlighted={highlightId === item.id}
              className={dock ? "w-56 max-w-full" : undefined}
              action={
                dock ? undefined : (
                  <Button type="button" size="xs" variant="outline" onClick={() => actions.schedule(item)}>
                    {t("tray_schedule")}
                  </Button>
                )
              }
            />
          )
        })}
        {group.items.length > GROUP_LIMIT && !forced ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="self-start text-muted-foreground"
            onClick={() => setExpanded((list) => (all ? list.filter((id) => id !== group.id) : [...list, group.id]))}
          >
            {all ? t("show_fewer") : t("show_all", { count: group.items.length })}
          </Button>
        ) : null}
      </>
    )
  }

  const groupLabel = (group: TrayGroup) => (
    <div className="flex min-w-0 items-baseline gap-1.5 text-xs" title={group.hint}>
      <span className="font-medium">{group.label}</span>
      <span className="text-muted-foreground num">{group.items.length}</span>
    </div>
  )

  const filled = groups.filter((g) => g.items.length)

  return (
    <section
      ref={setNodeRef}
      aria-labelledby="calendar-tray-title"
      className={cn(
        "min-w-0 rounded-lg border bg-card transition-colors",
        accepting && "border-dashed border-brand/50",
        accepting && isOver && "bg-brand-soft ring-2 ring-brand/40"
      )}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="calendar-tray-body"
        className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Inbox className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span id="calendar-tray-title" className="shrink-0 text-sm font-medium">
          {t("tray_title")}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div id="calendar-tray-body" className="min-w-0 border-t px-3 pt-2.5 pb-3">
          {total === 0 ? (
            <p className="text-xs text-pretty text-muted-foreground">
              {t("tray_empty")}
            </p>
          ) : dock ? (
            <div className="grid min-w-0 items-start gap-x-4 gap-y-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              {filled.map((group) => (
                <Fragment key={group.id}>
                  <div className="pt-1">{groupLabel(group)}</div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">{renderGroup(group)}</div>
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-3">
              {filled.map((group) => (
                <div key={group.id} className="flex min-w-0 flex-col gap-1.5">
                  {groupLabel(group)}
                  {renderGroup(group)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
