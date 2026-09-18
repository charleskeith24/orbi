"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"
import { formatDate } from "@/lib/dates"
import { translator } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions, scheduleItem, unscheduleItem } from "@/lib/store"
import type { ContentItem, ISODate, ISODateTime } from "@/lib/types"
import { truncate } from "@/lib/utils"
import type { DaySlot } from "./calendar-model"
import { FillSlotDialog, type FillTarget } from "./fill-slot-dialog"
import { calendarMessages } from "./messages"
import { DueDateDialog, ScheduleDialog } from "./schedule-item-dialog"

export interface CalendarActions {
  /** Opens the publish-time picker. */
  schedule: (item: ContentItem) => void
  /** Opens the due-date picker. */
  changeDue: (item: ContentItem) => void
  unschedule: (item: ContentItem) => void
  scheduleAt: (item: ContentItem, at: Date | ISODateTime) => void
  moveDue: (item: ContentItem, due: ISODate | null) => void
  /** Opens "Fill slot" for a posting slot on a day. */
  fillSlot: (day: Date, daySlot: DaySlot) => void
}

const CalendarActionsContext = createContext<CalendarActions | null>(null)

export function useCalendarActions(): CalendarActions {
  const actions = useContext(CalendarActionsContext)
  if (!actions) throw new Error("useCalendarActions must be used inside <CalendarActionsProvider>")
  return actions
}

/** Calendar strings in the current UI language (for toasts built in handlers). */
const tr = () => translator(calendarMessages, getUiLang())

const titleOf = (item: ContentItem) => `“${truncate(item.title.trim() || tr()("untitled_content"), 60)}”`

/** The latest row (a rendered item can be a render behind the store). */
const fresh = (item: ContentItem) => dataActions.getDb().content_items.find((row) => row.id === item.id) ?? item

/** Toast action restoring the scheduling fields as they were before a change. */
function undoFor(item: ContentItem) {
  const before = { scheduled_at: item.scheduled_at, stage: item.stage, due_date: item.due_date }
  return {
    label: tr()("undo"),
    onClick: () => {
      dataActions.update("content_items", item.id, before)
      toast.success(tr()("change_undone"))
    },
  }
}

interface DialogState<T> {
  value: T | null
  open: boolean
  nonce: number
}

const closed = <T,>(): DialogState<T> => ({ value: null, open: false, nonce: 0 })

/** Scheduling operations (with undo) and the dialogs they open, shared by every calendar view. */
export function CalendarActionsProvider({ children }: { children: React.ReactNode }) {
  const [scheduling, setScheduling] = useState<DialogState<ContentItem>>(closed)
  const [dueEditing, setDueEditing] = useState<DialogState<ContentItem>>(closed)
  const [filling, setFilling] = useState<DialogState<FillTarget>>(closed)

  const scheduleAt = useCallback((item: ContentItem, at: Date | ISODateTime) => {
    const row = fresh(item)
    const iso = at instanceof Date ? at.toISOString() : at
    const undo = undoFor(row)
    scheduleItem(row.id, iso)
    const t = tr()
    toast.success(t(row.scheduled_at ? "toast_rescheduled" : "toast_scheduled", { title: titleOf(row) }), {
      description: formatDate(iso, "EEEE, MMM d · h:mm a"),
      action: undo,
    })
  }, [])

  const unschedule = useCallback((item: ContentItem) => {
    const row = fresh(item)
    const undo = undoFor(row)
    unscheduleItem(row.id)
    const t = tr()
    toast.success(t("toast_unscheduled", { title: titleOf(row) }), {
      description: row.stage === "scheduled" ? t("toast_back_to_ready") : t("toast_no_publish_time"),
      action: undo,
    })
  }, [])

  const moveDue = useCallback((item: ContentItem, due: ISODate | null) => {
    const row = fresh(item)
    const undo = undoFor(row)
    dataActions.update("content_items", row.id, { due_date: due })
    const t = tr()
    toast.success(t(due ? "toast_due_moved" : "toast_due_cleared", { title: titleOf(row) }), {
      description: due ? t("toast_due_on", { date: formatDate(due, "EEEE, MMM d") }) : undefined,
      action: undo,
    })
  }, [])

  const actions = useMemo<CalendarActions>(
    () => ({
      schedule: (item) => setScheduling((s) => ({ value: item, open: true, nonce: s.nonce + 1 })),
      changeDue: (item) => setDueEditing((s) => ({ value: item, open: true, nonce: s.nonce + 1 })),
      unschedule,
      scheduleAt,
      moveDue,
      fillSlot: (day, daySlot) => setFilling((s) => ({ value: { day, daySlot }, open: true, nonce: s.nonce + 1 })),
    }),
    [unschedule, scheduleAt, moveDue]
  )

  return (
    <CalendarActionsContext.Provider value={actions}>
      {children}
      <ScheduleDialog
        item={scheduling.value}
        open={scheduling.open}
        nonce={scheduling.nonce}
        onOpenChange={(open) => setScheduling((s) => ({ ...s, open }))}
        onConfirm={(item, when) => {
          setScheduling((s) => ({ ...s, open: false }))
          scheduleAt(item, when)
        }}
      />
      <DueDateDialog
        item={dueEditing.value}
        open={dueEditing.open}
        nonce={dueEditing.nonce}
        onOpenChange={(open) => setDueEditing((s) => ({ ...s, open }))}
        onSave={(item, due) => {
          setDueEditing((s) => ({ ...s, open: false }))
          moveDue(item, due)
        }}
      />
      <FillSlotDialog
        target={filling.value}
        open={filling.open}
        nonce={filling.nonce}
        onOpenChange={(open) => setFilling((s) => ({ ...s, open }))}
      />
    </CalendarActionsContext.Provider>
  )
}
