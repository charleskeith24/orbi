"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  chipVariants,
  FormatSelect,
  FormField,
  FormRow,
  OptionSelect,
  PillarSelect,
  PlatformToggleGroup,
  TimeInput,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { dataActions, useLookup, useTable } from "@/lib/store"
import type { ID, PlatformId, PostingSlot, UpdateRow } from "@/lib/types"
import { weekdayOrder } from "./calendar-model"
import { insertionPlan, RECOMMENDED_THEMES } from "./schedule-model"

export interface SlotDraftTarget {
  /** null = a new slot. */
  slot: PostingSlot | null
  day: number
}

const MAX_LABEL = 80
const DEFAULT_TIME = "09:00"

/** Create / edit a posting slot: day, time, theme, pillar, format, platforms, active. */
export function SlotFormDialog({
  target,
  open,
  formKey,
  weekStartsOn,
  onOpenChange,
  onSaved,
}: {
  target: SlotDraftTarget | null
  open: boolean
  /** Changes whenever a different slot (or a new one) is opened, so the form starts fresh. */
  formKey: string
  weekStartsOn: 0 | 1
  onOpenChange: (open: boolean) => void
  onSaved?: (slot: PostingSlot, created: boolean) => void
}) {
  return (
    <Dialog open={open && Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {target ? (
          <SlotForm
            key={formKey}
            target={target}
            weekStartsOn={weekStartsOn}
            onCancel={() => onOpenChange(false)}
            onSaved={(slot, created) => {
              onOpenChange(false)
              onSaved?.(slot, created)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SlotForm({
  target,
  weekStartsOn,
  onCancel,
  onSaved,
}: {
  target: SlotDraftTarget
  weekStartsOn: 0 | 1
  onCancel: () => void
  onSaved: (slot: PostingSlot, created: boolean) => void
}) {
  const slots = useTable("content_calendar")
  const pillars = useLookup("content_pillars")
  const editing = target.slot
  const [day, setDay] = useState(String(editing?.day_of_week ?? target.day))
  const [label, setLabel] = useState(editing?.label ?? "")
  const [pillarId, setPillarId] = useState<ID | null>(editing?.pillar_id ?? null)
  const [formatId, setFormatId] = useState<ID | null>(editing?.format_id ?? null)
  const [platforms, setPlatforms] = useState<PlatformId[]>(editing?.platforms ?? [])
  const [time, setTime] = useState<string | null>(editing ? editing.time : DEFAULT_TIME)
  const [active, setActive] = useState(editing?.is_active ?? true)
  const [touched, setTouched] = useState(false)

  const clean = label.trim()
  const labelError = !clean
    ? "Name the slot's theme, e.g. “Tutorial / Framework”."
    : clean.length > MAX_LABEL
      ? `Keep it under ${MAX_LABEL} characters.`
      : null
  const dayOptions: SelectOption<string>[] = weekdayOrder(weekStartsOn).map((d) => ({ value: String(d), label: DAYS_OF_WEEK[d]?.label ?? "" }))
  const dayName = DAYS_OF_WEEK[Number(day)]?.label ?? "that day"

  function pickPillar(id: ID | null) {
    setPillarId(id)
    // A theme is required; the pillar's name is a sensible first draft.
    if (!clean && id) setLabel(pillars.get(id)?.name ?? "")
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (labelError) return
    const dayNumber = Number(day)
    const values = { day_of_week: dayNumber, label: clean, pillar_id: pillarId, format_id: formatId, platforms, time, is_active: active }
    if (editing) {
      const patch: UpdateRow<"content_calendar"> = { ...values }
      if (dayNumber !== editing.day_of_week) {
        const plan = insertionPlan(slots.filter((s) => s.id !== editing.id), dayNumber, time)
        if (plan.updates.length) dataActions.updateMany("content_calendar", plan.updates)
        patch.sort_order = plan.sortOrder
      }
      dataActions.update("content_calendar", editing.id, patch)
      toast.success("Posting slot updated", { description: `${dayName} · ${clean}` })
      onSaved({ ...editing, ...patch }, false)
      return
    }
    const plan = insertionPlan(slots, dayNumber, time)
    if (plan.updates.length) dataActions.updateMany("content_calendar", plan.updates)
    const row = dataActions.insert("content_calendar", { ...values, sort_order: plan.sortOrder })
    toast.success(`Posting slot added to ${dayName}`, { description: clean })
    onSaved(row, true)
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit posting slot" : "Add posting slot"}</DialogTitle>
        <DialogDescription>
          A recurring weekly target. The Calendar shows it as a lane every {dayName}, and the Weekly Planner fills it first.
        </DialogDescription>
      </DialogHeader>

      <FormRow>
        <FormField label="Day" htmlFor="slot-day">
          <OptionSelect id="slot-day" options={dayOptions} value={day} onChange={(value) => value && setDay(value)} />
        </FormField>
        <FormField label="Time" htmlFor="slot-time" description="Clear it for “any time”.">
          <TimeInput id="slot-time" value={time} onChange={setTime} className="w-full" />
        </FormField>
      </FormRow>

      <FormField label="Theme" htmlFor="slot-label" required error={touched ? labelError : null}>
        <Input
          id="slot-label"
          value={label}
          autoFocus={!editing}
          autoComplete="off"
          placeholder="e.g. Tutorial / Framework"
          aria-invalid={touched && Boolean(labelError)}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Recommended themes">
          {RECOMMENDED_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              aria-pressed={clean === theme}
              onClick={() => setLabel(theme)}
              className={chipVariants({ size: "xs", selected: clean === theme })}
            >
              {theme}
            </button>
          ))}
        </div>
      </FormField>

      <FormRow>
        <FormField label="Pillar" htmlFor="slot-pillar">
          <PillarSelect id="slot-pillar" value={pillarId} onChange={pickPillar} allowNone />
        </FormField>
        <FormField label="Format" htmlFor="slot-format">
          <FormatSelect id="slot-format" value={formatId} onChange={setFormatId} allowNone />
        </FormField>
      </FormRow>

      <FormField
        label="Platforms"
        description={
          platforms.length
            ? `${platforms.length} ${platforms.length === 1 ? "post" : "posts"} a week from this slot — one per platform.`
            : "No platform picked — any post that day fills it."
        }
      >
        <PlatformToggleGroup value={platforms} onChange={setPlatforms} size="xs" />
      </FormField>

      <div className="flex items-start gap-2.5">
        <Switch id="slot-active" checked={active} onCheckedChange={setActive} className="mt-0.5" />
        <Label htmlFor="slot-active" className="flex-col items-start gap-0.5 font-normal">
          <span className="text-sm font-medium">Active</span>
          <span className="text-xs text-muted-foreground">Counts toward weekly capacity and shows on the Calendar. Pause it to keep it for later.</span>
        </Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(labelError)}>
          {editing ? "Save slot" : "Add slot"}
        </Button>
      </DialogFooter>
    </form>
  )
}
