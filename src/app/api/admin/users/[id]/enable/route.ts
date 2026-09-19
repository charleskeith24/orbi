/**
 * POST /api/admin/users/:id/enable → AdminUserRow
 * Lifts the ban (`ban_duration: "none"`). Not disabled → unchanged. 404 not_found.
 * Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { loadTarget } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { json } from "@/lib/admin/server/http"
import { userRow, userStatus } from "@/lib/admin/server/users"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, now }, _request, { id }) => {
  const user = await loadTarget(service, id)
  if (userStatus(user, now) !== "disabled") return json(await userRow(service, user, admin.id, now))

  const { data, error } = await service.auth.admin.updateUserById(id, { ban_duration: "none" })
  if (error || !data.user) throw new Error(`[admin] enable user: ${error?.message ?? "no user returned"}`)
  const to = userStatus(data.user, now)
  await writeAudit(service, admin, { action: "user_enabled", target_user_id: id, target_email: user.email ?? null, details: { from: "disabled", to } })
  return json(await userRow(service, data.user, admin.id, now))
})
