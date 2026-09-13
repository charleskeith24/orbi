"use client"

import { CopyPlus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { DatePicker, FormField, NumberField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { METRIC_FIELDS, PLATFORMS } from "@/lib/constants"
import { formatDate, parseDate, toISODate } from "@/lib/dates"
import { dataActions, logMetrics, type MetricValues } from "@/lib/store"
import type { ContentItem, ContentMetric, ISODate, MetricKey } from "@/lib/types"
import { formatNumber } from "@/lib/utils"

type MetricInputs = Record<MetricKey, number | null>

function initialInputs(snapshot: ContentMetric | null): MetricInputs {
  const out = {} as MetricInputs
  for (const field of METRIC_FIELDS) out[field.key] = snapshot ? (snapshot[field.key] ?? null) : null
  return out
}

/** Add (logMetrics) or edit (dataActions.update) one analytics snapshot of `item`. */
export function SnapshotDialog({
  open,
  onOpenChange,
  item,
  snapshot,
  previous,
  now,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ContentItem
  /** The snapshot being edited; null adds a new one. */
  snapshot: ContentMetric | null
  /** Latest snapshot, shown as a hint in empty fields. */
  previous: ContentMetric | null
  now: Date
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <SnapshotForm
          key={snapshot?.id ?? "new"}
          item={item}
          snapshot={snapshot}
          previous={snapshot ? null : previous}
          now={now}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function SnapshotForm({
  item,
  snapshot,
  previous,
  now,
  onDone,
}: {
  item: ContentItem
  snapshot: ContentMetric | null
  previous: ContentMetric | null
  now: Date
  onDone: () => void
}) {
  const today = toISODate(now)
  const published = parseDate(item.published_at)
  const publishedDay = published ? toISODate(published) : null
  const [recordedAt, setRecordedAt] = useState<ISODate | null>(snapshot?.recorded_at ?? today)
  const [values, setValues] = useState<MetricInputs>(() => initialInputs(snapshot))
  const [notes, setNotes] = useState(snapshot?.notes ?? "")

  const dateError = !recordedAt
    ? "Pick the day you read these numbers."
    : recordedAt > today
      ? "The date can't be in the future."
      : publishedDay && recordedAt < publishedDay
        ? `The post went live on ${formatDate(publishedDay)}.`
        : null
  const hasNumbers = METRIC_FIELDS.some((f) => (values[f.key] ?? 0) > 0)
  const invalid = Boolean(dateError) || !hasNumbers

  function submit(event: FormEvent) {
    event.preventDefault()
    if (invalid || !recordedAt) return
    const optional = (value: number | null) => (value === null ? null : Math.max(0, value))
    const patch: MetricValues = {
      recorded_at: recordedAt,
      notes: notes.trim(),
      watch_time_seconds: optional(values.watch_time_seconds),
      avg_retention: optional(values.avg_retention),
    }
    for (const field of METRIC_FIELDS) {
      if (field.kind === "count") patch[field.key] = Math.max(0, Math.round(values[field.key] ?? 0))
    }
    if (snapshot) {
      dataActions.update("content_metrics", snapshot.id, patch)
      toast.success("Snapshot updated")
    } else {
      logMetrics(item.id, { ...patch, source: "manual" })
      toast.success("Snapshot added", { description: item.title || undefined })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{snapshot ? "Edit snapshot" : "Add snapshot"}</DialogTitle>
        <DialogDescription>
          {PLATFORMS[item.platform].label} · {item.title || "Untitled post"}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormField label="Recorded on" htmlFor="snapshot-recorded" required error={dateError} className="sm:w-56">
          <DatePicker
            id="snapshot-recorded"
            value={recordedAt}
            onChange={setRecordedAt}
            minDate={publishedDay ?? undefined}
            maxDate={today}
            clearable={false}
            aria-invalid={Boolean(dateError)}
          />
        </FormField>
        {previous ? (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setValues(initialInputs(previous))}>
            <CopyPlus aria-hidden />
            Start from last snapshot
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {METRIC_FIELDS.map((field) => {
          const hint = previous?.[field.key]
          return (
            <FormField key={field.key} label={field.label} htmlFor={`snapshot-${field.key}`}>
              <NumberField
                id={`snapshot-${field.key}`}
                value={values[field.key]}
                onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
                min={0}
                max={field.kind === "percent" ? 100 : undefined}
                integer={field.kind === "count"}
                placeholder={typeof hint === "number" ? `was ${formatNumber(hint)}` : "0"}
              />
            </FormField>
          )
        })}
      </div>

      <FormField label="Notes" htmlFor="snapshot-notes">
        <Textarea
          id="snapshot-notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="e.g. 48-hour check, boosted with ₱500"
        />
      </FormField>

      <DialogFooter className="items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {hasNumbers ? "Empty fields are saved as 0." : "Enter at least one number from the platform's insights."}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={invalid}>
            {snapshot ? "Save changes" : "Add snapshot"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
