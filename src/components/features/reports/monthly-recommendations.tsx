"use client"

import { Ban, Compass, FlaskConical, Repeat, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, ListEditor, ProviderBadge, SectionCard, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { buildMonthlyReviewInput, summarizeMonthlyReport, useAiTask } from "@/lib/ai"
import { monthlyReport, type MonthlyReport } from "@/lib/analytics"
import { formatDateTime } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { useSettings } from "@/lib/store"
import type { Database, GeneratedBy, MonthlyReview, ReviewStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error-notice"
import { ExperimentList } from "./experiment-list"
import { reportMessages } from "./messages"
import { monthlyReviewMessages } from "./monthly-messages"
import type { ReportPeriod } from "./report-periods"
import { saveMonthlyReview } from "./review-actions"
import {
  hasMonthlyText,
  MONTHLY_LISTS,
  monthlyFieldsOf,
  monthlyReviewState,
  sameMonthlyFields,
  trimMonthlyFields,
  type MonthlyListKey,
  type MonthlyReviewFields,
} from "./review-model"
import { ReviewStatusBadge } from "./review-status"

const LIST_ICONS: Record<MonthlyListKey, LucideIcon> = {
  continue_doing: Repeat,
  increase: TrendingUp,
  reduce: TrendingDown,
  stop: Ban,
  experiment: FlaskConical,
}

interface Engine {
  provider: GeneratedBy
  model?: string
}

/**
 * MONTHLY STRATEGIC RECOMMENDATIONS — Continue · Increase · Reduce · Stop · Experiment, drafted by the
 * `monthly_review` task, editable, saved (upsert by month). Mount with `key={period.key}`.
 */
export function MonthlyRecommendations({
  db,
  report,
  period,
  saved,
  now,
  className,
}: {
  db: Database
  report: MonthlyReport
  period: ReportPeriod
  saved: MonthlyReview | undefined
  now: Date
  className?: string
}) {
  const t = useT(monthlyReviewMessages)
  const r = useT(reportMessages)
  const lang = useUiLang()
  const settings = useSettings()
  const [fields, setFields] = useState<MonthlyReviewFields>(() => monthlyFieldsOf(saved))
  const [status, setStatus] = useState<ReviewStatus>(() => saved?.status ?? "draft")
  const [engine, setEngine] = useState<Engine | null>(() => (saved?.generated_by ? { provider: saved.generated_by } : null))
  const ai = useAiTask("monthly_review")
  const [confirm, confirmDialog] = useConfirm()

  const baseline = monthlyFieldsOf(saved)
  const hasText = hasMonthlyText(fields)
  const textChanged = !sameMonthlyFields(fields, baseline)
  const statusChanged = saved ? saved.status !== status : false
  const canSave = hasText && (textChanged || statusChanged)

  const setList = (key: MonthlyListKey, value: string[]) => setFields((prev) => ({ ...prev, [key]: value }))

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
    const result = await ai.run(buildMonthlyReviewInput(db, period.start, now))
    if (!result) return
    const o = result.output
    setFields({
      summary: o.summary,
      continue_doing: [...o.continue_doing],
      increase: [...o.increase],
      reduce: [...o.reduce],
      stop: [...o.stop],
      experiment: [...o.experiment],
    })
    setEngine({ provider: result.provider, model: result.model })
  }

  function save() {
    if (!canSave) return
    const clean = trimMonthlyFields(fields)
    // The frozen snapshot stays in English whatever the UI language (like the AI input).
    const source = lang === "en" ? report : monthlyReport(db, period.start, settings, now)
    const summary = summarizeMonthlyReport(source, db, now)
    saveMonthlyReview(period, {
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
      ? hasMonthlyText(baseline)
        ? r("unsaved_changes")
        : r("not_saved_yet")
      : status === "final"
        ? t("hint_final")
        : r("saved_as_draft")

  return (
    <SectionCard
      title={t("recommendations")}
      info={t("recommendations_info")}
      icon={Compass}
      className={className}
      action={
        <AiButton size="sm" pending={ai.isPending} onClick={() => void generate()} className="print:hidden">
          {hasText ? r("regenerate") : r("draft_with_ai")}
        </AiButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ReviewStatusBadge state={monthlyReviewState(saved)} />
          {engine ? <ProviderBadge provider={engine.provider} model={engine.model} /> : null}
          {saved ? <span className="num">{r("saved_at", { date: formatDateTime(saved.updated_at) })}</span> : null}
        </div>
        {engine && engine.provider !== "manual" ? <AiNotice className="print:hidden" /> : null}
        <AiErrorNotice error={ai.error} title={t("recommendations_error")} onRetry={() => void generate()} />

        <div className="flex min-w-0 flex-col gap-1.5 print:break-inside-avoid">
          <Label htmlFor="monthly-summary" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("summary")}
          </Label>
          <Textarea
            id="monthly-summary"
            value={fields.summary}
            placeholder={t("summary_placeholder")}
            readOnly={ai.isPending}
            aria-busy={ai.isPending || undefined}
            onChange={(event) => {
              const value = event.target.value
              setFields((prev) => ({ ...prev, summary: value }))
            }}
            className={cn("min-h-20 print:hidden", ai.isPending && "opacity-70")}
          />
          <p className="hidden text-sm whitespace-pre-wrap print:block">{fields.summary.trim() || "—"}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {MONTHLY_LISTS.map((list) => {
            const Icon = LIST_ICONS[list.key]
            const inputId = `monthly-${list.key}`
            const items = fields[list.key]
            return (
              <div key={list.key} className="flex min-w-0 flex-col gap-2 print:break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <Label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <Icon className="size-3.5" aria-hidden />
                    {list.label}
                    {items.length ? <span className="font-normal normal-case num">· {items.length}</span> : null}
                  </Label>
                </div>
                {list.key === "experiment" ? (
                  <ExperimentList
                    id={inputId}
                    value={items}
                    onChange={(value) => setList("experiment", value)}
                    placeholder={t(`placeholder_${list.key}`)}
                    disabled={ai.isPending}
                  />
                ) : (
                  <ListEditor
                    id={inputId}
                    variant="lines"
                    value={items}
                    onChange={(value) => setList(list.key, value)}
                    placeholder={t(`placeholder_${list.key}`)}
                    addLabel={t("add")}
                    aria-label={list.label}
                    disabled={ai.isPending}
                    className="print:hidden"
                  />
                )}
                <ol className="hidden list-decimal space-y-1 pl-5 text-sm print:block">
                  {items.length ? items.map((item, i) => <li key={i}>{item}</li>) : <li className="list-none">—</li>}
                </ol>
              </div>
            )
          })}
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
