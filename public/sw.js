/**
 * Orbi service worker — the offline app shell. Registered in production builds only
 * (src/components/features/pwa/pwa-runtime.ts); the dev server never runs it.
 *
 * - Navigations: network first; the HTML is cached per path, so pages you've opened load offline.
 *   Nothing cached yet → a small offline page (copy sent by the app, in the workspace language).
 * - Static assets (/_next/static, fonts, icons, manifest): stale-while-revalidate.
 * - Never cached: /api/*, /auth/*, RSC payloads, non-GET, range requests and every other origin
 *   (Supabase, AI providers). Those go straight to the network as if there were no service worker.
 * - Caches are versioned: bump VERSION when this file's caching logic changes; old caches are
 *   deleted on activate.
 * - Push reminders (online version): `push` shows the notification sent by /api/cron/reminders or
 *   /api/push/test ({ title, body, url, tag }); `notificationclick` focuses an open Orbi window on that
 *   page, or opens one.
 */
const VERSION = "v1"
const CACHE_PREFIX = "orbi-"
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`
const PAGES_CACHE = `${CACHE_PREFIX}pages-${VERSION}`
const META_CACHE = `${CACHE_PREFIX}meta-${VERSION}`
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, META_CACHE]

/** Hashed build assets pile up across deploys; the oldest entries go first. */
const STATIC_MAX_ENTRIES = 400
const PAGES_MAX_ENTRIES = 60

/** Opened on install so the app starts offline right away (start_url, home, ideas, share target). */
const PRECACHE_PAGES = ["/today", "/", "/ideas", "/share"]
/** Pages that must always be fresh (auth). Offline they get the offline page. */
const NO_STORE_PAGES = ["/login", "/signup"]

const OFFLINE_COPY_KEY = "/__orbi/offline-copy"
const DEFAULT_OFFLINE_COPY = {
  lang: "en",
  title: "You're offline",
  body: "This page isn't saved on this device yet. Pages you've opened before still work offline.",
  today: "Open Today",
  retry: "Try again",
}

const STATIC_FILE = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico|webmanifest)$/i

const underPath = (pathname, base) => pathname === base || pathname.startsWith(`${base}/`)

/**
 * How a request is handled: "page" (network first, cached), "page-no-store" (network first, never
 * cached), "static" (stale-while-revalidate) or null (not handled — the browser's default).
 * Takes anything shaped like a Request: { method, url, mode, headers }.
 */
function strategyFor(request, origin) {
  if (request.method !== "GET") return null
  let url
  try {
    url = new URL(request.url)
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  const path = url.pathname
  if (path === "/sw.js" || underPath(path, "/api") || underPath(path, "/auth") || path.startsWith("/__orbi/")) return null
  if (request.headers && (request.headers.get("range") || request.headers.get("rsc"))) return null
  if (url.searchParams.has("_rsc")) return null
  if (path.startsWith("/_next/")) return path.startsWith("/_next/static/") ? "static" : null
  if (request.mode === "navigate") return NO_STORE_PAGES.some((page) => underPath(path, page)) ? "page-no-store" : "page"
  return STATIC_FILE.test(path) ? "static" : null
}

/** Pages are cached by path: /ideas?open=… and /ideas share one entry. */
function pageKey(href) {
  const url = new URL(href)
  url.search = ""
  url.hash = ""
  return url.href
}

function isCacheablePage(response) {
  return (
    Boolean(response) &&
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    (response.headers.get("content-type") || "").includes("text/html")
  )
}

function isCacheableAsset(response) {
  return Boolean(response) && response.ok && response.type === "basic" && !response.redirected
}

/** Build assets referenced by a page's HTML (script/link tags and the inline RSC payload). */
function assetUrlsFromHtml(html) {
  const found = new Set()
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\&<>]+/g)) found.add(match[0])
  return [...found]
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

function offlineHtml(copy) {
  const c = { ...DEFAULT_OFFLINE_COPY, ...copy }
  return `<!doctype html>
