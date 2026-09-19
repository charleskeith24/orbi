/**
 * DELETE /api/admin/users/:id/photo → AdminUserRow
 * Moderation: removes the account's profile photo — the files in its avatars folder go through the Storage API and
 * `public.users.avatar_url` is cleared, so the person shows their initials again. No photo → unchanged, no audit row.
 * 404 not_found. Writes one audit row (`profile_photo_removed`, no details: the photo itself is never logged).
 * Admins can act on any account, their own included (anyone can also remove their own photo in Settings → Profile).
 * Behind requireAdmin; needs a same-origin Origin header.
 */
import { withAdmin } from "@/lib/admin/guard"
import { loadTarget } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { json } from "@/lib/admin/server/http"
import { removeProfilePhotos, userRow } from "@/lib/admin/server/users"

export const DELETE = withAdmin<{ id: string }>(async ({ service, admin, now }, _request, { id }) => {
  const user = await loadTarget(service, id)
  const { data, error } = await service.from("users").select("avatar_url").eq("id", id).maybeSingle()
  if (error) throw new Error(`[admin] load profile photo: ${error.message}`)
  const hadPhoto = Boolean((data as { avatar_url?: string | null } | null)?.avatar_url)
  // Files first: once they're gone, no signed URL can load the photo (a browser may still show a copy it already
  // downloaded, until its cache expires).
  const removed = await removeProfilePhotos(service, id)
  if (hadPhoto) {
    const { error: updateError } = await service.from("users").update({ avatar_url: null }).eq("id", id)
    if (updateError) throw new Error(`[admin] clear profile photo: ${updateError.message}`)
  }
  if (hadPhoto || removed > 0) {
    await writeAudit(service, admin, { action: "profile_photo_removed", target_user_id: id, target_email: user.email ?? null })
  }
  return json(await userRow(service, user, admin.id, now))
})
