/**
 * Validation for the push API bodies. Pure — shared by the routes and their tests.
 * The browser sends `PushSubscription.toJSON()`: `{ endpoint, expirationTime, keys: { p256dh, auth } }`.
 */

export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export const PUSH_BODY_MAX_CHARS = 4000
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

export function parseEndpoint(value: unknown): Parsed<string> {
  if (typeof value !== "string" || !value.trim()) return { ok: false, error: "endpoint is required" }
  const endpoint = value.trim()
  if (endpoint.length > 1000) return { ok: false, error: "endpoint is too long" }
  try {
    const url = new URL(endpoint)
    if (url.protocol !== "https:") return { ok: false, error: "endpoint must be https" }
  } catch {
    return { ok: false, error: "endpoint must be a URL" }
  }
  return { ok: true, value: endpoint }
}

export function parsePushSubscription(body: unknown): Parsed<PushSubscriptionInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be a JSON object" }
  const record = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  const endpoint = parseEndpoint(record.endpoint)
  if (!endpoint.ok) return endpoint
  const p256dh = record.keys?.p256dh
  const auth = record.keys?.auth
  if (typeof p256dh !== "string" || !BASE64URL.test(p256dh) || p256dh.length > 200) return { ok: false, error: "keys.p256dh is invalid" }
  if (typeof auth !== "string" || !BASE64URL.test(auth) || auth.length > 100) return { ok: false, error: "keys.auth is invalid" }
  return { ok: true, value: { endpoint: endpoint.value, p256dh, auth } }
}

/** Reads and parses a small JSON body; an empty body is `{}`. */
export async function readJsonBody(request: Request): Promise<Parsed<unknown>> {
  const raw = await request.text()
  if (raw.length > PUSH_BODY_MAX_CHARS) return { ok: false, error: "body is too large" }
  if (!raw.trim()) return { ok: true, value: {} }
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false, error: "body must be valid JSON" }
  }
}
