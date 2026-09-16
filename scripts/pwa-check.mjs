/**
 * Production PWA check (manifest, icons, installability, service worker, offline) against a
 * production server. Copies the demo workspace from the dev server on :3000 first, because
 * production ignores the dev seed.
 *
 *   npx next build && npx next start -p 3100 &
 *   node scripts/pwa-check.mjs /tmp/pwa-check
 *   lsof -ti tcp:3100 | xargs kill
 */
import fs from "node:fs"
import { chromium } from "playwright-core"

const DEV = "http://localhost:3000"
const PROD = "http://localhost:3100"
const OUT = process.argv[2]
fs.mkdirSync(OUT, { recursive: true })
const checks = {}
const notes = []
const check = (name, ok, detail) => {
  checks[name] = ok ? "ok" : `FAIL ${JSON.stringify(detail ?? "")}`.slice(0, 600)
  if (ok && detail !== undefined) notes.push(`${name}: ${JSON.stringify(detail)}`.slice(0, 300))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Wait for the production server.
let up = false
for (let i = 0; i < 120 && !up; i++) {
  try {
    up = (await fetch(PROD + "/manifest.webmanifest")).ok
  } catch {
    await sleep(1000)
  }
}
check("production server up", up)

// --- Static files ------------------------------------------------------------------------------
const manifestRes = await fetch(PROD + "/manifest.webmanifest")
const manifest = await manifestRes.json()
check("manifest served as JSON", manifestRes.ok && /json/.test(manifestRes.headers.get("content-type") ?? ""), manifestRes.headers.get("content-type"))
check(
  "manifest fields",
  manifest.name === "Orbi" && manifest.start_url === "/today" && manifest.scope === "/" && manifest.display === "standalone" &&
    manifest.share_target?.action === "/share" && manifest.share_target?.method === "GET" && manifest.shortcuts?.length === 3,
  { start_url: manifest.start_url, shortcuts: manifest.shortcuts?.map((s) => s.url), share_target: manifest.share_target }
)
for (const icon of [...manifest.icons, { src: "/apple-icon.png", sizes: "180x180", purpose: "apple" }]) {
  const r = await fetch(PROD + icon.src)
  const buf = Buffer.from(await r.arrayBuffer())
  const size = buf.length > 24 ? `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` : "?"
  check(`icon ${icon.src} (${icon.purpose})`, r.ok && r.headers.get("content-type") === "image/png" && size === icon.sizes, `${r.status} ${size}`)
}
const swRes = await fetch(PROD + "/sw.js")
check(
  "sw.js served uncached as JavaScript",
  swRes.ok && /no-store/.test(swRes.headers.get("cache-control") ?? "") && /javascript/.test(swRes.headers.get("content-type") ?? ""),
  { cache: swRes.headers.get("cache-control"), type: swRes.headers.get("content-type") }
)
const html = await (await fetch(PROD + "/today")).text()
check("<head> links the manifest and the apple-touch-icon", html.includes('rel="manifest"') && html.includes("apple-touch-icon"))

// --- A local workspace (production ignores the dev seed flag): copy the dev server's demo -------
const browser = await chromium.launch({ channel: "chrome", headless: true })
const waitWorkspace = (page) =>
  page.waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 60000 }).catch(() => {})

const devCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await devCtx.addInitScript(() => {
  if (!localStorage.getItem("pbos:dev-seed")) localStorage.setItem("pbos:dev-seed", "demo")
})
const dev = await devCtx.newPage()
await dev.goto(DEV + "/today", { waitUntil: "domcontentloaded", timeout: 90000 })
await waitWorkspace(dev)
await dev.waitForTimeout(1000)
let hasWorkspace = await dev.evaluate(() => Boolean(localStorage.getItem("pbos:workspace:v2")))
if (!hasWorkspace) {
  // The seed lives in memory until the first write: capture one idea so the whole workspace is saved.
  await dev.getByRole("button", { name: "Capture" }).first().click()
  await dev.locator("[role=dialog] textarea").fill("Production check seed idea")
  await dev.getByRole("button", { name: "Save idea" }).click()
  await dev.waitForTimeout(1500)
  await dev.evaluate(() => window.dispatchEvent(new Event("pagehide")))
  hasWorkspace = await dev.evaluate(() => Boolean(localStorage.getItem("pbos:workspace:v2")))
}
const storage = await dev.evaluate(() =>
  Object.fromEntries(
    Object.keys(localStorage)
      .filter((k) => k.startsWith("pbos:") && k !== "pbos:dev-seed")
      .map((k) => [k, localStorage.getItem(k)])
  )
)
await devCtx.close()
check("demo workspace copied from the dev server", hasWorkspace, Object.keys(storage))

// --- Production browser ------------------------------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" })
await ctx.addInitScript((entries) => {
  if (localStorage.getItem("__prod_check_seeded")) return
  for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
  localStorage.setItem("__prod_check_seeded", "1")
}, storage)
const page = await ctx.newPage()
const consoleErrors = []
page.on("pageerror", (e) => consoleErrors.push(`pageerror ${page.url()}: ${e.message}`.slice(0, 250)))
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(`console ${page.url()}: ${m.text()}`.slice(0, 250))
})

