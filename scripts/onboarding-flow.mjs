#!/usr/bin/env node
/**
 * First-run onboarding flow: a brand-new browser (no workspace) is sent from "/" to /onboarding,
 * completes Niche Discovery and setup — once in English, once in Taglish — and lands back on "/".
 * Every pass checks the stored workspace, not just the screen. The English pass then re-runs only
 * Niche Discovery (/onboarding?step=niche) and replaces the pillars.
 *
 *   node scripts/onboarding-flow.mjs [--shots=/tmp/onboarding-flow] [--lang=english|taglish] [--headed]
 *   node scripts/onboarding-flow.mjs --lang=taglish --dark --width=390 --height=844   (same flow, dark, phone-sized)
 *
 * --seed follows the other QA scripts: none (the default here — a true first run), or demo / fresh, which
 * skip the first-run passes and only re-run Niche Discovery on the seeded workspace.
 * Exits 1 on the first failure (with a screenshot) or if any page error was logged.
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
const shots = args.shots ?? "/tmp/onboarding-flow"
fs.mkdirSync(shots, { recursive: true })
const SEED = String(args.seed ?? "none")
const LANGS = args.lang ? [String(args.lang)] : ["english", "taglish"]

/** What the creator types and clicks, per UI language. */
const RUN = {
  english: {
    hilig: "What could you talk about for hours?",
    help: "How to register with BIR as a freelancer and how to budget an irregular income",
    proof: "Helped 40+ freelancers register and file with BIR",
    story: "In 2022 I almost paid a ₱20,000 penalty because I missed one deadline. Now I track every filing in one sheet.",
    stage: "First year freelancing, no idea about taxes yet",
    goal: "File taxes with confidence and save every month",
    level: "Beginner",
    problems: ["Doesn't know how to file taxes with BIR", "No savings even with good income", "Afraid of tax penalties"],
    aims: ["Get clients", "Sell products"],
    choose: "Choose this",
    /** Every suggestion reads in the chosen language. */
    reads: (s) => !/\b(para sa|ang|mga|na gustong|tinutulungan)\b/i.test(s),
  },
  taglish: {
    hilig: "Anong topic ang kaya mong pag-usapan nang ilang oras?",
    help: "Paano mag-register sa BIR as freelancer, paano mag-budget ng sahod",
    proof: "Natulungan ko ang 40+ freelancers mag-register at mag-file sa BIR",
    story: "Noong 2022, muntik na akong magbayad ng ₱20,000 na penalty dahil nakalimutan ko ang isang deadline. Ngayon, nasa isang sheet na lahat ng filings ko.",
    stage: "Bagong freelancer, first year pa lang, walang idea sa taxes",
    goal: "Maging tax-compliant at makaipon kahit irregular ang income",
    level: "Nagsisimula pa lang",
    problems: ["Hindi alam paano mag-file ng BIR", "Walang ipon kahit malaki ang kita", "Takot sa tax penalties"],
    aims: ["Magka-clients", "Magbenta ng products"],
    choose: "Piliin 'to",
    reads: (s) => /\b(para sa|ang|mga)\b/i.test(s),
  },
}

const browser = await chromium.launch({ channel: "chrome", headless: !args.headed })
const errors = []

async function newPage() {
  const context = await browser.newContext({
    viewport: { width: Number(args.width ?? 1440), height: Number(args.height ?? 900) },
    colorScheme: args.dark ? "dark" : "light",
  })
  if (SEED !== "none") {
    await context.addInitScript((seed) => {
      if (!localStorage.getItem("pbos:dev-seed")) localStorage.setItem("pbos:dev-seed", seed)
    }, SEED)
  }
  const page = await context.newPage()
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error" && !/DevTools|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 240)}`)
  })
  return { context, page }
}

