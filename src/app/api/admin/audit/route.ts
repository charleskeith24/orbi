/**
 * GET /api/admin/audit?page= → Page<AdminAuditEntry> (newest first, 50 per page).
 * Read through the admin's own session: the audit log's read policy requires is_admin() and AAL2.
 * Behind requireAdmin (src/lib/admin/guard.ts).
 */
import { withAdmin } from "@/lib/admin/guard"
import { listAudit } from "@/lib/admin/server/audit"
import { json, pageParam } from "@/lib/admin/server/http"

export const GET = withAdmin(async ({ supabase }, request) => json(await listAudit(supabase, pageParam(request))))
