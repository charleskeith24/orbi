/**
 * The `/admin` page gate (docs/ADMIN_BRIEF.md §3). Server-only: import it from server components and route
 * handlers, never from client code. The signature is frozen; the admin pages depend on it.
 *
 * - local       no Supabase env vars → the pages show the "online version" notice
 * - signed_out  no valid session (validated with `auth.getUser()`, never cookies alone) → /login?next=
 * - not_admin   signed in but not in `admin_users` (or the check failed) → 404, so the area isn't revealed
 * - needs_mfa   an admin whose session isn't AAL2 → /admin/security (enroll when !has_factor, else challenge)
 * - ok          an admin with 2-step verification
 */
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveAdminSession } from "./server/session"
import type { AdminGate } from "./types"

/** Where the current request stands for the `/admin` area (server components only). */
export async function getAdminGate(): Promise<AdminGate> {
  if (!isSupabaseConfigured) return { status: "local" }
  try {
    const session = await resolveAdminSession(await createSupabaseServerClient())
    switch (session.status) {
      case "ok":
        return { status: "ok", admin: session.admin }
      case "needs_mfa":
        return { status: "needs_mfa", has_factor: session.has_factor, email: session.admin.email }
      default:
        return { status: session.status }
    }
  } catch (error) {
    console.error("[admin] gate failed", error instanceof Error ? error.message : error)
    return { status: "signed_out" }
  }
}