const workspace = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pbos:workspace:v2")).db)
const settle = (page, ms = 600) => page.waitForTimeout(ms) // local saves are debounced by 300 ms
async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Loading workspace"]'), null, { timeout: 60000 })
  // Next's dev-tools indicator floats over the footer's primary button on phone-sized viewports (dev only).
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await settle(page, 500)
}
const heading = (page) => page.locator("main h1").first().innerText()
const submit = (page) => page.locator("#ob-step-form button[type=submit]")
const exact = (text) => new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`)
const chip = (page, text) => page.locator("main button", { hasText: exact(text) }).first()

/** Click after centring the element — the sticky header and footer cover the edges on phone-sized viewports. */
async function tap(locator) {
  await locator.waitFor({ state: "visible", timeout: 30000 })
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }))
  await locator.click({ timeout: 30000 })
}

/** Submit the step and wait for the next one's heading. */
async function advance(page) {
  const before = await heading(page)
  await submit(page).click()
  await page.waitForFunction((prev) => {
    const h = document.querySelector("main h1")
    return Boolean(h && h.textContent.trim() !== prev.trim())
  }, before, { timeout: 45000 })
  await settle(page, 300)
}

async function addChip(page, id, text) {
  await page.fill(`#${id}`, text)
  await page.press(`#${id}`, "Enter")
}

let n = 0
async function step(page, name, fn) {
  n++
  try {
    const detail = await fn()
    console.log(`✓ ${n}. ${name}${detail ? ` — ${detail}` : ""}`)
  } catch (e) {
    await page.screenshot({ path: `${shots}/fail-${n}.png`, fullPage: true }).catch(() => {})
    console.log(`✗ ${n}. ${name} — ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`)
    console.log(`  screenshot: ${shots}/fail-${n}.png  url: ${page.url()}`)
    if (errors.length) console.log(`  page errors: ${JSON.stringify(errors.slice(-5))}`)
    await browser.close()
    process.exit(1)
  }
}
const shot = (page, name, fullPage = false) => page.screenshot({ path: `${shots}/${name}.png`, fullPage })
const expect = (ok, message) => {
  if (!ok) throw new Error(message)
}

/* ------------------------------- First run -------------------------------- */

