/**
 * SERVER ONLY — which engine writes for the person asking.
 *
 * Online (Supabase): the person's own key (bring your own key) or, without one, the offline templates — the
 * site owner's ANTHROPIC_API_KEY is never used for anyone, so nobody's AI is billed to the owner. Local mode
 * (no accounts) keeps the server's own setup: ANTHROPIC_API_KEY or the offline templates.
 */
import { createSupabaseAdminClient, isSecretKeyConfigured } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { AiError } from "../errors"
import { createAnthropicProvider } from "../providers/anthropic"
import { createGeminiProvider } from "../providers/gemini"
import { OFFLINE_MODEL, offlineProvider, providerStatus, resolveProvider, type ProviderStatus } from "../providers"
import { createOpenAiProvider } from "../providers/openai"
import type { AiProvider } from "../providers/types"
import { supportsRefusalFallbacks } from "./catalog"
import { decryptApiKey, readAiKeySecret } from "./crypto"
import { loadAiKey, type StoredAiKey } from "./store"
import { AI_KEY_PROVIDER_NAMES } from "./types"

/** Online keys can be stored and read: the secret key reaches the table, AI_KEY_SECRET decrypts. */
export function aiKeysReady(): boolean {
  return isSupabaseConfigured && isSecretKeyConfigured() && readAiKeySecret() !== null
}

export const REASON_NO_KEY = "No AI key yet — add your own in Settings → AI. Until then, the offline templates write your drafts."
export const REASON_NOT_READY = "AI keys aren't set up on this site yet (the owner needs AI_KEY_SECRET) — using the offline templates."
export const REASON_UNREADABLE = "Your saved AI key can't be read anymore — add it again in Settings → AI."

function providerFor(stored: StoredAiKey, apiKey: string): AiProvider {
  if (stored.provider === "openai") return createOpenAiProvider({ apiKey, model: stored.model })
  if (stored.provider === "gemini") return createGeminiProvider({ apiKey, model: stored.model })
  const effort = stored.modelMeta.effort?.includes("high") ? "high" : null
  return createAnthropicProvider({ apiKey, model: stored.model, effort, fallbacks: supportsRefusalFallbacks(stored.model) })
}

/** The person's saved key, decrypted — or null without one. Throws AiError when it can't be read. */
async function loadKey(userId: string): Promise<{ stored: StoredAiKey; apiKey: string } | null> {
  const secret = readAiKeySecret()
  if (!secret || !isSecretKeyConfigured()) return null
  const stored = await loadAiKey(createSupabaseAdminClient(), userId)
  if (!stored) return null
  try {
    return { stored, apiKey: decryptApiKey(stored.ciphertext, secret, userId) }
  } catch {
    throw new AiError(REASON_UNREADABLE, { status: 409, code: "provider_auth", provider: stored.provider })
  }
}

/** The engine for one request by a signed-in person (online) or for this server (local). */
export async function providerForUser(userId: string | null): Promise<AiProvider> {
  if (!isSupabaseConfigured || !userId) return resolveProvider()
  const key = await loadKey(userId)
  return key ? providerFor(key.stored, key.apiKey) : offlineProvider
}

/** GET /api/ai/status for a signed-in person: their own engine, never the server's key. */
export async function aiStatusForUser(userId: string | null): Promise<ProviderStatus> {
  if (!isSupabaseConfigured || !userId) return providerStatus()
  if (!aiKeysReady()) return { provider: "offline", model: OFFLINE_MODEL, configured: false, reason: REASON_NOT_READY, source: "none" }
  const stored = await loadAiKey(createSupabaseAdminClient(), userId)
  if (!stored) return { provider: "offline", model: OFFLINE_MODEL, configured: false, reason: REASON_NO_KEY, source: "none" }
  return {
    provider: stored.provider,
    model: stored.model,
    configured: true,
    reason: `Using your ${AI_KEY_PROVIDER_NAMES[stored.provider]} key (${stored.model}).`,
    source: "user",
  }
}
