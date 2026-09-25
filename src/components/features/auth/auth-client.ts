/** Browser-side auth helpers: readable Supabase errors and email-link redirect URLs. */
import { authErrorMessages } from "@/components/features/auth/messages"
import { translator, type UiLang } from "@/lib/i18n/core"

type AuthErrorKey = keyof (typeof authErrorMessages)["en"]

/** Supabase Auth error code (or callback `?error=` code) → message key. */
const MESSAGES: Record<string, AuthErrorKey> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "already_registered",
  email_exists: "already_registered",
  weak_password: "weak_password",
  over_email_send_rate_limit: "email_rate_limit",
  over_request_rate_limit: "rate_limited",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "email_provider_disabled",
  otp_disabled: "otp_disabled",
  email_address_invalid: "email_address_invalid",
  email_address_not_authorized: "email_not_authorized",
  otp_expired: "link_invalid",
  flow_state_expired: "link_invalid",
  access_denied: "link_invalid",
  link_invalid: "link_invalid",
  flow_state_not_found: "other_browser",
  bad_code_verifier: "other_browser",
  session_expired: "session_expired",
  user_banned: "user_banned",
}

export interface AuthErrorLike {
  code?: string
  message?: string
  status?: number
  name?: string
}

/** A sentence a person can act on, for a Supabase Auth error or a callback `?error=` code. */
export function describeAuthError(error: AuthErrorLike | null | undefined, lang: UiLang = "en"): string {
  const t = translator(authErrorMessages, lang)
  if (!error) return t("generic")
  const key = error.code ? MESSAGES[error.code] : undefined
  if (key) return t(key)
  if (error.status === 429) return t("rate_limited")
  if (error.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(error.message ?? "")) {
    return t("unreachable")
  }
  // Supabase's own message (English) for anything unmapped.
  return error.message || t("generic")
}

/**
 * Magic links only sign in existing accounts (`shouldCreateUser: false` — accounts come from the waitlist). For an
 * email without one, Supabase answers `otp_disabled`, or `signup_disabled` when it would have created the account
 * but sign-ups are off. The form treats both like a sent link, as the password form's single "don't match" message
 * does, so the page never reveals who has an account — and never tells a visitor to turn sign-ups on.
 */
export function isNoAccountError(error: AuthErrorLike | null | undefined): boolean {
  return error?.code === "otp_disabled" || error?.code === "signup_disabled"
}

/** Where Supabase sends people from confirmation and magic-link emails. */
export function emailRedirectUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin)
  if (next !== "/") url.searchParams.set("next", next)
  return url.toString()
}

/** `/login` or `/signup`, carrying the destination along. */
export function authPageHref(page: "/login" | "/signup", next: string): string {
  return next === "/" ? page : `${page}?${new URLSearchParams({ next })}`
}