async function firstRun(lang) {
  const r = RUN[lang]
  const { context, page } = await newPage()
  let niche = ""

  await step(page, `[${lang}] a new browser is sent to /onboarding`, async () => {
    await go(page, "/")
    await page.waitForURL(/\/onboarding/, { timeout: 60000 })
    await page.locator("#ob-lang-english").waitFor({ timeout: 60000 })
    const db = await workspace(page)
    expect(!db.brand_profiles[0].onboarding_completed, "the new workspace is already onboarded")
    expect(db.content_ideas.length === 0 && db.content_items.length === 0, "a new workspace should hold no content")
    return `${db.content_formats.length} formats in the starter library`
  })

  await step(page, `[${lang}] welcome: pick the language`, async () => {
    await tap(page.locator(`label[for="ob-lang-${lang}"]`))
    await shot(page, `${lang}-01-welcome`)
    await advance(page)
    expect((await heading(page)).includes(r.hilig), `the hilig step isn't in ${lang}: “${await heading(page)}”`)
  })

  await step(page, `[${lang}] hilig: two suggestions and one of my own`, async () => {
    await tap(chip(page, "Personal finance"))
    await tap(chip(page, "Ipon & budgeting"))
    await addChip(page, "ob-interests", "K-drama")
    await shot(page, `${lang}-02-hilig`)
    await advance(page)
  })

  await step(page, `[${lang}] galing: skills, help, years, proof and a story`, async () => {
    await addChip(page, "ob-expertise_areas", "Bookkeeping")
    await tap(chip(page, "BIR & taxes"))
    await page.fill("#ob-help_requests", r.help)
    await page.fill("#ob-years_experience", "6")
    await page.fill("#ob-proof", r.proof)
    await page.fill("#ob-story", r.story)
    await shot(page, `${lang}-03-galing`, true)
    await advance(page)
  })

  await step(page, `[${lang}] kanino: audience, stage, goal and three problems`, async () => {
    await tap(chip(page, "Freelancers"))
    await page.fill("#ob-persona_profession", r.stage)
    await page.fill("#ob-audience_goal", r.goal)
    await tap(page.locator("main button", { hasText: exact(r.level) }).first())
    for (const problem of r.problems) await addChip(page, "ob-persona_problems", problem)
    await shot(page, `${lang}-04-kanino`, true)
    await advance(page)
  })

  await step(page, `[${lang}] para saan: clients and products`, async () => {
    for (const aim of r.aims) await tap(page.locator("main button", { hasText: aim }).first())
    await shot(page, `${lang}-05-para-saan`)
    await advance(page)
  })

  await step(page, `[${lang}] niche: three directions, choose the audience-led one`, async () => {
    const cards = page.locator("main article")
    await cards.nth(2).waitFor({ timeout: 60000 })
    expect((await cards.count()) === 3, `expected 3 niche cards, got ${await cards.count()}`)
    const statements = await cards.evaluateAll((els) => els.map((el) => el.querySelector("h3 + p")?.textContent ?? ""))
    expect(new Set(statements).size === 3, "the three directions aren't distinct")
    expect(statements.every((s) => r.reads(s)), `suggestions aren't in ${lang}: ${JSON.stringify(statements)}`)
    await shot(page, `${lang}-06-niche`, true)
    await tap(cards.nth(2).getByRole("button", { name: r.choose }))
    await settle(page, 300)
    niche = await page.inputValue("#ob-niche")
    expect(niche.length > 20, "choosing a direction didn't fill the niche")
    await page.locator("#ob-clarity-title").waitFor()
    await shot(page, `${lang}-07-niche-chosen`, true)
    await advance(page)
    return `“${niche}”`
  })

  await step(page, `[${lang}] identity: pre-filled industry, name and role`, async () => {
    const industry = await page.inputValue("#ob-industry")
    expect(industry.trim().length > 0, "industry wasn't pre-filled from the niche")
    await page.fill("#ob-name", "Mika Reyes")
    await page.fill("#ob-role", "Freelance bookkeeper")
    await page.fill("#ob-location", "Quezon City")
    await shot(page, `${lang}-08-identity`)
    await advance(page)
    return `industry “${industry}”`
  })

  await step(page, `[${lang}] platforms & schedule`, async () => {
    const group = page.locator('[role="group"][aria-label="Main platforms"]')
    for (const p of ["Facebook", "TikTok", "LinkedIn"]) await tap(group.locator("button", { hasText: p }).first())
    await shot(page, `${lang}-09-platforms`, true)
    await advance(page)
  })

  await step(page, `[${lang}] voice: personality traits`, async () => {
    const traits = page.locator('[aria-label="Personality"]')
    for (const trait of ["Direct", "Practical"]) await tap(traits.locator("button", { hasText: exact(trait) }).first())
    await shot(page, `${lang}-10-voice`, true)
    await advance(page)
  })

  await step(page, `[${lang}] pillars come from the niche and total 100%`, async () => {
    const list = page.locator("#ob-pillars")
    await list.waitFor()
    const selected = await list.locator('button[role="checkbox"][data-state="checked"]').count()
    expect(selected >= 4 && selected <= 6, `${selected} pillars selected`)
    expect((await page.locator("main").innerText()).includes("100%"), "the pillar mix doesn't total 100%")
    await shot(page, `${lang}-11-pillars`, true)
    await advance(page) // "Generate my strategy"
    await page.locator("#ob-ideas-title").waitFor({ timeout: 90000 })
    return `${selected} niche pillars`
  })

  await step(page, `[${lang}] strategy: starter ideas inside the niche`, async () => {
    const rows = await page.locator('section[aria-labelledby="ob-ideas-title"] li').count()
    expect(rows >= 25, `only ${rows} starter ideas`)
    await shot(page, `${lang}-12-strategy`, true)
    return `${rows} starter ideas`
  })

  await step(page, `[${lang}] finish setup lands on "/" with everything stored`, async () => {
    await submit(page).click()
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 60000 })
    await settle(page, 1200)
    const db = await workspace(page)
    const brand = db.brand_profiles[0]
    expect(brand.onboarding_completed === true, "onboarding_completed is not true")
    expect(brand.niche === niche, `brand.niche is “${brand.niche}”, expected “${niche}”`)
    expect(brand.interests.includes("Personal finance") && brand.interests.includes("K-drama"), `interests: ${JSON.stringify(brand.interests)}`)
    expect(/\/10/.test(brand.niche_fit), `niche_fit: “${brand.niche_fit}”`)
    expect(brand.language === lang, `brand.language is ${brand.language}`)
    expect(brand.expertise_areas.includes("Bookkeeping"), "expertise areas missing")
    const pillars = db.content_pillars.filter((p) => p.is_active)
    const total = pillars.reduce((a, p) => a + p.target_percentage, 0)
    expect(total === 100, `active pillars total ${total}%`)
    expect(!pillars.some((p) => /^(Education|Authority|Journey|Leadership|Personal|Business)$/.test(p.name)), "generic preset pillars were saved instead of niche pillars")
    const persona = db.audience_personas.find((p) => p.is_primary)
    expect(persona?.name === "Freelancers", `primary persona: ${persona?.name}`)
    const problems = db.audience_problems.filter((p) => p.persona_id === persona.id)
    expect(problems.length >= 3, `${problems.length} problems for the persona`)
    const ideas = db.content_ideas.filter((i) => i.source === "onboarding")
    expect(ideas.length >= 25, `${ideas.length} onboarding ideas`)
    expect(db.stories.length === 1, `${db.stories.length} stories`)
    if (lang === "taglish") {
      const taglish = ideas.filter((i) => /\b(ang|mga|sa|ng|mo|ko)\b|'to\b/i.test(`${i.hook} ${i.cta}`)).length
      expect(taglish >= 10, `only ${taglish} ideas read as Taglish`)
    }
    return `${pillars.length} pillars · ${ideas.length} ideas · persona “${persona.name}” with ${problems.length} problems`
  })

  return { context, page }
}

