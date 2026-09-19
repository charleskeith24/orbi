/**
 * GET /api/admin/feedback?page= → Page<AdminFeedback> (newest first, 50 per page, with the sender's email).
 * Behind requireAdmin (src/lib/admin/guard.ts).
 */
import { withAdmin } from "@/lib/admin/guard"
import { listFeedback } from "@/lib/admin/server/feedback"
import { json, pageParam } from "@/lib/admin/server/http"

export const GET = withAdmin(async ({ supabase, service }, request) => json(await listFeedback(supabase, service, pageParam(request))))
