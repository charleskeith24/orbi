/**
 * Anthropic provider — server only. The key is the person's own (bring your own key, online) or the server's
 * ANTHROPIC_API_KEY (local mode), and error messages point at the right place to fix it.
 *
 * Claude Opus 5 by default, adaptive thinking (the model default — no `thinking` param, no sampling
 * params), effort via `output_config.effort`, structured output via `output_config.format` built with
 * the SDK zod helper, and server-side refusal fallbacks (`fallbacks: "default"`) on the beta Messages API.
 * `stop_reason` is checked (refusal, max_tokens, model_context_window_exceeded) before any content is read.
 */
import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import * as z from "zod"
import { AiError, toAiError } from "../errors"
import { parseLoose } from "../schema"
import type { AiProvider, GenerateOptions, GenerateResult } from "./types"

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5"
export const AI_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const
export type AiEffort = (typeof AI_EFFORTS)[number]

const REQUEST_TIMEOUT_MS = 120_000
/** Non-streaming requests stay at or below this (SDK HTTP-timeout guidance). */
const MAX_TOKENS_CEILING = 16_000
const FALLBACK_BETA = "server-side-fallback-2026-07-01"

export interface AnthropicProviderOptions {
  model?: string
  /** null → omit effort (for models that don't support it). */
  effort?: AiEffort | null
  /** Server-side refusal fallbacks (`fallbacks: "default"`). */
  fallbacks?: boolean
  /** The person's own key (bring your own key). Without it the SDK reads ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN. */
  apiKey?: string
  client?: Anthropic
}

/** Whose key a request used — decides where an error message sends people to fix it. */
export type KeyOwner = "server" | "user"

type JsonSchema = Record<string, unknown>

/**
 * The installed SDK's zod helper moves `enum` into the description text (not enforced by constrained
 * decoding). Put the enums back from zod's own JSON Schema so enum fields are guaranteed valid.
 */
function restoreEnums(target: JsonSchema, source: JsonSchema): void {
  if (Array.isArray(source.enum) && (target.type === "string" || target.type === undefined)) {
    target.enum = source.enum
    if (typeof target.description === "string") {
      const cleaned = target.description.replace(/(?:\n\n)?\{enum: \[[\s\S]*?\]\}$/, "").trim()
      if (cleaned) target.description = cleaned
      else delete target.description
    }
  }
  const tp = target.properties
  const sp = source.properties
  if (tp && sp && typeof tp === "object" && typeof sp === "object") {
    for (const key of Object.keys(tp as JsonSchema)) {
      const t = (tp as JsonSchema)[key]
      const s = (sp as JsonSchema)[key]
      if (t && s && typeof t === "object" && typeof s === "object") restoreEnums(t as JsonSchema, s as JsonSchema)
    }
  }
  if (target.items && source.items && typeof target.items === "object" && typeof source.items === "object") {
    restoreEnums(target.items as JsonSchema, source.items as JsonSchema)
  }
  if (Array.isArray(target.anyOf) && Array.isArray(source.anyOf)) {
    target.anyOf.forEach((t, i) => {
      const s = (source.anyOf as unknown[])[i]
      if (t && s && typeof t === "object" && typeof s === "object") restoreEnums(t as JsonSchema, s as JsonSchema)
    })
  }
  // Sub-schemas used more than once live in $defs (same keys on both sides).
  const td = target.$defs
  const sd = source.$defs
  if (td && sd && typeof td === "object" && typeof sd === "object") {
    for (const key of Object.keys(td as JsonSchema)) {
      const t = (td as JsonSchema)[key]
      const s = (sd as JsonSchema)[key]
      if (t && s && typeof t === "object" && typeof s === "object") restoreEnums(t as JsonSchema, s as JsonSchema)
    }
  }
}

/** Strict JSON-schema output format for a zod schema (SDK helper + enum restoration). */
export function outputFormatFor(schema: z.ZodType): { type: "json_schema"; schema: JsonSchema } {
  const helper = betaZodOutputFormat(schema)
  const jsonSchema = JSON.parse(JSON.stringify(helper.schema)) as JsonSchema
  // Same options as the SDK helper so $defs keys line up.
  restoreEnums(jsonSchema, z.toJSONSchema(schema, { reused: "ref" }) as JsonSchema)
  if (typeof jsonSchema.description === "string" && jsonSchema.description.startsWith("{$schema")) delete jsonSchema.description
  return { type: "json_schema", schema: jsonSchema }
}

