"use client"

import { Check, ScanSearch } from "lucide-react"
import { AiButton, EmptyState, ProviderBadge } from "@/components/common"
import { AiErrorNotice } from "@/components/features/stories/ai-error"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { adaptMessages } from "./adapt-messages"
import type { AdaptAnalysis } from "./adapt-model"
import { AnalysisEditor } from "./analysis-editor"
import type { AnalysisFields } from "./research-model"
import { StepCard, type StepState } from "./step-card"

/** Step 2: analyze_reference (or the library's saved analysis), editable before adapting. */
export function AdaptAnalysisStep({
  state,
  analysis,
  pending,
  error,
  canAnalyze,
  hint,
  onAnalyze,
  onChange,
  onSaveToReference,
}: {
  state: StepState
  analysis: AdaptAnalysis | null
  pending: boolean
  error: string | null
  canAnalyze: boolean
  /** Why Analyze is unavailable, when it is. */
  hint: string
  onAnalyze: () => void
  onChange: (fields: AnalysisFields) => void
  /** Library references only: store an unsaved analysis on the reference. */
  onSaveToReference?: () => void
}) {
  const t = useT(adaptMessages)
  return (
    <StepCard
      step={2}
      state={state}
      title={t("analysis")}
      description={t("analysis_description")}
      action={
        analysis ? (
          <AiButton type="button" size="sm" variant="ghost" pending={pending} pendingLabel={t("analyzing")} disabled={!canAnalyze} onClick={onAnalyze}>
            {t("reanalyze")}
          </AiButton>
        ) : null
      }
    >
      {state === "locked" ? (
        <p>{t("locked_step1")}</p>
      ) : analysis ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ProviderBadge provider={analysis.provider} model={analysis.model ?? undefined} />
            <span>
              {onSaveToReference && !analysis.unsaved ? t("saved_on_reference") : ""}
              {t("analyzed_on", { date: formatDate(analysis.analyzedAt) })}
            </span>
            {onSaveToReference && analysis.unsaved ? (
              <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={onSaveToReference}>
                <Check aria-hidden />
                {t("save_to_reference")}
              </Button>
            ) : null}
          </div>
          {error ? <AiErrorNotice message={error} retryLabel={t("retry")} onRetry={onAnalyze} /> : null}
          <AnalysisEditor value={analysis.fields} onChange={onChange} disabled={pending} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {error ? <AiErrorNotice message={error} retryLabel={t("retry")} onRetry={onAnalyze} /> : null}
          <EmptyState
            compact
            icon={ScanSearch}
            title={t("analyze_title")}
            description={t("analyze_description")}
            action={
              <AiButton type="button" size="sm" variant="default" pending={pending} pendingLabel={t("analyzing")} disabled={!canAnalyze} onClick={onAnalyze}>
                {t("analyze_reference")}
              </AiButton>
            }
            className="rounded-lg border border-dashed"
          />
          {hint ? <p className="text-center text-xs text-pretty text-muted-foreground">{hint}</p> : null}
        </div>
      )}
    </StepCard>
  )
}
