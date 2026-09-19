#!/usr/bin/env node
/**
 * First-run onboarding flow (docs/QUICK_SETUP.md): a brand-new browser (no workspace) is sent from "/" to
 * /onboarding and goes through the four Quick setup screens — once in English, once in Taglish — then the
 * Building screen, and lands on Home with the setup checklist. A third new browser takes the
 * "I already know my niche" shortcut. The English workspace then re-runs Niche Discovery
 * (/onboarding?step=niche, replacing the pillars) and the Detailed setup (every step, as before Quick setup).
 * Every pass checks the stored workspace, not just the screen, and prints how many screens and required
 * fields it needed (required fields are the `[data-ob-required]` markers on each screen that was submitted).
 *
 *   node scripts/onboarding-flow.mjs [--shots=/tmp/onboarding-flow] [--lang=english|taglish] [--headed]
 *   node scripts/onboarding-flow.mjs --lang=taglish --dark --width=390 --height=844   (same flow, dark, phone-sized)
 *
 * --seed follows the other QA scripts: none (the default here — a true first run), or demo / fresh, which
 * skip the first-run passes and only re-run Niche Discovery and the Detailed setup on the seeded workspace.
 * The Building screen is screenshotted by holding the ideas request until the shot is taken (the app itself
 * never waits). Exits 1 on the first failure (with a screenshot) or if any page error was logged.
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

/** What the creator types and taps, and what the screens say, per UI language. */
const RUN = {
  english: {
    titles: { start: "Let's start", about: "About you", who: "Who you help", pick: "Pick your niche", building: "Setting up your Orbi" },
    aim: "Get clients",
    problemsGroup: /^Common for /,
    seeDetails: "See details",
    written: "Budget meal prep for busy nurses who work nights",
    knowNiche: "I already know my niche",
    detailed: "Detailed setup",
    checklistVoice: "Set your voice",
    /** Every suggestion reads in the chosen language. */
    reads: (s) => !/\b(para sa|ang|mga|na gustong|tinutulungan)\b/i.test(s),
  },
  taglish: {
    titles: { start: "Simulan natin", about: "Tungkol sa'yo", who: "Sino ang tinutulungan mo", pick: "Piliin ang niche mo", building: "Sine-setup ang Orbi mo" },
    aim: "Magka-clients",
    problemsGroup: /^Madalas sa /,
    seeDetails: "Tingnan ang detalye",
    written: "Budget meal prep para sa mga nurse na pagod sa night shift",
    knowNiche: "Alam ko na ang niche ko",
    detailed: "Detalyadong setup",
    checklistVoice: "I-set ang voice mo",
    reads: (s) => /\b(para sa|ang|mga|sa|mo|na)\b/i.test(s),
  },
}

const browser = await chromium.launch({ channel: "chrome", headless: !args.headed })
const errors = []
const summary = []
/** 500s the flow causes on purpose (the Building screen's failure path): the browser logs each one. */
let expected500 = 0

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
    if (m.type() !== "error" || /DevTools|favicon/.test(m.text())) return
    if (expected500 > 0 && /status of 500/.test(m.text())) {
      expected500--
      return
    }
    errors.push(`console: ${m.text().slice(0, 240)}`)
  })
  return { context, page }
}

/**
 * Holds the next `onboarding_strategy` request until released, so the Building screen can be screenshotted;
 * with `failOnce`, that task's first request answers 500 instead (the Building screen's error and Try again).
 */
async function holdIdeas(page, { failOnce = "" } = {}) {
  let release = () => {}
  let held = false
  let failed = false
  const gate = new Promise((resolve) => (release = resolve))
  await page.route("**/api/ai", async (route) => {
    let task = ""
    try {
      task = JSON.parse(route.request().postData() ?? "{}").task ?? ""
    } catch {
      // Not JSON: let it through.
    }
    if (task === failOnce && !failed) {
      failed = true
      expected500++
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "The AI service is unavailable (test).", code: "unknown" }) }).catch(() => {})
      return
    }
    if (task === "onboarding_strategy" && !held) {
      held = true
      await gate
    }
    await route.continue().catch(() => {})
  })
  // The route stays installed (later requests pass straight through); releasing lets the held request go.
  return async () => release()
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
const radios = (page) => page.locator('main [role="radiogroup"] [role="radio"]')

