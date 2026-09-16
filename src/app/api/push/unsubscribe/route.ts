/**
 * POST /api/push/unsubscribe — removes this browser's subscription (row-level security limits the
 * delete to the caller's own rows). Body: { endpoint }. 200 → { removed }.
 */
import { parseEndpoint, readJsonBody } from "@/lib/reminders/push-subscription"
import { failure, json } from "@/lib/reminders/server/respond"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) return failure(501, "not_configured", "Push reminders need the online version (Supabase).")
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return failure(401, "unauthorized", "Sign in to manage push reminders.")

    const body = await readJsonBody(request)
    if (!body.ok) return failure(400, "invalid_request", body.error)
    const endpoint = parseEndpoint((body.value as { endpoint?: unknown }).endpoint)
    if (!endpoint.ok) return failure(400, "invalid_request", endpoint.error)

    const { error, count } = await supabase
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .eq("user_id", data.user.id)
      .eq("endpoint", endpoint.value)
    if (error) {
      console.error("[api/push/unsubscribe] delete failed", error.message)
      return failure(500, "delete_failed", "Couldn't turn off push reminders. Try again in a moment.")
    }
    return json({ removed: count ?? 0 })
  } catch (err) {
    console.error("[api/push/unsubscribe] unexpected error", err instanceof Error ? err.message : err)
    return failure(500, "server_error", "Something went wrong. Try again in a moment.")
  }
}
