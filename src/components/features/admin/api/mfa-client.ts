/**
 * 2-step verification (TOTP) for the admin area, over Supabase Auth's `auth.mfa.*` in the browser.
 * The dev fixture implements the same interface with sample data.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { translator, type UiLang } from "@/lib/i18n/core"
import { securityErrorMessages } from "../messages"

/** A verified authenticator app. */
export interface MfaFactor {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

/** A started (unverified) enrollment: show the QR code and secret, then verify a code. */
export interface MfaEnrollment {
  factorId: string
  /** `data:image/svg+xml` URL. */
  qrCode: string
  secret: string
}

export interface MfaClient {
  /** Verified authenticator apps only. */
  listFactors(): Promise<MfaFactor[]>
  /** Starts a TOTP enrollment (clears unfinished ones first so a retry never hits a name conflict). */
  enroll(): Promise<MfaEnrollment>
  /** Challenge + verify a 6-digit code: finishes an enrollment or raises the session to AAL2. */
  verify(factorId: string, code: string): Promise<void>
  /** Removes a factor (also used to drop an enrollment the person abandoned). */
  unenroll(factorId: string): Promise<void>
}

/** Error with a Supabase Auth error code (`mfa_verification_failed`, …) when there is one. */
export class MfaError extends Error {
  readonly code: string
  constructor(code: string, message?: string) {
    super(message || code)
    this.name = "MfaError"
    this.code = code
  }
}

interface AuthErrorish {
  code?: string
  message?: string
  status?: number
}

function fail(error: AuthErrorish): never {
  const code = error.code ?? (error.status === 429 ? "over_request_rate_limit" : "unexpected_failure")
  throw new MfaError(code, error.message)
}

export const isSixDigitCode = (value: string) => /^\d{6}$/.test(value)

/** Digits only, at most 6 — for the code input (people paste "123 456"). */
export const cleanCode = (value: string) => value.replace(/\D/g, "").slice(0, 6)

/** `supabase` is a getter so the browser client is only created when a method runs (never during SSR). */
export function createSupabaseMfaClient(supabase: () => SupabaseClient, now: () => Date = () => new Date()): MfaClient {
  const mfa = {
    listFactors: () => supabase().auth.mfa.listFactors(),
    enroll: (params: { factorType: "totp"; friendlyName: string; issuer: string }) => supabase().auth.mfa.enroll(params),
    unenroll: (params: { factorId: string }) => supabase().auth.mfa.unenroll(params),
    challengeAndVerify: (params: { factorId: string; code: string }) => supabase().auth.mfa.challengeAndVerify(params),
  }

  async function listAll() {
    const { data, error } = await mfa.listFactors()
    if (error) fail(error)
    return data
  }

  return {
    async listFactors() {
      const data = await listAll()
      return data.totp.map((factor) => ({
        id: factor.id,
        name: factor.friendly_name ?? "",
        created_at: factor.created_at,
        last_used_at: factor.last_challenged_at ?? null,
      }))
    },

    async enroll() {
      const data = await listAll()
      for (const factor of data.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          const { error } = await mfa.unenroll({ factorId: factor.id })
          if (error) fail(error)
        }
      }
      const stamp = now().toISOString().slice(0, 16).replace("T", " ")
      const { data: enrolled, error } = await mfa.enroll({ factorType: "totp", friendlyName: `Orbi admin ${stamp}`, issuer: "Orbi" })
      if (error) fail(error)
      return { factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret }
    },

    async verify(factorId, code) {
      const { error } = await mfa.challengeAndVerify({ factorId, code })
      if (error) fail(error)
    },

    async unenroll(factorId) {
      const { error } = await mfa.unenroll({ factorId })
      if (error) fail(error)
    },
  }
}

const MFA_ERROR_KEYS: Record<string, keyof (typeof securityErrorMessages)["en"]> = {
  mfa_verification_failed: "wrong_code",
  mfa_verification_rejected: "wrong_code",
  mfa_challenge_expired: "code_expired",
  mfa_factor_not_found: "factor_gone",
  too_many_enrolled_mfa_factors: "too_many",
  mfa_factor_name_conflict: "name_conflict",
  mfa_totp_enroll_not_enabled: "totp_disabled",
  mfa_totp_verify_not_enabled: "totp_disabled",
  insufficient_aal: "needs_aal2",
  session_not_found: "signed_out",
  session_expired: "signed_out",
  over_request_rate_limit: "rate_limited",
}

/** A sentence for an MFA failure. */
export function describeMfaError(error: unknown, lang: UiLang = "en"): string {
  const t = translator(securityErrorMessages, lang)
  const code = error instanceof MfaError ? error.code : undefined
  if (code && MFA_ERROR_KEYS[code]) return t(MFA_ERROR_KEYS[code])
  if (error instanceof Error && /failed to fetch|network|load failed/i.test(error.message)) return t("unreachable")
  return t("generic")
}
