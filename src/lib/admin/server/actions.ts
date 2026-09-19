/**
 * SERVER ONLY — small helpers the `/api/admin/*` mutations share: loading the target account, sending the
 * Supabase Auth emails and turning Auth errors into the contract's error codes.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { AdminError, isUuid } from "./http"
import { getAuthUser, isEmailTaken } from "./users"

/**
 * Where invite and password-reset emails send people. With the token-hash email templates (DEPLOY.md step 5),
 * the template builds the link itself from the Site URL; this is the fallback for templates that use
 * `{{ .RedirectTo }}`. Must be allowed under Authentication → URL Configuration → Redirect URLs.
 */
export function setPasswordRedirect(origin: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent("/set-password")}`
}

/** The account the route acts on, or 404 not_found. */
export async function loadTarget(service: SupabaseClient, id: string): Promise<User> {
  if (!isUuid(id)) throw new AdminError("not_found", "No such account.")
  const user = await getAuthUser(service, id)
  if (!user) throw new AdminError("not_found", "No such account.")
  return user
}

type AuthErrorLike = { message?: string; code?: string; status?: number }

/** Supabase Auth failures the admin can act on get a real code; anything else is a server error. */
export function authFailure(what: string, error: AuthErrorLike): never {
  if (isEmailTaken(error)) throw new AdminError("conflict", "This email already has an account.")
  if (error.status === 429 || /rate limit/i.test(error.message ?? "") || (error.code ?? "").includes("rate_limit")) {
    throw new AdminError("rate_limited", "Supabase's email limit was reached. Try again later, or set up custom SMTP (DEPLOY.md step 5).")
  }
  throw new Error(`[admin] ${what}: ${error.message ?? "unknown error"}`)
}

/** Sends (or re-sends) a Supabase invite email. Returns the invited account. */
export async function sendInvite(service: SupabaseClient, email: string, origin: string): Promise<User> {
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: setPasswordRedirect(origin) })
  if (error) authFailure("invite", error)
  if (!data.user) throw new Error("[admin] invite: no user returned")
  return data.user
}
