"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  FormatSelect,
  FormField,
  FormRow,
  OptionSelect,
  PillarSelect,
  PlatformToggleGroup,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DAYS_OF_WEEK, SERIES_FREQUENCIES } from "@/lib/constants"
import { dataActions, useBrand } from "@/lib/store"
import type { ContentSeries, ID, PlatformId, SeriesFrequency, UpdateRow } from "@/lib/types"
import { cadenceLabel } from "./series-schedule"

const FREQUENCY_OPTIONS: SelectOption<SeriesFrequency>[] = SERIES_FREQUENCIES.map((f) => ({ value: f.id, label: f.label }))
const DAY_OPTIONS: SelectOption<string>[] = DAYS_OF_WEEK.map((d) => ({ value: String(d.value), label: d.label }))

interface FormValues {
  name: string
  description: string
  frequency: SeriesFrequency
  day: number | null
  platforms: PlatformId[]
  pillarId: ID | null
  formatId: ID | null
  hook: string
  active: boolean
}

type FieldKey = "name" | "platforms"

function validate(values: FormValues): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}
  if (!values.name.trim()) errors.name = "Give the series a name."
  if (!values.platforms.length) errors.platforms = "Pick at least one platform — new episodes are created on the first one."
  return errors
}

export function SeriesFormDialog({
  open,
  onOpenChange,
  series,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  series?: ContentSeries | null
  onSaved?: (series: ContentSeries, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <SeriesForm
          key={series?.id ?? "new"}
          series={series ?? null}
          onCancel={() => onOpenChange(false)}
          onSaved={(row, created) => {
            onOpenChange(false)
            onSaved?.(row, created)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function SeriesForm({
  series,
  onCancel,
  onSaved,
}: {
  series: ContentSeries | null
  onCancel: () => void
  onSaved: (series: ContentSeries, created: boolean) => void
}) {
  const brand = useBrand()
  const [values, setValues] = useState<FormValues>(() =>
    series
      ? {
          name: series.name,
          description: series.description,
          frequency: series.frequency,
          day: series.day_of_week,
          platforms: series.platforms,
          pillarId: series.pillar_id,
          formatId: series.format_id,
          hook: series.hook_template,
          active: series.is_active,
        }
      : {
          name: "",
          description: "",
          frequency: "weekly",
          day: new Date().getDay(),
          platforms: brand.main_platforms.slice(0, 1),
          pillarId: null,
          formatId: null,
          hook: "",
          active: true,
        }
  )
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const errors = validate(values)
  const valid = Object.keys(errors).length === 0
  const shown = (key: FieldKey) => (touched[key] ? errors[key] : undefined)
  const daily = values.frequency === "daily"

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    if (key === "platforms") setTouched((t) => ({ ...t, platforms: true }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ name: true, platforms: true })
    if (!valid) return
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      frequency: values.frequency,
      day_of_week: daily ? null : values.day,
      platforms: values.platforms,
      pillar_id: values.pillarId,
      format_id: values.formatId,
      hook_template: values.hook.trim(),
      is_active: values.active,
    } satisfies UpdateRow<"content_series">
    if (series) {
      dataActions.update("content_series", series.id, payload)
      toast.success("Series updated", { description: payload.name })
      onSaved({ ...series, ...payload }, false)
    } else {
      const row = dataActions.insert("content_series", payload)
      toast.success("Series created", { description: row.name })
      onSaved(row, true)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{series ? "Edit series" : "New series"}</DialogTitle>
        <DialogDescription className="text-xs">
          A recurring format your audience can look forward to. Episodes inherit these defaults.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Series name" htmlFor="series-name" required error={shown("name")}>
            <Input
              id="series-name"
              value={values.name}
              autoFocus
              maxLength={100}
              placeholder="e.g. Monday Marketing Lesson"
              aria-invalid={Boolean(shown("name")) || undefined}
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
          </FormField>

          <FormField label="Description" htmlFor="series-description" description="The promise of every episode, in a sentence or two.">
            <Textarea
              id="series-description"
              rows={2}
              className="min-h-14"
              value={values.description}
              placeholder="e.g. One practical ads lesson every Monday, under 60 seconds."
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>

          <FormRow>
            <FormField label="Frequency" htmlFor="series-frequency" description={cadenceLabel({ frequency: values.frequency, day_of_week: daily ? null : values.day })}>
              <OptionSelect
                id="series-frequency"
                options={FREQUENCY_OPTIONS}
                value={values.frequency}
                onChange={(next) => {
                  if (next) set("frequency", next)
                }}
              />
            </FormField>
            <FormField
              label="Day of week"
              htmlFor="series-day"
              description={daily ? "Daily series publish every day." : "Next-episode dates snap to this day."}
            >
              <OptionSelect
                id="series-day"
                options={DAY_OPTIONS}
                allowNone
                noneLabel="Any day"
                placeholder="Any day"
                disabled={daily}
                value={daily || values.day === null ? null : String(values.day)}
                onChange={(next) => set("day", next === null ? null : Number(next))}
              />
            </FormField>
          </FormRow>

          <FormField label="Platforms" required error={shown("platforms")} description="The first platform is used for new episodes.">
            <PlatformToggleGroup value={values.platforms} onChange={(next) => set("platforms", next)} aria-label="Series platforms" />
          </FormField>

          <FormRow>
            <FormField label="Default pillar" htmlFor="series-pillar">
              <PillarSelect
                id="series-pillar"
                allowNone
                noneLabel="No pillar"
                placeholder="Choose a pillar"
                value={values.pillarId}
                onChange={(next) => set("pillarId", next)}
              />
            </FormField>
            <FormField label="Default format" htmlFor="series-format">
              <FormatSelect
                id="series-format"
                allowNone
                noneLabel="No format"
                placeholder="Choose a format"
                value={values.formatId}
                onChange={(next) => set("formatId", next)}
              />
            </FormField>
          </FormRow>

          <FormField
            label="Hook template"
            htmlFor="series-hook"
            description="Use ___ for the part each episode fills in. New episodes start with this hook."
          >
            <Input
              id="series-hook"
              value={values.hook}
              maxLength={200}
              placeholder="e.g. Monday Marketing Lesson: ___ (in 60 seconds)."
              onChange={(event) => set("hook", event.target.value)}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="series-active" className="text-sm">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">Paused series stay in your library but drop out of next-episode suggestions.</p>
            </div>
            <Switch id="series-active" checked={values.active} onCheckedChange={(next) => set("active", next)} />
          </div>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {series ? "Save changes" : "Create series"}
        </Button>
      </DialogFooter>
    </form>
  )
}
