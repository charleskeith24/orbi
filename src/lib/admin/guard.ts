/**
 * SERVER ONLY — the guard every `/api/admin/*` handler runs first (docs/ADMIN_BRIEF.md §3).
 *
 * In order:
 * 1. local mode (no Supabase)                               → 501 not_configured
 * 2. a mutation (anything but GET/HEAD) without a same-origin `Origin` header → 403 bad_origin
 * 3. no valid session (`auth.getUser()`)                    → 401 unauthorized
 * 4. signed in but not an admin (`is_admin()`)              → 404 not_found (the area isn't revealed)
 * 5. an admin whose session isn't AAL2 (2-step verification) → 403 mfa_required
 * 6. the server has no SUPABASE_SECRET_KEY                  → 501 not_configured
 * Then the handler runs with the admin's identity, their session client and the secret-key client.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient, isSecretKeyConfigured } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdminError, fail, sameOrigin } from "./server/http"
import { resolveAdminSession, type AdminIdentity } from "./server/session"

export interface AdminContext {
  admin: AdminIdentity
  /** The admin's own session client: row-level security applies (admin read policies need AAL2). */
  supabase: SupabaseClient
  /** The secret-key client: bypasses row-level security. Scope every query. */
  service: SupabaseClient
  /** This site's origin (the validated `Origin` on mutations), for links in emails. */
  origin: string
  now: Date
}

export type RequireAdminResult = { ok: true; ctx: AdminContext } | { ok: false; response: Response }

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export async function requireAdmin(request: Request): Promise<RequireAdminResult> {
  const deny = (response: Response): RequireAdminResult => ({ ok: false, response })
  if (!isSupabaseConfigured) {
    return deny(fail("not_configured", "The admin area is part of the online version (Supabase). There are no accounts in local mode."))
  }
  const origin = sameOrigin(request)
  const mutation = !SAFE_METHODS.has(request.method.toUpperCase())
  if (mutation && !origin) return deny(fail("bad_origin", "Cross-site request refused: the Origin header must be this site."))

  const supabase = await createSupabaseServerClient()
  const session = await resolveAdminSession(supabase)
  if (session.status === "signed_out") return deny(fail("unauthorized", "Sign in to use this endpoint."))
  if (session.status === "not_admin") return deny(fail("not_found", "Not found."))
  if (session.status === "needs_mfa") {
    return deny(fail("mfa_required", "Turn on 2-step verification and verify this session to use the admin area."))
  }
  if (!isSecretKeyConfigured()) {
    return deny(fail("not_configured", "Set SUPABASE_SECRET_KEY on the server (Vercel → Environment Variables) to use the admin area."))
  }
  return {
    ok: true,
    ctx: {
      admin: session.admin,
      supabase,
      service: createSupabaseAdminClient(),
      origin: origin ?? new URL(request.url).origin,
      now: new Date(),
    },
  }
}

type Handler<P> = (ctx: AdminContext, request: Request, params: P) => Promise<Response>

/**
 * Wraps a route handler with `requireAdmin`, awaits the dynamic params and turns thrown AdminErrors
 * into `{ error, message }` responses (anything else → 500 server_error, details only in the server log).
 */
export function withAdmin<P extends Record<string, string> = Record<string, string>>(handler: Handler<P>) {
  return async (request: Request, context?: { params: Promise<P> }): Promise<Response> => {
    try {
      const guard = await requireAdmin(request)
      if (!guard.ok) return guard.response
      const params = ((await context?.params) ?? {}) as P
      return await handler(guard.ctx, request, params)
    } catch (error) {
      if (error instanceof AdminError) return fail(error.code, error.message)
      console.error("[api/admin] unexpected error", error instanceof Error ? error.message : error)
      return fail("server_error", "Something went wrong. Try again in a moment.")
    }
  }
}