/** Click after centring the element — the sticky header and footer cover the edges on phone-sized viewports. */
async function tap(locator) {
  await locator.waitFor({ state: "visible", timeout: 30000 })
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }))
  await locator.click({ timeout: 30000 })
}

/** Screens and required fields a pass needed. */
function counter(name) {
  const seen = new Set()
  let required = 0
  return {
    async screen(page) {
      seen.add((await heading(page)).trim())
    },
    async submitted(page) {
      seen.add((await heading(page)).trim())
      required += await page.locator("main [data-ob-required]").count()
    },
    report(extra = "") {
      const line = `${name}: ${seen.size} screens · ${required} required fields${extra ? ` · ${extra}` : ""}`
      summary.push(line)
      return line
    },
  }
}

/** Submit the step and wait for the next one's heading. */
async function advance(page, count) {
  const before = await heading(page)
  if (count) await count.submitted(page)
  await submit(page).click()
  await page.waitForFunction((prev) => {
    const h = document.querySelector("main h1")
    return Boolean(h && h.textContent.trim() !== prev.trim())
  }, before, { timeout: 45000 })
  await settle(page, 300)
  if (count) await count.screen(page)
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
const GENERIC = /^(Education|Authority|Journey|Leadership|Personal|Business)$/

/** What every pass checks in the stored workspace. */
function checkWorkspace(db, want) {
  const brand = db.brand_profiles[0]
  expect(brand.onboarding_completed === true, "onboarding_completed is not true")
  if (want.niche) expect(brand.niche === want.niche, `brand.niche is “${brand.niche}”, expected “${want.niche}”`)
  else expect(brand.niche.trim().length > 10, `brand.niche is “${brand.niche}”`)
  expect(brand.language === want.lang, `brand.language is ${brand.language}, expected ${want.lang}`)
  const pillars = db.content_pillars.filter((p) => p.is_active)
  const total = pillars.reduce((a, p) => a + p.target_percentage, 0)
  expect(pillars.length >= 2 && total === 100, `${pillars.length} active pillars totalling ${total}%`)
  if (want.nichePillars) expect(!pillars.some((p) => GENERIC.test(p.name)), `generic preset pillars were saved: ${pillars.map((p) => p.name).join(", ")}`)
  const ideas = db.content_ideas.filter((i) => i.source === "onboarding")
  expect(ideas.length >= 20, `${ideas.length} onboarding ideas`)
  const persona = db.audience_personas.find((p) => p.is_primary)
  expect(persona, "no primary persona")
  if (want.persona) expect(want.persona.test(persona.name), `primary persona is “${persona.name}”`)
  const platforms = db.content_platforms.filter((p) => p.is_active).map((p) => p.platform).sort()
  if (want.platforms) {
    expect(JSON.stringify(platforms) === JSON.stringify([...want.platforms].sort()), `active platforms ${JSON.stringify(platforms)}`)
    expect(JSON.stringify([...brand.main_platforms].sort()) === JSON.stringify([...want.platforms].sort()), `main platforms ${JSON.stringify(brand.main_platforms)}`)
  }
  const slots = db.content_calendar.filter((s) => s.is_active)
  expect(slots.length >= 1, "no posting slots")
  expect(slots.every((s) => s.platforms.every((p) => platforms.includes(p))), "a posting slot uses a platform that isn't active")
  if (want.uiLang) expect(db.app_settings[0].ui_language === want.uiLang, `app language is ${db.app_settings[0].ui_language}`)
  if (want.quick) {
    expect(brand.tones.length === 0 && brand.personality_traits.length === 0, `Quick setup invented a voice: ${JSON.stringify([brand.tones, brand.personality_traits])}`)
    expect(brand.role.trim() && brand.industry.trim(), `role/industry not derived: “${brand.role}” / “${brand.industry}”`)
    expect(brand.primary_goal_id, "no primary goal")
  }
  if (want.taglishIdeas) {
    const taglish = ideas.filter((i) => /\b(ang|mga|sa|ng|mo|ko)\b|'to\b/i.test(`${i.hook} ${i.cta}`)).length
    expect(taglish >= 10, `only ${taglish} ideas read as Taglish`)
  }
  return `${pillars.length} pillars · ${ideas.length} ideas · persona “${persona.name}” · ${platforms.length} platforms · ${slots.length} slots`
}

/* ------------------------------- Quick setup -------------------------------- */

/** Screen 1 → the chosen language, the name and the platforms (and, with `errorShot`, the validation error first). */
async function startScreen(page, lang, count, prefix, errorShot = false) {
  const r = RUN[lang]
  await go(page, "/")
  await page.waitForURL(/\/onboarding/, { timeout: 60000 })
  await page.locator("#ob-lang-english").waitFor({ timeout: 60000 })
  const db = await workspace(page)
  expect(!db.brand_profiles[0].onboarding_completed, "the new workspace is already onboarded")
  expect(db.content_ideas.length === 0 && db.content_items.length === 0, "a new workspace should hold no content")
  await tap(page.locator(`label[for="ob-lang-${lang}"]`))
  await settle(page, 300)
  expect((await heading(page)).includes(r.titles.start), `screen 1 isn't in ${lang}: “${await heading(page)}”`)
  await count.screen(page)
  await shot(page, `${prefix}-01-start`)
  if (errorShot) {
    await submit(page).click()
    await page.locator('main [role="alert"]').first().waitFor({ timeout: 10000 })
    expect((await page.locator('main [role="alert"]').count()) === 2, "screen 1 should flag the name and the platforms")
    await shot(page, `${prefix}-01b-start-error`)
  }
  await page.fill("#ob-name", "Mika Reyes")
  const group = page.locator('[role="group"][aria-labelledby="ob-platforms-title"]')
  for (const p of ["Facebook", "TikTok"]) await tap(group.locator("button", { hasText: p }).first())
  await advance(page, count)
  expect((await heading(page)).includes(r.titles.about), `screen 2 isn't in ${lang}: “${await heading(page)}”`)
  return `${db.content_formats.length} formats in the starter library`
}

/** Finish setup → the Building screen (screenshotted while the ideas are held) → Home with the checklist. */
async function finishAndLand(page, lang, count, prefix, { failOnce = "" } = {}) {
  const r = RUN[lang]
  const release = await holdIdeas(page, { failOnce })
  await count.submitted(page)
  await submit(page).click()
  await page.locator("#ob-building-title").waitFor({ timeout: 30000 })
  if (failOnce) {
    // The failed request shows its error with Try again; the answers are kept.
    const alert = page.locator('main [role="alert"]')
    await alert.waitFor({ timeout: 30000 })
    expect((await alert.innerText()).includes("unavailable (test)"), "the Building screen doesn't show the error")
    await shot(page, `${prefix}-05a-building-error`)
    await alert.getByRole("button").first().click()
  }
  expect((await page.locator("#ob-building-title").innerText()).includes(r.titles.building), "the Building screen isn't in the chosen language")
  await page.waitForFunction(() => document.querySelectorAll("main li svg.text-good-fg").length >= 4, null, { timeout: 30000 })
  await shot(page, `${prefix}-05-building`)
  await release()
  await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 60000 })
  await settle(page, 1500)
  // Home leads with "Your focus today"; the full first-week list (with day 4's voice step) is behind "All missions".
  const hero = page.locator('[data-slot="focus-hero"]')
  await hero.waitFor({ timeout: 30000 })
  await hero.locator('[data-slot="disclosure-trigger"]').last().click()
  await page.getByText(r.checklistVoice).first().waitFor({ timeout: 30000 })
  await shot(page, `${prefix}-06-home`, true)
}

