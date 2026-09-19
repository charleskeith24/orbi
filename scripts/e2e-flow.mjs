#!/usr/bin/env node
/**
 * Cross-feature flow check on a fresh demo workspace:
 * Quick Capture → Idea Bank → convert to content → Studio → Pipeline → publish → Add analytics
 * → Post Performance → Calendar → Dashboard.
 *
 *   node scripts/e2e-flow.mjs [--shots=/tmp/e2e] [--headed]
 *
 * Every step checks the stored workspace, not just the screen. Exits 1 on the first failure
 * (with a screenshot) or if any page error was logged along the way.
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
const shots = args.shots ?? "/tmp/e2e"
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch({ channel: "chrome", headless: !args.headed })

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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
page.on("console", (m) => {
  if (m.type() === "error" && !/DevTools|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 240)}`)
})

const workspace = () => page.evaluate(() => JSON.parse(localStorage.getItem("pbos:workspace:v2")).db)
const settle = (ms = 600) => page.waitForTimeout(ms) // local saves are debounced by 300 ms
async function go(path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 60000 })
  await settle(500)
}
const topDialog = () => page.locator('[role="dialog"], [role="alertdialog"]').last()

let n = 0
async function step(name, fn) {
  n++
  try {
    const detail = await fn()
    console.log(`✓ ${n}. ${name}${detail ? ` — ${detail}` : ""}`)
  } catch (e) {
    await page.screenshot({ path: `${shots}/fail-${n}.png` }).catch(() => {})
    console.log(`✗ ${n}. ${name} — ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`)
    console.log(`  screenshot: ${shots}/fail-${n}.png  url: ${page.url()}`)
    if (errors.length) console.log(`  page errors: ${JSON.stringify(errors.slice(-5))}`)
    await browser.close()
    process.exit(1)
  }
}

const MARKER = "E2E flow check"
const IDEA_TEXT = `${MARKER}: most founders track vanity metrics instead of the leads that pay the bills`
let ideaId = ""
let itemId = ""
let title = ""

await go("/today")

await step("Quick Capture saves an inbox idea (Alt+N, ⌘/Ctrl+Enter)", async () => {
  await page.keyboard.press("Alt+n")
  const dialog = topDialog()
  await dialog.waitFor({ timeout: 10000 })
  await dialog.locator("textarea").first().fill(IDEA_TEXT)
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter")
  await dialog.waitFor({ state: "hidden", timeout: 10000 })
  await settle()
  const idea = (await workspace()).content_ideas.find((i) => `${i.title} ${i.description}`.includes(MARKER))
  if (!idea) throw new Error("the captured idea is not in the workspace")
  if (idea.source !== "quick_capture" || idea.status !== "inbox") throw new Error(`source=${idea.source} status=${idea.status}`)
  ideaId = idea.id
  title = idea.title
  return `"${title}"`
})

await step("Idea Bank opens it from ?open=", async () => {
  await go(`/ideas?open=${ideaId}`)
  const sheet = topDialog()
  await sheet.waitFor({ timeout: 10000 })
  if (!(await sheet.innerText()).includes(MARKER)) throw new Error("the detail sheet doesn't show the idea")
})

await step("Convert to content creates an item and marks the idea converted", async () => {
  await topDialog().getByRole("button", { name: /^convert to content$/i }).first().click()
  await settle(400)
  const form = topDialog()
  await form.locator('button[type="submit"]').last().click({ timeout: 10000 })
  await settle()
  const db = await workspace()
  const items = db.content_items.filter((i) => i.idea_id === ideaId)
  if (!items.length) throw new Error("no content item was created")
  const idea = db.content_ideas.find((i) => i.id === ideaId)
  if (idea.status !== "converted") throw new Error(`idea status is ${idea.status}`)
  if (!db.content_briefs.some((b) => b.content_item_id === items[0].id)) throw new Error("the item has no brief")
  itemId = items[0].id
  return `${items.length} item(s), stage "${items[0].stage}", brief created`
})

await step("Content Studio opens the item", async () => {
  await go(`/studio/${itemId}`)
  const text = await page.locator("main").innerText()
  if (!text.includes(MARKER)) throw new Error("the workspace doesn't show the item title")
})

await step("Pipeline finds it by search", async () => {
  await go("/pipeline")
  await page.getByPlaceholder("Search pipeline…").fill(MARKER)
  await settle(500)
  if (!(await page.locator("main").innerText()).includes(MARKER)) throw new Error("the card isn't on the board")
})

await step("Mark published from the Studio", async () => {
  await go(`/studio/${itemId}`)
  await page.locator("main").getByRole("button", { name: /mark (as )?published/i }).first().click()
  await settle()
  const item = (await workspace()).content_items.find((i) => i.id === itemId)
  if (item.stage !== "published" || !item.published_at) throw new Error(`stage=${item.stage} published_at=${item.published_at}`)
  return `published_at ${item.published_at.slice(0, 16)}`
})

await step("Add analytics saves a snapshot for the item", async () => {
  await page.locator("main").getByRole("button", { name: /add analytics/i }).first().click()
  const dialog = topDialog()
  await dialog.waitFor({ timeout: 10000 })
  await dialog.getByLabel(/^views$/i).fill("12345")
  await dialog.getByLabel(/^reach$/i).fill("10000")
  await dialog.getByLabel(/^likes$/i).fill("400")
  await dialog.getByRole("button", { name: /save analytics/i }).click()
  await dialog.waitFor({ state: "hidden", timeout: 10000 })
  await settle()
  const metric = (await workspace()).content_metrics.find((m) => m.content_item_id === itemId)
  if (!metric) throw new Error("no metrics snapshot was saved")
  if (metric.views !== 12345 || metric.reach !== 10000) throw new Error(`views=${metric.views} reach=${metric.reach}`)
  return "12,345 views · 10,000 reach"
})

await step("Post Performance shows the snapshot", async () => {
  await go(`/analytics/posts?open=${itemId}`)
  const sheet = topDialog()
  await sheet.waitFor({ timeout: 10000 })
  if (!/12,345/.test(await sheet.innerText())) throw new Error("the post sheet doesn't show 12,345 views")
})

await step("Calendar places the published post", async () => {
  await go(`/calendar?open=${itemId}`)
  await settle(800)
  if (!(await page.locator("main").innerText()).includes(MARKER)) throw new Error("the post isn't on the calendar")
})

await step("Dashboard still renders", async () => {
  await go("/")
  // Home leads with "Your focus today"; the rest (Pipeline, Content Health Score, performance) is under "More on your week".
  await page.locator('[data-slot="focus-hero"]').waitFor({ timeout: 30000 })
  const more = page.getByRole("button", { name: /More on your week/i })
  if ((await more.getAttribute("aria-expanded")) !== "true") await more.click()
  await page.getByText("Content Health Score").first().waitFor({ timeout: 15000 })
  const text = await page.locator("main").innerText()
  if (!/Content Health Score/i.test(text)) throw new Error("dashboard sections missing")
})

await browser.close()
if (errors.length) {
  console.log(`✗ page errors during the flow: ${JSON.stringify(errors.slice(0, 8))}`)
  process.exit(1)
}
console.log("✓ flow complete — no page errors")
