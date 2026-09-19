#!/usr/bin/env node
/**
 * Text budget check (docs/CALM_UI.md): how many words each screen shows before scrolling, how many in total,
 * how many long lines (10+ words) and how tall the page is. Reads `<main>` (the app shell's inset: the top bar and
 * the backup line count, the sidebar doesn't). "above the fold" counts every text node that starts above the fold,
 * including Kanban columns scrolled off to the side; "on screen" counts only what is actually visible.
 *
 *   node scripts/text-budget.mjs                                  (the main screens, English, desktop)
 *   node scripts/text-budget.mjs --routes=/,/pipeline --lang=tl --width=390 --height=844
 *   node scripts/text-budget.mjs --budget=100                     (exit 1 if any screen goes over the fold budget)
 *   node scripts/text-budget.mjs --json=/tmp/budget.json          (also write the numbers as JSON)
 *
 * Uses the dev-only demo seed like the other QA scripts (--seed=demo|fresh).
 */
import fs from "node:fs"
import { chromium } from "playwright-core"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=")
    return [k, rest.length ? rest.join("=") : true]
  })
)
const DEFAULT_ROUTES = [
  "/", "/today", "/strategy", "/audience", "/pillars", "/ideas", "/studio", "/pipeline", "/calendar",
  "/campaigns", "/collabs", "/series", "/stories", "/research", "/analytics", "/winners", "/experiments",
  "/reports", "/money", "/settings?tab=profile", "/settings?tab=general", "/strategist",
]
const routes = args.routes ? String(args.routes).split(",") : DEFAULT_ROUTES
const width = Number(args.width ?? 1440)
const height = Number(args.height ?? 900)
const seed = String(args.seed ?? "demo")
const lang = args.lang ? String(args.lang) : ""
const budget = args.budget ? Number(args.budget) : null

const browser = await chromium.launch({ channel: "chrome", headless: true })
const context = await browser.newContext({ viewport: { width, height } })
await context.addInitScript(
  ({ seed, lang }) => {
    if (!localStorage.getItem("pbos:dev-seed")) localStorage.setItem("pbos:dev-seed", seed)
    if (lang && !localStorage.getItem("pbos:dev-ui-lang")) localStorage.setItem("pbos:dev-ui-lang", lang)
  },
  { seed, lang }
)
const page = await context.newPage()
const rows = []
for (const route of routes) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(800)
  const stats = await page.evaluate((viewportHeight) => {
    const main = document.querySelector("main") ?? document.body
    const lines = main.innerText.split("\n").map((l) => l.trim()).filter(Boolean)
    const words = lines.reduce((n, l) => n + l.split(/\s+/).length, 0)
    const longLines = lines.filter((l) => l.split(/\s+/).length >= 10).length
    // `fold`: every text node whose element starts above the fold (includes columns scrolled off to the side).
    // `visible`: only text actually on screen — inside the viewport on both axes and not clipped by a
    // scrolling or overflow-hidden ancestor (a Kanban's off-screen columns, a truncated carousel).
    let fold = 0
    let visible = 0
    const viewportWidth = window.innerWidth
    const clippedAway = (el, rect) => {
      let box = { left: Math.max(rect.left, 0), top: Math.max(rect.top, 0), right: Math.min(rect.right, viewportWidth), bottom: Math.min(rect.bottom, viewportHeight) }
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (s.overflowX === "visible" && s.overflowY === "visible") continue
        const r = a.getBoundingClientRect()
        box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) }
        if (box.right - box.left < 2 || box.bottom - box.top < 2) return true
      }
      return box.right - box.left < 2 || box.bottom - box.top < 2
    }
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const el = node.parentElement
      if (!text || !el) continue
      const style = getComputedStyle(el)
      if (style.visibility === "hidden" || style.display === "none" || el.closest("[aria-hidden='true'], .sr-only")) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0 || rect.top >= viewportHeight || rect.bottom <= 0) continue
      const count = text.split(/\s+/).length
      fold += count
      if (!clippedAway(el, rect)) visible += count
    }
    return { fold, visible, words, longLines, height: document.documentElement.scrollHeight }
  }, height)
  rows.push({ route, ...stats })
}
await browser.close()

rows.sort((a, b) => b.fold - a.fold)
for (const r of rows) {
  const over = budget !== null && r.fold > budget ? "  ← over budget" : ""
  console.log(
    `${String(r.fold).padStart(4)} above the fold · ${String(r.visible).padStart(4)} on screen · ${String(r.words).padStart(5)} total · ${String(r.longLines).padStart(3)} long lines · ${String(r.height).padStart(5)}px  ${r.route}${over}`
  )
}
if (args.json) fs.writeFileSync(String(args.json), JSON.stringify({ width, height, lang: lang || "en", seed, rows }, null, 2))
if (budget !== null && rows.some((r) => r.fold > budget)) process.exit(1)