async function firstRun(lang) {
  const r = RUN[lang]
  const count = counter(`[${lang}] Quick setup`)
  const { context, page } = await newPage()
  let niche = ""
  let persona = ""

  await step(page, `[${lang}] a new browser lands on screen 1; name and platforms are required`, () => startScreen(page, lang, count, lang, true))

  await step(page, `[${lang}] about you: two interests, one skill, "Show more"`, async () => {
    await tap(chip(page, "Personal finance"))
    await tap(chip(page, "Ipon & budgeting"))
    await tap(chip(page, "Bookkeeping"))
    await shot(page, `${lang}-02-about`)
    await tap(page.locator("main button[aria-expanded]").first())
    await shot(page, `${lang}-02b-about-more`, true)
    await advance(page, count)
    expect((await heading(page)).includes(r.titles.who), `screen 3 isn't in ${lang}`)
  })

  await step(page, `[${lang}] who you help: an audience, a suggested #1 problem, one aim`, async () => {
    await tap(chip(page, "Freelancers"))
    const problems = page.locator("main [role=group]").filter({ has: page.locator("p", { hasText: r.problemsGroup }) })
    await tap(problems.locator("button").first())
    persona = "Freelancers"
    await tap(page.locator("main button", { hasText: r.aim }).first())
    const problem = await page.inputValue("#ob-persona_problems")
    expect(problem.length > 5, "the suggested problem didn't fill the field")
    await shot(page, `${lang}-03-who`, true)
    await advance(page, count)
    return `“${problem}”`
  })

  await step(page, `[${lang}] pick your niche: three directions + "Write my own", best match first`, async () => {
    await radios(page).nth(3).waitFor({ timeout: 60000 })
    expect((await radios(page).count()) === 4, `expected 3 directions + "Write my own", got ${await radios(page).count()}`)
    const titles = await radios(page).evaluateAll((els) => els.slice(0, 3).map((el) => el.textContent ?? ""))
    expect(new Set(titles).size === 3, "the three directions aren't distinct")
    expect(titles.every((s) => r.reads(s)), `directions aren't in ${lang}: ${JSON.stringify(titles)}`)
    expect(await radios(page).first().locator("[data-slot=badge]").count(), "the first direction isn't marked Best match")
    await shot(page, `${lang}-04-pick`)
    // A validation error when nothing is picked.
    await submit(page).click()
    await page.locator('main [role="alert"]').first().waitFor({ timeout: 10000 })
    await shot(page, `${lang}-04b-pick-error`)
    // Details on demand.
    await tap(page.getByRole("button", { name: r.seeDetails }).first())
    await shot(page, `${lang}-04c-details`, true)
    // "Write my own" opens one field.
    await tap(radios(page).nth(3))
    await page.locator("textarea#ob-niche").waitFor()
    await shot(page, `${lang}-04d-write-own`, true)
    // Keyboard: arrows move the radio selection back to the first direction.
    await radios(page).nth(3).focus()
    await page.keyboard.press("Home")
    await settle(page, 300)
    expect((await radios(page).first().getAttribute("aria-checked")) === "true", "Home didn't select the best match")
    const draft = await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith("pbos:onboarding:"))?.[1])
    niche = JSON.parse(draft).answers.niche
    expect(niche.length > 20, "choosing a direction didn't set the niche")
    return `“${niche}”`
  })

  await step(page, `[${lang}] finish setup: Building screen, then Home with everything stored`, async () => {
    await finishAndLand(page, lang, count, lang)
    const detail = checkWorkspace(await workspace(page), {
      niche,
      lang,
      uiLang: lang === "english" ? "en" : "tl",
      nichePillars: true,
      persona: new RegExp(persona),
      platforms: ["facebook", "tiktok"],
      quick: true,
      taglishIdeas: lang === "taglish",
    })
    return `${detail} — ${count.report()}`
  })

  return { context, page }
}

