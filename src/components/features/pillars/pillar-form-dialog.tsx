"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ColorSwatchPicker, FormField, FormRow, ListEditor, NumberField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { CategoricalColor, ContentPillar, UpdateRow } from "@/lib/types"
import { rebalanceHint } from "./pillar-actions"
import { PillarIconPicker } from "./pillar-icon-picker"
import { DEFAULT_PILLAR_ICON, PillarIconTile } from "./pillar-icons"
import { activeTargetTotal, nextPillarColor, nextSortOrder, TARGET_TOTAL } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"

interface FormValues {
  name: string
  description: string
  color: CategoricalColor
  icon: string
  target: number | null
  examples: string[]
  active: boolean
}

/** Create or edit a pillar. Esc closes; Enter in the name submits. */
export function PillarFormDialog({
  open,
  onOpenChange,
  pillar,
  onSaved,
  onSetTargets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pillar?: ContentPillar | null
  onSaved?: (pillar: ContentPillar, created: boolean) => void
  /** Opens the targets editor — offered when a save leaves active targets away from 100%. */
  onSetTargets?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <PillarForm
          key={pillar?.id ?? "new"}
          pillar={pillar ?? null}
          onCancel={() => onOpenChange(false)}
          onSaved={(row, created) => {
            onOpenChange(false)
            onSaved?.(row, created)
          }}
          onSetTargets={onSetTargets}
        />
      </DialogContent>
    </Dialog>
  )
}

function PillarForm({
  pillar,
  onCancel,
  onSaved,
  onSetTargets,
}: {
  pillar: ContentPillar | null
  onCancel: () => void
  onSaved: (pillar: ContentPillar, created: boolean) => void
  onSetTargets?: () => void
}) {
  const t = useT(pillarMessages)
  const c = useT(commonMessages)
  const pillars = useTable("content_pillars")
  const [values, setValues] = useState<FormValues>(() =>
    pillar
      ? {
          name: pillar.name,
          description: pillar.description,
          color: pillar.color,
          icon: pillar.icon || DEFAULT_PILLAR_ICON,
          target: pillar.target_percentage,
          examples: pillar.examples,
          active: pillar.is_active,
        }
      : {
          name: "",
          description: "",
          color: nextPillarColor(pillars),
          icon: DEFAULT_PILLAR_ICON,
          target: Math.max(0, TARGET_TOTAL - activeTargetTotal(pillars)),
          examples: [],
          active: true,
        }
  )
  const [touched, setTouched] = useState(false)

  const others = pillars.filter((p) => p.id !== pillar?.id)
  const cleanName = values.name.trim()
  const nameError = !cleanName
    ? t("name_required")
    : others.some((p) => p.name.trim().toLowerCase() === cleanName.toLowerCase())
      ? t("name_taken")
      : undefined
  const valid = !nameError
  const othersTotal = activeTargetTotal(others)
  const newTotal = othersTotal + (values.active ? Math.round(values.target ?? 0) : 0)
  const totalHint = values.active
    ? t(newTotal === TARGET_TOTAL ? "total_hint" : "total_hint_rebalance", { others: othersTotal, total: newTotal })
    : t("paused_hint")

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!valid) return
    const payload = {
      name: cleanName,
      description: values.description.trim(),
      color: values.color,
      icon: values.icon,
      target_percentage: Math.min(100, Math.max(0, Math.round(values.target ?? 0))),
      examples: values.examples,
      is_active: values.active,
    } satisfies UpdateRow<"content_pillars">
    if (pillar) {
      dataActions.update("content_pillars", pillar.id, payload)
      const hint = rebalanceHint(onSetTargets)
      toast.success(t("updated"), { description: hint.description ?? payload.name, action: hint.action })
      onSaved({ ...pillar, ...payload }, false)
    } else {
      const row = dataActions.insert("content_pillars", { ...payload, sort_order: nextSortOrder(pillars) })
      const hint = rebalanceHint(onSetTargets)
      toast.success(t("created"), { description: hint.description ?? row.name, action: hint.action })
      onSaved(row, true)
    }
  }

  const shownNameError = touched ? nameError : undefined

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{pillar ? t("edit_pillar") : t("new_pillar")}</DialogTitle>
        <DialogDescription className="text-xs">{t("form_description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("name")} htmlFor="pillar-name" required error={shownNameError}>
            <div className="flex items-center gap-2.5">
              <PillarIconTile name={values.icon} color={values.color} />
              <Input
                id="pillar-name"
                value={values.name}
                autoFocus
                maxLength={60}
                placeholder={t("name_placeholder")}
                aria-invalid={Boolean(shownNameError) || undefined}
                onChange={(event) => set("name", event.target.value)}
                onBlur={() => setTouched(true)}
              />
            </div>
          </FormField>

          <FormField label={t("description_label")} htmlFor="pillar-description" description={t("description_help")}>
            <Textarea
              id="pillar-description"
              rows={2}
              maxLength={200}
              className="min-h-14"
              value={values.description}
              placeholder={t("description_placeholder")}
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>

          <FormRow>
            <FormField label={t("color")} description={t("color_help")}>
              <ColorSwatchPicker value={values.color} onChange={(color) => set("color", color)} aria-label={t("color_aria")} />
            </FormField>
            <FormField label={t("target_share")} htmlFor="pillar-target" description={totalHint}>
              <NumberField
                id="pillar-target"
                integer
                min={0}
                max={100}
                suffix="%"
                className="w-28"
                value={values.target}
                onChange={(next) => set("target", next)}
              />
            </FormField>
          </FormRow>

          <FormField label={t("icon")}>
            <PillarIconPicker
              value={values.icon}
              color={values.color}
              onChange={(name) => set("icon", name)}
              aria-label={t("icon_aria")}
            />
          </FormField>

          <FormField
            label={t("examples")}
            htmlFor="pillar-examples"
            description={t("examples_help")}
          >
            <ListEditor
              id="pillar-examples"
              value={values.examples}
              onChange={(next) => set("examples", next)}
              maxItems={12}
              placeholder={t("examples_placeholder")}
              aria-label={t("examples")}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="pillar-active" className="text-sm">
                {t("active")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("active_help")}</p>
            </div>
            <Switch id="pillar-active" checked={values.active} onCheckedChange={(next) => set("active", next)} />
          </div>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {pillar ? c("save_changes") : t("create_pillar")}
        </Button>
      </DialogFooter>
    </form>
  )
}
