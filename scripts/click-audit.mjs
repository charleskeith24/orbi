#!/usr/bin/env node
/**
 * Dead-button detector. Clicks every visible control inside <main> (or the whole
 * page with --all) and reports whether anything happened.
 *
 *   node scripts/click-audit.mjs /ideas
 *   node scripts/click-audit.mjs /ideas --all --max=60 --out=/tmp/ideas-audit.json
 *   node scripts/click-audit.mjs /pipeline --fast        (one page, Escape/back between clicks)
 *   node scripts/click-audit.mjs /admin/users --admin    (dev-only admin fixture: sample data)
 *   node scripts/click-audit.mjs /circles --circles      (dev-only Circles fixture: sample circles)
 *
 * Default mode isolates every click in a fresh browser context (fresh demo
 * workspace), so destructive actions can't affect later clicks.
 *
 * An effect is any of: URL change, dialog/sheet/menu/popover/listbox opened,
 * toast shown, DOM mutation inside the page, workspace data changed, focus moved
 * into an input, clipboard write, file download, file picker opened. Controls with NO effect are
 * listed under "noEffect" — each one is either a dead button or needs a reason.
 */
import { chromium } from "playwright-core"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const route = process.argv[2] ?? "/"
const args = Object.fromEntries(
  process.argv.slice(3).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=")
    return [k, rest.length ? rest.join("=") : true]
  })
)
const MAX = Number(args.max ?? 80)
const scope = args.all ? "body" : "main, [data-slot='sidebar-inset'] > div:last-child"
const width = Number(args.width ?? 1440)
const height = Number(args.height ?? 900)
const WAIT = Number(args.wait ?? 700)

const CLICKABLE = [
  "button:not([disabled])",
  "a[href]",
  "[role='button']:not([aria-disabled='true'])",
  "[role='tab']",
  "[role='switch']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[role='combobox']",
  "summary",
].join(",")

const browser = await chromium.launch({ channel: "chrome", headless: true })

// New browser profiles start empty (first run → onboarding). QA runs seed the sample brand through a
// dev-only flag by default: --seed=demo (default), --seed=fresh (onboarded but empty), --seed=none (true first run).
const SEED = String(args.seed ?? "demo")
// --lang=en|tl sets the app language of a newly seeded workspace (dev only).
const LANG = args.lang ? String(args.lang) : ""
// --admin turns on the dev-only admin fixture (sample data on /admin, which can't run in local mode).
const ADMIN = Boolean(args.admin)
// --circles turns on the dev-only Circles fixture (sample circles; Circles need the online version otherwise).
const CIRCLES = Boolean(args.circles)
const newContextRaw = browser.newContext.bind(browser)
browser.newContext = async (options) => {
  const context = await newContextRaw(options)
  if (SEED !== "none") {
    await context.addInitScript(
      ({ seed, lang }) => {
        if (!localStorage.getItem("pbos:dev-seed")) localStorage.setItem("pbos:dev-seed", seed)
        if (lang && !localStorage.getItem("pbos:dev-ui-lang")) localStorage.setItem("pbos:dev-ui-lang", lang)
      },
      { seed: SEED, lang: LANG }
    )
  }
  if (ADMIN) {
    await context.addInitScript(() => {
      if (!localStorage.getItem("pbos:dev-admin")) localStorage.setItem("pbos:dev-admin", "fixture")
    })
  }
  if (CIRCLES) {
    await context.addInitScript(() => {
      if (!localStorage.getItem("pbos:dev-circles")) localStorage.setItem("pbos:dev-circles", "fixture")
    })
  }
  return context
}

async function openPage() {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true })
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {})
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error" && !/DevTools|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`)
  })
  let downloads = 0
  page.on("download", () => downloads++)
  // Listening makes Playwright intercept the native file picker (it never opens) and lets us count it.
  let fileChoosers = 0
  page.on("filechooser", () => fileChoosers++)
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 })
  await page
    .waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 45000 })
    .catch(() => errors.push("timeout: workspace never finished loading"))
  // The admin and Circles screens load their (fixture) data after the page: wait until nothing is busy.
  if (ADMIN || CIRCLES) {
    await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 45000 })
      .catch(() => errors.push("timeout: admin screen never finished loading"))
  }
  await page.waitForTimeout(500)
  return { context, page, errors, getDownloads: () => downloads, getFileChoosers: () => fileChoosers }
}

async function listControls(page) {
  return page.evaluate(
    ({ scope, CLICKABLE }) => {
      const roots = [...document.querySelectorAll(scope)]
      const seen = new Set()
      const out = []
      for (const root of roots) {
        for (const el of root.querySelectorAll(CLICKABLE)) {
          if (seen.has(el)) continue
          seen.add(el)
          const r = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          const visible = r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none"
          if (!visible) continue
          const label =
            el.getAttribute("aria-label") ||
            el.textContent?.replace(/\s+/g, " ").trim().slice(0, 60) ||
            el.getAttribute("title") ||
            el.tagName.toLowerCase()
          out.push({ label, tag: el.tagName.toLowerCase(), href: el.getAttribute("href") })
        }
      }
      return out
    },
    { scope, CLICKABLE }
  )
}

