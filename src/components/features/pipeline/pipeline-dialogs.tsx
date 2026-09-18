"use client"

import { useMemo, useState } from "react"
import { DatePicker, DateTimePicker, FormField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useT, type Translator } from "@/lib/i18n"
import { formatDate, parseDate, toISODate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import type { ContentItem, ISODate, ISODateTime } from "@/lib/types"
import { cn, truncate } from "@/lib/utils"
import { defaultScheduleTime, nextPostingSlots } from "./board-model"
import { pipelineCardMessages } from "./messages"
import { useNow } from "./use-now"

const quoted = (item: ContentItem, t: Translator<(typeof pipelineCardMessages)["en"]>) =>
  `“${truncate(item.title.trim() || t("untitled"), 80)}”`

interface TargetDialogProps {
  /** Kept after closing so the content doesn't collapse during the exit animation. */
  item: ContentItem | null
  open: boolean
  /** Changes on every open so each form starts from the item's current values. */
  nonce: number
  onOpenChange: (open: boolean) => void
}

/* -------------------------------- Schedule -------------------------------- */

/** Publish time picker — shown when a card lands in Scheduled without a future time, or via "Reschedule…". */
export function ScheduleDialog({
  item,
  open,
  nonce,
  onOpenChange,
  move,
  onConfirm,
}: TargetDialogProps & { move: boolean; onConfirm: (when: ISODateTime) => void }) {
  return (
    <Dialog open={open && Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {item ? (
          <ScheduleForm key={nonce} item={item} move={move} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({
  item,
  move,
  onCancel,
  onConfirm,
}: {
  item: ContentItem
  move: boolean
  onCancel: () => void
  onConfirm: (when: ISODateTime) => void
}) {
  const t = useT(pipelineCardMessages)
  const slots = useTable("content_calendar")
  const items = useTable("content_items")
  const now = useNow()
  const suggestions = useMemo(() => nextPostingSlots(slots, items, item, now), [slots, items, item, now])
  const [value, setValue] = useState<ISODateTime | null>(() => defaultScheduleTime(item, suggestions, now).toISOString())
  const at = parseDate(value)
  const error = !at ? t("error_pick_time") : at.getTime() <= now.getTime() ? t("error_future") : null

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (value && !error) onConfirm(value)
      }}
    >
      <DialogHeader>
        <DialogTitle>{move ? t("schedule_title") : t("reschedule_title")}</DialogTitle>
        <DialogDescription>
          {move ? t("schedule_description", { title: quoted(item, t) }) : t("reschedule_description", { title: quoted(item, t) })}
        </DialogDescription>
      </DialogHeader>

      {suggestions.length ? (
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("open_slots")}</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((slot) => {
              const iso = slot.at.toISOString()
              const active = at?.getTime() === slot.at.getTime()
              return (
                <Button
                  key={iso}
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
                  <span className="max-w-full truncate text-[11px] font-normal text-muted-foreground">
                    {slot.label || t("posting_slot")}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      <FormField label={t("publish_time")} htmlFor="pipeline-schedule-at" error={error}>
        <DateTimePicker
          id="pipeline-schedule-at"
          value={value}
          onChange={setValue}
          clearable={false}
          minDate={toISODate(now)}
          aria-invalid={Boolean(error)}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={Boolean(error)}>
          {move ? t("schedule") : t("save_time")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/* -------------------------------- Due date -------------------------------- */

export function DueDateDialog({
  item,
  open,
  nonce,
  onOpenChange,
  onSave,
}: TargetDialogProps & { onSave: (due: ISODate | null) => void }) {
  return (
    <Dialog open={open && Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {item ? <DueDateForm key={nonce} item={item} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function DueDateForm({
  item,
  onCancel,
  onSave,
}: {
  item: ContentItem
  onCancel: () => void
  onSave: (due: ISODate | null) => void
}) {
  const t = useT(pipelineCardMessages)
  const [value, setValue] = useState<ISODate | null>(item.due_date)
  const unchanged = value === item.due_date
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!unchanged) onSave(value)
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("set_due_date")}</DialogTitle>
        <DialogDescription>{t("due_description", { title: quoted(item, t) })}</DialogDescription>
      </DialogHeader>
      <FormField
        label={t("due_date")}
        htmlFor="pipeline-due-date"
        description={item.scheduled_at ? t("goes_live", { when: formatDate(item.scheduled_at, "EEE, MMM d · h:mm a") }) : undefined}
      >
        <DatePicker id="pipeline-due-date" value={value} onChange={setValue} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={unchanged}>
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/* ---------------------------------- Owner --------------------------------- */

const MAX_OWNER_LENGTH = 60

export function OwnerDialog({
  item,
  open,
  nonce,
  onOpenChange,
  owners,
  onSave,
}: TargetDialogProps & { owners: string[]; onSave: (owner: string) => void }) {
  return (
    <Dialog open={open && Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {item ? (
          <OwnerForm key={nonce} item={item} owners={owners} onCancel={() => onOpenChange(false)} onSave={onSave} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function OwnerForm({
  item,
  owners,
  onCancel,
  onSave,
}: {
  item: ContentItem
  owners: string[]
  onCancel: () => void
  onSave: (owner: string) => void
}) {
  const t = useT(pipelineCardMessages)
  const [value, setValue] = useState(item.owner)
  const clean = value.trim()
  const error = clean.length > MAX_OWNER_LENGTH ? t("owner_too_long", { max: MAX_OWNER_LENGTH }) : null
  const invalid = !clean || Boolean(error) || clean === item.owner.trim()
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!invalid) onSave(clean)
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("assign_owner")}</DialogTitle>
        <DialogDescription>{t("owner_description", { title: quoted(item, t) })}</DialogDescription>
      </DialogHeader>
      <FormField label={t("owner")} htmlFor="pipeline-owner" error={error}>
        <Input
          id="pipeline-owner"
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("owner_placeholder")}
          aria-invalid={Boolean(error)}
        />
      </FormField>
      {owners.length ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("people_on_content")}>
          {owners.slice(0, 8).map((owner) => (
            <Button
              key={owner}
              type="button"
              variant="outline"
              size="xs"
              aria-pressed={clean === owner}
              onClick={() => setValue(owner)}
              className={cn(clean === owner && "border-brand/60 bg-brand-soft hover:bg-brand-soft dark:bg-brand-soft")}
            >
              {owner}
            </Button>
          ))}
        </div>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={invalid}>
          {t("assign")}
        </Button>
      </DialogFooter>
    </form>
  )
}
