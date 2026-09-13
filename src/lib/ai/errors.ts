import type { AiProviderId } from "@/lib/types"

export type AiErrorCode =
  | "invalid_request"
  | "unknown_task"
  | "invalid_input"
  | "unauthorized"
  | "rate_limited"
  | "provider_auth"
  | "provider_error"
  | "overloaded"
  | "timeout"
  | "refusal"
  | "truncated"
  | "invalid_output"
  | "network"
  | "aborted"
  | "unknown"

/** User-facing AI failure. `message` is always safe to show; it never contains keys or stack traces. */
export class AiError extends Error {
  readonly status: number
  readonly code: AiErrorCode
  readonly provider: AiProviderId | null
  readonly retryable: boolean

  constructor(
    message: string,
    options: { status?: number; code?: AiErrorCode; provider?: AiProviderId | null; retryable?: boolean } = {}
  ) {
    super(message)
    this.name = "AiError"
    this.status = options.status ?? 500
    this.code = options.code ?? "unknown"
    this.provider = options.provider ?? null
    this.retryable = options.retryable ?? false
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError
}

/** Normalise anything thrown into an AiError without leaking internals. */
export function toAiError(err: unknown, provider: AiProviderId | null = null): AiError {
  if (err instanceof AiError) return err
  if (err instanceof DOMException && err.name === "AbortError") {
    return new AiError("The request was cancelled.", { status: 499, code: "aborted", provider })
  }
  return new AiError("Something went wrong while generating. Please try again.", { status: 500, code: "unknown", provider, retryable: true })
}