async function probe(page, index, errors, getDownloads, getFileChoosers = () => 0) {
  const handle = await page.evaluateHandle(
    ({ scope, CLICKABLE, index }) => {
      const roots = [...document.querySelectorAll(scope)]
      const seen = new Set()
      const list = []
      for (const root of roots)
        for (const el of root.querySelectorAll(CLICKABLE)) {
          if (seen.has(el)) continue
          seen.add(el)
          const r = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          if (r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none") list.push(el)
        }
      return list[index] ?? null
    },
    { scope, CLICKABLE, index }
  )
  const el = handle.asElement()
  if (!el) return { skipped: "element not found after reload" }

  await page.evaluate(() => {
    window.__audit = { mutations: 0, clipboard: false }
    const obs = new MutationObserver((records) => {
      window.__audit.mutations += records.length
    })
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    window.__auditObs = obs
    const orig = navigator.clipboard?.writeText?.bind(navigator.clipboard)
    if (orig)
      navigator.clipboard.writeText = (t) => {
        window.__audit.clipboard = true
        return orig(t)
      }
  })
  const snapshot = () =>
    page.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      overlays: document.querySelectorAll(
        "[role='dialog'],[role='alertdialog'],[role='menu'],[role='listbox'],[data-radix-popper-content-wrapper],[data-slot='popover-content'],[data-slot='sheet-content'],[data-slot='dropdown-menu-content']"
      ).length,
      toasts: document.querySelectorAll("[data-sonner-toast]").length,
      data: (localStorage.getItem("pbos:workspace:v2") ?? "").length,
      focusInput: ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "") || document.activeElement?.isContentEditable,
    }))
  const before = await snapshot()
  const downloadsBefore = getDownloads()
  const fileChoosersBefore = getFileChoosers()
  const errorsBefore = errors.length
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 3000 })
    await el.click({ timeout: 5000 })
  } catch (e) {
    return { clickError: e instanceof Error ? e.message.split("\n")[0] : String(e) }
  }
  await page.waitForTimeout(WAIT)
  const after = await snapshot().catch(() => ({ url: "(navigated)", overlays: 0, toasts: 0, data: before.data, focusInput: false }))
  // A navigation mid-probe replaces the page, so __audit can be undefined as well as throw.
  const audit = (await page.evaluate(() => window.__audit).catch(() => null)) ?? { mutations: 1, clipboard: false }
  // Flush the debounced local save before comparing data.
  await page.waitForTimeout(350)
  const dataAfter = await page.evaluate(() => (localStorage.getItem("pbos:workspace:v2") ?? "").length).catch(() => after.data)

  // Client navigations to not-yet-compiled dev routes can take seconds: give quiet clicks a second chance.
  if (after.url === before.url && after.overlays === before.overlays && after.toasts === before.toasts && dataAfter === before.data) {
    await page.waitForTimeout(2500)
    const late = await snapshot().catch(() => after)
    Object.assign(after, late)
  }

  const effects = []
  if (after.url !== before.url) effects.push(`navigate → ${after.url}`)
  if (after.overlays > before.overlays) effects.push("overlay opened")
  if (after.overlays < before.overlays) effects.push("overlay closed")
  if (after.toasts > before.toasts) effects.push("toast")
  if (dataAfter !== before.data) effects.push("data changed")
  if (audit.clipboard) effects.push("clipboard")
  if (getDownloads() > downloadsBefore) effects.push("download")
  if (getFileChoosers() > fileChoosersBefore) effects.push("file picker")
  if (!before.focusInput && after.focusInput) effects.push("focused input")
  if (!effects.length && audit.mutations > 0) effects.push(`dom mutations (${audit.mutations})`)
  return { effects, newErrors: errors.slice(errorsBefore) }
}

const first = await openPage()
const controls = (await listControls(first.page)).slice(0, MAX)
const results = []

if (args.fast) {
  for (let i = 0; i < controls.length; i++) {
    const r = await probe(first.page, i, first.errors, first.getDownloads, first.getFileChoosers)
    results.push({ index: i, ...controls[i], ...r })
    await first.page.keyboard.press("Escape").catch(() => {})
    await first.page.waitForTimeout(150)
    const path = await first.page.evaluate(() => location.pathname + location.search).catch(() => "")
    if (path !== route) {
      await first.page.goto(BASE + route, { waitUntil: "domcontentloaded" })
      await first.page.waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 45000 }).catch(() => {})
      await first.page.waitForTimeout(300)
    }
  }
  await first.context.close()
} else {
  await first.context.close()
  for (let i = 0; i < controls.length; i++) {
    const s = await openPage()
    const r = await probe(s.page, i, s.errors, s.getDownloads, s.getFileChoosers)
    results.push({ index: i, ...controls[i], ...r })
    await s.context.close()
  }
}

await browser.close()
const noEffect = results.filter((r) => !r.skipped && !r.clickError && r.effects && r.effects.length === 0)
const weak = results.filter((r) => r.effects?.length === 1 && r.effects[0].startsWith("dom mutations"))
const withErrors = results.filter((r) => r.newErrors?.length)
const summary = {
  route,
  controls: results.length,
  noEffect: noEffect.map((r) => `#${r.index} ${r.tag} "${r.label}"`),
  onlyDomMutation: weak.map((r) => `#${r.index} ${r.tag} "${r.label}" (${r.effects[0]})`),
  clickErrors: results.filter((r) => r.clickError).map((r) => `#${r.index} "${r.label}": ${r.clickError}`),
  runtimeErrors: withErrors.map((r) => ({ control: `#${r.index} "${r.label}"`, errors: r.newErrors })),
}
if (args.out) {
  const fs = await import("node:fs")
  fs.writeFileSync(args.out, JSON.stringify({ summary, results }, null, 2))
}
console.log(JSON.stringify(summary, null, 2))
process.exit(summary.noEffect.length || summary.runtimeErrors.length ? 1 : 0)
