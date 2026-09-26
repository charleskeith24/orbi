/**
 * Provider resolution (server only).
 *
 *   AI_PROVIDER   "anthropic" (default) | "offline" (force the offline engine)
 *   ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN — without one, the offline engine is used
 *   AI_MODEL      default "claude-opus-5"
 *   AI_EFFORT     low | medium | high (default) | xhigh | max | none (omit, for models without effort)
 *   AI_FALLBACKS  "default" (default: server-side refusal fallbacks) | "off"
 *
 * Adding another provider:
 *   1. Implement `AiProvider` in providers/<name>.ts — map { system, user, history, schema, maxTokens }
 *      to the vendor's structured-output API, validate with `parseLoose(schema, raw)`, and map vendor
 *      errors to `AiError` with a friendly message (never include keys or raw payloads).
 *   2. Add its id to `AiProviderId` in src/lib/types.ts (a foundation change — request it).
 *   3. Extend `resolveProvider` / `providerStatus` below with its env switch and key check.
 *   4. Add a gateway test with the vendor SDK mocked, plus one real smoke call, before enabling it.
 * Don't ship an untested provider.
 */
import type { AiProviderId } from "@/lib/types"
import { AI_EFFORTS, createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL, type AiEffort } from "./anthropic"
import { OFFLINE_MODEL, offlineProvider } from "./offline"
import type { AiProvider } from "./types"

type Env = Record<string, string | undefined>

export interface ProviderStatus {
  provider: AiProviderId
  model: string
  /** A live model is configured (an API key is present). */
  configured: boolean
  /** Human-readable explanation for the UI. */
  reason: string
  /** Whose key: the server's (local mode), the person's own (online), or none (offline templates). */
  source?: "server" | "user" | "none"
}

function hasAnthropicCredentials(env: Env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim())
}

function effortFrom(env: Env): AiEffort | null {
  const value = env.AI_EFFORT?.trim().toLowerCase()
  if (value === "none" || value === "off") return null
  return (AI_EFFORTS as readonly string[]).includes(value ?? "") ? (value as AiEffort) : "high"
}

export function providerStatus(env: Env = process.env): ProviderStatus {
  const forced = env.AI_PROVIDER?.trim().toLowerCase()
  const configured = hasAnthropicCredentials(env)
  const model = env.AI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL
  if (forced === "offline") {
    return { provider: "offline", model: OFFLINE_MODEL, configured, reason: "AI_PROVIDER is set to offline — using the offline template engine." }
  }
  if (!configured) {
    return { provider: "offline", model: OFFLINE_MODEL, configured: false, reason: "No ANTHROPIC_API_KEY on the server — using the offline template engine." }
  }
  return { provider: "anthropic", model, configured: true, reason: `Using ${model} via the Anthropic API.`, source: "server" }
}

let cached: { key: string; provider: AiProvider } | null = null

export function resolveProvider(env: Env = process.env): AiProvider {
  const status = providerStatus(env)
  if (status.provider === "offline") return offlineProvider
  const effort = effortFrom(env)
  const fallbacks = env.AI_FALLBACKS?.trim().toLowerCase() !== "off"
  const key = `${status.model}|${effort}|${fallbacks}|${env.ANTHROPIC_API_KEY ? "k" : ""}${env.ANTHROPIC_AUTH_TOKEN ? "t" : ""}`
  if (!cached || cached.key !== key) cached = { key, provider: createAnthropicProvider({ model: status.model, effort, fallbacks }) }
  return cached.provider
}

export { offlineProvider, OFFLINE_MODEL } from "./offline"
export type { AiProvider, GenerateOptions, GenerateResult } from "./types"
