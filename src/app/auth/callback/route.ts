import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { safeNextPath } from "@/components/features/auth/auth-paths"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * Landing point for email links (sign-up confirmation, magic link).
 * - `?code=`                  PKCE flow (default Supabase templates)
 * - `?token_hash=&type=`      token-hash flow (custom templates; works across browsers)
 * On success the session cookies are set and the visitor continues to `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const next = safeNextPath(params.get("next"))
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url))
  // Back to sign-in with a readable error, keeping the destination for the retry.
  const failWith = (errorCode: string) => {
    const loginParams = new URLSearchParams({ error: errorCode })
    if (next !== "/") loginParams.set("next", next)
    return redirectTo(`/login?${loginParams}`)
  }

  if (!isSupabaseConfigured) return redirectTo("/")

  // Supabase forwards verification failures (e.g. an expired link) as query params.
  const providerError = params.get("error_code") ?? params.get("error")
  if (providerError) return failWith(providerError)

  const code = params.get("code")
  const tokenHash = params.get("token_hash")
  const type = params.get("type") as EmailOtpType | null

  const supabase = await createSupabaseServerClient()
  let errorCode: string | undefined = "link_invalid"
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    errorCode = error ? (error.code ?? "link_invalid") : undefined
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    errorCode = error ? (error.code ?? "link_invalid") : undefined
  }

  return errorCode ? failWith(errorCode) : redirectTo(next)
}
