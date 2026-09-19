/**
 * SERVER ONLY — where the signed-in visitor stands for the admin area, from their own session client
 * (cookies). Shared by the page gate (`../gate`) and the API guard (`../guard`).
 *
 * 1. `auth.getUser()` validates the session with Supabase Auth — cookies alone are never trusted.
 * 2. `is_admin()` runs in Postgres with that session's JWT (PostgREST verifies it).
 * 3. The assurance level comes from the same, just-validated access token: `aal2` means the session
 *    passed 2-step verification.
 * Any failure along the way fails closed (signed_out / not_admin / needs_mfa).
 */
import type { SupabaseClient, User } from "@supabase/supabase-js"

export interface AdminIdentity {
  id: string
  email: string
}

export type AdminSession =
  | { status: "signed_out" }
  | { status: "not_admin" }
  | { status: "needs_mfa"; has_factor: boolean; admin: AdminIdentity }
  | { status: "ok"; admin: AdminIdentity }

/** Whether the user has a verified second factor (TOTP, phone or passkey). */
export function hasVerifiedFactor(user: Pick<User, "factors">): boolean {
  return (user.factors ?? []).some((factor) => factor.status === "verified")
}

export async function resolveAdminSession(supabase: SupabaseClient): Promise<AdminSession> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user
  if (userError || !user) return { status: "signed_out" }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin")
  if (adminError) {
    console.error("[admin] is_admin() failed", adminError.message)
    return { status: "not_admin" }
  }
  if (isAdmin !== true) return { status: "not_admin" }

  const admin: AdminIdentity = { id: user.id, email: user.email ?? "" }
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalError || aal?.currentLevel !== "aal2") {
    return { status: "needs_mfa", has_factor: hasVerifiedFactor(user), admin }
  }
  return { status: "ok", admin }
}
