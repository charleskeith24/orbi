/**
 * POST /api/admin/requests/:id/approve → AccessRequest
 * Sends the Supabase invite (the invite → /set-password flow in DEPLOY.md), then marks the request approved
 * with decided_by and decided_at, and writes one audit row.
 * 404 not_found · 409 conflict (already decided, or the email already has an account) · 429 rate_limited
 * (Supabase's email limit). Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { sendInvite } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, isUuid, json } from "@/lib/admin/server/http"
import { decideAccessRequest, getAccessRequest } from "@/lib/admin/server/requests"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, origin, now }, _request, { id }) => {
  const pending = isUuid(id) ? await getAccessRequest(service, id) : null
  if (!pending) throw new AdminError("not_found", "No such request.")
  if (pending.status !== "pending") throw new AdminError("conflict", `This request was already ${pending.status}.`)

  const user = await sendInvite(service, pending.email, origin)
  const approved = await decideAccessRequest(service, id, "approved", admin, now)
  if (!approved) throw new AdminError("conflict", "Another admin decided this request at the same time.")
  await writeAudit(service, admin, {
    action: "request_approved",
    target_user_id: user.id,
    target_email: pending.email,
    details: { request_id: id },
  })
  return json(approved)
})
