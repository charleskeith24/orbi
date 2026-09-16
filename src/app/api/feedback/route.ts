/**
 * POST /api/feedback — in-app feedback from the top-bar dialog (online version only).
 * Body: { kind, message, page?, ui_language?, viewport? } (src/lib/telemetry/feedback.ts).
 * The row is inserted with the caller's session, so RLS pins it to the signed-in user.
 * 201 → { id, created_at }; failures → { error, message } with 400/401/413/501/500.
 * Messages are developer-facing; the dialog shows its own translated copy per status.
 */
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { FEEDBACK_MAX_BODY_CHARS, parseFeedback } from "@/lib/telemetry/feedback"

const NO_STORE = { "Cache-Control": "no-store" }

function failure(status: number, error: string, message: string, extra: Record<string, string> = {}): Response {
  return Response.json({ error, message, ...extra }, { status, headers: NO_STORE })
}

/** Short commit id on Vercel (system env), otherwise empty. */
function appVersion(): string {
  return (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7)
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return failure(501, "not_configured", "Feedback is saved by the online version only. In local mode, copy it from the dialog instead.")
  }
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return failure(401, "unauthorized", "Sign in to send feedback.")

    const raw = await request.text()
    if (raw.length > FEEDBACK_MAX_BODY_CHARS) return failure(413, "too_large", "Feedback is too long.")
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return failure(400, "invalid_request", "Request body must be valid JSON.")
    }
    const parsed = parseFeedback(body)
    if (!parsed.ok) return failure(400, "invalid_request", parsed.error, { field: parsed.field })

    const row = {
      ...parsed.value,
      user_id: user.id,
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 400),
      app_version: appVersion(),
    }
    const { data: saved, error } = await supabase.from("feedback").insert(row).select("id, created_at").single()
    if (error || !saved) {
      console.error("[api/feedback] insert failed", error?.message ?? "no row returned")
      return failure(500, "save_failed", "Couldn't save the feedback. Try again in a moment.")
    }
    return Response.json({ id: saved.id, created_at: saved.created_at }, { status: 201, headers: NO_STORE })
  } catch (err) {
    console.error("[api/feedback] unexpected error", err instanceof Error ? err.message : err)
    return failure(500, "server_error", "Something went wrong. Try again in a moment.")
  }
}
