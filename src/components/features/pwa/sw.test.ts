/**
 * Runs public/sw.js in a VM with an in-memory Cache Storage and a mocked fetch, and checks the
 * caching rules: what is cached, what never is, offline fallbacks and versioned cleanup.
 */
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { describe, expect, it, vi } from "vitest"

const SW_SOURCE = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8")
const ORIGIN = "https://orbi.test"

type Key = string | { url: string }
const keyOf = (key: Key) => (typeof key === "string" ? key : key.url)

class MemoryCache {
  entries = new Map<string, Response>()
  async match(key: Key) {
    return this.entries.get(keyOf(key))?.clone()
  }
  async put(key: Key, response: Response) {
    this.entries.delete(keyOf(key))
    this.entries.set(keyOf(key), response)
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }))
  }
  async delete(key: Key) {
    return this.entries.delete(keyOf(key))
  }
}

class MemoryCacheStorage {
  stores = new Map<string, MemoryCache>()
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache())
    return this.stores.get(name)!
  }
  async keys() {
    return [...this.stores.keys()]
  }
  async delete(name: string) {
    return this.stores.delete(name)
  }
}

/** A same-origin ("basic") response, as the browser would hand the worker. */
function res(body: string, { type = "text/html; charset=utf-8", status = 200, redirected = false } = {}) {
  const response = new Response(body, { status, headers: { "content-type": type } })
  Object.defineProperty(response, "type", { value: "basic" })
  Object.defineProperty(response, "redirected", { value: redirected })
  return response
}

interface FakeRequest {
  method: string
  url: string
  mode: string
  headers: Headers
}
const req = (url: string, init: Partial<Omit<FakeRequest, "headers">> & { headers?: Record<string, string> } = {}): FakeRequest => ({
  method: init.method ?? "GET",
  url: url.startsWith("http") ? url : ORIGIN + url,
  mode: init.mode ?? "navigate",
  headers: new Headers(init.headers ?? {}),
})

type Handler = (event: Record<string, unknown>) => void
type FetchImpl = (input: string | FakeRequest) => Promise<Response>

function loadWorker(fetchImpl: FetchImpl = async () => res("")) {
  const listeners: Record<string, Handler> = {}
  const caches = new MemoryCacheStorage()
  const fetch = vi.fn(fetchImpl)
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => (listeners[type] = handler),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => undefined),
      matchAll: vi.fn(async (): Promise<{ url: string; focus: () => Promise<unknown>; navigate?: (url: string) => Promise<unknown> }[]> => []),
      openWindow: vi.fn(async (url: string) => ({ url })),
    },
    registration: { showNotification: vi.fn(async () => undefined) },
  }
  const context = vm.createContext({ self, caches, fetch, URL, Response, Headers, console })
  vm.runInContext(SW_SOURCE, context)
  const get = <T,>(name: string) => vm.runInContext(name, context) as T

  async function dispatch(type: string, extra: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = []
    let responded: Promise<Response> | undefined
    listeners[type]({ ...extra, respondWith: (p: Promise<Response>) => (responded = p), waitUntil: (p: Promise<unknown>) => waits.push(p) })
    const response = responded ? await responded : undefined
    await Promise.all(waits)
    return response
  }

  return { caches, fetch, self, get, dispatch, fetchEvent: (request: FakeRequest) => dispatch("fetch", { request }) }
}

const urlOf = (input: string | FakeRequest) => (typeof input === "string" ? input : input.url)
const offline: FetchImpl = async () => {
  throw new TypeError("Failed to fetch")
}

