import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

type SetAll = (
  cookies: { name: string; value: string; options: Record<string, unknown> }[],
  headers: Record<string, string>
) => void

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>(),
}))

// A fake Supabase server client whose getUser() refreshes the session (writes cookies via setAll).
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: SetAll } }) => ({
    auth: {
      async getUser() {
        options.cookies.setAll([{ name: "sb-test-auth-token", value: "refreshed", options: { path: "/" } }], {
          "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0",
        })
        return getUser()
      },
    },
  }),
}))

/** Imports the proxy with (or without) Supabase env vars; config is read at module load. */
async function loadProxy(configured: boolean) {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", configured ? "https://project.supabase.co" : "")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", configured ? "sb_publishable_test" : "")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
  return import("@/proxy")
}

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"))
const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
const signedOut = () => getUser.mockResolvedValue({ data: { user: null } })

afterEach(() => {
  vi.unstubAllEnvs()
  getUser.mockReset()
})

describe("proxy in local mode", () => {
  it("passes every request through without touching Supabase", async () => {
    const { proxy } = await loadProxy(false)
    const response = await proxy(request("/ideas"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(getUser).not.toHaveBeenCalled()
  })
})

describe("proxy in Supabase mode", () => {
  it("redirects anonymous page requests to /login with the destination", async () => {
    signedOut()
    const { proxy } = await loadProxy(true)
    const response = await proxy(request("/ideas?open=abc"))
    expect(response.status).toBe(307)
    expect(getRedirectUrl(response)).toBe("http://localhost:3000/login?next=%2Fideas%3Fopen%3Dabc")
    // Session cookies written during the check survive the redirect, with no-store caching.
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
    expect(response.headers.get("cache-control")).toContain("no-store")
  })

  it("answers anonymous API calls with 401 JSON", async () => {
    signedOut()
    const { proxy } = await loadProxy(true)
    const response = await proxy(request("/api/ai"))
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
  })

  it("lets signed-in requests through with refreshed cookies", async () => {
    signedIn()
    const { proxy } = await loadProxy(true)
    const response = await proxy(request("/pipeline"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
  })

  it("sends signed-in visitors of /login and /signup on to `next` or home", async () => {
    signedIn()
    const { proxy } = await loadProxy(true)
    expect(getRedirectUrl(await proxy(request("/login?next=%2Fpipeline")))).toBe("http://localhost:3000/pipeline")
    expect(getRedirectUrl(await proxy(request("/signup?next=//evil.com")))).toBe("http://localhost:3000/")
  })

  it("keeps /login, /signup and /auth/* public", async () => {
    signedOut()
    const { proxy } = await loadProxy(true)
    for (const path of ["/login", "/signup?next=/ideas", "/auth/callback?code=abc"]) {
      expect((await proxy(request(path))).headers.get("x-middleware-next"), path).toBe("1")
    }
  })

  it("treats a failing auth check as signed out", async () => {
    getUser.mockRejectedValue(new Error("network down"))
    const { proxy } = await loadProxy(true)
    expect(getRedirectUrl(await proxy(request("/today")))).toBe("http://localhost:3000/login?next=%2Ftoday")
  })
})

describe("proxy matcher", () => {
  it("runs on pages, API routes and auth handlers but skips Next internals and static files", async () => {
    const { config } = await loadProxy(false)
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })
    for (const url of ["/", "/ideas", "/studio/abc", "/api/ai", "/auth/callback", "/login"]) {
      expect(matches(url), url).toBe(true)
    }
    for (const url of [
      "/_next/static/chunks/main.js",
      "/_next/image?url=%2Fa.png&w=64&q=75",
      "/favicon.ico",
      "/logo.png",
      "/robots.txt",
      "/fonts/geist.woff2",
    ]) {
      expect(matches(url), url).toBe(false)
    }
  })
})
