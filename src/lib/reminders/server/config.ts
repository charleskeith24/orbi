/**
 * Server-only configuration for push reminders, read from the environment at call time (tests and
 * `next start` can change it). Never import this from client code: it reads secrets.
 */
import { SUPABASE_URL } from "@/lib/supabase/config"

export interface VapidConfig {
  publicKey: string
  privateKey: string
  /** `mailto:` or `https:` contact the push services can reach. */
  subject: string
}

/** VAPID keys and contact, or null when push isn't configured. */
export function vapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim()
  const privateKey = (env.VAPID_PRIVATE_KEY ?? "").trim()
  const production = (env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim()
  const subject = (env.VAPID_SUBJECT ?? "").trim() || (production ? `https://${production}` : "")
  if (!publicKey || !privateKey || !/^(mailto:|https:\/\/)/.test(subject)) return null
  return { publicKey, privateKey, subject }
}

/** The service-role key the cron job uses (bypasses row-level security — server only). */
export function supabaseSecretKey(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
}

export function cronSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (env.CRON_SECRET ?? "").trim()
}

/** What the reminders scheduler still needs, as env var names (empty when ready). */
export function missingSchedulerConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!supabaseSecretKey(env)) missing.push("SUPABASE_SECRET_KEY")
  if (!cronSecret(env)) missing.push("CRON_SECRET")
  if (!vapidConfig(env)) missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT")
  return missing
}
