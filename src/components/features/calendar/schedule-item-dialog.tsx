"use client"

import { addDays, startOfDay } from "date-fns"
import Link from "next/link"
import { useMemo, useState } from "react"
import { DatePicker, DateTimePicker, FormField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PLATFORMS } from "@/lib/constants"
import { combineDateTime, formatDate, parseDate, toISODate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import type { ContentItem, ISODate, ISODateTime } from "@/lib/types"
import { cn, truncate } from "@/lib/utils"
import { openSlotSuggestions } from "./calendar-model"
import { useNow } from "./use-now"

const quoted = (item: ContentItem) => `“${truncate(item.title.trim() || "Untitled content", 80)}”`

interface ItemDialogProps {
  /** Kept after closing so the content doesn't collapse during the exit animation. */
  item: ContentItem | null
  open: boolean
  /** Changes on every open so each form starts from the item's current values. */
  nonce: number
  onOpenChange: (open: boolean) => void
}

/* -------------------------------- Schedule -------------------------------- */

/** Publish time picker with the next open posting slots on the item's platform. */
export function ScheduleDialog({
  item,
  open,
  nonce,
  onOpenChange,
  onConfirm,
}: ItemDialogProps & { onConfirm: (item: ContentItem, when: ISODateTime) => void }) {
  return (
    <Dialog open={open && Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {item ? (
          <ScheduleForm key={nonce} item={item} onCancel={() => onOpenChange(false)} onConfirm={(when) => onConfirm(item, when)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({ item, onCancel, onConfirm }: { item: ContentItem; onCancel: () => void; onConfirm: (when: ISODateTime) => void }) {
  const slots = useTable("content_calendar")
  const items = useTable("content_items")
  const now = useNow()
  const suggestions = useMemo(() => openSlotSuggestions(slots, items, item, now), [slots, items, item, now])
  const [value, setValue] = useState<ISODateTime | null>(() => {
    const current = parseDate(item.scheduled_at)
    if (current && current.getTime() > now.getTime()) return current.toISOString()
    return suggestions[0]?.at.toISOString() ?? combineDateTime(addDays(startOfDay(now), 1), "09:00")
  })
  const at = parseDate(value)
  const error = !at ? "Pick a publish date and time." : at.getTime() <= now.getTime() ? "Pick a time in the future." : null
  const rescheduling = Boolean(item.scheduled_at)
  const platform = PLATFORMS[item.platform]?.label ?? item.platform

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (value && !error) onConfirm(value)
      }}
    >
      <DialogHeader>
        <DialogTitle>{rescheduling ? "Reschedule" : "Schedule"}</DialogTitle>
        <DialogDescription>
          {rescheduling ? `Change when ${quoted(item)} goes live on ${platform}.` : `Pick when ${quoted(item)} goes live on ${platform}.`}
          {item.stage === "ready_to_post" ? " It moves to Scheduled." : ""}
        </DialogDescription>
      </DialogHeader>

      {suggestions.length ? (
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Open posting slots on {platform}</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((slot) => {
              const iso = slot.at.toISOString()
              const active = at?.getTime() === slot.at.getTime()
              return (
                <Button
                  key={`${slot.slotId}-${iso}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={active}
                  onClick={() => setValue(iso)}
                  className={cn(
                    "h-auto max-w-full flex-col items-start gap-0 px-2.5 py-1 text-left",
                    active && "border-brand/60 bg-brand-soft hover:bg-brand-soft dark:bg-brand-soft"
                  )}
                >
                  <span className="text-xs font-medium">{formatDate(slot.at, "EEE, MMM d · h:mm a")}</span>
                  <span className="max-w-full truncate text-[11px] font-normal text-muted-foreground">{slot.label || "Posting slot"}</span>
                </Button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">
          No open posting slots on {platform} in the next two weeks — pick any time, or{" "}
          <Link href="/calendar/schedule" className="font-medium text-foreground underline-offset-4 hover:underline">
            edit your Posting Schedule
          </Link>
          .
        </p>
      )}

      <FormField label="Publish time" htmlFor="calendar-schedule-at" error={error}>
        <DateTimePicker
          id="calendar-schedule-at"
          value={value}
          onChange={setValue}
          clearable={false}
          minDate={toISODate(now)}
          aria-invalid={Boolean(error)}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(error)}>
          {rescheduling ? "Save time" : "Schedule"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/* -------------------------------- Due date -------------------------------- */

/** Production deadline editor (the calendar shows deadlines of unscheduled work as "Due"). */
export function DueDateDialog({
  item,
  open,
  nonce,
  onOpenChange,
  onSave,
}: ItemDialogProps & { onSave: (item: ContentItem, due: ISODate | null) => void }) {
  return (
    <Dialog open={open && Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {item ? <DueDateForm key={nonce} item={item} onCancel={() => onOpenChange(false)} onSave={(due) => onSave(item, due)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function DueDateForm({ item, onCancel, onSave }: { item: ContentItem; onCancel: () => void; onSave: (due: ISODate | null) => void }) {
  const [value, setValue] = useState<ISODate | null>(item.due_date)
  const scheduled = parseDate(item.scheduled_at)
  const error = value && scheduled && value > toISODate(scheduled) ? "The deadline can't be after the publish date." : null
  const unchanged = value === item.due_date
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!unchanged && !error) onSave(value)
      }}
    >
      <DialogHeader>
        <DialogTitle>{item.due_date ? "Change due date" : "Set due date"}</DialogTitle>
        <DialogDescription>The production deadline for {quoted(item)}. Work past its deadline shows as overdue on Today.</DialogDescription>
      </DialogHeader>
      <FormField
        label="Due date"
        htmlFor="calendar-due-date"
        error={error}
        description={scheduled ? `Goes live ${formatDate(scheduled, "EEE, MMM d · h:mm a")}` : "No publish time yet"}
      >
        <DatePicker id="calendar-due-date" value={value} onChange={setValue} aria-invalid={Boolean(error)} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={unchanged || Boolean(error)}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
