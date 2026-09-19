/**
 * DELETE /api/admin/users/:id { confirm_email } → { ok: true }
 * Deletes the account with `auth.admin.deleteUser`; the workspace, feedback and usage events cascade in the
 * database. Its profile photos are deleted first through the Storage API (files can't cascade from SQL); if Storage
 * fails, nothing is deleted and the admin gets a 500 to retry. The body must repeat the account's email. 409 self_action (your own account) · 409 last_admin ·
 * 400 invalid (email doesn't match) · 404 not_found. Writes one audit row (the log keeps the email).
 * Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { loadTarget } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json, readJson } from "@/lib/admin/server/http"
import { loadAdminIds, removeProfilePhotos, userStatus } from "@/lib/admin/server/users"

export const DELETE = withAdmin<{ id: string }>(async ({ service, admin, now }, request, { id }) => {
  if (id === admin.id) throw new AdminError("self_action", "You can't delete your own account here.")
  const user = await loadTarget(service, id)
  const body = (await readJson(request, 1_000)) as { confirm_email?: unknown }
  const confirm = typeof body?.confirm_email === "string" ? body.confirm_email.trim().toLowerCase() : ""
  if (!confirm || confirm !== (user.email ?? "").toLowerCase()) {
    throw new AdminError("invalid", "Type the account's email address to confirm the deletion.")
  }
  const admins = await loadAdminIds(service)
  if (admins.has(id) && admins.size <= 1) throw new AdminError("last_admin", "This is the last admin.")

  await removeProfilePhotos(service, id)
  const { error } = await service.auth.admin.deleteUser(id)
  if (error) throw new Error(`[admin] delete user: ${error.message}`)
  await writeAudit(service, admin, {
    action: "user_deleted",
    target_user_id: id,
    target_email: user.email ?? null,
    details: { status: userStatus(user, now), was_admin: admins.has(id) },
  })
  return json({ ok: true })
})
