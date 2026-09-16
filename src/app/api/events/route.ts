/**
 * POST /api/events — opt-in usage analytics (online version only). Body: { events: [...] }, at most
 * 50 per request. Unknown event names are dropped and props are whitelisted
 * (src/lib/telemetry/events.ts), so no personal content can be stored. Rows are inserted with the
 * caller's session, so RLS pins them to the signed-in user.
 * 202 → { accepted, dropped }; failures → { error, message } with 400/401/413/501/500.
 */
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { MAX_EVENTS_BODY_CHARS, MAX_EVENTS_PER_REQUEST, parseUsageEvent, type UsageEventRow } from "@/lib/telemetry/events"

const NO_STORE = { "Cache-Control": "no-store" }

function failure(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status, headers: NO_STORE })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) return failure(501, "not_configured", "Usage analytics need the online version (Supabase).")
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return failure(401, "unauthorized", "Sign in to send usage events.")

    const raw = await request.text()
    if (raw.length > MAX_EVENTS_BODY_CHARS) return failure(413, "too_large", "Request body is too large.")
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return failure(400, "invalid_request", "Request body must be valid JSON.")
    }
    const events = body && typeof body === "object" && !Array.isArray(body) ? (body as { events?: unknown }).events : undefined
    if (!Array.isArray(events)) return failure(400, "invalid_request", "Expected { events: [...] }.")
    if (events.length > MAX_EVENTS_PER_REQUEST) {
      return failure(413, "too_many_events", `Send at most ${MAX_EVENTS_PER_REQUEST} events per request.`)
    }

    const now = new Date()
    const rows = events
      .map((event) => parseUsageEvent(event, now))
      .filter((event): event is UsageEventRow => event !== null)
      .map((event) => ({ ...event, user_id: user.id }))
    if (rows.length) {
      const { error } = await supabase.from("usage_events").insert(rows)
      if (error) {
        console.error("[api/events] insert failed", error.message)
        return failure(500, "save_failed", "Couldn't save the events.")
      }
    }
    return Response.json({ accepted: rows.length, dropped: events.length - rows.length }, { status: 202, headers: NO_STORE })
  } catch (err) {
    console.error("[api/events] unexpected error", err instanceof Error ? err.message : err)
    return failure(500, "server_error", "Something went wrong.")
  }
}
