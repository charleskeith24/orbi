/**
 * POST /api/push/subscribe — saves this browser's push subscription for the signed-in user.
 * Body: PushSubscription.toJSON() → { endpoint, keys: { p256dh, auth } }.
 * 201 → { id }; failures → { error, message } with 400/401/501/500.
 */
import { parsePushSubscription, readJsonBody } from "@/lib/reminders/push-subscription"
import { vapidConfig } from "@/lib/reminders/server/config"
import { failure, json } from "@/lib/reminders/server/respond"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) return failure(501, "not_configured", "Push reminders need the online version (Supabase).")
  if (!vapidConfig()) return failure(501, "not_configured", "Push reminders need VAPID keys on the server.")
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return failure(401, "unauthorized", "Sign in to turn on push reminders.")

    const body = await readJsonBody(request)
    if (!body.ok) return failure(400, "invalid_request", body.error)
    const parsed = parsePushSubscription(body.value)
    if (!parsed.ok) return failure(400, "invalid_request", parsed.error)

    const { data: id, error } = await supabase.rpc("save_push_subscription", {
      p_endpoint: parsed.value.endpoint,
      p_p256dh: parsed.value.p256dh,
      p_auth: parsed.value.auth,
      p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 400),
    })
    if (error || !id) {
      console.error("[api/push/subscribe] save failed", error?.message ?? "no id returned")
      return failure(500, "save_failed", "Couldn't save the subscription. Try again in a moment.")
    }
    return json({ id }, 201)
  } catch (err) {
    console.error("[api/push/subscribe] unexpected error", err instanceof Error ? err.message : err)
    return failure(500, "server_error", "Something went wrong. Try again in a moment.")
  }
}