/** "I already know my niche": screen 1, the shortcut on screen 2, one sentence on screen 4. */
async function shortcutRun(lang) {
  const r = RUN[lang]
  const count = counter(`[${lang}] shortcut`)
  const { context, page } = await newPage()
  await step(page, `[${lang}] shortcut: screen 1`, () => startScreen(page, lang, count, `shortcut-${lang}`))
  await step(page, `[${lang}] shortcut: "${r.knowNiche}" opens "Write my own" on screen 4`, async () => {
    await tap(page.getByRole("button", { name: r.knowNiche }))
    await page.locator("textarea#ob-niche").waitFor({ timeout: 30000 })
    expect((await heading(page)).includes(r.titles.pick), "the shortcut didn't land on screen 4")
    await count.screen(page)
    expect((await radios(page).last().getAttribute("aria-checked")) === "true", "“Write my own” isn't selected")
    await page.fill("#ob-niche", r.written)
    await shot(page, `shortcut-${lang}-04-own`, true)
  })
  await step(page, `[${lang}] shortcut: the written niche alone builds pillars, persona and ideas`, async () => {
    await finishAndLand(page, lang, count, `shortcut-${lang}`, { failOnce: "niche_discovery" })
    const detail = checkWorkspace(await workspace(page), { niche: r.written, lang, nichePillars: true, persona: /nurse/i, platforms: ["facebook", "tiktok"], quick: true })
    return `${detail} — ${count.report()}`
  })
  await context.close()
}

