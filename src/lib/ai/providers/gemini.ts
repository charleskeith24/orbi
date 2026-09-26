/**
 * Gemini provider — server only, bring your own key (Google AI Studio keys, which include a free tier).
 * `generateContent` in JSON mode; the answer is validated like every provider's.
 */
import { AiError } from "../errors"
import { jsonTaskPrompt, parseJsonAnswer, requestJson } from "./json-output"
import type { AiProvider, GenerateOptions, GenerateResult } from "./types"

export const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"
const TIMEOUT_MS = 120_000
/** Gemini's thinking models spend tokens before they answer; leave room for them on top of the answer. */
const THINKING_HEADROOM = 8_000
const MAX_OUTPUT_TOKENS = 65_536
const NAME = "Gemini"
const REFUSED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"])

export interface GeminiProviderOptions {
  apiKey: string
  model: string
  fetch?: typeof fetch
}

/** Google marks a bad key with reason API_KEY_INVALID (on a 400), not a 401. */
export function isInvalidGeminiKey(status: number, json: Record<string, unknown>): boolean {
  if (status === 401) return true
  const details = ((json.error ?? {}) as { details?: unknown }).details
  return status === 400 && Array.isArray(details) && details.some((d) => (d as { reason?: unknown })?.reason === "API_KEY_INVALID")
}

/** A Gemini error status → a friendly AiError that points at Settings → AI (never the key or the payload). */
export function mapGeminiError(status: number, json: Record<string, unknown>, model: string): AiError {
  const provider = "gemini" as const
  if (isInvalidGeminiKey(status, json)) {
    return new AiError("Your Gemini key was rejected. Check it — or add a new one — in Settings → AI.", { status: 502, code: "provider_auth", provider })
  }
  if (status === 403) return new AiError(`Your Gemini key can't use ${model}. Pick another model in Settings → AI.`, { status: 502, code: "provider_auth", provider })
  if (status === 404) return new AiError(`${model} isn't available to your Gemini key. Pick another model in Settings → AI.`, { status: 502, code: "provider_error", provider })
  if (status === 429) {
    return new AiError("Your Gemini limit was reached (the free tier allows a set number of requests per minute and per day). Wait a minute, or check your limits in Google AI Studio.", { status: 429, code: "rate_limited", provider, retryable: true })
  }
  if (status === 400) return new AiError("Gemini rejected the request. Try a shorter input, or pick another model in Settings → AI.", { status: 502, code: "provider_error", provider })
  if (status === 503) return new AiError("Gemini is overloaded right now. Try again in a minute.", { status: 503, code: "overloaded", provider, retryable: true })
  return new AiError("Gemini had a server error. Try again in a moment.", { status: 502, code: "provider_error", provider, retryable: true })
}

export function createGeminiProvider({ apiKey, model, fetch: fetchImpl = fetch }: GeminiProviderOptions): AiProvider {
  return {
    id: "gemini",
    model,
    async generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>> {
      const { status, json } = await requestJson(fetchImpl, `${GEMINI_API}/models/${encodeURIComponent(model)}:generateContent`, {
        headers: { "x-goog-api-key": apiKey },
        body: {
          systemInstruction: { parts: [{ text: jsonTaskPrompt(opts.system, opts.schema) }] },
          contents: [
            ...(opts.history ?? []).map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
            { role: "user", parts: [{ text: opts.user }] },
          ],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: Math.min(opts.maxTokens + THINKING_HEADROOM, MAX_OUTPUT_TOKENS) },
        },
        signal: opts.signal,
        timeoutMs: TIMEOUT_MS,
        provider: "gemini",
        name: NAME,
      })
      if (status !== 200) {
        const mapped = mapGeminiError(status, json, model)
        console.error(`[ai] ${opts.taskName}: Gemini request failed (${status} → ${mapped.code})`)
        throw mapped
      }
      const blocked = ((json.promptFeedback ?? {}) as { blockReason?: unknown }).blockReason
      const candidate = (Array.isArray(json.candidates) ? json.candidates[0] : undefined) as
        | { finishReason?: string; content?: { parts?: { text?: unknown; thought?: unknown }[] } }
        | undefined
      if (blocked || REFUSED.has(candidate?.finishReason ?? "")) {
        throw new AiError("Gemini declined this request. Try rephrasing it — or switch to the offline templates for this one.", { status: 502, code: "refusal", provider: "gemini" })
      }
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new AiError("The response was cut off before it finished. Ask for fewer items or a shorter piece and try again.", { status: 502, code: "truncated", provider: "gemini", retryable: true })
      }
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text as string)
        .join("")
      const output = parseJsonAnswer(text, opts.schema, "gemini", opts.taskName, NAME)
      return { output, model: typeof json.modelVersion === "string" && json.modelVersion ? json.modelVersion : model }
    },
  }
}
