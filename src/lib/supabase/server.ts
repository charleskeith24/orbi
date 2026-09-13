import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config"

/**
 * Server-side Supabase client bound to the request cookies (Route Handlers,
 * Server Components, Server Actions). Throws when Supabase isn't configured.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured")
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component where cookies are read-only; the proxy refreshes sessions.
        }
      },
    },
  })
}