/* ------------------------- Niche Discovery re-run ------------------------- */

async function nicheRerun(page) {
  const count = counter("[niche] Niche Discovery re-run")
  let niche = ""
  let before = []
  let chosenPillars = []
  await step(page, "[niche] /onboarding?step=niche opens screens 2–4 pre-filled", async () => {
    before = (await workspace(page)).content_pillars.filter((p) => p.is_active).map((p) => p.id)
    await go(page, "/onboarding?step=niche")
    await page.locator("#ob-interests").waitFor({ timeout: 60000 })
    await count.screen(page)
    const chips = await page.locator('[data-slot="token"]').count()
    expect(chips >= 2, "interests weren't pre-filled from Brand HQ")
    await shot(page, "niche-01-about")
    await advance(page, count)
    await advance(page, count)
    return `${chips} pre-filled chips`
  })

  await step(page, "[niche] choose the best match and replace pillars (confirmed)", async () => {
    await radios(page).nth(3).waitFor({ timeout: 60000 })
    await tap(page.locator("main button[aria-controls^=ob-niche-details]").first())
    chosenPillars = await page.locator("#ob-niche-details-0 ul").first().locator("li > span.truncate").allInnerTexts()
    await tap(radios(page).first())
    await settle(page, 300)
    const draft = await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith("pbos:onboarding:"))?.[1])
    niche = JSON.parse(draft).answers.niche
    await tap(page.locator('label[for="ob-replace-pillars"]'))
    await shot(page, "niche-02-pick", true)
    await count.submitted(page)
    await submit(page).click()
    const dialog = page.locator('[role="alertdialog"]')
    await dialog.waitFor({ timeout: 10000 })
    await shot(page, "niche-03-confirm")
    await dialog.getByRole("button", { name: /Replace pillars|Palitan ang pillars/ }).click()
    await page.waitForURL((url) => new URL(url).pathname === "/strategy", { timeout: 60000 })
    await settle(page, 1200)
    const db = await workspace(page)
    const lang = db.brand_profiles[0].language
    const detail = checkWorkspace(db, { niche, lang, nichePillars: true })
    const active = db.content_pillars.filter((p) => p.is_active)
    // Pillars are matched by name: shared names are updated in place, the rest are switched off.
    const names = active.map((p) => p.name).sort()
    expect(JSON.stringify(names) === JSON.stringify([...chosenPillars].sort()), `active pillars ${JSON.stringify(names)} ≠ chosen ${JSON.stringify(chosenPillars)}`)
    const stale = db.content_pillars.filter((p) => before.includes(p.id) && !chosenPillars.includes(p.name) && p.is_active)
    expect(!stale.length, `old pillars still active: ${stale.map((p) => p.name).join(", ")}`)
    expect(db.content_pillars.filter((p) => before.includes(p.id)).length === before.length, "pillars were deleted instead of switched off")
    return `“${niche}” · ${detail} — ${count.report()}`
  })
}

