"use client"

import { Check, ScanSearch } from "lucide-react"
import { AiButton, EmptyState, ProviderBadge } from "@/components/common"
import { AiErrorNotice } from "@/components/features/stories/ai-error"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
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
  return (
    <StepCard
      step={2}
      state={state}
      title="Analysis"
      description="Why it works — hook, structure, angle, psychology and the patterns to borrow. Edit anything before you adapt it."
      action={
        analysis ? (
          <AiButton type="button" size="sm" variant="ghost" pending={pending} pendingLabel="Analyzing…" disabled={!canAnalyze} onClick={onAnalyze}>
            Re-analyze
          </AiButton>
        ) : null
      }
    >
      {state === "locked" ? (
        <p>Add a reference in step 1 first.</p>
      ) : analysis ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ProviderBadge provider={analysis.provider} model={analysis.model ?? undefined} />
            <span>
              {onSaveToReference && !analysis.unsaved ? "Saved on the reference · " : ""}analyzed {formatDate(analysis.analyzedAt)}
            </span>
            {onSaveToReference && analysis.unsaved ? (
              <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={onSaveToReference}>
                <Check aria-hidden />
                Save to reference
              </Button>
            ) : null}
          </div>
          {error ? <AiErrorNotice message={error} onRetry={onAnalyze} /> : null}
          <AnalysisEditor value={analysis.fields} onChange={onChange} disabled={pending} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {error ? <AiErrorNotice message={error} onRetry={onAnalyze} /> : null}
          <EmptyState
            compact
            icon={ScanSearch}
            title="Analyze the reference"
            description="The AI explains why it works — it describes the reference, it never rewrites it."
            action={
              <AiButton type="button" size="sm" variant="default" pending={pending} pendingLabel="Analyzing…" disabled={!canAnalyze} onClick={onAnalyze}>
                Analyze reference
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