describe("strategyFor", () => {
  const { get } = loadWorker()
  const strategyFor = get<(request: FakeRequest, origin: string) => string | null>("strategyFor")
  const s = (url: string, init?: Parameters<typeof req>[1]) => strategyFor(req(url, init), ORIGIN)

  it("caches app pages network-first, but never stores auth pages", () => {
    expect(s("/ideas")).toBe("page")
    expect(s("/share?text=hi")).toBe("page")
    expect(s("/login")).toBe("page-no-store")
    expect(s("/signup")).toBe("page-no-store")
  })

  it("never handles API, auth handlers, the worker itself or non-GET requests", () => {
    expect(s("/api/ai", { mode: "cors" })).toBeNull()
    expect(s("/api", { mode: "navigate" })).toBeNull()
    expect(s("/auth/callback?code=1")).toBeNull()
    expect(s("/sw.js", { mode: "no-cors" })).toBeNull()
    expect(s("/ideas", { method: "POST" })).toBeNull()
  })

  it("never handles other origins (Supabase, CDNs)", () => {
    expect(s("https://abc.supabase.co/rest/v1/content_ideas", { mode: "cors" })).toBeNull()
    expect(s("https://abc.supabase.co/auth/v1/user", { mode: "cors" })).toBeNull()
    expect(s("https://fonts.gstatic.com/s/geist.woff2", { mode: "cors" })).toBeNull()
  })

  it("leaves RSC payloads and range requests to the network", () => {
    expect(s("/ideas", { mode: "cors", headers: { RSC: "1" } })).toBeNull()
    expect(s("/ideas?_rsc=abc12", { mode: "cors" })).toBeNull()
    expect(s("/_next/static/media/clip.mp4", { mode: "no-cors", headers: { Range: "bytes=0-" } })).toBeNull()
  })

  it("serves build assets, fonts, icons and the manifest stale-while-revalidate", () => {
    expect(s("/_next/static/chunks/app-123.js", { mode: "no-cors" })).toBe("static")
    expect(s("/_next/static/media/geist.woff2", { mode: "cors" })).toBe("static")
    expect(s("/icons/icon-192.png", { mode: "no-cors" })).toBe("static")
    expect(s("/icon.svg?b1f", { mode: "no-cors" })).toBe("static")
    expect(s("/manifest.webmanifest", { mode: "cors" })).toBe("static")
  })

  it("ignores other Next internals and non-navigation HTML fetches", () => {
    expect(s("/_next/image?url=%2Fa.png", { mode: "no-cors" })).toBeNull()
    expect(s("/_next/webpack-hmr", { mode: "cors" })).toBeNull()
    expect(s("/ideas", { mode: "cors" })).toBeNull()
  })
})

describe("helpers", () => {
  const { get } = loadWorker()

  it("keys pages by path", () => {
    const pageKey = get<(href: string) => string>("pageKey")
    expect(pageKey(`${ORIGIN}/ideas?open=abc#top`)).toBe(`${ORIGIN}/ideas`)
  })

  it("finds the build assets a page references, including the escaped RSC payload", () => {
    const assetUrlsFromHtml = get<(html: string) => string[]>("assetUrlsFromHtml")
    const html = `<link rel="stylesheet" href="/_next/static/css/b.css"><script src="/_next/static/chunks/a.js" async></script>
      <script>self.__next_f.push([1,"0:[\\"/_next/static/chunks/c.js\\",\\"/_next/static/chunks/a.js\\"]"])</script>`
    expect(assetUrlsFromHtml(html)).toEqual(["/_next/static/css/b.css", "/_next/static/chunks/a.js", "/_next/static/chunks/c.js"])
  })

  it("escapes the offline copy", () => {
    const offlineHtml = get<(copy: Record<string, string>) => string>("offlineHtml")
    const html = offlineHtml({ title: "<script>alert(1)</script>", lang: "tl" })
    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&#60;script&#62;")
    expect(html).toContain('lang="tl"')
    expect(html).toContain("Try again")
  })

  it("trims the oldest entries beyond the limit", async () => {
    const worker = loadWorker()
    const cache = await worker.caches.open("orbi-static-v1")
    for (const n of [1, 2, 3, 4, 5]) await cache.put(`${ORIGIN}/_next/static/${n}.js`, res(""))
    await worker.get<(name: string, max: number) => Promise<void>>("trimCache")("orbi-static-v1", 3)
    expect([...cache.entries.keys()]).toEqual([3, 4, 5].map((n) => `${ORIGIN}/_next/static/${n}.js`))
  })
})

