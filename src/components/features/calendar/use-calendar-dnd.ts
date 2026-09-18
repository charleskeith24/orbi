"use client"

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { format } from "date-fns"
import { useRef, useState } from "react"
import { parseDate } from "@/lib/dates"
import { translator } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions } from "@/lib/store"
import type { ID, PostingSlot } from "@/lib/types"
import { truncate } from "@/lib/utils"
import type { CalendarActions } from "./calendar-actions"
import { directionalCoordinates, KEYBOARD_CODES } from "./calendar-dnd"
import type { ItemKind } from "./calendar-item"
import { dayKeyFromDrop, dropTime, isLiveItem, placementOf, TRAY_DROP_ID } from "./calendar-model"
import { calendarMessages } from "./messages"

/** Announcements are built when they're read, in the current UI language. */
const tr = () => translator(calendarMessages, getUiLang())

const itemTitle = (id: UniqueIdentifier) => {
  const item = dataActions.getDb().content_items.find((row) => row.id === String(id))
  return `“${truncate(item?.title.trim() || tr()("untitled_content"), 60)}”`
}

const dropLabel = (id: UniqueIdentifier) => {
  if (id === TRAY_DROP_ID) return tr()("dnd_tray")
  const day = parseDate(dayKeyFromDrop(id))
  return day ? format(day, "EEEE, MMMM d") : tr()("dnd_no_day")
}

const announcements: Announcements = {
  onDragStart: ({ active }) => tr()("dnd_pick", { title: itemTitle(active.id) }),
  onDragOver: ({ over }) => (over ? tr()("dnd_over", { target: dropLabel(over.id) }) : tr()("dnd_not_over")),
  onDragEnd: ({ active, over }) =>
    over ? tr()("dnd_drop", { title: itemTitle(active.id), target: dropLabel(over.id) }) : tr()("dnd_not_moved", { title: itemTitle(active.id) }),
  onDragCancel: ({ active }) => tr()("dnd_cancel", { title: itemTitle(active.id) }),
}

/**
 * Calendar drag and drop: an unpublished post dropped on a day keeps its time of day (scheduleItem), a deadline
 * moves its due date, and a scheduled post dropped on the tray is unscheduled. Past days refuse drops.
 */
export function useCalendarDnd(actions: CalendarActions, slots: PostingSlot[]) {
  const [dragging, setDragging] = useState<{ id: ID; kind: ItemKind } | null>(null)
  const suppressClick = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: directionalCoordinates, keyboardCodes: KEYBOARD_CODES })
  )

  function onDragStart({ active }: DragStartEvent) {
    suppressClick.current = true
    const kind = (active.data.current as { kind?: ItemKind } | undefined)?.kind ?? "unscheduled"
    setDragging({ id: String(active.id), kind })
  }

  function onDragCancel() {
    setDragging(null)
    // The click that ends a drag must not open the item underneath.
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    onDragCancel()
    const item = dataActions.getDb().content_items.find((row) => row.id === String(active.id))
    if (!item || !over || isLiveItem(item)) return
    if (over.id === TRAY_DROP_ID) {
      if (item.scheduled_at) actions.unschedule(item)
      return
    }
    const key = dayKeyFromDrop(over.id)
    const day = parseDate(key)
    if (!key || !day) return
    if (placementOf(item)?.kind === "due") {
      if (item.due_date !== key) actions.moveDue(item, key)
      return
    }
    const at = dropTime(item, day, slots, new Date())
    if (parseDate(item.scheduled_at)?.getTime() === at.getTime()) return
    actions.scheduleAt(item, at)
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
  }

  return { sensors, announcements, dragging, onDragStart, onDragCancel, onDragEnd, onClickCapture }
}
