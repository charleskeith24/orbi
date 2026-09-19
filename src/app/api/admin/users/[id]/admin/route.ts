/**
 * POST   /api/admin/users/:id/admin → AdminUserRow  (make admin; already admin → unchanged)
 * DELETE /api/admin/users/:id/admin → AdminUserRow  (remove admin; not an admin → unchanged)
 * Removing: 409 self_action for your own role, 409 last_admin for the last one (checked atomically in
 * public.revoke_admin). 404 not_found. A change writes one audit row.
 * Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { loadTarget } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json } from "@/lib/admin/server/http"
import { loadAdminIds, userRow } from "@/lib/admin/server/users"

export const POST = withAdmin<{ id: string }>(async ({ service, admin, now }, _request, { id }) => {
  const user = await loadTarget(service, id)
  if (!(await loadAdminIds(service)).has(id)) {
    const { error } = await service.from("admin_users").upsert({ user_id: id, granted_by: admin.id }, { onConflict: "user_id", ignoreDuplicates: true })
    if (error) throw new Error(`[admin] grant admin: ${error.message}`)
    await writeAudit(service, admin, { action: "admin_granted", target_user_id: id, target_email: user.email ?? null })
  }
  return json(await userRow(service, user, admin.id, now))
})

export const DELETE = withAdmin<{ id: string }>(async ({ service, admin, now }, _request, { id }) => {
  if (id === admin.id) throw new AdminError("self_action", "You can't remove your own admin role. Ask another admin.")
  const user = await loadTarget(service, id)
  const { data, error } = await service.rpc("revoke_admin", { p_user_id: id })
  if (error) throw new Error(`[admin] revoke admin: ${error.message}`)
  if (data === "last_admin") throw new AdminError("last_admin", "This is the last admin.")
  if (data === "revoked") {
    await writeAudit(service, admin, { action: "admin_revoked", target_user_id: id, target_email: user.email ?? null })
  }
  return json(await userRow(service, user, admin.id, now))
})
