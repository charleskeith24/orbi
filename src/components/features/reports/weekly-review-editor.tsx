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
import { weeklyReport, type WeeklyReport } from "@/lib/analytics"
import { formatDateTime } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { useSettings } from "@/lib/store"
import type { Database, GeneratedBy, ReviewStatus, WeeklyReview } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error-notice"
import { reportMessages } from "./messages"
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
import { weeklyReportMessages } from "./weekly-messages"

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
  const t = useT(weeklyReportMessages)
  const r = useT(reportMessages)
  const lang = useUiLang()
  const settings = useSettings()
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
        title: t("replace_title"),
        description: t("replace_description"),
        confirmLabel: r("replace"),
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
    // The frozen snapshot stays in English whatever the UI language (like the AI input).
    const source = lang === "en" ? report : weeklyReport(db, period.start, settings, now)
    const summary = summarizeWeeklyReport(source, db, now)
    saveWeeklyReview(period, {
      fields: clean,
      status,
      generatedBy: engine?.provider ?? "manual",
      report: { ...summary, saved_at: new Date().toISOString() },
    })
    setFields(clean)
    toast.success(status === "final" ? r("saved_final", { period: period.label }) : r("saved_draft", { period: period.label }))
  }

  const hint = !hasText
    ? t("hint_empty")
    : canSave
      ? savedHasText
        ? r("unsaved_changes")
        : r("not_saved_yet")
      : status === "final"
        ? t("hint_final")
        : r("saved_as_draft")

  return (
    <SectionCard
      title={t("review_title")}
      info={t("review_info")}
      icon={NotebookPen}
      className={className}
      action={
        <AiButton size="sm" pending={ai.isPending} onClick={() => void generate()} className="print:hidden">
          {hasText ? r("regenerate") : r("draft_with_ai")}
        </AiButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ReviewStatusBadge state={weeklyReviewState(saved)} />
          {engine ? <ProviderBadge provider={engine.provider} model={engine.model} /> : null}
          {saved && savedHasText ? <span className="num">{r("saved_at", { date: formatDateTime(saved.updated_at) })}</span> : null}
          {focus ? (
            <span className="flex min-w-0 items-center gap-1">
              <Target className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate" title={focus}>
                {t("focus", { focus })}
              </span>
            </span>
          ) : null}
        </div>
        {engine && engine.provider !== "manual" ? <AiNotice className="print:hidden" /> : null}
        <AiErrorNotice error={ai.error} title={t("review_error")} onRetry={() => void generate()} />
        <div className="grid gap-4 md:grid-cols-2">
          {WEEKLY_FIELDS.map((key) => (
            <div key={key} className="flex min-w-0 flex-col gap-1.5 print:break-inside-avoid">
              <Label htmlFor={`weekly-review-${key}`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t(`label_${key}`)}
              </Label>
              <Textarea
                id={`weekly-review-${key}`}
                value={fields[key]}
                placeholder={t(`placeholder_${key}`)}
                readOnly={ai.isPending}
                aria-busy={ai.isPending || undefined}
                onChange={(event) => {
                  const value = event.target.value
                  setFields((prev) => ({ ...prev, [key]: value }))
                }}
                className={cn("min-h-24 print:hidden", ai.isPending && "opacity-70")}
              />
              <p className="hidden text-sm whitespace-pre-wrap print:block">{fields[key].trim() || "—"}</p>
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
              aria-label={r("save_as")}
            >
              <ToggleGroupItem value="draft" className="px-2.5 text-xs">
                {r("draft")}
              </ToggleGroupItem>
              <ToggleGroupItem value="final" className="px-2.5 text-xs">
                {r("final")}
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" onClick={save} disabled={!canSave || ai.isPending}>
              {status === "final" ? r("save_as_final") : r("save_draft")}
            </Button>
          </div>
        </div>
      </div>
      {confirmDialog}
    </SectionCard>
  )
}
