/**
 * SERVER ONLY — the Supabase client with the secret key (service role). It bypasses row-level security,
 * so only route handlers and server components may import it, and every query must scope itself.
 * Never import this file from client code (the key is not a NEXT_PUBLIC_ variable, so a client bundle
 * would get an empty string, and the guard below throws in a browser anyway).
 *
 * Used by the admin area and the access-request waitlist (docs/ADMIN.md). The reminders cron job has
 * its own copy of the same client (src/lib/reminders/server/supabase-store.ts).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseConfigured, SUPABASE_URL } from "@/lib/supabase/config"

/** `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`), read at call time. */
export function supabaseSecretKey(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
}

/** Supabase mode with the secret key available on the server. */
export function isSecretKeyConfigured(): boolean {
  return isSupabaseConfigured && Boolean(SUPABASE_URL) && Boolean(supabaseSecretKey())
}

/** A fresh secret-key client (no session, no token refresh). Throws when the key or URL is missing. */
export function createSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("createSupabaseAdminClient() is server-only")
  const key = supabaseSecretKey()
  if (!SUPABASE_URL || !key) throw new Error("SUPABASE_SECRET_KEY is not set")
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
