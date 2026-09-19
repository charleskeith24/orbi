/**
 * GET /api/admin/overview → AdminOverview: users, active in 7/30 days, finished setup, pending requests,
 * feedback in 7 days, the onboarding funnel (opt-in usage events, so it undercounts) and access_open.
 * Counts only. Behind requireAdmin (src/lib/admin/guard.ts).
 */
import { withAdmin } from "@/lib/admin/guard"
import { json } from "@/lib/admin/server/http"
import { loadOverview } from "@/lib/admin/server/overview"

export const GET = withAdmin(async ({ service, now }) => json(await loadOverview(service, now)))
