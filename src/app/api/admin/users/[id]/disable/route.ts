/**
 * POST /api/admin/users/:id/disable → AdminUserRow
 * Bans the account (`ban_duration`, 100 years): it can't sign in or refresh its session; a session already
 * open ends when its access token expires (at most an hour by default). Already disabled → unchanged.
 * 409 self_action · 409 last_admin · 404 not_found. Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { loadTarget } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json } from "@/lib/admin/server/http"
import { DISABLE_BAN_DURATION, loadAdminIds, userRow, userStatus } from "@/lib/admin/server/users"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, now }, _request, { id }) => {
  if (id === admin.id) throw new AdminError("self_action", "You can't disable your own account.")
  const user = await loadTarget(service, id)
  const from = userStatus(user, now)
  if (from === "disabled") return json(await userRow(service, user, admin.id, now))
  const admins = await loadAdminIds(service)
  if (admins.has(id) && admins.size <= 1) throw new AdminError("last_admin", "This is the last admin.")

  const { data, error } = await service.auth.admin.updateUserById(id, { ban_duration: DISABLE_BAN_DURATION })
  if (error || !data.user) throw new Error(`[admin] disable user: ${error?.message ?? "no user returned"}`)
  await writeAudit(service, admin, { action: "user_disabled", target_user_id: id, target_email: user.email ?? null, details: { from, to: "disabled" } })
  return json(await userRow(service, data.user, admin.id, now))
})