/* ------------------------- Niche Discovery re-run ------------------------- */

async function nicheRerun(page, { replace = true } = {}) {
  let niche = ""
  let before = []
  await step(page, "[niche] /onboarding?step=niche opens Niche Discovery pre-filled", async () => {
    before = (await workspace(page)).content_pillars.filter((p) => p.is_active).map((p) => p.id)
    await go(page, "/onboarding?step=niche")
    await page.locator("#ob-interests").waitFor({ timeout: 60000 })
    const chips = await page.locator('[data-slot="token"]').count()
    expect(chips >= 2, "interests weren't pre-filled from Brand HQ")
    await shot(page, "niche-01-hilig")
    for (let i = 0; i < 4; i++) await advance(page)
    return `${chips} pre-filled chips`
  })

  await step(page, "[niche] choose a new direction and replace pillars (confirmed)", async () => {
    const cards = page.locator("main article")
    await cards.nth(2).waitFor({ timeout: 60000 })
    const chosenPillars = await cards.nth(0).locator("ul").first().locator("li > span.truncate").allInnerTexts()
    await tap(cards.nth(0).getByRole("button", { name: /Choose this|Piliin 'to/ }))
    await settle(page, 300)
    niche = await page.inputValue("#ob-niche")
    if (replace) await tap(page.locator('label[for="ob-replace-pillars"]'))
    await shot(page, "niche-02-chosen", true)
    await submit(page).click()
    if (replace) {
      const dialog = page.locator('[role="alertdialog"]')
      await dialog.waitFor({ timeout: 10000 })
      await shot(page, "niche-03-confirm")
      await dialog.getByRole("button", { name: /Replace pillars|Palitan ang pillars/ }).click()
    }
    await page.waitForURL((url) => new URL(url).pathname === "/strategy", { timeout: 60000 })
    await settle(page, 1200)
    const db = await workspace(page)
    expect(db.brand_profiles[0].niche === niche, `brand.niche is “${db.brand_profiles[0].niche}”`)
    const active = db.content_pillars.filter((p) => p.is_active)
    const total = active.reduce((a, p) => a + p.target_percentage, 0)
    expect(total === 100, `active pillars total ${total}%`)
    if (replace) {
      // Pillars are matched by name: shared names are updated in place, the rest are switched off.
      const names = active.map((p) => p.name).sort()
      expect(JSON.stringify(names) === JSON.stringify([...chosenPillars].sort()), `active pillars ${JSON.stringify(names)} ≠ chosen ${JSON.stringify(chosenPillars)}`)
      const stale = db.content_pillars.filter((p) => before.includes(p.id) && !chosenPillars.includes(p.name) && p.is_active)
      expect(!stale.length, `old pillars still active: ${stale.map((p) => p.name).join(", ")}`)
    }
    expect(db.content_pillars.filter((p) => before.includes(p.id)).length === before.length, "pillars were deleted instead of switched off")
    return `“${niche}” · ${active.length} active pillars`
  })
}

/* ---------------------------------- Run ----------------------------------- */

if (SEED === "none") {
  for (const lang of LANGS) {
    const { context, page } = await firstRun(lang)
    if (lang === "english") await nicheRerun(page)
    await context.close()
  }
} else {
  const { context, page } = await newPage()
  await go(page, "/")
  await nicheRerun(page)
  await context.close()
}

await browser.close()
if (errors.length) {
  console.log(`✗ page errors during the flow: ${JSON.stringify(errors.slice(0, 8))}`)
  process.exit(1)
}
console.log("✓ onboarding flow complete — no page errors")