describe("fetch handling", () => {
  it("returns the network page and stores it by path", async () => {
    const worker = loadWorker(async () => res("<html>ideas</html>"))
    const response = await worker.fetchEvent(req("/ideas?open=1"))
    expect(await response?.text()).toBe("<html>ideas</html>")
    const pages = await worker.caches.open("orbi-pages-v1")
    expect([...pages.entries.keys()]).toEqual([`${ORIGIN}/ideas`])
  })

  it("serves the cached page offline, whatever the query string", async () => {
    let online = true
    const worker = loadWorker(async (input) => {
      if (!online) throw new TypeError("Failed to fetch")
      return res(`<html>${urlOf(input)}</html>`)
    })
    await worker.fetchEvent(req("/share"))
    online = false
    const response = await worker.fetchEvent(req("/share?text=hello"))
    expect(await response?.text()).toBe(`<html>${ORIGIN}/share</html>`)
  })

  it("falls back to the offline page in the language the app sent", async () => {
    const worker = loadWorker(offline)
    await worker.dispatch("message", {
      data: { type: "ORBI_OFFLINE_COPY", copy: { lang: "tl", title: "Offline ka ngayon", body: "b", today: "t", retry: "r", extra: "x" } },
    })
    const response = await worker.fetchEvent(req("/never-opened"))
    const html = (await response?.text()) ?? ""
    expect(response?.headers.get("content-type")).toContain("text/html")
    expect(html).toContain("Offline ka ngayon")
    expect(html).toContain('href="/today"')
  })

  it("does not store redirects (e.g. to sign-in), error pages or auth pages", async () => {
    const responses: Record<string, Response> = {
      [`${ORIGIN}/today`]: res("<html>login</html>", { redirected: true }),
      [`${ORIGIN}/ideas`]: res("<html>oops</html>", { status: 500 }),
      [`${ORIGIN}/login`]: res("<html>login</html>"),
    }
    const worker = loadWorker(async (input) => responses[urlOf(input)])
    for (const url of Object.keys(responses)) await worker.fetchEvent(req(url))
    expect((await worker.caches.open("orbi-pages-v1")).entries.size).toBe(0)
  })

  it("never touches API or Supabase requests", async () => {
    const worker = loadWorker()
    expect(await worker.fetchEvent(req("/api/ai", { method: "POST", mode: "cors" }))).toBeUndefined()
    expect(await worker.fetchEvent(req("https://abc.supabase.co/rest/v1/x", { mode: "cors" }))).toBeUndefined()
    expect(worker.fetch).not.toHaveBeenCalled()
    expect(worker.caches.stores.size).toBe(0)
  })

  it("serves static assets from the cache and revalidates in the background", async () => {
    let version = "v1"
    let online = true
    const worker = loadWorker(async () => {
      if (!online) throw new TypeError("Failed to fetch")
      return res(version, { type: "text/javascript" })
    })
    const asset = req("/_next/static/chunks/a.js", { mode: "no-cors" })
    expect(await (await worker.fetchEvent(asset))?.text()).toBe("v1")
    version = "v2"
    expect(await (await worker.fetchEvent(asset))?.text()).toBe("v1") // stale first…
    online = false
    expect(await (await worker.fetchEvent(asset))?.text()).toBe("v2") // …updated behind the scenes, served offline
  })
})

