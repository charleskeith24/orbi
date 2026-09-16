/**
 * src/proxy.ts: which requests it runs on (public PWA files must never be redirected to /login) and
 * the scheduled-job exception. The session rules themselves are covered in features/auth/proxy.test.ts.
 */
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn(async () => ({ data: { user: null } })) }))

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

async function loadProxy(configured: boolean) {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", configured ? "https://project.supabase.co" : "")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", configured ? "sb_publishable_test" : "")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
  return import("@/proxy")
}

afterEach(() => {
  vi.unstubAllEnvs()
  getUser.mockClear()
})

describe("proxy matcher", () => {
  it("skips the service worker, the web manifest and PWA icons", async () => {
    const { config } = await loadProxy(true)
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })
    for (const url of ["/sw.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-maskable-512.png", "/icons/shortcut.json", "/apple-icon.png", "/icon.svg"]) {
      expect(matches(url), url).toBe(false)
    }
  })

  it("still guards pages, the share target, API routes and look-alike script paths", async () => {
    const { config } = await loadProxy(true)
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })
    for (const url of ["/", "/today", "/share?title=Hi&text=Idea", "/api/push/subscribe", "/api/cron/reminders", "/sw.jsx", "/app/sw.js", "/iconsets"]) {
      expect(matches(url), url).toBe(true)
    }
  })
})

describe("scheduled jobs", () => {
  it("lets /api/cron/* through without a session (the route checks CRON_SECRET)", async () => {
    const { proxy } = await loadProxy(true)
    const request = new NextRequest(new URL("/api/cron/reminders", "http://localhost:3000"), {
      headers: { authorization: "Bearer test-secret" },
    })
    const response = await proxy(request)
    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(getUser).not.toHaveBeenCalled()
  })

  it("keeps answering other anonymous API calls with 401", async () => {
    const { proxy } = await loadProxy(true)
    const response = await proxy(new NextRequest(new URL("/api/push/subscribe", "http://localhost:3000"), { method: "POST" }))
    expect(response.status).toBe(401)
    expect(getUser).toHaveBeenCalledOnce()
  })
})