/* ---------------------------- Detailed setup -------------------------------- */

async function detailedRerun(page) {
  const count = counter("[detailed] Detailed setup (re-run)")
  await step(page, "[detailed] /onboarding offers the Detailed setup on a finished workspace", async () => {
    await go(page, "/onboarding")
    const db = await workspace(page)
    const lang = db.brand_profiles[0].language === "english" ? "english" : "taglish"
    const button = page.getByRole("button", { name: RUN[lang].detailed })
    await button.waitFor({ timeout: 30000 })
    await shot(page, "detailed-00-already-set-up")
    await tap(button)
    await page.locator("#ob-lang-english").waitFor({ timeout: 30000 })
    await count.screen(page)
    return lang
  })

  await step(page, "[detailed] every step, pre-filled from Brand HQ; voice needs a personality", async () => {
    let i = 1
    for (;;) {
      const h = await heading(page)
      await shot(page, `detailed-${String(i).padStart(2, "0")}`)
      if (await page.locator("#ob-personality").count()) {
        const traits = page.locator('[aria-label="Personality"]')
        for (const trait of ["Direct", "Practical"]) await tap(traits.locator("button", { hasText: exact(trait) }).first())
      }
      if (await page.locator("#ob-ideas-title").count()) break
      await advance(page, count)
      if ((await heading(page)) === h) throw new Error(`stuck on “${h}”`)
      if (await page.locator("#ob-pillars").count()) {
        // The next Continue is "Generate my strategy": wait for the ideas.
        await advance(page, count)
        await page.locator("#ob-ideas-title").waitFor({ timeout: 90000 })
      }
      i++
      if (i > 14) throw new Error("the detailed setup never reached the strategy step")
    }
    return `${i} screens walked`
  })

  await step(page, "[detailed] finish setup lands on \"/\" with everything stored", async () => {
    await count.submitted(page)
    await submit(page).click()
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 60000 })
    await settle(page, 1200)
    const db = await workspace(page)
    const detail = checkWorkspace(db, { lang: db.brand_profiles[0].language })
    expect(db.brand_profiles[0].personality_traits.length >= 1, "the Detailed setup didn't save the personality")
    return `${detail} — ${count.report()}`
  })
}

/* ---------------------------------- Run ----------------------------------- */

if (SEED === "none") {
  for (const lang of LANGS) {
    const { context, page } = await firstRun(lang)
    if (lang === "english") {
      await nicheRerun(page)
      await detailedRerun(page)
    }
    await context.close()
  }
  await shortcutRun(LANGS[LANGS.length - 1])
} else {
  const { context, page } = await newPage()
  await go(page, "/")
  await nicheRerun(page)
  await detailedRerun(page)
  await context.close()
}

await browser.close()
if (errors.length) {
  console.log(`✗ page errors during the flow: ${JSON.stringify(errors.slice(0, 8))}`)
  process.exit(1)
}
console.log("\nScreens and required fields per pass:")
for (const line of summary) console.log(`  ${line}`)
console.log("✓ onboarding flow complete — no page errors")
