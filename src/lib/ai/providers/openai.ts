/**
 * OpenAI provider — server only, bring your own key (the key comes from the person's saved key, never the
 * environment). Chat Completions in JSON mode; the answer is validated like every provider's.
 */
import { AiError } from "../errors"
import { jsonTaskPrompt, parseJsonAnswer, requestJson } from "./json-output"
import type { AiProvider, GenerateOptions, GenerateResult } from "./types"

const ENDPOINT = "https://api.openai.com/v1/chat/completions"
const TIMEOUT_MS = 120_000
/** Reasoning models spend hidden tokens before they answer; leave room for them on top of the answer. */
const REASONING_HEADROOM = 8_000
const MAX_COMPLETION_TOKENS = 32_000
const NAME = "OpenAI"

export interface OpenAiProviderOptions {
  apiKey: string
  model: string
  fetch?: typeof fetch
}

/** An OpenAI error status → a friendly AiError that points at Settings → AI (never the key or the payload). */
export function mapOpenAiError(status: number, json: Record<string, unknown>, model: string): AiError {
  const provider = "openai" as const
  const error = (json.error ?? {}) as { code?: unknown; type?: unknown }
  if (status === 401) return new AiError("Your OpenAI key was rejected. Check it — or add a new one — in Settings → AI.", { status: 502, code: "provider_auth", provider })
  if (status === 403) return new AiError(`Your OpenAI key can't use ${model}. Pick another model in Settings → AI.`, { status: 502, code: "provider_auth", provider })
  if (status === 404) return new AiError(`${model} isn't available to your OpenAI key. Pick another model in Settings → AI.`, { status: 502, code: "provider_error", provider })
  if (status === 429) {
    return error.code === "insufficient_quota" || error.type === "insufficient_quota"
      ? new AiError("Your OpenAI account is out of credit. Add credit at platform.openai.com, then try again.", { status: 429, code: "rate_limited", provider })
      : new AiError("OpenAI is rate-limiting your key right now. Wait a minute and try again.", { status: 429, code: "rate_limited", provider, retryable: true })
  }
  if (status === 400) return new AiError("OpenAI rejected the request. Try a shorter input, or pick another model in Settings → AI.", { status: 502, code: "provider_error", provider })
  if (status === 503) return new AiError("OpenAI is overloaded right now. Try again in a minute.", { status: 503, code: "overloaded", provider, retryable: true })
  return new AiError("OpenAI had a server error. Try again in a moment.", { status: 502, code: "provider_error", provider, retryable: true })
}

export function createOpenAiProvider({ apiKey, model, fetch: fetchImpl = fetch }: OpenAiProviderOptions): AiProvider {
  return {
    id: "openai",
    model,
    async generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>> {
      const { status, json } = await requestJson(fetchImpl, ENDPOINT, {
        headers: { authorization: `Bearer ${apiKey}` },
        body: {
          model,
          messages: [
            { role: "system", content: jsonTaskPrompt(opts.system, opts.schema) },
            ...(opts.history ?? []).map((turn) => ({ role: turn.role, content: turn.content })),
            { role: "user", content: opts.user },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: Math.min(opts.maxTokens + REASONING_HEADROOM, MAX_COMPLETION_TOKENS),
        },
        signal: opts.signal,
        timeoutMs: TIMEOUT_MS,
        provider: "openai",
        name: NAME,
      })
      if (status !== 200) {
        const mapped = mapOpenAiError(status, json, model)
        console.error(`[ai] ${opts.taskName}: OpenAI request failed (${status} → ${mapped.code})`)
        throw mapped
      }
      const choice = (Array.isArray(json.choices) ? json.choices[0] : undefined) as
        | { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }
        | undefined
      if (choice?.message?.refusal || choice?.finish_reason === "content_filter") {
        throw new AiError("OpenAI declined this request. Try rephrasing it — or switch to the offline templates for this one.", { status: 502, code: "refusal", provider: "openai" })
      }
      if (choice?.finish_reason === "length") {
        throw new AiError("The response was cut off before it finished. Ask for fewer items or a shorter piece and try again.", { status: 502, code: "truncated", provider: "openai", retryable: true })
      }
      const text = typeof choice?.message?.content === "string" ? choice.message.content : ""
      const output = parseJsonAnswer(text, opts.schema, "openai", opts.taskName, NAME)
      return { output, model: typeof json.model === "string" && json.model ? json.model : model }
    },
  }
}
