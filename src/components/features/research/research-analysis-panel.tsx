"use client"

import { Check, Pencil, ScanSearch } from "lucide-react"
import { toast } from "sonner"
import { AiButton, AiNotice, EmptyState, ProviderBadge } from "@/components/common"
import { AiErrorNotice } from "@/components/features/stories/ai-error"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { ResearchItem } from "@/lib/types"
import { AnalysisEditor } from "./analysis-editor"
import { canAnalyze, clearAnalysisDraft, editSavedAnalysis, updateAnalysisDraft, useAnalysisSession } from "./analysis-store"
import { AnalysisView } from "./analysis-view"
import { researchMessages } from "./messages"
import { useResearchActions } from "./research-actions"
import { analysisIsEmpty, MIN_REFERENCE_CHARS, statusAfterAnalysis, toReferenceAnalysis } from "./research-model"

/**
 * The sheet's Analysis tab: analyze_reference → review and edit → save (status becomes "analyzed").
 * A saved analysis stays visible while a new one is generated.
 */
export function ResearchAnalysisPanel({ item }: { item: ResearchItem }) {
  const t = useT(researchMessages)
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
    toast.success(fresh ? t("analysis_saved") : t("analysis_updated"), {
      description: fresh && status !== item.status ? t("marked_analyzed", { title: item.title }) : item.title,
    })
  }

  const analyzeButton = (label: string, variant: "ghost" | "default") => (
    <AiButton type="button" size="sm" variant={variant} pending={pending} pendingLabel={t("analyzing")} disabled={!ready} onClick={() => actions.analyze(item)}>
      {label}
    </AiButton>
  )
  const error = session.error ? <AiErrorNotice message={session.error} retryLabel={t("retry")} onRetry={() => actions.analyze(item)} /> : null

  if (draft) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {session.analyzedAt ? t("new_analysis") : t("editing_saved")}
          </span>
          {session.provider ? <ProviderBadge provider={session.provider} model={session.model ?? undefined} /> : null}
          <div className="ml-auto">{analyzeButton(t("reanalyze"), "ghost")}</div>
        </div>
        {error}
        <AnalysisEditor value={draft} onChange={(next) => updateAnalysisDraft(item.id, next)} disabled={pending} />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => clearAnalysisDraft(item.id)}>
            {t("discard")}
          </Button>
          <Button type="button" size="sm" disabled={pending || analysisIsEmpty(draft)} onClick={save}>
            <Check aria-hidden />
            {t("save_analysis")}
          </Button>
        </div>
        <AiNotice>{t("analysis_notice")}</AiNotice>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProviderBadge provider={saved.provider} />
          <span className="text-xs text-muted-foreground">{t("analyzed_on", { date: formatDate(saved.analyzed_at) })}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => editSavedAnalysis(item)}>
              <Pencil aria-hidden />
              {t("edit")}
            </Button>
            {analyzeButton(t("reanalyze"), "ghost")}
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
        title={t("not_analyzed")}
        description={t("not_analyzed_description")}
        action={analyzeButton(t("analyze"), "default")}
        className="rounded-lg border border-dashed"
      />
      {ready ? null : (
        <p className="text-center text-xs text-pretty text-muted-foreground">
          {t("paste_in_details", { min: MIN_REFERENCE_CHARS })}
        </p>
      )}
    </div>
  )
}
