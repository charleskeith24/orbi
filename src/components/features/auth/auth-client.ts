/** Browser-side auth helpers: readable Supabase errors and email-link redirect URLs. */

const LINK_INVALID = "That sign-in link is invalid or has expired. Request a new one."
const OTHER_BROWSER = "Open the link in the same browser you requested it from, or request a new one."
const ALREADY_REGISTERED = "An account with this email already exists. Sign in instead."
const RATE_LIMITED = "Too many attempts. Wait a minute, then try again."

const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check both and try again.",
  email_not_confirmed: "Confirm your email first: open the link we sent when you signed up, or email yourself a magic link.",
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  weak_password: "Choose a stronger password: at least 8 characters, mixing letters, numbers and symbols.",
  over_email_send_rate_limit: "Too many emails were sent. Wait a minute, then try again.",
  over_request_rate_limit: RATE_LIMITED,
  signup_disabled: "New accounts are disabled for this project. Enable sign-ups in Supabase → Authentication.",
  email_provider_disabled: "Email sign-in is disabled. Enable the Email provider in Supabase → Authentication.",
  otp_disabled: "Magic links are disabled for this project. Sign in with your password instead.",
  email_address_invalid: "Enter a valid email address.",
  email_address_not_authorized:
    "Supabase's built-in email service only sends to your team's addresses. Configure custom SMTP to email anyone.",
  otp_expired: LINK_INVALID,
  flow_state_expired: LINK_INVALID,
  access_denied: LINK_INVALID,
  link_invalid: LINK_INVALID,
  flow_state_not_found: OTHER_BROWSER,
  bad_code_verifier: OTHER_BROWSER,
  session_expired: "Your session expired. Sign in again.",
  user_banned: "This account has been suspended.",
}

interface AuthErrorLike {
  code?: string
  message?: string
  status?: number
  name?: string
}

/** A sentence a person can act on, for a Supabase Auth error or a callback `?error=` code. */
export function describeAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return "Something went wrong. Try again."
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]
  if (error.status === 429) return RATE_LIMITED
  if (error.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(error.message ?? "")) {
    return "Couldn't reach Supabase. Check your connection and NEXT_PUBLIC_SUPABASE_URL."
  }
  return error.message || "Something went wrong. Try again."
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
