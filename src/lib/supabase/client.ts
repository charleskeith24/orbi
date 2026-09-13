import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config"

let browserClient: SupabaseClient | null = null

/** Singleton browser client. Throws when Supabase isn't configured — check `isSupabaseConfigured` first. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured")
  browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return browserClient
}
