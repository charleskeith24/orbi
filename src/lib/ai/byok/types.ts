/**
 * Bring your own key (ARCHITECTURE §7): in the online version each creator connects their own AI provider
 * with their own API key, so the AI they use is billed to them — never to the site owner. Pure: shared by the
 * Settings → AI card (browser) and the /api/ai/key route (server).
 */

export const AI_KEY_PROVIDERS = ["anthropic", "openai", "gemini"] as const
export type AiKeyProvider = (typeof AI_KEY_PROVIDERS)[number]

export function isAiKeyProvider(value: unknown): value is AiKeyProvider {
  return typeof value === "string" && (AI_KEY_PROVIDERS as readonly string[]).includes(value)
}

/** Where to create a key, per provider (opened in a new tab). */
export const AI_KEY_CONSOLES: Record<AiKeyProvider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
}

/** Product names shown next to a key (English in both UI languages, like every product name). */
export const AI_KEY_PROVIDER_NAMES: Record<AiKeyProvider, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
}

export interface AiModelOption {
  id: string
  label: string
}

/**
 * GET /api/ai/key — the saved key's description, never the key:
 * local (no accounts: the server's own setup decides) · not_configured (online, but the owner hasn't set
 * AI_KEY_SECRET, so keys can't be stored) · none · saved (`models` only when asked for with ?models=1).
 */
export type AiKeyState =
  | { status: "local" }
  | { status: "not_configured" }
  | { status: "none" }
  | {
      status: "saved"
      provider: AiKeyProvider
      model: string
      /** The key's last four characters. */
      hint: string
      verifiedAt: string
      models?: AiModelOption[]
      /** Listing the models failed (the key stays saved). */
      modelsError?: string
    }

/** PUT /api/ai/key. */
export interface AiKeySaveInput {
  provider: AiKeyProvider
  key: string
  model?: string
}

/** Failures of /api/ai/key: `{ error, code }` with a real status. */
export type AiKeyErrorCode =
  | "local"
  | "not_configured"
  | "unauthorized"
  | "bad_origin"
  | "invalid"
  | "invalid_key"
  | "unknown_model"
  | "quota"
  | "provider_error"
  | "server_error"

export const AI_KEY_ROUTE = "/api/ai/key"

/** Model ids as providers write them ("claude-opus-5", "gpt-5", "gemini-2.5-flash"). */
export const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/

/**
 * A key as people paste it: trimmed, surrounding quotes dropped, no spaces inside, a plausible length.
 * null when it can't be a key. The provider decides whether it's valid.
 */
export function cleanApiKey(value: string): string | null {
  const key = value.trim().replace(/^["'`]+|["'`]+$/g, "")
  if (key.length < 20 || key.length > 400 || /\s/.test(key)) return null
  return key
}

/** The last four characters, shown as "•••• abcd" so a person can tell their keys apart. */
export function keyHint(key: string): string {
  return key.slice(-4)
}
