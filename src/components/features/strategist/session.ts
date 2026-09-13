import { useMemo } from "react"
import { toast } from "sonner"
import { create } from "zustand"
import {
  buildAnalyticsSnapshot,
  buildBrandContext,
  buildStrategistInput,
  runAiTask,
  toAiError,
  type AiRunResult,
} from "@/lib/ai"
import { dataActions, useDataStore, useTable } from "@/lib/store"
import { consideredContext } from "./considered-context"
import {
  historyMessages,
  MAX_QUESTION_CHARS,
  parseIdeas,
  parseTurns,
  settledTurns,
  storedTurnInput,
  STRATEGIST_TASK,
  type ContextChip,
} from "./turns"

export interface PendingTurn {
  question: string
  /** When it was asked (ISO). Log rows created since then belong to this question until it settles. */
  since: string
  status: "sending" | "error"
  error: string | null
}

interface SessionState {
  pending: PendingTurn | null
  /** Composer text, shared by the panel and the full page. */
  draft: string
  /** Bumped when a composer should take focus (e.g. a failed question was put back for editing). */
  focusRequest: number
  /** Caret position for that focus (null = end of the draft). */
  caret: number | null
}

/**
 * One strategist conversation for the whole app: the panel and /strategist share the draft and the
 * question in flight, and a request keeps running when the panel closes or the route changes.
 */
export const useStrategistSession = create<SessionState>()(() => ({ pending: null, draft: "", focusRequest: 0, caret: null }))

let inFlight: AbortController | null = null
let abortReason: "stop" | "clear" = "stop"

function setPending(pending: PendingTurn | null) {
  useStrategistSession.setState({ pending })
}

/** Rewrite the log row runAiTask created with the lossless turn record (or add one if it couldn't log). */
function persistTurn(result: AiRunResult<"strategist_chat">, question: string, context: ContextChip[]) {
  const record = { input: storedTurnInput(question, context), output: result.output }
  const id = result.generationId
  if (id && useDataStore.getState().db.ai_generations.some((row) => row.id === id)) {
    dataActions.update("ai_generations", id, record)
    return
  }
  dataActions.insert("ai_generations", {
    task: STRATEGIST_TASK,
    provider: result.provider,
    model: result.model,
    status: "success",
    duration_ms: Math.round(result.durationMs),
    ...record,
  })
}

async function ask(question: string) {
  const now = new Date()
  const db = useDataStore.getState().db
  const input = buildStrategistInput(db, now, historyMessages(parseTurns(db.ai_generations), question))
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller
  abortReason = "stop"
  setPending({ question, since: now.toISOString(), status: "sending", error: null })
  try {
    const result = await runAiTask("strategist_chat", input, { signal: controller.signal, now })
    if (inFlight !== controller) {
      // Cleared while the answer was on its way: drop the row runAiTask just logged.
      if (result.generationId) dataActions.remove("ai_generations", result.generationId)
      return
    }
    const latest = useDataStore.getState().db
    const context = consideredContext({
      context: buildBrandContext(latest, now, { focus: question }),
      snapshot: buildAnalyticsSnapshot(latest, now),
      question,
      reply: result.output.reply,
      ideas: parseIdeas(result.output.suggested_ideas),
    })
    persistTurn(result, question, context)
    setPending(null)
  } catch (err) {
    const error = toAiError(err)
    if (error.code === "aborted") {
      if (abortReason === "stop") {
        useStrategistSession.setState((s) => ({
          pending: null,
          draft: s.draft.trim() ? s.draft : question,
          focusRequest: s.focusRequest + 1,
        }))
      }
      return
    }
    if (inFlight === controller) setPending({ question, since: now.toISOString(), status: "error", error: error.message })
  } finally {
    if (inFlight === controller) inFlight = null
  }
}

export const strategistSession = {
  /**
   * Ask a question. Returns false when nothing was sent: empty text, the workspace isn't loaded yet,
   * or an answer is still on its way (the text then waits in the composer).
   */
  send(text: string): boolean {
    const question = text.trim().slice(0, MAX_QUESTION_CHARS)
    if (!question || useDataStore.getState().status !== "ready") return false
    if (useStrategistSession.getState().pending?.status === "sending") {
      useStrategistSession.setState((s) => ({ draft: s.draft.trim() ? s.draft : question }))
      toast.info("Still answering your last question", { description: "Your new question is waiting in the composer." })
      return false
    }
    void ask(question)
    return true
  },
  /** A suggested prompt: sent as-is, or put in the composer when it needs the creator's own details. */
  pick(prompt: { text: string; prefill?: string; caret?: number }) {
    const prefill = prompt.prefill
    if (prefill) {
      useStrategistSession.setState((s) => ({ draft: prefill, caret: prompt.caret ?? null, focusRequest: s.focusRequest + 1 }))
    } else {
      strategistSession.send(prompt.text)
    }
  },
  retry() {
    const pending = useStrategistSession.getState().pending
    if (pending?.status === "error") void ask(pending.question)
  },
  /** Put a failed question back in the composer to edit it. */
  edit() {
    const pending = useStrategistSession.getState().pending
    if (!pending || pending.status !== "error") return
    useStrategistSession.setState((s) => ({ pending: null, draft: pending.question, focusRequest: s.focusRequest + 1 }))
  },
  /** Stop waiting for the current answer; the question goes back to the composer. */
  stop() {
    if (!inFlight) return
    abortReason = "stop"
    inFlight.abort()
  },
  setDraft(draft: string) {
    useStrategistSession.setState({ draft })
  },
  requestFocus() {
    useStrategistSession.setState((s) => ({ focusRequest: s.focusRequest + 1 }))
  },
  /** Delete every strategist turn (and failed attempt) from the log. Returns how many rows went. */
  clear(): number {
    abortReason = "clear"
    inFlight?.abort()
    inFlight = null
    const ids = useDataStore
      .getState()
      .db.ai_generations.filter((row) => row.task === STRATEGIST_TASK)
      .map((row) => row.id)
    if (ids.length) dataActions.remove("ai_generations", ids)
    setPending(null)
    return ids.length
  },
}

/** The saved conversation (oldest first) plus the question in flight, if any. */
export function useStrategistConversation() {
  const rows = useTable("ai_generations")
  const pending = useStrategistSession((s) => s.pending)
  const all = useMemo(() => parseTurns(rows), [rows])
  const turns = useMemo(() => settledTurns(all, pending?.since ?? null), [all, pending])
  return { turns, pending, total: all.length }
}
