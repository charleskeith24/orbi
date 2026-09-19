import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { decideProxyAction } from "@/components/features/auth/auth-paths"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config"

/**
 * Scheduled jobs (`/api/cron/*`) are called by the scheduler with `Authorization: Bearer $CRON_SECRET`
 * and no session cookie; each route checks that secret itself.
 */
export function isCronRoute(pathname: string): boolean {
  return pathname === "/api/cron" || pathname.startsWith("/api/cron/")
}

/**
 * Supabase mode: refreshes the auth session on every request and guards routes.
 * - anonymous page request   → /login?next=<path> (except the public /privacy and /terms pages)
 * - anonymous /api/* request → 401 JSON (except /api/cron/*, which authenticates with CRON_SECRET, and
 *   POST /api/access-requests, the public "Request access" form)
 * - signed-in /login|/signup → the `next` page or '/'
 * Local mode (no Supabase env vars): a pass-through.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured || isCronRoute(request.nextUrl.pathname)) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        // Refreshed tokens must reach both the rendering request and the browser.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
      },
    },
  })

  // getUser() validates the session with Supabase Auth (and refreshes it) — never trust cookies alone.
  let isAuthenticated = false
  try {
    const { data } = await supabase.auth.getUser()
    isAuthenticated = Boolean(data.user)
  } catch {
    isAuthenticated = false
  }

  const { pathname, search } = request.nextUrl
  const decision = decideProxyAction(pathname, search, isAuthenticated, request.method)
  if (decision.action === "continue") return response

  const final =
    decision.action === "unauthorized"
      ? NextResponse.json({ error: "unauthorized", message: "Sign in to use this endpoint." }, { status: 401 })
      : NextResponse.redirect(new URL(decision.location, request.url))
  // Carry refreshed/cleared auth cookies and their no-store headers over to the new response.
  for (const cookie of response.cookies.getAll()) final.cookies.set(cookie)
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header)
    if (value) final.headers.set(header, value)
  }
  return final
}

export const config = {
  matcher: [
    // Everything except Next internals and public files: the service worker (a browser refuses a
    // redirected worker script, so a signed-out visitor could never install or update it), PWA icons,
    // images, fonts, robots/sitemap and manifests.
    "/((?!_next/|favicon\\.ico$|sw\\.js$|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest|woff2?|ttf|otf)$).*)",
  ],
}
