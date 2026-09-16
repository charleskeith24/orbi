/**
 * POST /api/push/test — sends a test notification to the signed-in user's devices (or only to
 * `endpoint` when given), in the workspace language. Subscriptions the push service reports gone are
 * deleted. 200 → { sent, failed, removed }; 404 when there is no subscription.
 */
import { translate, uiLangOf } from "@/lib/i18n/core"
import { toPushTarget, type StoredPushSubscription } from "@/lib/reminders/cron"
import { reminderMessages } from "@/lib/reminders/messages"
import { parseEndpoint, readJsonBody } from "@/lib/reminders/push-subscription"
import { vapidConfig } from "@/lib/reminders/server/config"
import { failure, json } from "@/lib/reminders/server/respond"
import { createWebPushSender } from "@/lib/reminders/server/web-push-sender"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) return failure(501, "not_configured", "Push reminders need the online version (Supabase).")
  const vapid = vapidConfig()
  if (!vapid) return failure(501, "not_configured", "Push reminders need VAPID keys on the server.")
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return failure(401, "unauthorized", "Sign in to test push reminders.")

    const body = await readJsonBody(request)
    if (!body.ok) return failure(400, "invalid_request", body.error)
    const rawEndpoint = (body.value as { endpoint?: unknown }).endpoint
    const endpoint = rawEndpoint === undefined ? null : parseEndpoint(rawEndpoint)
    if (endpoint && !endpoint.ok) return failure(400, "invalid_request", endpoint.error)

    let query = supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, created_at, failure_count")
      .eq("user_id", user.id)
    if (endpoint?.ok) query = query.eq("endpoint", endpoint.value)
    const [{ data: rows, error }, { data: settings }] = await Promise.all([
      query,
      supabase.from("app_settings").select("ui_language").eq("user_id", user.id).limit(1).maybeSingle(),
    ])
    if (error) {
      console.error("[api/push/test] load failed", error.message)
      return failure(500, "load_failed", "Couldn't load your devices. Try again in a moment.")
    }
    const subscriptions = (rows ?? []) as StoredPushSubscription[]
    if (!subscriptions.length) return failure(404, "no_subscription", "Turn on push reminders on this device first.")

    const lang = uiLangOf(settings as { ui_language?: string } | null)
    const payload = {
      title: translate(reminderMessages, lang, "test_title"),
      body: translate(reminderMessages, lang, "test_body"),
      url: "/settings?tab=reminders",
      tag: "orbi-test",
    }
    const send = createWebPushSender(vapid)
    const result = { sent: 0, failed: 0, removed: 0 }
    for (const row of subscriptions) {
      const outcome = await send(toPushTarget(row), payload, { ttlSeconds: 600 })
      if (outcome.ok) {
        result.sent++
        continue
      }
      result.failed++
      if (outcome.gone) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id)
        result.removed++
      }
    }
    return json(result)
  } catch (err) {
    console.error("[api/push/test] unexpected error", err instanceof Error ? err.message : err)
    return failure(500, "server_error", "Something went wrong. Try again in a moment.")
  }
}
