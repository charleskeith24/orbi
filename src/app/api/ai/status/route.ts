/**
 * GET /api/ai/status → { provider, model, configured, reason, source } — which engine writes for the person
 * asking. Online, that's their own key (bring your own key) or the offline templates, never the server's key.
 */
import { aiStatusForUser } from "@/lib/ai/byok/resolve"
import { providerStatus } from "@/lib/ai/providers"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured) return Response.json(providerStatus(), { headers: NO_STORE })
  const { createSupabaseServerClient } = await import("@/lib/supabase/server")
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return Response.json({ error: "Sign in to see your AI engine." }, { status: 401, headers: NO_STORE })
  try {
    return Response.json(await aiStatusForUser(data.user.id), { headers: NO_STORE })
  } catch (err) {
    console.error("[api/ai/status] failed", err instanceof Error ? err.message : err)
    return Response.json({ error: "Couldn't check your AI engine." }, { status: 500, headers: NO_STORE })
  }
}
