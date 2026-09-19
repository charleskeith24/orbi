/**
 * POST /api/admin/users/invite { email } → AdminUserRow (201)
 * Invites someone directly, bypassing the waitlist; a pending request for the same email is marked approved.
 * 400 invalid · 409 conflict (already has an account) · 429 rate_limited (Supabase's email limit).
 * Behind requireAdmin; needs a same-origin Origin header.
 */
import { z } from "zod"
import { accessRequestSchema } from "@/lib/admin/access-request"
import { withAdmin } from "@/lib/admin/guard"
import { sendInvite } from "@/lib/admin/server/actions"
import { writeAudit } from "@/lib/admin/server/audit"
import { AdminError, json, readJson } from "@/lib/admin/server/http"
import { decideAccessRequest, pendingRequestFor } from "@/lib/admin/server/requests"
import { userRow } from "@/lib/admin/server/users"

const inviteSchema = z.object({ email: accessRequestSchema.shape.email })

export const POST = withAdmin(async ({ service, admin, origin, now }, request) => {
  const parsed = inviteSchema.safeParse(await readJson(request, 1_000))
  if (!parsed.success) throw new AdminError("invalid", "Enter a valid email address.")
  const { email } = parsed.data

  const user = await sendInvite(service, email, origin)
  const waiting = await pendingRequestFor(service, email)
  if (waiting) await decideAccessRequest(service, waiting.id, "approved", admin, now)
  await writeAudit(service, admin, {
    action: "user_invited",
    target_user_id: user.id,
    target_email: email,
    details: waiting ? { request_id: waiting.id } : {},
  })
  return json(await userRow(service, user, admin.id, now), 201)
})
