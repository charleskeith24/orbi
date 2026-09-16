/**
 * GET /api/push/status — what the Settings → Reminders push card needs to be honest:
 * { push: VAPID keys set, scheduler: cron can run, publicKey } (the public key is public by design).
 */
import { missingSchedulerConfig, vapidConfig } from "@/lib/reminders/server/config"
import { json } from "@/lib/reminders/server/respond"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function GET(): Promise<Response> {
  const vapid = vapidConfig()
  return json({
    online: isSupabaseConfigured,
    push: Boolean(vapid),
    scheduler: isSupabaseConfigured && missingSchedulerConfig().length === 0,
    publicKey: vapid?.publicKey ?? null,
  })
}
