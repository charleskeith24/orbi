#!/usr/bin/env node
/**
 * Loads every route (light, dark and mobile) with a fresh demo workspace and
 * reports runtime errors, the Next.js error overlay, horizontal page overflow and
 * load time. Screenshots go to --dir (default /tmp/route-audit).
 *
 *   node scripts/route-audit.mjs
 *   node scripts/route-audit.mjs --dynamic            (detail pages only: /studio/<id>, /campaigns/<id>, unknown id)
 *   node scripts/route-audit.mjs --only=/ideas,/pipeline --modes=light,mobile --dir=/tmp/ra
 */
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=")
    return [k, rest.length ? rest.join("=") : true]
  })
)
const dir = args.dir ?? "/tmp/route-audit"
fs.mkdirSync(dir, { recursive: true })
const modes = String(args.modes ?? "light,dark,mobile").split(",")

const STATIC_ROUTES = [
  "/", "/today", "/strategy", "/strategy/goals", "/strategy/platforms", "/strategy/system",
  "/audience", "/audience/problems", "/audience/questions", "/pillars", "/pillars/matrix", "/pillars/funnel",
  "/ideas", "/ideas/generator", "/ideas/hooks", "/ideas/angles", "/studio", "/pipeline",
  "/calendar", "/calendar/planner", "/calendar/schedule", "/campaigns", "/series",
  "/stories", "/stories/experience", "/research", "/research/adapt", "/analytics", "/analytics/posts",
  "/winners", "/experiments", "/reports", "/reports/monthly", "/settings", "/strategist",
  "/money", "/money/deals", "/money/income", "/money/media-kit", "/collabs", "/circles", "/share",
  "/onboarding", "/login", "/signup", "/set-password", "/privacy", "/terms", "/admin",
]

const browser = await chromium.launch({ channel: "chrome", headless: true })

// New browser profiles start empty (first run → onboarding). QA runs seed the sample brand through a
// dev-only flag by default: --seed=demo (default), --seed=fresh (onboarded but empty), --seed=none (true first run).
const SEED = String(args.seed ?? "demo")
// --lang=en|tl sets the app language of a newly seeded workspace (dev only).
const LANG = args.lang ? String(args.lang) : ""
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
  return context
}

async function dynamicRoutes() {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !!localStorage.getItem("pbos:workspace:v2"), null, { timeout: 60000 })
  const ids = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pbos:workspace:v2")).db
    const published = db.content_items.find((i) => i.stage === "published")
    const draft = db.content_items.find((i) => i.stage === "scripting") ?? db.content_items[0]
    return { published: published?.id, draft: draft?.id, campaign: db.content_campaigns[0]?.id }
  })
  await context.close()
  return [
    ids.published && `/studio/${ids.published}`,
    ids.draft && `/studio/${ids.draft}`,
    ids.campaign && `/campaigns/${ids.campaign}`,
    "/studio/does-not-exist",
  ].filter(Boolean)
}

const routes = args.only
  ? String(args.only).split(",")
  : args.dynamic
    ? await dynamicRoutes()
    : [...STATIC_ROUTES, ...(await dynamicRoutes())]
const report = []

for (const mode of modes) {
  const context = await browser.newContext({
    viewport: mode === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    colorScheme: mode === "dark" ? "dark" : "light",
    isMobile: mode === "mobile",
    hasTouch: mode === "mobile",
  })
  const page = await context.newPage()
  let errors = []
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error" && !/DevTools|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`)
  })
  for (const route of routes) {
    errors = []
    const started = Date.now()
    let status = null
    try {
      const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 })
      status = res?.status() ?? null
      await page
        .waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 45000 })
        .catch(() => errors.push("timeout: workspace never finished loading"))
      await page.waitForTimeout(700)
    } catch (e) {
      errors.push(`navigation: ${e instanceof Error ? e.message.split("\n")[0] : e}`)
    }
    const loadMs = Date.now() - started
    const overflow = await page
      .evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      .catch(() => 0)
    const overlay = await page.locator("nextjs-portal").count().catch(() => 0)
    const overlayText = overlay ? await page.locator("nextjs-portal").first().innerText().catch(() => "") : ""
    if (overlay && /error|unhandled|failed/i.test(overlayText)) errors.push(`overlay: ${overlayText.slice(0, 300)}`)
    const file = path.join(dir, `${mode}${route.replace(/[^a-z0-9]+/gi, "_") || "_home"}.png`)
    await page.screenshot({ path: file }).catch(() => {})
    report.push({ mode, route, status, loadMs, horizontalOverflowPx: overflow, errors, screenshot: file })
  }
  await context.close()
}

await browser.close()
fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2))
const failing = report.filter((r) => r.errors.length || r.horizontalOverflowPx > 1 || (r.status && r.status >= 500))
console.log(
  JSON.stringify(
    {
      routes: routes.length,
      modes,
      failing: failing.map((r) => ({ mode: r.mode, route: r.route, status: r.status, overflow: r.horizontalOverflowPx, errors: r.errors.slice(0, 3) })),
      slowest: [...report].sort((a, b) => b.loadMs - a.loadMs).slice(0, 5).map((r) => `${r.mode} ${r.route} ${r.loadMs}ms`),
      reportFile: path.join(dir, "report.json"),
    },
    null,
    2
  )
)
process.exit(failing.length ? 1 : 0)
