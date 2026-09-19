/**
 * Sends the public "Request access" form to POST /api/access-requests (docs/ADMIN_BRIEF.md §1) and reads
 * the answer. Never throws. The server answers the same "ok" for new, repeated and already-approved
 * emails, so the form never learns (or shows) who has asked or signed up.
 */
import type { AccessRequestData, AccessRequestInput } from "@/lib/admin/access-request"

export type AccessRequestResult =
  | { status: "ok" }
  | { status: "closed" }
  | { status: "rate_limited" }
  | { status: "invalid"; fields: Partial<Record<keyof AccessRequestData, string>> }
  | { status: "offline" }
  | { status: "error" }

export async function submitAccessRequest(input: AccessRequestInput, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<AccessRequestResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { status: "offline" }
  let response: Response
  try {
    response = await fetchImpl("/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      credentials: "same-origin",
      cache: "no-store",
    })
  } catch {
    return { status: "offline" }
  }
  if (response.ok) return { status: "ok" }
  const body = (await response.json().catch(() => null)) as { error?: unknown; fields?: unknown } | null
  if (body?.error === "closed") return { status: "closed" }
  if (response.status === 429 || body?.error === "rate_limited") return { status: "rate_limited" }
  if (response.status === 400 || body?.error === "invalid") {
    const fields = body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, string>) : {}
    return { status: "invalid", fields }
  }
  return { status: "error" }
}

/** "instagram.com/me" → "https://instagram.com/me"; anything else unchanged. */
export function normalizeLink(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed) || /\s/.test(trimmed) || !/^[\w@-]+(\.[\w-]+)+/.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
