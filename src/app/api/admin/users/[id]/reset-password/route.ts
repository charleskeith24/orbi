/**
 * POST /api/admin/users/:id/reset-password → { ok: true }
 * Sends Supabase's password-recovery email (it lands on /set-password with the Reset Password template from
 * SUPABASE.md). 409 conflict for disabled accounts and for invites not accepted yet (resend the invite
 * instead) · 404 not_found · 429 rate_limited. Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { authFailure, loadTarget, setPasswordRedirect } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json } from "@/lib/admin/server/http"
import { userStatus } from "@/lib/admin/server/users"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, origin, now }, _request, { id }) => {
  const user = await loadTarget(service, id)
  const status = userStatus(user, now)
  if (status === "disabled") throw new AdminError("conflict", "Enable the account before sending a password reset.")
  if (status === "invited" || !user.email) throw new AdminError("conflict", "They haven't accepted the invite yet — resend the invite instead.")

  const { error } = await service.auth.resetPasswordForEmail(user.email, { redirectTo: setPasswordRedirect(origin) })
  if (error) authFailure("password reset", error)
  await writeAudit(service, admin, { action: "password_reset_sent", target_user_id: id, target_email: user.email })
  return json({ ok: true })
})