try {
  await page.goto(PROD + "/today", { waitUntil: "load", timeout: 90000 })
  await waitWorkspace(page)
  check("first load stays on /today (workspace present)", new URL(page.url()).pathname === "/today", page.url())

  const sw = await page.evaluate(async () => {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 20000))
    const reg = await Promise.race([navigator.serviceWorker.ready, timeout])
    if (!reg) return { error: "serviceWorker.ready timed out" }
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100))
    return { scope: reg.scope, script: reg.active?.scriptURL ?? null, controlled: Boolean(navigator.serviceWorker.controller) }
  })
  check("service worker registered and controlling the page", sw.controlled && sw.script?.endsWith("/sw.js") && sw.scope === PROD + "/", sw)

  const cdp = await ctx.newCDPSession(page)
  const installability = await cdp.send("Page.getInstallabilityErrors").catch((e) => ({ error: e.message }))
  check("Chrome: installable (no installability errors)", installability.installabilityErrors?.length === 0, installability)
  const appManifest = await cdp.send("Page.getAppManifest").catch((e) => ({ error: e.message }))
  check("Chrome: manifest parsed without errors", appManifest.errors?.length === 0, appManifest.errors ?? appManifest)

  const cacheState = await page.evaluate(async () => {
    const read = async () => {
      const names = await caches.keys()
      const out = { names, bytes: {} }
      for (const name of names) {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        out[name] = keys.map((r) => r.url)
        let bytes = 0
        for (const key of keys) bytes += (await (await cache.match(key))?.blob())?.size ?? 0
        out.bytes[name] = bytes
      }
      return out
    }
    let state = await read()
    for (let i = 0; i < 100; i++) {
      const pages = (state["orbi-pages-v1"] ?? []).map((u) => new URL(u).pathname)
      if (["/today", "/", "/ideas", "/share"].every((p) => pages.includes(p)) && (state["orbi-meta-v1"] ?? []).length) break
      await new Promise((r) => setTimeout(r, 300))
      state = await read()
    }
    return state
  })
  const pages = (cacheState["orbi-pages-v1"] ?? []).map((u) => new URL(u).pathname)
  const allUrls = cacheState.names.flatMap((n) => cacheState[n] ?? [])
  const bad = allUrls.filter((u) => !u.startsWith(PROD + "/") || u.includes("/api/") || u.includes("_rsc="))
  check("core pages precached (/today, /, /ideas, /share)", ["/today", "/", "/ideas", "/share"].every((p) => pages.includes(p)), pages)
  check(
    "build assets cached",
    (cacheState["orbi-static-v1"] ?? []).some((u) => u.includes("/_next/static/")),
    { assets: (cacheState["orbi-static-v1"] ?? []).length, bytes: cacheState.bytes }
  )
  check("offline copy stored for the fallback page", (cacheState["orbi-meta-v1"] ?? []).length === 1, cacheState["orbi-meta-v1"])
  check("nothing cached from /api, RSC payloads or other origins", bad.length === 0, bad)

  // --- Offline --------------------------------------------------------------------------------
  await ctx.setOffline(true)
  await page.reload({ waitUntil: "load", timeout: 30000 })
  await waitWorkspace(page)
  await page.waitForTimeout(800)
  const offToday = await page.evaluate(() => ({
    path: location.pathname,
    h1: document.querySelector("h1")?.textContent ?? null,
    sidebar: Boolean(document.querySelector('[data-sidebar="sidebar"]')),
  }))
  check("offline reload of /today renders the app with the local workspace", offToday.path === "/today" && /Today/.test(offToday.h1 ?? "") && offToday.sidebar, offToday)
  await page.screenshot({ path: `${OUT}/offline-today.png` })

  await page.locator('[data-sidebar="sidebar"] a[href="/ideas"]').first().click()
  await page.waitForURL("**/ideas", { timeout: 20000 }).catch(() => {})
  await waitWorkspace(page)
  await page.waitForTimeout(1000)
  const offIdeas = await page.evaluate(() => ({ path: location.pathname, h1: document.querySelector("h1")?.textContent ?? null }))
  check("offline sidebar navigation to a precached page (/ideas)", offIdeas.path === "/ideas" && /Idea/.test(offIdeas.h1 ?? ""), offIdeas)

  await page.goto(PROD + "/share?title=From%20the%20bus&text=Offline%20idea%20about%20jeepney%20budgeting", { waitUntil: "load", timeout: 30000 })
  await waitWorkspace(page)
  await page.waitForTimeout(1200)
  const offShare = await page.evaluate(() => ({
    url: location.pathname + location.search,
    text: document.querySelector("[role=dialog] textarea")?.value ?? null,
  }))
  check("offline share target opens a prefilled Quick Capture", offShare.text === "From the bus\nOffline idea about jeepney budgeting", offShare)
  await page.screenshot({ path: `${OUT}/offline-share.png` })
  if (offShare.text) {
    await page.getByRole("button", { name: "Save idea" }).click()
    await page.waitForTimeout(1000)
    const saved = await page.getByText("Saved to your Idea Bank").count()
    check("idea saved offline (local mode) and confirmed on /share", saved > 0, saved)
    await page.screenshot({ path: `${OUT}/offline-share-saved.png` })
  }

  await page.goto(PROD + "/experiments", { waitUntil: "load", timeout: 30000 })
  const offPage = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent ?? null,
    lang: document.documentElement.lang,
    link: document.querySelector('a[href="/today"]')?.textContent ?? null,
  }))
  check("never-opened page offline shows the offline page", offPage.h1 === "You're offline" && offPage.link === "Open Today", offPage)
  await page.screenshot({ path: `${OUT}/offline-fallback-light.png` })
  await page.emulateMedia({ colorScheme: "dark" })
  await page.screenshot({ path: `${OUT}/offline-fallback-dark.png` })
  await page.emulateMedia({ colorScheme: "light" })

  // --- Back online ----------------------------------------------------------------------------
  await ctx.setOffline(false)
  await page.goto(PROD + "/ideas", { waitUntil: "load", timeout: 30000 })
  await waitWorkspace(page)
  await page.waitForTimeout(800)
  const kept = await page.getByText("Offline idea about jeepney budgeting").count()
  check("back online: the offline capture is in the Idea Bank", kept > 0, kept)
} catch (e) {
  check("script completed", false, e instanceof Error ? e.message : String(e))
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {})
}

console.log(JSON.stringify({ checks, notes, consoleErrors: consoleErrors.slice(0, 15), consoleErrorCount: consoleErrors.length }, null, 2))
await browser.close()
