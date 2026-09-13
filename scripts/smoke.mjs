#!/usr/bin/env node
/**
 * Headless smoke test for one route using the locally installed Google Chrome
 * (playwright-core, no browser download). Requires the dev server on :3000.
 *
 *   node scripts/smoke.mjs /ideas
 *   node scripts/smoke.mjs /ideas --out=/tmp/ideas.png --width=390 --height=844 --dark --full
 *   node scripts/smoke.mjs /ideas --actions='[{"click":"text=Add idea"},{"wait":400},{"fill":["input[name=title]","Test"]},{"press":"Enter"},{"screenshot":"/tmp/after.png"}]'
 *
 * Each run uses a fresh browser profile → empty localStorage → the demo workspace is seeded.
 * Exit code 1 when page errors, console errors, or the Next.js error overlay are detected.
 *
 * Actions: {click: selector} {dblclick: selector} {fill: [selector, value]} {press: key}
 *          {hover: selector} {wait: ms} {waitFor: selector} {screenshot: path} {goto: route}
 *          {eval: "js expression"} {expectText: "text"}
 */
import { chromium } from "playwright-core"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const args = Object.fromEntries(
  process.argv.slice(3).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=")
    return [k, rest.length ? rest.join("=") : true]
  })
)
const route = process.argv[2] ?? "/"
const width = Number(args.width ?? 1440)
const height = Number(args.height ?? 900)
const out = args.out ?? `/tmp/smoke${route.replace(/[^a-z0-9]+/gi, "-") || "-home"}.png`
const settle = Number(args.wait ?? 600)

const errors = []
const logs = []
const browser = await chromium.launch({ channel: "chrome", headless: true })
const context = await browser.newContext({
  viewport: { width, height },
  colorScheme: args.dark ? "dark" : "light",
  deviceScaleFactor: 1,
})
const page = await context.newPage()
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
page.on("console", (m) => {
  const text = m.text()
  if (m.type() === "error" && !/Download the React DevTools|favicon/.test(text)) errors.push(`console.error: ${text}`)
  else if (m.type() === "warning") logs.push(`warn: ${text.slice(0, 300)}`)
})

async function waitForWorkspace() {
  await page
    .waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 45000 })
    .catch(() => errors.push("timeout: workspace never finished loading"))
}

let status = null
try {
  const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90000 })
  status = res?.status() ?? null
  await waitForWorkspace()
  await page.waitForTimeout(settle)

  const actions = args.actions ? JSON.parse(args.actions) : []
  for (const action of actions) {
    if (action.click) await page.locator(action.click).first().click({ timeout: 10000 })
    else if (action.dblclick) await page.locator(action.dblclick).first().dblclick({ timeout: 10000 })
    else if (action.fill) await page.locator(action.fill[0]).first().fill(String(action.fill[1]), { timeout: 10000 })
    else if (action.press) await page.keyboard.press(action.press)
    else if (action.hover) await page.locator(action.hover).first().hover({ timeout: 10000 })
    else if (action.wait) await page.waitForTimeout(Number(action.wait))
    else if (action.waitFor) await page.locator(action.waitFor).first().waitFor({ timeout: 15000 })
    else if (action.goto) {
      await page.goto(BASE + action.goto, { waitUntil: "domcontentloaded" })
      await waitForWorkspace()
    } else if (action.screenshot) await page.screenshot({ path: action.screenshot, fullPage: Boolean(args.full) })
    else if (action.eval) logs.push(`eval: ${JSON.stringify(await page.evaluate(action.eval))}`)
    else if (action.expectText) {
      const found = await page.getByText(action.expectText, { exact: false }).count()
      if (!found) errors.push(`expectText not found: ${action.expectText}`)
    }
  }

  const overlay = await page.locator("nextjs-portal").count()
  if (overlay) {
    const text = await page.locator("nextjs-portal").first().innerText().catch(() => "")
    if (/error|unhandled|failed/i.test(text)) errors.push(`Next.js error overlay: ${text.slice(0, 500)}`)
  }
  await page.screenshot({ path: out, fullPage: Boolean(args.full) })
} catch (e) {
  errors.push(`script: ${e instanceof Error ? e.message : String(e)}`)
  await page.screenshot({ path: out, fullPage: Boolean(args.full) }).catch(() => {})
}

console.log(JSON.stringify({ route, status, errors, warnings: logs.slice(0, 15), screenshot: out }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)
