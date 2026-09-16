/**
 * GET|POST /api/cron/reminders — sends due push reminders to every subscribed device.
 *
 * Called by a scheduler (docs/REMINDERS.md): Vercel Cron (vercel.json; sends
 * `Authorization: Bearer $CRON_SECRET` automatically) or Supabase Cron + pg_net every 15 minutes.
 * The proxy lets /api/cron/* through without a session, so the bearer secret is the only lock:
 * missing/wrong → 401, CRON_SECRET unset → 503.
 *
 * Idempotent and safe to call often or concurrently (per-device claims in the database).
 * 200 → { ok, ranAt, subscriptions, users, due, sent, skipped, failed, removed }.
 */
import { runReminderCron } from "@/lib/reminders/cron"
import { cronSecret, supabaseSecretKey, vapidConfig } from "@/lib/reminders/server/config"
import { authorizeCron } from "@/lib/reminders/server/cron-auth"
import { failure, json } from "@/lib/reminders/server/respond"
import { createServiceClient, createSupabaseReminderStore } from "@/lib/reminders/server/supabase-store"
import { createWebPushSender } from "@/lib/reminders/server/web-push-sender"
import { SUPABASE_URL } from "@/lib/supabase/config"

export const maxDuration = 60

async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request.headers.get("authorization"), cronSecret())
  if (!auth.ok) {
    return auth.error === "not_configured"
      ? failure(503, "not_configured", "CRON_SECRET is not set, so scheduled reminders are disabled.")
      : failure(401, "unauthorized", "Missing or wrong Authorization bearer token.")
  }
  const secretKey = supabaseSecretKey()
  if (!SUPABASE_URL || !secretKey) {
    return failure(503, "not_configured", "Push reminders need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.")
  }
  const vapid = vapidConfig()
  if (!vapid) {
    return failure(503, "not_configured", "Push reminders need NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.")
  }
  const now = new Date()
  try {
    const summary = await runReminderCron({
      store: createSupabaseReminderStore(createServiceClient(secretKey)),
      send: createWebPushSender(vapid),
      now,
    })
    return json({ ok: true, ranAt: now.toISOString(), ...summary })
  } catch (error) {
    console.error("[api/cron/reminders] failed", error instanceof Error ? error.message : error)
    return failure(500, "server_error", "The reminder job failed. It is safe to run again.")
  }
}

export const GET = handle
export const POST = handle