<html lang="${escapeHtml(c.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#fcfcfc">
<title>${escapeHtml(c.title)} · Orbi</title>
<style>
:root{color-scheme:light dark;--bg:#fcfcfc;--fg:#1f2328;--muted:#6b7280;--card:#ffffff;--border:#e5e7eb;--brand:#2a78d6}
@media (prefers-color-scheme:dark){:root{--bg:#1b1b1b;--fg:#f3f4f6;--muted:#a1a1aa;--card:#262626;--border:#3f3f46;--brand:#3987e5}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:360px;padding:24px;text-align:center}
svg{width:40px;height:40px}
h1{margin:16px 0 4px;font-size:18px;font-weight:600}
p{margin:0 0 20px;color:var(--muted);text-wrap:pretty}
.actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
a,button{font:inherit;font-weight:500;border-radius:8px;padding:8px 14px;cursor:pointer;text-decoration:none;border:1px solid var(--border)}
a{background:var(--brand);border-color:transparent;color:#fff}
button{background:var(--card);color:var(--fg)}
a:focus-visible,button:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
</style>
</head>
<body>
<main>
<svg viewBox="0 0 64 64" aria-hidden="true">
<defs><linearGradient id="o" x1="2" y1="40" x2="54" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#56b9f5"/><stop offset="1" stop-color="#6b6cf3"/></linearGradient></defs>
<path d="M45.54 14.66A22 22 0 0 0 11.75 40.6M17.28 48.35A22 22 0 0 0 51.42 21.67" fill="none" stroke="currentColor" stroke-width="8.5"/>
<path d="M2.5 34.5C1.5 41.5 7 46 14 44.6C26 42.3 42 29 51 16.5" fill="none" stroke="url(#o)" stroke-width="2.8" stroke-linecap="round"/>
<circle cx="51" cy="16" r="5.2" fill="#6b6cf3"/>
</svg>
<h1>${escapeHtml(c.title)}</h1>
<p>${escapeHtml(c.body)}</p>
<div class="actions"><a href="/today">${escapeHtml(c.today)}</a><button type="button" onclick="location.reload()">${escapeHtml(c.retry)}</button></div>
</main>
</body>
</html>`
}

async function offlineResponse() {
  let copy = {}
  try {
    const stored = await (await caches.open(META_CACHE)).match(OFFLINE_COPY_KEY)
    if (stored) copy = await stored.json()
  } catch {
    // Fall back to the defaults.
  }
  return new Response(offlineHtml(copy), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function putPage(href, response) {
  const cache = await caches.open(PAGES_CACHE)
  await cache.put(pageKey(href), response)
  await trimCache(PAGES_CACHE, PAGES_MAX_ENTRIES)
}

async function cacheAssets(urls) {
  const cache = await caches.open(STATIC_CACHE)
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await cache.match(url, { ignoreVary: true })) return
        const response = await fetch(url, { credentials: "same-origin" })
        if (isCacheableAsset(response)) await cache.put(url, response)
      } catch {
        // Offline or gone — runtime caching fills it in later.
      }
    })
  )
  await trimCache(STATIC_CACHE, STATIC_MAX_ENTRIES)
}

/** Fetches a page (and the build assets it references) into the caches. */
async function cachePage(href) {
  try {
    const response = await fetch(href, { credentials: "same-origin", cache: "no-store" })
    if (!isCacheablePage(response)) return
    const html = await response.clone().text()
    await putPage(href, response)
    await cacheAssets(assetUrlsFromHtml(html).map((path) => new URL(path, self.location.origin).href))
  } catch {
    // Offline, redirected to sign-in, or blocked: skip it.
  }
}

async function networkFirstPage(event, store) {
  try {
    const response = await fetch(event.request)
    if (store && isCacheablePage(response)) event.waitUntil(putPage(event.request.url, response.clone()))
    return response
  } catch {
    const cached = await (await caches.open(PAGES_CACHE)).match(pageKey(event.request.url), { ignoreVary: true })
    return cached || offlineResponse()
  }
}

async function staleWhileRevalidate(event) {
  const key = event.request.url
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(key, { ignoreVary: true })
  const network = fetch(event.request).then(async (response) => {
    if (isCacheableAsset(response)) {
      await cache.put(key, response.clone())
      await trimCache(STATIC_CACHE, STATIC_MAX_ENTRIES)
    }
    return response
  })
  if (cached) {
    event.waitUntil(network.catch(() => undefined))
    return cached
  }
  return network
}

/** The app tells the worker what it already loaded before the worker took control. */
async function warm({ pages = [], assets = [] }) {
  const origin = self.location.origin
  const toHref = (value) => {
    try {
      return new URL(String(value), origin).href
    } catch {
      return null
    }
  }
  const pageHrefs = pages
    .slice(0, 10)
    .map(toHref)
    .filter((href) => href && strategyFor({ method: "GET", url: href, mode: "navigate" }, origin) === "page")
  const assetHrefs = assets
    .slice(0, 300)
    .map(toHref)
    .filter((href) => href && strategyFor({ method: "GET", url: href, mode: "no-cors" }, origin) === "static")
  await cacheAssets(assetHrefs)
  await Promise.all(pageHrefs.map(cachePage))
}

async function saveOfflineCopy(copy) {
  const clean = {}
  for (const key of Object.keys(DEFAULT_OFFLINE_COPY)) {
    if (typeof copy[key] === "string" && copy[key].trim()) clean[key] = copy[key].slice(0, 500)
  }
  const cache = await caches.open(META_CACHE)
  await cache.put(OFFLINE_COPY_KEY, new Response(JSON.stringify(clean), { headers: { "content-type": "application/json" } }))
}

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(Promise.all(PRECACHE_PAGES.map((path) => cachePage(new URL(path, self.location.origin).href))))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name)) await caches.delete(name)
      }
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request, self.location.origin)
  if (strategy === "static") event.respondWith(staleWhileRevalidate(event))
  else if (strategy === "page" || strategy === "page-no-store") event.respondWith(networkFirstPage(event, strategy === "page"))
})

self.addEventListener("message", (event) => {
  const data = event.data
  if (!data || typeof data !== "object") return
  if (data.type === "ORBI_WARM") event.waitUntil(warm(data))
  else if (data.type === "ORBI_OFFLINE_COPY" && data.copy && typeof data.copy === "object") event.waitUntil(saveOfflineCopy(data.copy))
})

/* ------------------------------ Push reminders ------------------------------ */

/** A same-origin path from a notification payload; anything else opens Today. */
function notificationPath(value) {
  try {
    const url = new URL(String(value || "/today"), self.location.origin)
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/today"
  } catch {
    return "/today"
  }
}

function notificationFromPush(data) {
  let payload = {}
  try {
    payload = data ? data.json() : {}
  } catch {
    payload = { body: data ? data.text() : "" }
  }
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.slice(0, 120) : "Orbi"
  const options = {
    body: typeof payload.body === "string" ? payload.body.slice(0, 500) : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: notificationPath(payload.url) },
  }
  if (typeof payload.tag === "string" && payload.tag) {
    options.tag = payload.tag.slice(0, 120)
    options.renotify = false
  }
  return { title, options }
}

async function openFromNotification(path) {
  const target = new URL(path, self.location.origin).href
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
  if (existing) {
    try {
      const focused = await existing.focus()
      if (focused && "navigate" in focused && focused.url !== target) return await focused.navigate(target)
      return focused
    } catch {
      // Not controlled by this worker (navigate refused): open a new window instead.
    }
  }
  return self.clients.openWindow(target)
}

self.addEventListener("push", (event) => {
  const { title, options } = notificationFromPush(event.data)
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = notificationPath(event.notification.data && event.notification.data.url)
  event.waitUntil(openFromNotification(path))
})
