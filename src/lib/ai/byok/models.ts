/**
 * SERVER ONLY — the models a key can use. Listing them is also how a key is checked before it's saved:
 * every provider answers it without spending tokens, and a bad key fails here instead of mid-generation.
 */
import Anthropic from "@anthropic-ai/sdk"
import { GEMINI_API, isInvalidGeminiKey } from "../providers/gemini"
import { requestJson } from "../providers/json-output"
import { catalogModels, type CatalogModel } from "./catalog"
import { AI_KEY_PROVIDER_NAMES, type AiKeyErrorCode, type AiKeyProvider } from "./types"

const TIMEOUT_MS = 15_000
const MAX_PAGES = 5

/** A key-check failure with the status and code the /api/ai/key route answers with. */
export class AiKeyError extends Error {
  constructor(
    message: string,
    readonly code: AiKeyErrorCode,
    readonly status: number
  ) {
    super(message)
    this.name = "AiKeyError"
  }
}

const invalidKey = (provider: AiKeyProvider) =>
  new AiKeyError(`${AI_KEY_PROVIDER_NAMES[provider]} didn't accept this key. Copy it again from your ${AI_KEY_PROVIDER_NAMES[provider]} account and paste the whole key.`, "invalid_key", 400)
const quota = (provider: AiKeyProvider) =>
  new AiKeyError(`${AI_KEY_PROVIDER_NAMES[provider]} is limiting this key right now. Wait a minute and try again.`, "quota", 429)
const unreachable = (provider: AiKeyProvider) =>
  new AiKeyError(`Couldn't check the key with ${AI_KEY_PROVIDER_NAMES[provider]} right now. Try again in a moment.`, "provider_error", 502)

function fromStatus(provider: AiKeyProvider, status: number, json: Record<string, unknown>): AiKeyError {
  if (provider === "gemini" ? isInvalidGeminiKey(status, json) || status === 403 : status === 401 || status === 403) return invalidKey(provider)
  if (status === 429) return quota(provider)
  return unreachable(provider)
}

async function listAnthropic(key: string): Promise<unknown[]> {
  const client = new Anthropic({ apiKey: key, authToken: null, maxRetries: 0, timeout: TIMEOUT_MS })
  const raw: unknown[] = []
  try {
    for await (const model of client.models.list({ limit: 100 })) raw.push(model)
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw invalidKey("anthropic")
    if (err instanceof Anthropic.RateLimitError) throw quota("anthropic")
    throw unreachable("anthropic")
  }
  return raw
}

async function listOpenAi(key: string, fetchImpl: typeof fetch): Promise<unknown[]> {
  const { status, json } = await requestJson(fetchImpl, "https://api.openai.com/v1/models", {
    method: "GET",
    headers: { authorization: `Bearer ${key}` },
    timeoutMs: TIMEOUT_MS,
    provider: "openai",
    name: "OpenAI",
  }).catch(() => {
    throw unreachable("openai")
  })
  if (status !== 200) throw fromStatus("openai", status, json)
  return Array.isArray(json.data) ? json.data : []
}

async function listGemini(key: string, fetchImpl: typeof fetch): Promise<unknown[]> {
  const raw: unknown[] = []
  let pageToken = ""
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ pageSize: "1000", ...(pageToken ? { pageToken } : {}) })
    const { status, json } = await requestJson(fetchImpl, `${GEMINI_API}/models?${query}`, {
      method: "GET",
      headers: { "x-goog-api-key": key },
      timeoutMs: TIMEOUT_MS,
      provider: "gemini",
      name: "Gemini",
    }).catch(() => {
      throw unreachable("gemini")
    })
    if (status !== 200) throw fromStatus("gemini", status, json)
    if (Array.isArray(json.models)) raw.push(...json.models)
    pageToken = typeof json.nextPageToken === "string" ? json.nextPageToken : ""
    if (!pageToken) break
  }
  return raw
}

/** The chat models this key can use, newest first. Throws AiKeyError for a bad key or an unreachable provider. */
export async function listKeyModels(provider: AiKeyProvider, key: string, options: { fetch?: typeof fetch } = {}): Promise<CatalogModel[]> {
  const fetchImpl = options.fetch ?? fetch
  const raw = provider === "anthropic" ? await listAnthropic(key) : provider === "openai" ? await listOpenAi(key, fetchImpl) : await listGemini(key, fetchImpl)
  const models = catalogModels(provider, raw)
  if (!models.length) {
    throw new AiKeyError(`This ${AI_KEY_PROVIDER_NAMES[provider]} key works, but it can't use any model Orbi writes with.`, "unknown_model", 400)
  }
  return models
}
