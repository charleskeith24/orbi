/**
 * POST /api/admin/requests/:id/reject → AccessRequest
 * Marks the request rejected (no email is sent — fine for the beta; the UI says so) and writes one audit row.
 * 404 not_found · 409 conflict (already decided). Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, isUuid, json } from "@/lib/admin/server/http"
import { decideAccessRequest, getAccessRequest } from "@/lib/admin/server/requests"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, now }, _request, { id }) => {
  const pending = isUuid(id) ? await getAccessRequest(service, id) : null
  if (!pending) throw new AdminError("not_found", "No such request.")
  if (pending.status !== "pending") throw new AdminError("conflict", `This request was already ${pending.status}.`)

  const rejected = await decideAccessRequest(service, id, "rejected", admin, now)
  if (!rejected) throw new AdminError("conflict", "Another admin decided this request at the same time.")
  await writeAudit(service, admin, { action: "request_rejected", target_email: pending.email, details: { request_id: id } })
  return json(rejected)
})
