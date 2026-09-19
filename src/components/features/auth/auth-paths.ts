/**
 * Route rules shared by the proxy, the auth pages and the auth route handlers.
 * Pure and dependency-free so `src/proxy.ts` stays small.
 */

/** Pages that only make sense without a session. Signed-in visitors are sent on. */
export const AUTH_PAGES = ["/login", "/signup"] as const

const matches = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => matches(pathname, page))
}

/** Route handlers under /auth (callback, sign-out) manage the session themselves. */
export function isAuthRoute(pathname: string): boolean {
  return matches(pathname, "/auth")
}

export function isApiRoute(pathname: string): boolean {
  return matches(pathname, "/api")
}

/** Pages anyone may read, signed in or not (the privacy notice is linked from the request-access form). */
export const PUBLIC_PAGES = ["/privacy"] as const

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((page) => matches(pathname, page))
}

/**
 * API calls anonymous visitors may make: `POST /api/access-requests`, the "Request access" form (the route
 * checks the Origin header, validates and rate-limits). Every other method and API path still needs a session.
 */
export function isPublicApiCall(pathname: string, method: string): boolean {
  return pathname === "/api/access-requests" && method.toUpperCase() === "POST"
}

/**
 * Only same-origin, relative paths are accepted as post-sign-in destinations
 * (prevents open redirects such as `?next=//evil.com` or `?next=/\evil.com`).
 * Auth pages and handlers fall back too, so a sign-in can never loop.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback
  for (const char of value) {
    const code = char.charCodeAt(0)
    // Browsers strip tabs/newlines from URLs, which would turn "/\t/evil.com" into "//evil.com".
    if (code < 0x20 || code === 0x7f) return fallback
  }
  const pathname = value.split(/[?#]/, 1)[0]
  if (isAuthPage(pathname) || isAuthRoute(pathname)) return fallback
  return value
}

/** First value of a Next.js `searchParams` entry. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** `/login` with the page the visitor was trying to reach, e.g. `/login?next=%2Fideas`. */
export function loginPathFor(pathname: string, search = ""): string {
  const next = safeNextPath(`${pathname}${search}`, "")
  return next && next !== "/" ? `/login?${new URLSearchParams({ next })}` : "/login"
}

export type ProxyDecision =
  | { action: "continue" }
  | { action: "redirect"; location: string }
  | { action: "unauthorized" }

/** What the proxy does with a request once it knows whether a session exists. */
export function decideProxyAction(pathname: string, search: string, isAuthenticated: boolean, method = "GET"): ProxyDecision {
  if (isAuthRoute(pathname) || isPublicPage(pathname) || isPublicApiCall(pathname, method)) return { action: "continue" }
  if (isAuthPage(pathname)) {
    if (!isAuthenticated) return { action: "continue" }
    return { action: "redirect", location: safeNextPath(new URLSearchParams(search).get("next")) }
  }
  if (isAuthenticated) return { action: "continue" }
  if (isApiRoute(pathname)) return { action: "unauthorized" }
  return { action: "redirect", location: loginPathFor(pathname, search) }
}