/** Typed SDK errors → friendly AiError (never includes keys or raw provider payloads). */
export function mapAnthropicError(err: unknown, owner: KeyOwner = "server", model: string = DEFAULT_ANTHROPIC_MODEL): AiError {
  if (err instanceof AiError) return err
  const provider = "anthropic" as const
  if (owner === "user") {
    if (err instanceof Anthropic.AuthenticationError) {
      return new AiError("Your Claude key was rejected. Check it — or add a new one — in Settings → AI.", { status: 502, code: "provider_auth", provider })
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return new AiError(`Your Claude key can't use ${model}. Pick another model in Settings → AI.`, { status: 502, code: "provider_auth", provider })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new AiError("Your Claude key is rate-limited right now. Wait a minute and try again.", { status: 429, code: "rate_limited", provider, retryable: true })
    }
    if (err instanceof Anthropic.NotFoundError) {
      return new AiError(`${model} isn't available to your Claude key. Pick another model in Settings → AI.`, { status: 502, code: "provider_error", provider })
    }
    if (err instanceof Anthropic.BadRequestError) {
      return new AiError("Claude rejected the request — a shorter input may help. If it keeps happening, check your Claude Console credit or pick another model in Settings → AI.", { status: 502, code: "provider_error", provider })
    }
  }
  if (err instanceof Anthropic.APIUserAbortError) return new AiError("The request was cancelled.", { status: 499, code: "aborted", provider })
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError("Claude took too long to respond. Try again, or ask for something shorter.", { status: 504, code: "timeout", provider, retryable: true })
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError("The server couldn't reach the Anthropic API. Check its network connection and try again.", { status: 502, code: "network", provider, retryable: true })
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY on the server.", { status: 502, code: "provider_auth", provider })
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new AiError("This Anthropic API key doesn't have access to the configured model.", { status: 502, code: "provider_auth", provider })
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError("Claude is rate-limited right now. Wait a minute and try again.", { status: 429, code: "rate_limited", provider, retryable: true })
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new AiError("The configured model wasn't found. Check AI_MODEL on the server.", { status: 502, code: "provider_error", provider })
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AiError("Claude rejected the request. Try a shorter input; if it keeps happening, check AI_MODEL and AI_EFFORT.", { status: 502, code: "provider_error", provider })
  }
  if (err instanceof Anthropic.InternalServerError) {
    return err.status === 529
      ? new AiError("Claude is overloaded right now. Try again in a minute.", { status: 503, code: "overloaded", provider, retryable: true })
      : new AiError("Claude had a server error. Try again in a moment.", { status: 502, code: "provider_error", provider, retryable: true })
  }
  if (err instanceof Anthropic.APIError) {
    return new AiError("The AI request failed. Try again in a moment.", { status: 502, code: "provider_error", provider, retryable: true })
  }
  return toAiError(err, provider)
}

export function createAnthropicProvider(options: AnthropicProviderOptions = {}): AiProvider {
  const model = options.model || DEFAULT_ANTHROPIC_MODEL
  const effort = options.effort === undefined ? "high" : options.effort
  const fallbacks = options.fallbacks ?? true
  const owner: KeyOwner = options.apiKey ? "user" : "server"
  // A person's own key, or ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN read by the SDK. With a person's key the
  // server's auth token must not ride along.
  const client =
    options.client ??
    new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 1, ...(options.apiKey ? { apiKey: options.apiKey, authToken: null } : {}) })
  const formats = new WeakMap<z.ZodType, ReturnType<typeof outputFormatFor>>()

  return {
    id: "anthropic",
    model,
    async generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>> {
      let format = formats.get(opts.schema)
      if (!format) {
        format = outputFormatFor(opts.schema)
        formats.set(opts.schema, format)
      }
      let message: Anthropic.Beta.BetaMessage
      try {
        message = await client.beta.messages.create(
          {
            model,
            max_tokens: Math.min(opts.maxTokens, MAX_TOKENS_CEILING),
            system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
            messages: [...(opts.history ?? []).map((t) => ({ role: t.role, content: t.content })), { role: "user" as const, content: opts.user }],
            output_config: { ...(effort ? { effort } : {}), format },
            ...(fallbacks ? { fallbacks: "default" as const, betas: [FALLBACK_BETA] } : {}),
          },
          { signal: opts.signal }
        )
      } catch (err) {
        const mapped = mapAnthropicError(err, owner, model)
        if (mapped.code !== "aborted") console.error(`[ai] ${opts.taskName}: Anthropic request failed (${mapped.code})`, err instanceof Error ? err.message : "")
        throw mapped
      }

      if (message.stop_reason === "refusal") {
        throw new AiError("Claude declined this request. Try rephrasing it — or switch to the offline templates for this one.", { status: 502, code: "refusal", provider: "anthropic" })
      }
      if (message.stop_reason === "max_tokens") {
        throw new AiError("The response was cut off before it finished. Ask for fewer items or a shorter piece and try again.", { status: 502, code: "truncated", provider: "anthropic", retryable: true })
      }
      // The prompt plus the answer outgrew the context window — retrying the same input won't help.
      if (message.stop_reason === "model_context_window_exceeded") {
        throw new AiError("This request and its answer didn't fit in the model's context window. Shorten the pasted text or ask for fewer items and try again.", { status: 502, code: "truncated", provider: "anthropic" })
      }
      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        throw new AiError("Claude's response wasn't valid JSON. Please try again.", { status: 502, code: "invalid_output", provider: "anthropic", retryable: true })
      }
      const parsed = parseLoose(opts.schema, raw)
      if (!parsed.success) {
        console.error(`[ai] ${opts.taskName}: output failed validation`, parsed.error.issues.slice(0, 3))
        throw new AiError("Claude's response didn't match the expected format. Please try again.", { status: 502, code: "invalid_output", provider: "anthropic", retryable: true })
      }
      return { output: parsed.data, model: message.model || model }
    },
  }
}
