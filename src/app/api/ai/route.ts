/**
 * POST /api/ai — the only place AI runs. Body: { task, input, context }.
 * 200 → { output, provider, model, durationMs }; failures → { error, provider, code } with 400/401/413/429/5xx.
 * Keys stay server-side; error messages never include keys or stack traces.
 * Runs on the Node.js runtime (the default).
 */
import { AiError, toAiError } from "@/lib/ai/errors"
import { providerStatus } from "@/lib/ai/providers"
import { executeAiTask, MAX_REQUEST_CHARS, type AiGatewayFailure } from "@/lib/ai/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/** Seconds — one Claude call (120 s timeout) plus one SDK retry. */
export const maxDuration = 300

const NO_STORE = { "Cache-Control": "no-store" }

function failure(status: number, body: AiGatewayFailure): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

export async function POST(request: Request): Promise<Response> {
  const provider = providerStatus().provider
  try {
    if (isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server")
      const supabase = await createSupabaseServerClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) return failure(401, { error: "Sign in to use the AI features.", provider, code: "unauthorized" })
    }

    const raw = await request.text()
    if (raw.length > MAX_REQUEST_CHARS) {
      return failure(413, { error: "This request is too large. Shorten the text and try again.", provider, code: "invalid_request" })
    }
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return failure(400, { error: "Request body must be valid JSON.", provider, code: "invalid_request" })
    }

    const result = await executeAiTask(body, { signal: request.signal })
    return Response.json(result, { headers: NO_STORE })
  } catch (err) {
    const error = toAiError(err, provider)
    if (!(err instanceof AiError)) console.error("[api/ai] unexpected error", err instanceof Error ? err.message : err)
    const status = error.status >= 400 && error.status <= 599 ? error.status : 500
    return failure(status, { error: error.message, provider: error.provider ?? provider, code: error.code })
  }
}
