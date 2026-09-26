/**
 * JSON answers for providers without Claude's constrained decoding (OpenAI, Gemini): the task's JSON Schema
 * goes into the system prompt, the provider's JSON mode keeps the answer parseable, and `parseLoose`
 * validates it against the same zod schema every provider uses.
 */
import * as z from "zod"
import type { AiProviderId } from "@/lib/types"
import { AiError } from "../errors"
import { parseLoose } from "../schema"

const schemaText = new WeakMap<z.ZodType, string>()

/** The task's system prompt plus the answer format. */
export function jsonTaskPrompt(system: string, schema: z.ZodType): string {
  let text = schemaText.get(schema)
  if (!text) {
    text = JSON.stringify(z.toJSONSchema(schema))
    schemaText.set(schema, text)
  }
  return `${system}\n\nAnswer with one JSON object and nothing else — no prose, no Markdown code fences. It must match this JSON Schema:\n${text}`
}

/** Parses and validates an answer; a stray ```json fence is tolerated. */
export function parseJsonAnswer<T>(text: string, schema: z.ZodType<T>, provider: AiProviderId, taskName: string, name: string): T {
  const body = text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1")
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new AiError(`${name}'s response wasn't valid JSON. Please try again.`, { status: 502, code: "invalid_output", provider, retryable: true })
  }
  const parsed = parseLoose(schema, raw)
  if (!parsed.success) {
    console.error(`[ai] ${taskName}: ${provider} output failed validation`, parsed.error.issues.slice(0, 3))
    throw new AiError(`${name}'s response didn't match the expected format. Please try again.`, { status: 502, code: "invalid_output", provider, retryable: true })
  }
  return parsed.data
}

/** POSTs (or GETs) JSON with a timeout joined to the caller's signal; network failures become AiErrors. */
export async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  init: { method?: "GET" | "POST"; headers: Record<string, string>; body?: unknown; signal?: AbortSignal; timeoutMs: number; provider: AiProviderId; name: string }
): Promise<{ status: number; json: Record<string, unknown> }> {
  const timeout = AbortSignal.timeout(init.timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: init.method ?? "POST",
      headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal,
      cache: "no-store",
    })
  } catch (err) {
    if (init.signal?.aborted) throw new AiError("The request was cancelled.", { status: 499, code: "aborted", provider: init.provider })
    if (timeout.aborted) {
      throw new AiError(`${init.name} took too long to respond. Try again, or ask for something shorter.`, { status: 504, code: "timeout", provider: init.provider, retryable: true })
    }
    console.error(`[ai] ${init.provider}: network error`, err instanceof Error ? err.message : "")
    throw new AiError(`The server couldn't reach ${init.name}. Try again in a moment.`, { status: 502, code: "network", provider: init.provider, retryable: true })
  }
  let json: Record<string, unknown> = {}
  try {
    const parsed: unknown = await response.json()
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) json = parsed as Record<string, unknown>
  } catch {
    // Non-JSON error pages: the status alone decides.
  }
  return { status: response.status, json }
}
