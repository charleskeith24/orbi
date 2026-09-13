/**
 * Client entry point for AI: builds the Brand Context from the loaded workspace, calls /api/ai,
 * logs every call to `ai_generations` (newest 200 rows kept, plus the newest 300 strategist_chat rows
 * in their own bucket) and throws AiError with a user-facing message.
 */
import { dataActions, useDataStore } from "@/lib/store"
import type { AiProviderId, ID } from "@/lib/types"
import { buildBrandContext } from "./context"
import { AiError } from "./errors"
import { GENERATION_LIMITS, LOCAL_GENERATION_LIMITS, staleGenerationIds } from "./generations"
import type { AiTaskInput, AiTaskName, AiTaskOutput } from "./tasks"

export interface RunAiTaskOptions {
  /** Links the ai_generations log row to a record, e.g. ("content_items", itemId). */
  entityType?: string | null
  entityId?: ID | null
  signal?: AbortSignal
  now?: Date
}

export interface AiRunResult<N extends AiTaskName> {
  output: AiTaskOutput<N>
  provider: AiProviderId
  model: string
  durationMs: number
  /** Id of the ai_generations row (null when the workspace isn't loaded). */
  generationId: ID | null
}

const MAX_LOG_INPUT_CHARS = 4096
const MAX_LOG_OUTPUT_CHARS = 8192
const PROVIDERS: AiProviderId[] = ["anthropic", "openai", "offline"]

let lastProvider: AiProviderId = "offline"

/** Strings, then arrays, get shorter until the JSON fits `max` characters. */
export function trimForLog(value: unknown, max: number): unknown {
  let json: string
  try {
    json = JSON.stringify(value) ?? "null"
  } catch {
    return null
  }
  if (json.length <= max) return JSON.parse(json) as unknown
  for (const [stringCap, arrayCap] of [
    [600, 20],
    [200, 8],
    [80, 4],
  ] as const) {
    const walk = (v: unknown, depth: number): unknown => {
      if (typeof v === "string") return v.length > stringCap ? `${v.slice(0, stringCap)}…` : v
      if (Array.isArray(v)) return depth > 4 ? `[${v.length} items]` : v.slice(0, arrayCap).map((x) => walk(x, depth + 1))
      if (v && typeof v === "object") {
        if (depth > 4) return "{…}"
        return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, depth + 1)]))
      }
      return v
    }
    const trimmed = walk(JSON.parse(json), 0)
    if (JSON.stringify(trimmed).length <= max) return trimmed
  }
  return { truncated: true, preview: json.slice(0, max - 60) }
}

/** Text fields of the input, used to pick the most relevant stories, problems and questions. */
function focusText(input: unknown): string {
  const parts: string[] = []
  const walk = (v: unknown, depth: number) => {
    if (parts.join(" ").length > 2000 || depth > 3) return
    if (typeof v === "string") parts.push(v)
    else if (Array.isArray(v)) v.slice(0, 20).forEach((x) => walk(x, depth + 1))
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach((x) => walk(x, depth + 1))
  }
  walk(input, 0)
  return parts.join(" ").slice(0, 2000)
}

function storyIdsOf(input: unknown): ID[] {
  const ids = input && typeof input === "object" ? (input as { story_ids?: unknown }).story_ids : undefined
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []
}

function logGeneration(row: {
  task: string
  provider: AiProviderId
  model: string
  input: unknown
  output: unknown
  entityType?: string | null
  entityId?: ID | null
  status: "success" | "error"
  error: string | null
  durationMs: number | null
}): ID | null {
  const state = useDataStore.getState()
  if (state.status !== "ready") return null
  try {
    const inserted = dataActions.insert("ai_generations", {
      task: row.task,
      provider: row.provider,
      model: row.model,
      input: trimForLog(row.input, MAX_LOG_INPUT_CHARS),
      output: row.output === null ? null : trimForLog(row.output, MAX_LOG_OUTPUT_CHARS),
      entity_type: row.entityType ?? null,
      entity_id: row.entityId ?? null,
      status: row.status,
      error: row.error,
      duration_ms: row.durationMs,
    })
    // Strategist conversations live in this table too — they're retained in their own bucket.
    const dataState = useDataStore.getState()
    const limits = dataState.mode === "local" ? LOCAL_GENERATION_LIMITS : GENERATION_LIMITS
    const stale = staleGenerationIds(dataState.db.ai_generations, limits)
    if (stale.length) dataActions.remove("ai_generations", stale)
    return inserted.id
  } catch {
    return null
  }
}

function isAbort(err: unknown): boolean {
  return (err instanceof DOMException && err.name === "AbortError") || (err instanceof Error && err.name === "AbortError")
}

/**
 * Run an AI task through /api/ai with the current Brand Context.
 * Resolves with the validated output; rejects with AiError (message is safe to show).
 */
export async function runAiTask<N extends AiTaskName>(task: N, input: AiTaskInput<N>, options: RunAiTaskOptions = {}): Promise<AiRunResult<N>> {
  const now = options.now ?? new Date()
  const db = useDataStore.getState().db
  const context = buildBrandContext(db, now, { focus: focusText(input), storyIds: storyIdsOf(input) })
  const started = Date.now()
  const base = { task, input, entityType: options.entityType, entityId: options.entityId }

  let response: Response
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, input, context }),
      signal: options.signal,
    })
  } catch (err) {
    if (isAbort(err)) throw new AiError("The request was cancelled.", { status: 499, code: "aborted" })
    const error = new AiError("Couldn't reach the AI service. Check your connection and try again.", { status: 0, code: "network", retryable: true })
    logGeneration({ ...base, provider: lastProvider, model: "", output: null, status: "error", error: error.message, durationMs: Date.now() - started })
    throw error
  }

  let payload: Record<string, unknown> | null = null
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch (err) {
    if (isAbort(err)) throw new AiError("The request was cancelled.", { status: 499, code: "aborted" })
    payload = null
  }
  const provider = PROVIDERS.includes(payload?.provider as AiProviderId) ? (payload?.provider as AiProviderId) : lastProvider

  if (!response.ok || !payload || !("output" in payload)) {
    const message = typeof payload?.error === "string" && payload.error ? payload.error : `The AI request failed (${response.status}).`
    const error = new AiError(message, {
      status: response.status,
      code: typeof payload?.code === "string" ? (payload.code as AiError["code"]) : "unknown",
      provider,
      retryable: response.status === 429 || response.status >= 500,
    })
    logGeneration({ ...base, provider, model: "", output: null, status: "error", error: message, durationMs: Date.now() - started })
    throw error
  }

  lastProvider = provider
  const model = typeof payload.model === "string" ? payload.model : ""
  const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : Date.now() - started
  const output = payload.output as AiTaskOutput<N>
  const generationId = logGeneration({ ...base, provider, model, output, status: "success", error: null, durationMs })
  return { output, provider, model, durationMs, generationId }
}

/** Display name for the engine that produced an output (ProviderBadge). */
export function providerLabel(provider: AiProviderId | null | undefined, model?: string | null): string {
  if (!provider) return "AI"
  if (provider === "offline") return "Offline templates"
  if (provider === "anthropic") {
    const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model ?? "")
    if (!m) return "Claude"
    return `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] && m[3].length <= 2 ? `.${m[3]}` : ""}`
  }
  return model || provider
}
