/**
 * GET /api/admin/users?page=&query=&status= → Page<AdminUserRow>
 * Every account from Supabase Auth, filtered by email/name and status, newest first, 50 per page; with the
 * name, admin flag, setup state and counts of ideas, content items and published items — never content.
 * Behind requireAdmin (src/lib/admin/guard.ts).
 */
import { withAdmin } from "@/lib/admin/guard"
import { AdminError, json, pageParam } from "@/lib/admin/server/http"
import { listUserRows } from "@/lib/admin/server/users"
import type { AdminUserStatus } from "@/lib/admin/types"

const STATUSES: readonly string[] = ["invited", "active", "disabled"] satisfies AdminUserStatus[]

export const GET = withAdmin(async ({ service, admin, now }, request) => {
  const params = new URL(request.url).searchParams
  const page = pageParam(request)
  const status = params.get("status") ?? ""
  if (status && !STATUSES.includes(status)) throw new AdminError("invalid", "status must be invited, active or disabled.")
  const query = (params.get("query") ?? "").trim().slice(0, 200)
  return json(await listUserRows(service, { page, query, status: (status || undefined) as AdminUserStatus | undefined }, admin.id, now))
})
