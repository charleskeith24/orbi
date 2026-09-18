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
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useLookup, useTable } from "@/lib/store"
import type { ID, PlatformId, PostingSlot, UpdateRow } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { weekdayOrder } from "./calendar-model"
import { scheduleMessages } from "./schedule-messages"
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
  const t = useT(scheduleMessages)
  const c = useT(commonMessages)
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
  const labelError = !clean ? t("theme_required") : clean.length > MAX_LABEL ? t("theme_too_long", { max: MAX_LABEL }) : null
  const dayOptions: SelectOption<string>[] = weekdayOrder(weekStartsOn).map((d) => ({ value: String(d), label: DAYS_OF_WEEK[d]?.label ?? "" }))
  const dayName = DAYS_OF_WEEK[Number(day)]?.label ?? t("that_day")

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
      toast.success(t("slot_updated"), { description: `${dayName} · ${clean}` })
      onSaved({ ...editing, ...patch }, false)
      return
    }
    const plan = insertionPlan(slots, dayNumber, time)
    if (plan.updates.length) dataActions.updateMany("content_calendar", plan.updates)
    const row = dataActions.insert("content_calendar", { ...values, sort_order: plan.sortOrder })
    toast.success(t("slot_added_to", { day: dayName }), { description: clean })
    onSaved(row, true)
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? t("edit_title") : t("add_title")}</DialogTitle>
        <DialogDescription>{t("form_description", { day: dayName })}</DialogDescription>
      </DialogHeader>

      <FormRow>
        <FormField label={t("day")} htmlFor="slot-day">
          <OptionSelect id="slot-day" options={dayOptions} value={day} onChange={(value) => value && setDay(value)} />
        </FormField>
        <FormField label={c("time")} htmlFor="slot-time" description={t("time_hint")}>
          <TimeInput id="slot-time" value={time} onChange={setTime} className="w-full" />
        </FormField>
      </FormRow>

      <FormField label={t("theme")} htmlFor="slot-label" required error={touched ? labelError : null}>
        <Input
          id="slot-label"
          value={label}
          autoFocus={!editing}
          autoComplete="off"
          placeholder={t("theme_placeholder")}
          aria-invalid={touched && Boolean(labelError)}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label={t("recommended_themes")}>
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
        <FormField label={t("pillar")} htmlFor="slot-pillar">
          <PillarSelect id="slot-pillar" value={pillarId} onChange={pickPillar} allowNone />
        </FormField>
        <FormField label={t("format")} htmlFor="slot-format">
          <FormatSelect id="slot-format" value={formatId} onChange={setFormatId} allowNone />
        </FormField>
      </FormRow>

      <FormField
        label={t("platforms")}
        description={
          platforms.length ? t.plural("platforms_count", platforms.length, { count: formatNumber(platforms.length) }) : t("platforms_none")
        }
      >
        <PlatformToggleGroup value={platforms} onChange={setPlatforms} size="xs" />
      </FormField>

      <div className="flex items-start gap-2.5">
        <Switch id="slot-active" checked={active} onCheckedChange={setActive} className="mt-0.5" />
        <Label htmlFor="slot-active" className="flex-col items-start gap-0.5 font-normal">
          <span className="text-sm font-medium">{t("active")}</span>
          <span className="text-xs text-muted-foreground">{t("active_hint")}</span>
        </Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={Boolean(labelError)}>
          {editing ? t("save_slot") : t("add_slot")}
        </Button>
      </DialogFooter>
    </form>
  )
}
