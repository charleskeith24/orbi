"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChipToggleGroup, DatePicker, FormField, FormRow, OptionSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EXPERIMENT_METRICS, EXPERIMENT_TEMPLATES } from "@/lib/constants"
import { dataActions } from "@/lib/store"
import type { ContentExperiment, ExperimentMetric } from "@/lib/types"
import { formValuesOf, validateExperiment, type ExperimentFormValues } from "./experiment-model"

const METRIC_OPTIONS = EXPERIMENT_METRICS.map((m) => ({ value: m.id, label: m.label }))
const TEMPLATE_OPTIONS = EXPERIMENT_TEMPLATES.map((t) => ({ value: t.name, label: t.name }))

/** Create (from a template or blank) or edit an experiment's design. */
export function ExperimentFormDialog({
  open,
  experiment,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  experiment: ContentExperiment | null
  onOpenChange: (open: boolean) => void
  onSaved: (experiment: ContentExperiment, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <ExperimentForm
          key={experiment?.id ?? "new"}
          experiment={experiment}
          onCancel={() => onOpenChange(false)}
          onSaved={(row, created) => {
            onOpenChange(false)
            onSaved(row, created)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function ExperimentForm({
  experiment,
  onCancel,
  onSaved,
}: {
  experiment: ContentExperiment | null
  onCancel: () => void
  onSaved: (experiment: ContentExperiment, created: boolean) => void
}) {
  const [values, setValues] = useState<ExperimentFormValues>(() => formValuesOf(experiment))
  const [template, setTemplate] = useState<string | null>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof ExperimentFormValues, boolean>>>({})
  const errors = validateExperiment(values)
  const valid = Object.keys(errors).length === 0
  const errorOf = (key: keyof ExperimentFormValues) => (touched[key] ? errors[key] : undefined)
  const touch = (key: keyof ExperimentFormValues) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }))
  const set = <K extends keyof ExperimentFormValues>(key: K, value: ExperimentFormValues[K]) => setValues((v) => ({ ...v, [key]: value }))

  function applyTemplate(name: string | null) {
    setTemplate(name)
    const preset = EXPERIMENT_TEMPLATES.find((t) => t.name === name)
    if (!preset) return
    setValues((v) => ({
      ...v,
      name: preset.name,
      hypothesis: preset.hypothesis,
      variant_a: preset.variant_a,
      variant_b: preset.variant_b,
      metric: preset.metric,
    }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) {
      setTouched({ name: true, variant_a: true, variant_b: true, end_date: true })
      return
    }
    const payload = {
      name: values.name.trim(),
      hypothesis: values.hypothesis.trim(),
      variant_a: values.variant_a.trim(),
      variant_b: values.variant_b.trim(),
      metric: values.metric,
      start_date: values.start_date,
      end_date: values.end_date,
    }
    if (experiment) {
      dataActions.update("content_experiments", experiment.id, payload)
      toast.success("Experiment updated", { description: payload.name })
      onSaved({ ...experiment, ...payload }, false)
    } else {
      const row = dataActions.insert("content_experiments", { ...payload, status: "planned" })
      toast.success("Experiment created", { description: "Link published posts to each variant as you post them." })
      onSaved(row, true)
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{experiment ? "Edit experiment" : "New experiment"}</DialogTitle>
        <DialogDescription className="text-xs">
          Change one variable, keep everything else the same, and compare the two variants on one metric.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        {experiment ? null : (
          <FormField label="Start from a template" description="Pick one to prefill the design, or leave all unselected to start blank.">
            <ChipToggleGroup options={TEMPLATE_OPTIONS} value={template} onChange={applyTemplate} size="xs" aria-label="Experiment templates" />
          </FormField>
        )}

        <FormField label="Experiment" htmlFor="experiment-name" required error={errorOf("name")}>
          <Input
            id="experiment-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => touch("name")}
            maxLength={120}
            placeholder="e.g. Short hooks vs long hooks on TikTok"
            aria-invalid={Boolean(errorOf("name"))}
            autoFocus
          />
        </FormField>

        <FormField label="Hypothesis" htmlFor="experiment-hypothesis" description="What you expect to happen, and why.">
          <Textarea
            id="experiment-hypothesis"
            value={values.hypothesis}
            onChange={(e) => set("hypothesis", e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Hooks under 8 words hold attention better for our TikTok audience."
          />
        </FormField>

        <FormRow>
          <FormField label="Variant A" htmlFor="experiment-variant-a" required error={errorOf("variant_a")}>
            <Input
              id="experiment-variant-a"
              value={values.variant_a}
              onChange={(e) => set("variant_a", e.target.value)}
              onBlur={() => touch("variant_a")}
              maxLength={120}
              placeholder="e.g. Hook under 8 words"
              aria-invalid={Boolean(errorOf("variant_a"))}
            />
          </FormField>
          <FormField label="Variant B" htmlFor="experiment-variant-b" required error={errorOf("variant_b")}>
            <Input
              id="experiment-variant-b"
              value={values.variant_b}
              onChange={(e) => set("variant_b", e.target.value)}
              onBlur={() => touch("variant_b")}
              maxLength={120}
              placeholder="e.g. Hook of 15+ words"
              aria-invalid={Boolean(errorOf("variant_b"))}
            />
          </FormField>
        </FormRow>

        <FormField label="Metric" htmlFor="experiment-metric" description="Compared per post, from each post's latest analytics snapshot.">
          <OptionSelect<ExperimentMetric>
            id="experiment-metric"
            value={values.metric}
            onChange={(next) => set("metric", next ?? values.metric)}
            options={METRIC_OPTIONS}
          />
        </FormField>

        <FormRow>
          <FormField label="Start date" htmlFor="experiment-start">
            <DatePicker id="experiment-start" value={values.start_date} onChange={(next) => set("start_date", next)} />
          </FormField>
          <FormField label="End date" htmlFor="experiment-end" error={errorOf("end_date") ?? (values.end_date ? errors.end_date : undefined)}>
            <DatePicker
              id="experiment-end"
              value={values.end_date}
              onChange={(next) => {
                set("end_date", next)
                touch("end_date")
              }}
              minDate={values.start_date ?? undefined}
              aria-invalid={Boolean(errors.end_date)}
            />
          </FormField>
        </FormRow>
      </div>

      <DialogFooter className="m-0 items-center rounded-b-xl border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {experiment ? "Save changes" : "Create experiment"}
        </Button>
      </DialogFooter>
    </form>
  )
}
