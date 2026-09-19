/**
 * Admin API failures as one error type, and a sentence a person can act on for each. Pure module:
 * used by the HTTP client, the dev fixture, the views and tests.
 */
import { translator, type UiLang } from "@/lib/i18n/core"
import type { AdminErrorCode } from "@/lib/admin/types"
import { adminErrorMessages } from "../messages"

/** The contract's error codes plus the two the client produces itself. */
export type AdminClientErrorCode = AdminErrorCode | "network" | "unknown"

const CONTRACT_CODES: ReadonlySet<string> = new Set<AdminErrorCode>([
  "not_configured",
  "unauthorized",
  "not_found",
  "mfa_required",
  "bad_origin",
  "invalid",
  "self_action",
  "last_admin",
  "conflict",
  "rate_limited",
  "closed",
  "server_error",
])

export const isAdminErrorCode = (value: unknown): value is AdminErrorCode =>
  typeof value === "string" && CONTRACT_CODES.has(value)

export class AdminApiError extends Error {
  readonly code: AdminClientErrorCode
  /** HTTP status; 0 when the request never got an answer. */
  readonly status: number

  constructor(code: AdminClientErrorCode, status: number, message?: string) {
    super(message || code)
    this.name = "AdminApiError"
    this.code = code
    this.status = status
  }
}

/** Code for a failed response: the body's `error` when it's a contract code, otherwise from the status. */
export function codeForResponse(status: number, body: unknown): AdminClientErrorCode {
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined
  if (isAdminErrorCode(error)) return error
  if (status === 400 || status === 413 || status === 422) return "invalid"
  if (status === 401) return "unauthorized"
  if (status === 404) return "not_found"
  if (status === 409) return "conflict"
  if (status === 429) return "rate_limited"
  if (status === 501) return "not_configured"
  if (status >= 500) return "server_error"
  return "unknown"
}

/** Any thrown value → AdminApiError (network failures and bugs become "network" / "unknown"). */
export function toAdminError(error: unknown): AdminApiError {
  if (error instanceof AdminApiError) return error
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|network|load failed/i.test(error.message))) {
    return new AdminApiError("network", 0, error.message)
  }
  return new AdminApiError("unknown", 0, error instanceof Error ? error.message : String(error))
}

/** A translated sentence for any admin failure. */
export function describeAdminError(error: unknown, lang: UiLang = "en"): string {
  const t = translator(adminErrorMessages, lang)
  return t(toAdminError(error).code)
}
