/**
 * POST /api/admin/users/:id/resend-invite → { ok: true }
 * Sends the invite email again — only while the account is still invited (never signed in).
 * 404 not_found · 409 conflict · 429 rate_limited. Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { loadTarget, sendInvite } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json } from "@/lib/admin/server/http"
import { userStatus } from "@/lib/admin/server/users"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, origin, now }, _request, { id }) => {
  const user = await loadTarget(service, id)
  if (userStatus(user, now) !== "invited" || !user.email) {
    throw new AdminError("conflict", "Only accounts that haven't accepted their invite yet can get it again.")
  }
  await sendInvite(service, user.email, origin)
  await writeAudit(service, admin, { action: "invite_resent", target_user_id: id, target_email: user.email })
  return json({ ok: true })
})
