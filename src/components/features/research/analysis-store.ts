import { create } from "zustand"
import { runAiTask, toAiError } from "@/lib/ai"
import type { AiProviderId, ID, ResearchItem } from "@/lib/types"
import { analysisFields, MIN_REFERENCE_CHARS, type AnalysisFields } from "./research-model"

/** One reference's analysis in progress: a fresh AI result or the saved analysis being edited. */
export interface AnalysisSession {
  status: "idle" | "pending" | "done" | "error"
  /** Editable analysis waiting to be saved. */
  draft: AnalysisFields | null
  provider: AiProviderId | null
  model: string | null
  /** When a fresh AI analysis was produced; null while editing the saved one (it keeps its date). */
  analyzedAt: string | null
  error: string | null
  request: number
}

const IDLE: AnalysisSession = { status: "idle", draft: null, provider: null, model: null, analyzedAt: null, error: null, request: 0 }

interface AnalysisStoreState {
  sessions: Record<ID, AnalysisSession>
}

/** Module-level so "Analyze" from a row menu can start before the sheet that shows it has mounted. */
export const useAnalysisStore = create<AnalysisStoreState>(() => ({ sessions: {} }))

export function useAnalysisSession(id: ID): AnalysisSession {
  return useAnalysisStore((state) => state.sessions[id] ?? IDLE)
}

function patchSession(id: ID, patch: (session: AnalysisSession) => Partial<AnalysisSession>) {
  useAnalysisStore.setState((state) => {
    const current = state.sessions[id] ?? IDLE
    return { sessions: { ...state.sessions, [id]: { ...current, ...patch(current) } } }
  })
}

export function canAnalyze(item: Pick<ResearchItem, "content">): boolean {
  return item.content.trim().length >= MIN_REFERENCE_CHARS
}

let requestSeq = 0

/** analyze_reference on the reference's pasted text. The result waits in the session for review before saving. */
export async function runReferenceAnalysis(item: ResearchItem): Promise<boolean> {
  if (!canAnalyze(item)) return false
  const request = ++requestSeq
  patchSession(item.id, () => ({ status: "pending", error: null, request }))
  try {
    const result = await runAiTask(
      "analyze_reference",
      {
        content: item.content.trim().slice(0, 15000),
        platform: item.platform,
        creator: item.creator.trim().slice(0, 120) || null,
        title: item.title.trim().slice(0, 300) || null,
      },
      { entityType: "research_items", entityId: item.id }
    )
    if (useAnalysisStore.getState().sessions[item.id]?.request !== request) return false
    patchSession(item.id, () => ({
      status: "done",
      draft: analysisFields(result.output),
      provider: result.provider,
      model: result.model,
      analyzedAt: new Date().toISOString(),
    }))
    return true
  } catch (err) {
    if (useAnalysisStore.getState().sessions[item.id]?.request !== request) return false
    patchSession(item.id, () => ({ status: "error", error: toAiError(err).message }))
    return false
  }
}

export function editSavedAnalysis(item: ResearchItem) {
  const saved = item.analysis
  if (!saved) return
  patchSession(item.id, () => ({ status: "done", draft: analysisFields(saved), provider: saved.provider, model: null, analyzedAt: null, error: null }))
}

export function updateAnalysisDraft(id: ID, draft: AnalysisFields) {
  patchSession(id, () => ({ draft }))
}

export function clearAnalysisDraft(id: ID) {
  patchSession(id, () => ({ status: "idle", draft: null, analyzedAt: null, error: null }))
}
