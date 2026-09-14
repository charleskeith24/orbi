"use client"

import { Check, Pencil, ScanSearch } from "lucide-react"
import { toast } from "sonner"
import { AiButton, AiNotice, EmptyState, ProviderBadge } from "@/components/common"
import { AiErrorNotice } from "@/components/features/stories/ai-error"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { dataActions } from "@/lib/store"
import type { ResearchItem } from "@/lib/types"
import { AnalysisEditor } from "./analysis-editor"
import { canAnalyze, clearAnalysisDraft, editSavedAnalysis, updateAnalysisDraft, useAnalysisSession } from "./analysis-store"
import { AnalysisView } from "./analysis-view"
import { useResearchActions } from "./research-actions"
import { analysisIsEmpty, MIN_REFERENCE_CHARS, statusAfterAnalysis, toReferenceAnalysis } from "./research-model"

/**
 * The sheet's Analysis tab: analyze_reference → review and edit → save (status becomes "analyzed").
 * A saved analysis stays visible while a new one is generated.
 */
export function ResearchAnalysisPanel({ item }: { item: ResearchItem }) {
  const session = useAnalysisSession(item.id)
  const actions = useResearchActions()
  const pending = session.status === "pending"
  const ready = canAnalyze(item)
  const draft = session.draft
  const saved = item.analysis

  function save() {
    if (!draft || analysisIsEmpty(draft)) return
    const fresh = session.analyzedAt !== null
    const status = statusAfterAnalysis(item.status)
    dataActions.update("research_items", item.id, {
      analysis: toReferenceAnalysis(draft, session.provider ?? saved?.provider ?? "offline", session.analyzedAt ?? saved?.analyzed_at ?? new Date().toISOString()),
      ...(fresh ? { status } : {}),
    })
    clearAnalysisDraft(item.id)
    toast.success(fresh ? "Analysis saved" : "Analysis updated", {
      description: fresh && status !== item.status ? `${item.title} · marked as analyzed` : item.title,
    })
  }

  const analyzeButton = (label: string, variant: "ghost" | "default") => (
    <AiButton type="button" size="sm" variant={variant} pending={pending} pendingLabel="Analyzing…" disabled={!ready} onClick={() => actions.analyze(item)}>
      {label}
    </AiButton>
  )
  const error = session.error ? <AiErrorNotice message={session.error} onRetry={() => actions.analyze(item)} /> : null

  if (draft) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {session.analyzedAt ? "New analysis — review and edit it before saving." : "Editing the saved analysis."}
          </span>
          {session.provider ? <ProviderBadge provider={session.provider} model={session.model ?? undefined} /> : null}
          <div className="ml-auto">{analyzeButton("Re-analyze", "ghost")}</div>
        </div>
        {error}
        <AnalysisEditor value={draft} onChange={(next) => updateAnalysisDraft(item.id, next)} disabled={pending} />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => clearAnalysisDraft(item.id)}>
            Discard
          </Button>
          <Button type="button" size="sm" disabled={pending || analysisIsEmpty(draft)} onClick={save}>
            <Check aria-hidden />
            Save analysis
          </Button>
        </div>
        <AiNotice>The analysis explains why the reference works — it never rewrites it. Borrow the structure, bring your own substance.</AiNotice>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProviderBadge provider={saved.provider} />
          <span className="text-xs text-muted-foreground">Analyzed {formatDate(saved.analyzed_at)}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => editSavedAnalysis(item)}>
              <Pencil aria-hidden />
              Edit
            </Button>
            {analyzeButton("Re-analyze", "ghost")}
          </div>
        </div>
        {error}
        <AnalysisView analysis={saved} />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {error}
      <EmptyState
        compact
        icon={ScanSearch}
        title="Not analyzed yet"
        description="Find out why it works — the hook, structure, angle, psychology and the patterns you can borrow."
        action={analyzeButton("Analyze", "default")}
        className="rounded-lg border border-dashed"
      />
      {ready ? null : (
        <p className="text-center text-xs text-pretty text-muted-foreground">
          Paste the reference text, a transcript or your notes in Details first — at least {MIN_REFERENCE_CHARS} characters.
        </p>
      )}
    </div>
  )
}
