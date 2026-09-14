"use client"

import { NotebookPen, Target } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, ProviderBadge, SectionCard, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { buildWeeklyReviewInput, summarizeWeeklyReport, useAiTask } from "@/lib/ai"
import type { WeeklyReport } from "@/lib/analytics"
import { formatDateTime } from "@/lib/dates"
import type { Database, GeneratedBy, ReviewStatus, WeeklyReview } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error-notice"
import type { ReportPeriod } from "./report-periods"
import { saveWeeklyReview } from "./review-actions"
import {
  hasWeeklyText,
  sameWeeklyFields,
  trimWeeklyFields,
  WEEKLY_FIELDS,
  weeklyFieldsOf,
  weeklyReviewState,
  type WeeklyReviewFields,
} from "./review-model"
import { ReviewStatusBadge } from "./review-status"

interface Engine {
  provider: GeneratedBy
  model?: string
}

/**
 * WHAT WORKED · WHAT DIDN'T · WHAT WE LEARNED · DOUBLE DOWN · STOP · TEST NEXT WEEK — drafted by the
 * `weekly_review` task from the week's numbers, editable, saved (upsert by week) with a frozen stats snapshot.
 * Mount with `key={period.key}` so switching weeks loads that week's saved text.
 */
export function WeeklyReviewEditor({
  db,
  report,
  period,
  saved,
  now,
  className,
}: {
  db: Database
  report: WeeklyReport
  period: ReportPeriod
  saved: WeeklyReview | undefined
  now: Date
  className?: string
}) {
  const [fields, setFields] = useState<WeeklyReviewFields>(() => weeklyFieldsOf(saved))
  const [status, setStatus] = useState<ReviewStatus>(() => saved?.status ?? "draft")
  const [engine, setEngine] = useState<Engine | null>(() => (saved?.generated_by ? { provider: saved.generated_by } : null))
  const ai = useAiTask("weekly_review")
  const [confirm, confirmDialog] = useConfirm()

  const baseline = weeklyFieldsOf(saved)
  const savedHasText = hasWeeklyText(baseline)
  const hasText = hasWeeklyText(fields)
  const textChanged = !sameWeeklyFields(fields, baseline)
  const statusChanged = saved ? saved.status !== status : false
  const canSave = hasText && (textChanged || statusChanged)
  const focus = saved?.focus.trim() ?? ""

  async function generate() {
    if (hasText) {
      const ok = await confirm({
        title: "Replace the review text?",
        description: "The new draft replaces all six sections. Nothing is saved until you click Save.",
        confirmLabel: "Replace",
        destructive: false,
      })
      if (!ok) return
    }
    const result = await ai.run(buildWeeklyReviewInput(db, period.start, now, focus.slice(0, 300)))
    if (!result) return
    const o = result.output
    setFields({
      what_worked: o.what_worked,
      what_didnt: o.what_didnt,
      learned: o.learned,
      double_down: o.double_down,
      stop: o.stop,
      test_next: o.test_next,
    })
    setEngine({ provider: result.provider, model: result.model })
  }

  function save() {
    if (!canSave) return
    const clean = trimWeeklyFields(fields)
    const summary = summarizeWeeklyReport(report, db, now)
    saveWeeklyReview(period, {
      fields: clean,
      status,
      generatedBy: engine?.provider ?? "manual",
      report: { ...summary, saved_at: new Date().toISOString() },
    })
    setFields(clean)
    toast.success(status === "final" ? `Final review saved for ${period.label}` : `Draft review saved for ${period.label}`)
  }

  const hint = !hasText
    ? "Draft it from this week's numbers with AI, or write it yourself."
    : canSave
      ? savedHasText
        ? "Unsaved changes."
        : "Not saved yet."
      : status === "final"
        ? "Saved as final, with this week's numbers frozen alongside."
        : "Saved as a draft."

  return (
    <SectionCard
      title="Weekly review"
      description="What worked, what didn't, what we learned — and what to double down on, stop and test next week."
      icon={NotebookPen}
      className={className}
      action={
        <AiButton size="sm" pending={ai.isPending} onClick={() => void generate()} className="print:hidden">
          {hasText ? "Regenerate" : "Draft with AI"}
        </AiButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ReviewStatusBadge state={weeklyReviewState(saved)} />
          {engine ? <ProviderBadge provider={engine.provider} model={engine.model} /> : null}
          {saved && savedHasText ? <span className="num">Saved {formatDateTime(saved.updated_at)}</span> : null}
          {focus ? (
            <span className="flex min-w-0 items-center gap-1">
              <Target className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate" title={focus}>
                Focus: {focus}
              </span>
            </span>
          ) : null}
        </div>
        {engine && engine.provider !== "manual" ? <AiNotice className="print:hidden" /> : null}
        <AiErrorNotice error={ai.error} title="Couldn't draft the review." onRetry={() => void generate()} />
        <div className="grid gap-4 md:grid-cols-2">
          {WEEKLY_FIELDS.map((field) => (
            <div key={field.key} className="flex min-w-0 flex-col gap-1.5 print:break-inside-avoid">
              <Label htmlFor={`weekly-review-${field.key}`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {field.label}
              </Label>
              <Textarea
                id={`weekly-review-${field.key}`}
                value={fields[field.key]}
                placeholder={field.placeholder}
                readOnly={ai.isPending}
                aria-busy={ai.isPending || undefined}
                onChange={(event) => {
                  const value = event.target.value
                  setFields((prev) => ({ ...prev, [field.key]: value }))
                }}
                className={cn("min-h-24 print:hidden", ai.isPending && "opacity-70")}
              />
              <p className="hidden text-sm whitespace-pre-wrap print:block">{fields[field.key].trim() || "—"}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 print:hidden">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {hint}
          </p>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              spacing={0}
              value={status}
              onValueChange={(value) => {
                if (value === "draft" || value === "final") setStatus(value)
              }}
              aria-label="Save as"
            >
              <ToggleGroupItem value="draft" className="px-2.5 text-xs">
                Draft
              </ToggleGroupItem>
              <ToggleGroupItem value="final" className="px-2.5 text-xs">
                Final
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" onClick={save} disabled={!canSave || ai.isPending}>
              {status === "final" ? "Save as final" : "Save draft"}
            </Button>
          </div>
        </div>
      </div>
      {confirmDialog}
    </SectionCard>
  )
}
