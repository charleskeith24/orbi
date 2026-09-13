/**
 * AI gateway core (server only): validate the request, compose Brand Voice system prompt + task
 * prompt, run the provider, then validate, clamp and map ids on the output. Used by /api/ai.
 */
import type { AiProviderId } from "@/lib/types"
import { parseBrandContext } from "./context"
import { AiError, type AiErrorCode } from "./errors"
import { brandVoiceSystemPrompt } from "./prompts/system"
import { resolveProvider, type AiProvider } from "./providers"
import { parseLoose } from "./schema"
import { getAiTask, isAiTaskName, type AiTaskName } from "./tasks"

/** Request bodies above this are rejected (the Brand Context is ~40 KB). */
export const MAX_REQUEST_CHARS = 400_000

export interface AiGatewaySuccess {
  output: unknown
  provider: AiProviderId
  model: string
  durationMs: number
}

export interface AiGatewayFailure {
  error: string
  provider: AiProviderId | null
  code: AiErrorCode
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Run one task. Throws AiError (with `status`) for every failure. */
export async function executeAiTask(body: unknown, options: { provider?: AiProvider; signal?: AbortSignal } = {}): Promise<AiGatewaySuccess> {
  const provider = options.provider ?? resolveProvider()
  const fail = (message: string, status: number, code: AiErrorCode) => new AiError(message, { status, code, provider: provider.id })

  if (!isRecord(body)) throw fail("Request body must be a JSON object with task, input and context.", 400, "invalid_request")
  const taskName = body.task
  if (!isAiTaskName(taskName)) throw fail(`Unknown AI task “${String(taskName ?? "").slice(0, 60)}”.`, 400, "unknown_task")
  const task = getAiTask(taskName as AiTaskName)

  const parsedInput = task.input.safeParse(body.input ?? {})
  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0]
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : ""
    throw fail(`Invalid input — ${where}${issue?.message ?? "check the fields and try again."}`, 400, "invalid_input")
  }
  const input = parsedInput.data
  const workspace = parseBrandContext(body.context)
  const ctx = task.context ? task.context(workspace, input) : workspace
  const parts = task.buildPrompt(ctx, input)
  const system = parts.system ? `${brandVoiceSystemPrompt(ctx)}\n\n${parts.system}` : brandVoiceSystemPrompt(ctx)

  const started = Date.now()
  const { output, model } = await provider.generate({
    system,
    user: parts.user,
    history: parts.history,
    schema: task.output,
    maxTokens: task.maxTokens,
    taskName,
    signal: options.signal,
    offline: () => {
      try {
        return task.offline(ctx, input)
      } catch (err) {
        console.error(`[ai] ${taskName}: offline engine failed`, err)
        throw fail("The offline engine couldn't generate this one. Try different input.", 500, "invalid_output")
      }
    },
  })

  const checked = parseLoose(task.output, output)
  if (!checked.success) {
    console.error(`[ai] ${taskName}: output failed validation`, checked.error.issues.slice(0, 3))
    throw fail("The generated output didn't match the expected format. Please try again.", provider.id === "offline" ? 500 : 502, "invalid_output")
  }
  const final = task.finalize ? task.finalize(checked.data, ctx, input) : checked.data
  return { output: final, provider: provider.id, model, durationMs: Date.now() - started }
}
