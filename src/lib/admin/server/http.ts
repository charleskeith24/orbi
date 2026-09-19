/**
 * SERVER ONLY — JSON responses and request checks shared by `/api/admin/*` and `/api/access-requests`.
 * Every response is `Cache-Control: no-store`; every failure is `{ error, message }` (AdminErrorBody) with a
 * real status. Messages are developer-facing; the UI translates the `error` code.
 */
import type { AdminErrorCode } from "../types"

export const NO_STORE = { "Cache-Control": "no-store" } as const

export const ERROR_STATUS: Record<AdminErrorCode, number> = {
  not_configured: 501,
  unauthorized: 401,
  not_found: 404,
  mfa_required: 403,
  bad_origin: 403,
  invalid: 400,
  self_action: 409,
  last_admin: 409,
  conflict: 409,
  rate_limited: 429,
  closed: 403,
  server_error: 500,
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

/** `{ error, message, ...extra }` with the code's status. */
export function fail(error: AdminErrorCode, message: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, message, ...extra }, { status: ERROR_STATUS[error], headers: NO_STORE })
}

/** Thrown inside handlers to answer with a specific error (caught by `withAdmin`). */
export class AdminError extends Error {
  constructor(
    readonly code: AdminErrorCode,
    message: string
  ) {
    super(message)
  }
}

function firstHeader(value: string | null): string {
  return (value ?? "").split(",")[0].trim().toLowerCase()
}

/**
 * The `Origin` header when it names this site, else null. Browsers always send `Origin` on cross-site and
 * same-site POST/PATCH/DELETE; a missing or foreign one is refused (CSRF). Compared with the Host the
 * request reached (or the proxy's X-Forwarded-Host on Vercel).
 */
export function sameOrigin(request: Request): string | null {
  const origin = request.headers.get("origin")
  if (!origin || origin === "null") return null
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  const hosts = new Set<string>()
  for (const candidate of [firstHeader(request.headers.get("x-forwarded-host")), firstHeader(request.headers.get("host"))]) {
    if (candidate) hosts.add(candidate)
  }
  try {
    hosts.add(new URL(request.url).host.toLowerCase())
  } catch {
    // Relative URLs only happen in tests; the headers above still apply.
  }
  return hosts.has(parsed.host.toLowerCase()) ? parsed.origin : null
}

/** Reads a small JSON body. Empty body → `{}`. Throws AdminError("invalid") when too large or not JSON. */
export async function readJson(request: Request, maxChars = 5_000): Promise<unknown> {
  const raw = await request.text()
  if (raw.length > maxChars) throw new AdminError("invalid", "Request body is too large.")
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new AdminError("invalid", "Request body must be valid JSON.")
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

/** `?page=` → a 1-based page number (default 1). Throws AdminError("invalid") for anything else. */
export function pageParam(request: Request): number {
  const raw = new URL(request.url).searchParams.get("page")
  if (raw === null || raw === "") return 1
  if (!/^\d{1,6}$/.test(raw) || Number(raw) < 1) throw new AdminError("invalid", "page must be a positive whole number.")
  return Number(raw)
}