describe("lifecycle", () => {
  it("precaches the core pages and their build assets on install, skipping redirects", async () => {
    const worker = loadWorker(async (input) => {
      const url = urlOf(input)
      if (url === `${ORIGIN}/`) return res("<html>login</html>", { redirected: true })
      if (url.includes("/_next/static/")) return res("js", { type: "text/javascript" })
      return res(`<script src="/_next/static/chunks/page.js"></script>`)
    })
    await worker.dispatch("install")
    expect(worker.self.skipWaiting).toHaveBeenCalled()
    const pages = [...(await worker.caches.open("orbi-pages-v1")).entries.keys()]
    expect(pages.sort()).toEqual([`${ORIGIN}/ideas`, `${ORIGIN}/share`, `${ORIGIN}/today`])
    const assets = [...(await worker.caches.open("orbi-static-v1")).entries.keys()]
    expect(assets).toEqual([`${ORIGIN}/_next/static/chunks/page.js`])
  })

  it("deletes old Orbi caches on activate and leaves other caches alone", async () => {
    const worker = loadWorker()
    for (const name of ["orbi-static-v0", "orbi-pages-v0", "orbi-static-v1", "someone-elses-cache"]) await worker.caches.open(name)
    await worker.dispatch("activate")
    expect((await worker.caches.keys()).sort()).toEqual(["orbi-static-v1", "someone-elses-cache"])
    expect(worker.self.clients.claim).toHaveBeenCalled()
  })

  it("warms only same-origin pages and assets that the rules allow", async () => {
    const worker = loadWorker(async (input) =>
      urlOf(input).includes("/_next/static/") ? res("js", { type: "text/javascript" }) : res("<html>today</html>")
    )
    await worker.dispatch("message", {
      data: {
        type: "ORBI_WARM",
        pages: ["/today", "/api/secret", "https://evil.test/"],
        assets: ["/_next/static/chunks/a.js", "/api/ai", "https://abc.supabase.co/x.js"],
      },
    })
    const fetched = worker.fetch.mock.calls.map(([input]) => urlOf(input)).sort()
    expect(fetched).toEqual([`${ORIGIN}/_next/static/chunks/a.js`, `${ORIGIN}/today`])
  })
})

describe("push reminders", () => {
  const pushData = (value: unknown) => ({
    json: () => (typeof value === "string" ? JSON.parse(value) : value),
    text: () => (typeof value === "string" ? value : JSON.stringify(value)),
  })

  it("shows the notification from the payload, deduplicated by tag", async () => {
    const worker = loadWorker()
    await worker.dispatch("push", { data: pushData({ title: "Today in Orbi", body: "2 posts scheduled", url: "/today", tag: "orbi-daily:2026-09-16" }) })
    expect(worker.self.registration.showNotification).toHaveBeenCalledWith("Today in Orbi", {
      body: "2 posts scheduled",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/today" },
      tag: "orbi-daily:2026-09-16",
      renotify: false,
    })
  })

  it("survives an empty or non-JSON push and never keeps an off-site link", async () => {
    const worker = loadWorker()
    await worker.dispatch("push", { data: null })
    await worker.dispatch("push", { data: pushData("plain text") })
    await worker.dispatch("push", { data: pushData({ title: "Hi", url: "https://evil.test/phish" }) })
    const calls = worker.self.registration.showNotification.mock.calls as unknown as [string, { body: string; data: { url: string } }][]
    expect(calls.map(([title, options]) => [title, options.body, options.data.url])).toEqual([
      ["Orbi", "", "/today"],
      ["Orbi", "plain text", "/today"],
      ["Hi", "", "/today"],
    ])
  })

  it("focuses an open Orbi window and navigates it to the reminder's page", async () => {
    const worker = loadWorker()
    const navigate = vi.fn(async (url: string) => ({ url }))
    const client = { url: `${ORIGIN}/ideas`, focus: vi.fn(async () => client), navigate }
    worker.self.clients.matchAll.mockResolvedValue([client])
    const close = vi.fn()
    await worker.dispatch("notificationclick", { notification: { close, data: { url: "/studio/item-1" } } })
    expect(close).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}/studio/item-1`)
    expect(worker.self.clients.openWindow).not.toHaveBeenCalled()
  })

  it("opens a window when none is open, or when the open one can't be navigated", async () => {
    const worker = loadWorker()
    await worker.dispatch("notificationclick", { notification: { close: vi.fn(), data: { url: "/reports" } } })
    expect(worker.self.clients.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/reports`)

    const stubborn = { url: `${ORIGIN}/ideas`, focus: vi.fn(async () => stubborn), navigate: vi.fn(async () => Promise.reject(new TypeError("not controlled"))) }
    worker.self.clients.matchAll.mockResolvedValue([stubborn])
    await worker.dispatch("notificationclick", { notification: { close: vi.fn(), data: {} } })
    expect(worker.self.clients.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/today`)
  })
})
