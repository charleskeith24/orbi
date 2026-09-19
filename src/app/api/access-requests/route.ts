/**
 * POST /api/access-requests — the public "Request access" form (the waitlist, docs/ADMIN.md). Anonymous callers
 * are allowed through the proxy (src/components/features/auth/auth-paths.ts).
 *
 * Body: AccessRequestInput, validated with the form's own schema (src/lib/admin/access-request.ts).
 * 201 { ok: true } for a new request, a repeat request, an email that already has an account and a filled
 * honeypot alike, so the answer never reveals who has asked or signed up.
 * Failures ({ error, message }, no-store): 501 not_configured · 403 bad_origin · 400 invalid (+ fields) ·
 * 403 closed · 429 rate_limited · 500 server_error.
 *
 * Limits live in the database (public.submit_access_request, one transaction): one pending request per
 * email, ACCESS_REQUESTS_PER_HOUR new requests per hour overall. No IP address is read or stored.
 */
import { ACCESS_REQUEST_LIMITS, accessRequestErrors, accessRequestSchema } from "@/lib/admin/access-request"
import { AdminError, fail, json, readJson, sameOrigin } from "@/lib/admin/server/http"
import { submitAccessRequest } from "@/lib/admin/server/requests"
import { createSupabaseAdminClient, isSecretKeyConfigured } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const THANKS = { ok: true } as const

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return fail("not_configured", "Access requests are part of the online version (Supabase). There are no accounts in local mode.")
  }
  if (!isSecretKeyConfigured()) {
    return fail("not_configured", "Set SUPABASE_SECRET_KEY on the server to accept access requests.")
  }
  if (!sameOrigin(request)) return fail("bad_origin", "Cross-site request refused: the Origin header must be this site.")

  try {
    let body: unknown
    try {
      body = await readJson(request, ACCESS_REQUEST_LIMITS.body)
    } catch (error) {
      if (error instanceof AdminError) return fail(error.code, error.message)
      throw error
    }
    const parsed = accessRequestSchema.safeParse(body)
    if (!parsed.success) return fail("invalid", "Check the highlighted fields.", { fields: accessRequestErrors(parsed.error) })

    // Honeypot: people never see the field; bots fill it. Same answer, nothing stored.
    if (parsed.data.website.trim()) return json(THANKS, 201)

    const outcome = await submitAccessRequest(createSupabaseAdminClient(), parsed.data)
    if (outcome === "closed") return fail("closed", "Requests are closed for now.")
    if (outcome === "rate_limited") return fail("rate_limited", "Too many requests right now. Try again in an hour.")
    return json(THANKS, 201)
  } catch (error) {
    console.error("[api/access-requests] failed", error instanceof Error ? error.message : error)
    return fail("server_error", "Something went wrong. Try again in a moment.")
  }
}
