/** Shared JSON responses for the push and cron routes. Messages are developer-facing. */
export const NO_STORE = { "Cache-Control": "no-store" }

export function failure(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status, headers: NO_STORE })
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}
