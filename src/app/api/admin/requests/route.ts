/**
 * GET /api/admin/requests?status=pending|approved|rejected → AccessRequest[] (newest first; all statuses when
 * `status` is empty). Behind requireAdmin (src/lib/admin/guard.ts).
 */
import { withAdmin } from "@/lib/admin/guard"
import { AdminError, json } from "@/lib/admin/server/http"
import { isAccessRequestStatus, listAccessRequests } from "@/lib/admin/server/requests"

export const GET = withAdmin(async ({ service }, request) => {
  const status = new URL(request.url).searchParams.get("status") || undefined
  if (status !== undefined && !isAccessRequestStatus(status)) throw new AdminError("invalid", "status must be pending, approved or rejected.")
  return json(await listAccessRequests(service, status))
})
