import { describe, expect, it } from "vitest"
import type { AiTaskOutput, NicheDiscoveryOutput } from "@/lib/ai"
import { discoverNiches } from "@/lib/ai/offline/niche"
import { offlineProvider } from "@/lib/ai/providers/offline"
import { executeAiTask } from "@/lib/ai/server"
import { nicheDiscoveryTask } from "@/lib/ai/tasks/niche-discovery"
import { onboardingStrategyTask } from "@/lib/ai/tasks/onboarding-strategy"
import { CATEGORICAL_COLORS, PLATFORM_IDS } from "@/lib/constants"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import { useDataStore } from "@/lib/store"
import { applyOnboardingPlan } from "./apply-onboarding"
import { COPY } from "./copy"
import { EN } from "./copy-en"
import { TL } from "./copy-tl"
import { applyNicheOption, clarityChecks, nicheInput, nicheKey, pillarsFromOption, pillarsMatchOption, problemSuggestions, startOwnNiche, writtenNicheInput } from "./niche-model"
import { createDraft, parseDraft, serializeDraft } from "./onboarding-draft"
import { assignPillars, effectivePillars, goalForIdea, matchProblem, toIdeaDrafts, type IdeaDraft } from "./onboarding-ideas"
import {
  answersFromWorkspace,
  countedSteps,
  distributeTotal,
  emptyAnswers,
  evenPillars,
  firstInvalidStep,
  flowFor,
  FULL_FLOW,
  goalsFromAims,
  largestRemainder,
  NICHE_FLOW,
  parsePositioning,
  pillarColors,
  pillarTotal,
  presetPillars,
  QUICK_FLOW,
  rebalancePillars,
  recommendedSchedule,
  sanitizeAnswers,
  selectedPillars,
  stepNumber,
  strategyInput,
  strategyKey,
  validateStep,
  weeklyTotal,
  type OnboardingAnswers,
} from "./onboarding-model"
import { planNicheUpdate, planOnboarding, planStarterLibrary, storyTitle } from "./onboarding-plan"
import { bestMatchIndex, canSuggestNiches, optionForWrittenNiche, quickSetupAnswers, rankedOptions, roleFor, type QuickAnswers } from "./quick-setup"

const NOW = new Date(2026, 8, 13, 10, 0, 0)
const USER = "00000000-0000-4000-8000-000000000001"
const total = (values: number[]) => values.reduce((a, b) => a + b, 0)

function filledAnswers(): OnboardingAnswers {
  return {
    ...emptyAnswers(),
    interests: ["Personal finance", "Ipon & budgeting", "Travel"],
    expertise_areas: ["Bookkeeping", "BIR & taxes"],
    help_requests: "How to register with BIR as a freelancer",
    years_experience: 6,
    proof: "Helped 40+ freelancers register with BIR",
    story: "In 2022 I almost paid a ₱20,000 penalty because I missed a deadline. Now I track every filing in one sheet.",
    audiences: ["Freelancers"],
    persona_profession: "First year freelancing",
    persona_experience: "Beginner",
    audience_goal: "File taxes with confidence",
    persona_problems: ["Doesn't know how to file taxes with BIR", "No savings even with good income", "Afraid of tax penalties"],
    persona_platforms: ["facebook", "tiktok"],
    aims: ["clients", "products"],
    primary_goal: "leads",
    secondary_goal: "business",
    niche: "Taxes and bookkeeping made simple for new Filipino freelancers",
    audience: "new freelancers",
    result: "file taxes with confidence",
    method: "simple bookkeeping systems",
    name: "Mika Reyes",
    role: "Freelance bookkeeper",
    industry: "Accounting & taxes",
    location: "Quezon City",
    platforms: ["facebook", "tiktok", "linkedin"],
    split: { facebook: 3, tiktok: 3, linkedin: 2 },
    tones: ["conversational", "educational"],
    personality: ["direct", "practical"],
  }
}

function idea(over: Partial<IdeaDraft> = {}): IdeaDraft {
  return {
    title: "Why new freelancers are afraid of tax penalties",
    core_idea: "Most penalties come from one missed deadline.",
    why_it_matters: "The top fear your persona named.",
    hook: "One missed deadline cost me ₱20,000.",
    hook_category: "story",
    format: "Short-form Video",
    angle: "Problem",
    talking_points: ["The deadline most people miss", "The one sheet that fixes it"],
    cta: "Comment TAX",
    platform: "tiktok",
    funnel_stage: "tofu",
    pillar_id: null,
    persona_id: null,
    problem_id: null,
    key: "idea-0",
    selected: true,
    ...over,
  }
}

describe("onboarding model", () => {
  it("splits totals with largest remainder and a minimum", () => {
    expect(largestRemainder([30, 20, 20, 15, 10, 5], 100, 1)).toEqual([30, 20, 20, 15, 10, 5])
    const even = largestRemainder([1, 1, 1], 100, 1)
    expect(total(even)).toBe(100)
    expect(Math.min(...even)).toBeGreaterThanOrEqual(33)
  })

  it("rebalances pillar targets to exactly 100", () => {
    const pillars = presetPillars()
    pillars[5] = { ...pillars[5], selected: false }
    expect(pillarTotal(pillars)).toBe(95)
    const fixed = rebalancePillars(pillars)
    expect(pillarTotal(fixed)).toBe(100)
    expect(fixed.filter((p) => p.selected).every((p) => p.target >= 1)).toBe(true)
    expect(pillarTotal(evenPillars(pillars))).toBe(100)
  })

  it("keeps existing pillar colours and fills new ones in categorical order", () => {
    const colors = pillarColors(presetPillars(), [])
    expect([...colors.values()]).toEqual(CATEGORICAL_COLORS.slice(0, 6))
    const kept = pillarColors(presetPillars(), [{ name: "education", color: "violet" }])
    expect(kept.get("preset:Education")).toBe("violet")
    expect(new Set(kept.values()).size).toBe(6)
  })

  it("keeps the weekly target equal to the platform split", () => {
    const answers = { platforms: ["facebook", "tiktok", "linkedin"] as ("facebook" | "tiktok" | "linkedin")[], split: {} }
    expect(weeklyTotal(answers)).toBe(7) // starter frequencies: FB 3 + TikTok 2 + LinkedIn 2
    const split = distributeTotal(12, answers)
    expect(total(Object.values(split) as number[])).toBe(12)
    expect(total(Object.values(distributeTotal(1, answers)) as number[])).toBe(3)
  })

  it("adapts the recommended schedule to the chosen platforms", () => {
    for (const platforms of [["linkedin"], ["youtube", "x"], ["facebook", "instagram"]] as const) {
      const days = recommendedSchedule([...platforms])
      expect(days).toHaveLength(7)
      for (const day of days) {
        expect(day.platforms.length).toBeGreaterThan(0)
        for (const p of day.platforms) expect(platforms).toContain(p)
      }
    }
  })

  it("runs Quick setup on a first run, the detailed setup on a re-run and screens 2–4 for Niche Discovery", () => {
    expect(flowFor("first")).toBe(QUICK_FLOW)
    expect(QUICK_FLOW).toEqual(["start", "about", "who", "pick"])
    expect(countedSteps(QUICK_FLOW)).toHaveLength(4)
    expect(QUICK_FLOW.map((_, i) => stepNumber(QUICK_FLOW, i))).toEqual([1, 2, 3, 4])
    expect(flowFor("niche")).toBe(NICHE_FLOW)
    expect(NICHE_FLOW).toEqual(QUICK_FLOW.slice(1))
    // The detailed setup keeps Niche Discovery first; its welcome screen isn't counted.
    expect(flowFor("rerun")).toBe(FULL_FLOW)
    expect(FULL_FLOW.slice(0, 6)).toEqual(["welcome", "hilig", "galing", "kanino", "para_saan", "niche"])
    expect(stepNumber(FULL_FLOW, 0)).toBe(0)
    expect(stepNumber(FULL_FLOW, 1)).toBe(1)
    expect(stepNumber(FULL_FLOW, FULL_FLOW.length - 1)).toBe(10)
  })

  it("validates each step in English and Taglish", () => {
    const blank = emptyAnswers()
    expect(validateStep("hilig", blank).interests).toBe(EN.errors.interests)
    expect(validateStep("hilig", blank, TL.errors).interests).toBe(TL.errors.interests)
    expect(validateStep("hilig", { ...blank, interests: ["Coffee", "Travel"] })).toEqual({})
    expect(Object.keys(validateStep("kanino", blank)).sort()).toEqual(["audiences", "persona_problems"])
    expect(validateStep("para_saan", blank).aims).toBeTruthy()
    expect(validateStep("niche", blank).niche).toBeTruthy()
    expect(Object.keys(validateStep("identity", blank)).sort()).toEqual(["industry", "name", "role"])
    expect(firstInvalidStep(filledAnswers())).toBe(-1)
    expect(firstInvalidStep({ ...filledAnswers(), own_niche: true }, NICHE_FLOW, NICHE_FLOW.length)).toBe(-1)
    const pillars = filledAnswers()
    pillars.pillars[0] = { ...pillars.pillars[0], target: 40 }
    expect(validateStep("pillars", pillars).pillars).toMatch(/110%/)
  })

  it("maps aims to goals and keeps a primary that still applies", () => {
    expect(goalsFromAims(["clients", "products"], { primary_goal: null })).toEqual({ primary_goal: "leads", secondary_goal: "business" })
    expect(goalsFromAims(["clients", "products"], { primary_goal: "business" })).toEqual({ primary_goal: "business", secondary_goal: "leads" })
    expect(goalsFromAims(["career", "speaking"], { primary_goal: null })).toEqual({ primary_goal: "authority", secondary_goal: null })
    expect(goalsFromAims([], { primary_goal: "leads" })).toEqual({ primary_goal: null, secondary_goal: null })
  })

  it("builds AI requests the tasks accept, in both languages", () => {
    const a = filledAnswers()
    a.name = "x".repeat(500)
    a.expertise_areas = Array.from({ length: 20 }, (_, i) => `Area ${i}`)
    const strategy = strategyInput(a)
    expect(onboardingStrategyTask.input.safeParse(strategy).success).toBe(true)
    expect(strategy.goals).toEqual(["leads", "business"])
    expect(strategy.niche).toBe(a.niche)
    expect(strategy.pillars?.map((p) => p.name)).toEqual(selectedPillars(a).map((p) => p.name))
    for (const lang of ["english", "taglish"] as const) expect(nicheDiscoveryTask.input.safeParse(nicheInput(a, lang)).success).toBe(true)
    expect(nicheKey(a, "english")).not.toBe(nicheKey(a, "taglish"))
    // Identity comes after the niche step, so it never makes niche suggestions stale.
    expect(nicheKey({ ...a, name: "Someone else", role: "CEO" }, "english")).toBe(nicheKey(a, "english"))
    // Pillar targets don't make a strategy stale; pillar names do.
    const retargeted = { ...a, pillars: rebalancePillars(a.pillars.map((p, i) => (i === 0 ? { ...p, target: p.target + 5 } : p))) }
    expect(strategyKey(retargeted)).toBe(strategyKey(a))
    expect(strategyKey({ ...a, pillars: a.pillars.map((p, i) => (i === 0 ? { ...p, name: "Money habits" } : p)) })).not.toBe(strategyKey(a))
  })

  it("parses a positioning statement back into its parts", () => {
    expect(parsePositioning("I help first-time founders grow profitably through simple ad systems.", "first-time founders")).toEqual({
      audience: "first-time founders",
      result: "grow profitably",
      method: "simple ad systems",
    })
    expect(parsePositioning("Helping founders grow.", "founders")).toBeNull()
  })

  it("restores drafts defensively", () => {
    expect(sanitizeAnswers(null)).toEqual(emptyAnswers())
    const restored = sanitizeAnswers({ name: 5, platforms: ["facebook", "myspace"], tones: ["casual", "loud"], language: "klingon", aims: ["clients", "fame"], niche_option: { kind: "nope" } })
    expect(restored.name).toBe("")
    expect(restored.platforms).toEqual(["facebook"])
    expect(restored.tones).toEqual(["casual"])
    expect(restored.language).toBe("english")
    expect(restored.aims).toEqual(["clients"])
    expect(restored.niche_option).toBeNull()
    const withOption = { ...filledAnswers(), niche_option: discoverNiches(nicheDiscoveryTask.input.parse(nicheInput(filledAnswers(), "english"))).options[0] }
    expect(sanitizeAnswers(JSON.parse(JSON.stringify(withOption)))).toEqual(withOption)
  })

  it("prefills a re-run (and Niche Discovery) from the workspace", () => {
    const demo = createDemoDatabase(USER, NOW)
    const a = answersFromWorkspace(demo, { rerun: true })
    const brand = demo.brand_profiles[0]
    expect(a.name).toBe(brand.name)
    expect(a.niche).toBe(brand.niche)
    expect(a.interests).toEqual(brand.interests)
    expect(a.pillars.filter((p) => p.selected).length).toBe(demo.content_pillars.filter((p) => p.is_active).length)
    expect(a.audiences[0]).toBe(a.persona_name)
    expect(a.primary_goal).not.toBeNull()
    expect(a.aims.length).toBeGreaterThan(0)
    expect(a.schedule_mode).toBe("custom")
    expect(firstInvalidStep(a, NICHE_FLOW, NICHE_FLOW.length)).toBe(-1)
  })
})

describe("niche discovery model", () => {
  const options = discoverNiches(nicheDiscoveryTask.input.parse(nicheInput(filledAnswers(), "english"))).options

  it("applies a chosen direction: niche, fit, positioning — pillars only when asked", () => {
    const a = { ...filledAnswers(), niche: "", known_for: "", industry: "" }
    const option = options[0]
    const kept = { ...a, ...applyNicheOption(a, option, { replacePillars: false, copy: EN }) }
    expect(kept.niche).toBe(option.niche_statement)
    expect(kept.known_for).toBe(option.niche_statement)
    expect(kept.industry).toBe(option.industry)
    expect(kept.audience).toBe(option.positioning_audience)
    expect(kept.niche_fit).toMatch(/Passion \d+\/10 — .+ Expertise \d+\/10 — .+ Demand \d+\/10/)
    expect(kept.pillars).toEqual(a.pillars)
    const replaced = { ...a, ...applyNicheOption(a, option, { replacePillars: true, copy: TL }) }
    expect(replaced.niche_fit).toMatch(/^Hilig \d+\/10/)
    expect(selectedPillars(replaced).map((p) => p.name)).toEqual(option.pillars.map((p) => p.name))
    expect(pillarTotal(replaced.pillars)).toBe(100)
    expect(pillarsMatchOption(replaced, option)).toBe(true)
    // Presets stay available, unselected; switching direction doesn't pile up old niche pillars.
    expect(replaced.pillars.some((p) => p.preset && !p.selected)).toBe(true)
    const switched = pillarsFromOption(options[1], replaced.pillars)
    expect(switched.filter((p) => p.key.startsWith("niche:")).map((p) => p.name)).toEqual(options[1].pillars.map((p) => p.name))
    // A known-for the creator wrote stays.
    const custom = { ...a, known_for: "My own words" }
    expect(applyNicheOption(custom, option, { replacePillars: false, copy: EN }).known_for).toBeUndefined()
  })

  it("starts an own niche from the Kanino answers", () => {
    const a = { ...filledAnswers(), audience: "", result: "", niche_option: options[0] }
    expect(startOwnNiche(a, EN)).toMatchObject({ niche_option: null, audience: "freelancers", result: "File taxes with confidence" })
  })

  it("clarity check: passes strong answers, flags thin ones with where to fix them", () => {
    const strong = { ...filledAnswers(), niche_option: options[2] }
    expect(clarityChecks(strong).every((c) => c.ok)).toBe(true)
    const weak = { ...filledAnswers(), niche: "Money; taxes; life", audience: "everyone", persona_problems: ["Taxes"], aims: [], interests: [], expertise_areas: [] }
    const checks = Object.fromEntries(clarityChecks(weak).map((c) => [c.key, c]))
    expect(checks.sentence.ok).toBe(false)
    expect(checks.audience.ok).toBe(false)
    expect(checks.problems).toMatchObject({ ok: false, count: 0, fix: { step: "kanino" } })
    expect(checks.range.ok).toBe(false)
    expect(checks.money).toMatchObject({ ok: false, fix: { step: "para_saan" } })
  })
})

describe("idea matching", () => {
  const pillars = [
    { name: "Education", description: "Teach", examples: [], target: 50 },
    { name: "Personal", description: "Stories", examples: [], target: 50 },
  ]

  it("prefers relevant pillars and spreads the rest by target", () => {
    const tutorials = Array.from({ length: 10 }, (_, i) => idea({ key: `t${i}`, angle: "Tutorial", title: `Tutorial ${i}` }))
    expect(new Set(assignPillars(tutorials, pillars))).toEqual(new Set(["Education"]))
    const neutral = Array.from({ length: 10 }, (_, i) => idea({ key: `n${i}`, angle: "", title: `Qwerty ${i}`, core_idea: "", hook: "", talking_points: [] }))
    const counts = assignPillars(neutral, pillars).reduce<Record<string, number>>((acc, name) => ({ ...acc, [name ?? ""]: (acc[name ?? ""] ?? 0) + 1 }), {})
    expect(counts).toEqual({ Education: 5, Personal: 5 })
  })

  it("links problems and goals", () => {
    expect(matchProblem(idea(), ["No savings even with good income", "Afraid of tax penalties"])).toBe(1)
    expect(matchProblem(idea({ title: "Morning routine", core_idea: "", hook: "", why_it_matters: "", talking_points: [] }), ["Afraid of tax penalties"])).toBe(-1)
    expect(goalForIdea("bofu", ["authority", "leads"])).toBe("leads")
    expect(goalForIdea("tofu", ["leads"])).toBe("leads")
  })

  it("titles stories from their first clause", () => {
    expect(storyTitle("In 2022 we almost closed our first store because sales dropped. Then…")).toBe("In 2022 we almost closed our first store")
  })
})

describe("onboarding plan", () => {
  it("fills a missing Starter Kit library and remaps its references", () => {
    const empty = emptyDatabase()
    empty.brand_profiles = [buildRow("brand_profiles", {}, USER, NOW)]
    empty.app_settings = [buildRow("app_settings", {}, USER, NOW)]
    const starter = createStarterDatabase(USER, NOW)
    const { inserts, count } = planStarterLibrary(empty, { now: NOW })
    for (const table of ["content_goals", "content_formats", "angles", "hooks", "tags", "content_platforms"] as const) {
      expect(inserts[table] ?? []).toHaveLength(starter[table].length)
    }
    expect(count).toBeGreaterThan(50)
    const goalIds = new Set((inserts.content_goals ?? []).map((g) => g.id))
    const formatIds = new Set((inserts.content_formats ?? []).map((f) => f.id))
    for (const platform of inserts.content_platforms ?? []) {
      expect(goalIds.has(platform.primary_goal_id ?? "")).toBe(true)
      for (const id of platform.preferred_format_ids ?? []) expect(formatIds.has(id)).toBe(true)
    }
    expect(planStarterLibrary(starter, { now: NOW }).count).toBe(0)
    expect(planStarterLibrary(createDemoDatabase(USER, NOW), { now: NOW }).count).toBe(0)
  })

  it("plans a first run on a fresh starter workspace, niche fields included", () => {
    const db = createStarterDatabase(USER, NOW)
    const a = filledAnswers()
    const ideas = [
      { idea: idea(), title: "Why new freelancers are afraid of tax penalties", pillar: "Education" },
      { idea: idea({ key: "idea-1", funnel_stage: "bofu", angle: "Case Study", format: "LinkedIn Post", platform: "linkedin" }), title: "How one sheet saved a client ₱20,000", pillar: "Business" },
    ]
    const plan = planOnboarding(db, { answers: a, ideas, now: NOW })
    const goal = (category: string) => db.content_goals.find((g) => g.category === category)!

    expect(plan.summary.libraryRows).toBe(0)
    expect(plan.inserts.content_goals ?? []).toHaveLength(0)
    expect((plan.updates.content_goals ?? []).map((u) => u.id).sort()).toEqual([goal("leads").id, goal("business").id].sort())
    expect(plan.brand).toMatchObject({
      onboarding_completed: true,
      primary_goal_id: goal("leads").id,
      secondary_goal_id: goal("business").id,
      niche: a.niche,
      interests: a.interests,
      known_for: a.niche,
      why_listen: a.proof,
      expertise_summary: a.help_requests,
      expertise_areas: a.expertise_areas,
      positioning_audience: "new freelancers",
    })
    expect(plan.brand.problems_solved).toBe(a.persona_problems.join("; "))
    expect(plan.brand.who_am_i).toMatch(/^I'm Mika Reyes — Freelance bookkeeper\./)

    const pillars = plan.inserts.content_pillars ?? []
    expect(pillars.map((p) => p.color)).toEqual(CATEGORICAL_COLORS.slice(0, 6))
    expect(total(pillars.map((p) => p.target_percentage ?? 0))).toBe(100)

    const persona = plan.inserts.audience_personas?.[0]
    expect(persona).toMatchObject({ name: "Freelancers", is_primary: true, goals: ["File taxes with confidence"], profession: "First year freelancing" })
    const problems = plan.inserts.audience_problems ?? []
    expect(problems).toHaveLength(3)
    expect(problems.every((p) => p.persona_id === persona?.id && p.category === "beginner")).toBe(true)

    expect(plan.inserts.content_calendar ?? []).toHaveLength(0)
    const slots = plan.updates.content_calendar ?? []
    expect(slots).toHaveLength(7)
    for (const slot of slots) for (const p of slot.patch.platforms ?? []) expect(a.platforms).toContain(p)

    const platforms = plan.updates.content_platforms ?? []
    const off = platforms.filter((u) => u.patch.is_active === false).map((u) => db.content_platforms.find((p) => p.id === u.id)?.platform)
    expect(off.sort()).toEqual(["instagram", "youtube"])
    expect(plan.settings.weekly_post_target).toBe(8)

    const created = plan.inserts.content_ideas ?? []
    expect(created).toHaveLength(2)
    expect(created.every((i) => i.source === "onboarding" && i.persona_id === persona?.id)).toBe(true)
    expect(created[0].problem_id).toBe(problems[2].id)
    expect(created[0].pillar_id).toBe(pillars.find((p) => p.name === "Education")?.id)
    expect(created[1].goal_id).toBe(goal("leads").id)
    expect(plan.inserts.stories ?? []).toHaveLength(1)
    expect(plan.summary.niche).toBe(a.niche)
  })

  it("inserts everything for an empty (new Supabase user) workspace", () => {
    const empty = emptyDatabase()
    empty.brand_profiles = [buildRow("brand_profiles", {}, USER, NOW)]
    empty.app_settings = [buildRow("app_settings", {}, USER, NOW)]
    const plan = planOnboarding(empty, { answers: filledAnswers(), ideas: [], now: NOW })
    const goals = plan.inserts.content_goals ?? []
    expect(goals).toHaveLength(5)
    expect(goals.find((g) => g.id === plan.brand.primary_goal_id)?.category).toBe("leads")
    expect(plan.inserts.content_calendar ?? []).toHaveLength(7)
    const platforms = plan.inserts.content_platforms ?? []
    expect(platforms.map((p) => p.platform).sort()).toEqual([...PLATFORM_IDS].sort())
    expect(platforms.filter((p) => p.is_active).map((p) => p.platform).sort()).toEqual(["facebook", "linkedin", "tiktok"])
  })

  it("updates instead of duplicating when setup is re-run", () => {
    const demo = createDemoDatabase(USER, NOW)
    const answers = answersFromWorkspace(demo, { rerun: true })
    const existingTitle = demo.content_ideas[0].title
    const plan = planOnboarding(demo, { answers, ideas: [{ idea: idea(), title: existingTitle, pillar: null }], now: NOW })
    expect(plan.summary.libraryRows).toBe(0)
    expect(plan.inserts.content_pillars ?? []).toHaveLength(0)
    expect(plan.inserts.audience_personas ?? []).toHaveLength(0)
    expect(plan.inserts.content_goals ?? []).toHaveLength(0)
    expect(plan.inserts.audience_problems ?? []).toHaveLength(0)
    expect(plan.inserts.content_ideas ?? []).toHaveLength(0)
    expect(plan.summary.ideasSkipped).toBe(1)
    expect(plan.brand.who_am_i).toBeUndefined()
  })

  it("re-runs only Niche Discovery: niche and persona update, pillars only when confirmed", () => {
    const demo = createDemoDatabase(USER, NOW)
    const base = answersFromWorkspace(demo, { rerun: true })
    const option = discoverNiches(nicheDiscoveryTask.input.parse(nicheInput(base, "english"))).options[0]
    const answers = { ...base, ...applyNicheOption(base, option, { replacePillars: false, copy: EN }) }

    const keep = planNicheUpdate(demo, { answers, replacePillars: false, now: NOW })
    expect(keep.brand).toMatchObject({ niche: option.niche_statement, positioning_audience: option.positioning_audience })
    expect(keep.brand.niche_fit).toContain("/10")
    expect(keep.brand.onboarding_completed).toBeUndefined()
    expect(keep.settings).toEqual({})
    for (const table of ["content_pillars", "content_platforms", "content_calendar", "content_ideas", "audience_personas"] as const) {
      expect(keep.inserts[table] ?? []).toHaveLength(0)
    }
    expect(keep.updates.content_pillars ?? []).toHaveLength(0)
    expect(keep.updates.content_platforms ?? []).toHaveLength(0)
    expect(keep.updates.content_calendar ?? []).toHaveLength(0)

    const replaced = planNicheUpdate(demo, { answers: { ...answers, pillars: pillarsFromOption(option, answers.pillars) }, replacePillars: true, now: NOW })
    const added = replaced.inserts.content_pillars ?? []
    expect(added.map((p) => p.name)).toEqual(option.pillars.map((p) => p.name))
    expect(total(added.map((p) => p.target_percentage ?? 0))).toBe(100)
    expect(replaced.summary.pillarsArchived).toBe(demo.content_pillars.filter((p) => p.is_active).length)
    expect((replaced.updates.content_pillars ?? []).every((u) => u.patch.is_active === false)).toBe(true)
  })

  it("applies through the store without duplicates on a second run", () => {
    useDataStore.setState({ db: createStarterDatabase(USER, NOW), status: "ready", userId: USER, adapter: null })
    const answers = filledAnswers()
    const ideas = [{ idea: idea(), title: "Why new freelancers are afraid of tax penalties", pillar: "Education" }]
    applyOnboardingPlan(planOnboarding(useDataStore.getState().db, { answers, ideas, now: NOW }))
    let db = useDataStore.getState().db
    expect(db.brand_profiles[0]).toMatchObject({ onboarding_completed: true, niche: answers.niche, interests: answers.interests })
    expect(db.content_pillars).toHaveLength(6)
    expect(db.audience_personas).toHaveLength(1)
    expect(db.content_ideas.filter((i) => i.source === "onboarding")).toHaveLength(1)
    expect(db.content_calendar).toHaveLength(7)
    expect(db.app_settings[0].weekly_post_target).toBe(8)

    applyOnboardingPlan(planOnboarding(db, { answers, ideas, now: NOW }))
    applyOnboardingPlan(planNicheUpdate(useDataStore.getState().db, { answers: { ...answers, niche: "Bookkeeping for new freelancers" }, replacePillars: false, now: NOW }))
    db = useDataStore.getState().db
    expect(db.brand_profiles[0].niche).toBe("Bookkeeping for new freelancers")
    expect(db.content_pillars).toHaveLength(6)
    expect(db.audience_personas).toHaveLength(1)
    expect(db.audience_problems).toHaveLength(3)
    expect(db.content_goals).toHaveLength(5)
    expect(db.content_ideas.filter((i) => i.source === "onboarding")).toHaveLength(1)
    expect(db.stories).toHaveLength(1)
  })
})

describe("first run end to end (offline engine)", () => {
  it.each(["english", "taglish"] as const)("%s: niche → pillars → 30 niche-aligned ideas → workspace plan", async (lang) => {
    const a: OnboardingAnswers = { ...filledAnswers(), language: lang, niche: "", audience: "", result: "", method: "", known_for: "", industry: "" }
    const niche = await executeAiTask({ task: "niche_discovery", input: nicheInput(a, lang), context: {} }, { provider: offlineProvider })
    const option = (niche.output as NicheDiscoveryOutput).options[2]
    const chosen: OnboardingAnswers = { ...a, ...applyNicheOption(a, option, { replacePillars: true, copy: COPY[lang] }) }
    expect(pillarTotal(chosen.pillars)).toBe(100)
    expect(firstInvalidStep(chosen)).toBe(-1)

    const res = await executeAiTask({ task: "onboarding_strategy", input: strategyInput(chosen), context: {} }, { provider: offlineProvider })
    const out = res.output as AiTaskOutput<"onboarding_strategy">
    expect(out.pillar_suggestions.map((p) => p.name)).toEqual(selectedPillars(chosen).map((p) => p.name))
    expect(out.ideas).toHaveLength(30)

    const drafts = toIdeaDrafts(out.ideas)
    const names = effectivePillars(
      drafts,
      selectedPillars(chosen).map((p) => ({ name: p.name, description: p.description, examples: p.examples, target: p.target }))
    )
    const plan = planOnboarding(createStarterDatabase(USER, NOW), { answers: chosen, ideas: drafts.map((d, i) => ({ idea: d, title: d.title, pillar: names[i] })), now: NOW })
    expect(plan.summary.ideas).toBeGreaterThanOrEqual(25)
    expect(plan.brand).toMatchObject({ niche: option.niche_statement, onboarding_completed: true, language: lang })
    expect(plan.inserts.content_pillars?.map((p) => p.name)).toEqual(option.pillars.map((p) => p.name))
  })
})

describe("quick setup", () => {
  const quick = (over: Partial<QuickAnswers> = {}): QuickAnswers => ({
    name: "Mika Reyes",
    platforms: ["tiktok", "facebook"],
    interests: ["Personal finance", "Ipon & budgeting"],
    expertise_areas: [],
    audiences: ["Freelancers"],
    persona_problems: [],
    aims: [],
    ...over,
  })
  const answersOf = (q: QuickAnswers): OnboardingAnswers => ({ ...emptyAnswers(), ...q })
  const discover = (a: OnboardingAnswers, lang: "english" | "taglish" = "english") =>
    discoverNiches(nicheDiscoveryTask.input.parse(nicheInput(a, lang))).options

  it("blocks each screen only on its required fields", () => {
    const blank = emptyAnswers()
    expect(Object.keys(validateStep("start", blank)).sort()).toEqual(["name", "platforms"])
    expect(Object.keys(validateStep("about", blank))).toEqual(["interests"])
    expect(Object.keys(validateStep("who", blank))).toEqual(["audiences"])
    expect(validateStep("pick", blank).niche).toBe(EN.errors.pickNiche)
    expect(validateStep("pick", blank, TL.errors).niche).toBe(TL.errors.pickNiche)

    // Skills, the #1 problem and aims are optional.
    const a = answersOf(quick())
    for (const key of ["start", "about", "who"] as const) expect(validateStep(key, a)).toEqual({})
    expect(validateStep("about", { ...a, interests: ["Coffee"] }).interests).toBe(EN.errors.interests)
    const option = discover(a)[0]
    expect(validateStep("pick", { ...a, ...applyNicheOption(a, option, { replacePillars: true, copy: EN }) })).toEqual({})

    // Writing your own niche: only the sentence is needed, and screens 2–3 become optional.
    const own = { ...emptyAnswers(), name: "Mika", platforms: ["facebook" as const], own_niche: true }
    expect(validateStep("pick", own).niche).toBe(EN.errors.ownNiche)
    expect(firstInvalidStep({ ...own, niche: "Budget meal prep for busy nurses" }, QUICK_FLOW, QUICK_FLOW.length)).toBe(-1)
    expect(firstInvalidStep(own, QUICK_FLOW, QUICK_FLOW.length)).toBe(3)
    expect(canSuggestNiches(own)).toBe(false)
    expect(canSuggestNiches(a)).toBe(true)
  })

  it("fills in everything from four screens: identity, schedule, pillars, persona, goals — no invented voice", () => {
    const a = answersOf(quick({ persona_problems: ["Doesn't know how to file taxes"] }))
    const options = discover(a)
    const option = options[bestMatchIndex(options)]
    const full = quickSetupAnswers(a, { option }, "english")

    expect(full).toMatchObject({ name: "Mika Reyes", role: roleFor(option.industry), industry: option.industry, location: "", language: "english" })
    expect(full.role).toMatch(/ creator$/)
    expect(full.niche).toBe(option.niche_statement)
    expect(full.niche_option).toEqual(option)
    expect(full.niche_fit).toMatch(/Passion \d+\/10/)
    expect({ audience: full.audience, result: full.result, method: full.method }).toEqual({
      audience: option.positioning_audience,
      result: option.positioning_result,
      method: option.positioning_method,
    })
    // Recommended weekly strategy for the chosen platforms.
    expect(full.platforms).toEqual(["facebook", "tiktok"])
    expect(full.schedule_mode).toBe("recommended")
    expect(weeklyTotal(full)).toBe(5)
    // Pillars from the chosen direction, totalling 100.
    expect(selectedPillars(full).map((p) => p.name)).toEqual(option.pillars.map((p) => p.name))
    expect(pillarTotal(full.pillars)).toBe(100)
    // No aims picked → build an audience (awareness), with no target.
    expect(full.aims).toEqual(["audience"])
    expect(full).toMatchObject({ primary_goal: "awareness", secondary_goal: null, goal_targets: { awareness: { value: null, period: "monthly" } } })
    // Voice is the creator's call.
    expect(full.tones).toEqual([])
    expect(full.personality).toEqual([])

    const plan = planOnboarding(createStarterDatabase(USER, NOW), { answers: full, ideas: [], lang: "english", now: NOW })
    expect(plan.brand).toMatchObject({ onboarding_completed: true, name: "Mika Reyes", tones: [], personality_traits: [], language: "english", niche: option.niche_statement })
    expect(plan.inserts.audience_personas?.[0]).toMatchObject({ name: "Freelancers", is_primary: true, platforms: ["facebook", "tiktok"] })
    expect(plan.inserts.audience_problems?.map((p) => p.problem)).toEqual(["Doesn't know how to file taxes"])
    const awareness = plan.updates.content_goals?.find((u) => u.patch.target_value === null)
    expect(awareness).toBeTruthy()
    expect(plan.summary).toMatchObject({ goals: 1, slots: 7, weeklyTarget: 5, pillars: option.pillars.length })

    // Aims map to goals when picked; Taglish sets the brand language and fit labels.
    const picked = quickSetupAnswers({ ...a, aims: ["clients", "products"] }, { option }, "taglish")
    expect(picked).toMatchObject({ primary_goal: "leads", secondary_goal: "business", language: "taglish" })
    expect(picked.niche_fit).toMatch(/^Hilig \d+\/10/)
  })

  it("ranks the best match first", () => {
    const options = discover(answersOf(quick({ expertise_areas: ["Bookkeeping"] })))
    const best = bestMatchIndex(options)
    const total = (i: number) => options[i].fit.passion.score + options[i].fit.expertise.score + options[i].fit.demand.score
    expect(options.every((_, i) => total(i) <= total(best))).toBe(true)
    expect(rankedOptions(options)[0]).toBe(options[best])
    expect(new Set(rankedOptions(options))).toEqual(new Set(options))
  })

  it.each(["english", "taglish"] as const)("%s: a written niche alone builds pillars, a persona and 30 ideas", async (lang) => {
    const written = lang === "english" ? "Budget meal prep for busy nurses who work nights" : "Budget meal prep para sa mga nurse na pagod sa night shift"
    const q = quick({ interests: [], audiences: [] })
    const a = { ...answersOf(q), own_niche: true, niche: written }
    expect(firstInvalidStep(a, QUICK_FLOW, QUICK_FLOW.length)).toBe(-1)

    const res = await executeAiTask({ task: "niche_discovery", input: writtenNicheInput(a, lang, written), context: {} }, { provider: offlineProvider })
    const options = (res.output as NicheDiscoveryOutput).options
    const option = optionForWrittenNiche(options, written)!
    expect(option).toBeTruthy()
    const full = quickSetupAnswers(q, { option, written }, lang)
    expect(full).toMatchObject({ niche: written, own_niche: true, niche_option: null, language: lang, known_for: written })
    expect(pillarTotal(full.pillars)).toBe(100)
    const pillars = selectedPillars(full).map((p) => p.name)
    expect(pillars.length).toBeGreaterThanOrEqual(4)
    expect(pillars.some((p) => /^(Education|Authority|Journey|Leadership|Personal|Business)$/.test(p))).toBe(false)
    // The niche names its audience: that's the persona.
    expect(full.audience.toLowerCase()).toContain("nurse")

    const strategy = await executeAiTask({ task: "onboarding_strategy", input: strategyInput(full), context: {} }, { provider: offlineProvider })
    const ideas = toIdeaDrafts((strategy.output as AiTaskOutput<"onboarding_strategy">).ideas)
    expect(ideas.length).toBeGreaterThanOrEqual(20)
    const plan = planOnboarding(createStarterDatabase(USER, NOW), { answers: full, ideas: ideas.map((idea) => ({ idea, title: idea.title, pillar: null })), lang, now: NOW })
    expect(plan.summary.ideas).toBeGreaterThanOrEqual(20)
    expect(plan.brand).toMatchObject({ niche: written, language: lang, onboarding_completed: true })
    expect((plan.inserts.audience_personas?.[0]?.name ?? "").toLowerCase()).toContain("nurse")
    expect(plan.inserts.content_calendar?.length ?? plan.updates.content_calendar?.length).toBeGreaterThan(0)
  })

  it("suggests #1 problems for the suggested audiences in the UI language", () => {
    expect(problemSuggestions("Freelancers", "english")).toHaveLength(3)
    expect(problemSuggestions("freelancers", "taglish")[0]).toMatch(/Hindi alam/)
    expect(problemSuggestions("Birdwatchers", "english")).toEqual([])
  })
})

describe("onboarding drafts", () => {
  const WS = "brand-1|2026-09-13T00:00:00.000Z"
  const stored = (draft: object) => JSON.parse(JSON.stringify(draft))

  it("resumes by step key and round-trips", () => {
    const draft = { ...createDraft(WS, "first", { ...emptyAnswers(), name: "Mika" }, "taglish"), step: 2, maxStep: 3 }
    const restored = parseDraft(JSON.parse(serializeDraft(draft)), WS)
    expect(restored).toMatchObject({ version: 3, mode: "first", lang: "taglish", step: 2, maxStep: 3 })
    expect(restored?.answers.name).toBe("Mika")
    expect(JSON.parse(serializeDraft(draft))).toMatchObject({ stepKey: "who", maxStepKey: "pick" })
    expect(parseDraft(JSON.parse(serializeDraft(draft)), "another|workspace")).toBeNull()
    expect(parseDraft("nonsense", WS)).toBeNull()
    expect(parseDraft(null, WS)).toBeNull()
  })

  it("moves old drafts (step indexes into the 10-step flow) and unknown keys to screen 1, keeping the answers", () => {
    const old = stored({
      version: 2,
      workspace: WS,
      mode: "first",
      lang: "english",
      step: 7, // "platforms" in the old first run
      maxStep: 9,
      answers: { name: "Mika", platforms: ["facebook"], interests: ["Coffee", "Travel"], audiences: ["Freelancers"], persona_problems: ["No savings"], aims: ["clients"], tones: ["casual"] },
      niche: null,
      strategy: { key: "x", positioning_statement: "I help …", ideas: [] },
    })
    const migrated = parseDraft(old, WS)
    expect(migrated).toMatchObject({ version: 3, step: 0, maxStep: 0 })
    expect(migrated?.answers).toMatchObject({ name: "Mika", platforms: ["facebook"], interests: ["Coffee", "Travel"], audiences: ["Freelancers"], persona_problems: ["No savings"], aims: ["clients"], own_niche: false })
    expect(validateStep("start", migrated!.answers)).toEqual({})

    expect(parseDraft({ ...old, version: 3, stepKey: "hilig" }, WS)?.step).toBe(0)
    expect(parseDraft({ ...old, version: 3, stepKey: 42 }, WS)?.step).toBe(0)
    expect(parseDraft({ ...old, version: 3, stepKey: "pick" }, WS)?.step).toBe(3)
    // The detailed flow didn't change: a re-run draft keeps its place.
    expect(parseDraft({ ...old, mode: "rerun", step: 3 }, WS)?.step).toBe(3)
    // An old Niche Discovery draft starts again on its first screen.
    expect(parseDraft({ ...old, mode: "niche", step: 4 }, WS)?.step).toBe(0)
  })
})

describe("quick setup end to end (offline engine)", () => {
  it.each(["english", "taglish"] as const)("%s: four screens → best match → 30 ideas → workspace plan", async (lang) => {
    const q: QuickAnswers = {
      name: "Mika Reyes",
      platforms: ["facebook", "tiktok"],
      interests: ["Personal finance", "Ipon & budgeting"],
      expertise_areas: ["Bookkeeping"],
      audiences: ["Freelancers"],
      persona_problems: [problemSuggestions("Freelancers", lang)[0]],
      aims: ["clients"],
    }
    const a = { ...emptyAnswers(), ...q }
    const niche = await executeAiTask({ task: "niche_discovery", input: nicheInput(a, lang), context: {} }, { provider: offlineProvider })
    const options = (niche.output as NicheDiscoveryOutput).options
    const option = rankedOptions(options)[0]
    const chosen = { ...a, ...applyNicheOption(a, option, { replacePillars: true, copy: COPY[lang] }) }
    expect(firstInvalidStep(chosen, QUICK_FLOW, QUICK_FLOW.length)).toBe(-1)

    const full = quickSetupAnswers(chosen, { option }, lang)
    const res = await executeAiTask({ task: "onboarding_strategy", input: strategyInput(full), context: {} }, { provider: offlineProvider })
    const drafts = toIdeaDrafts((res.output as AiTaskOutput<"onboarding_strategy">).ideas)
    expect(drafts).toHaveLength(30)
    const names = effectivePillars(drafts, selectedPillars(full).map((p) => ({ name: p.name, description: p.description, examples: p.examples, target: p.target })))
    const plan = planOnboarding(createStarterDatabase(USER, NOW), { answers: full, ideas: drafts.map((d, i) => ({ idea: d, title: d.title, pillar: names[i] })), lang, now: NOW })
    expect(plan.summary.ideas).toBeGreaterThanOrEqual(25)
    expect(plan.summary.pillars).toBe(option.pillars.length)
    expect(plan.brand).toMatchObject({ niche: option.niche_statement, language: lang, primary_goal_id: expect.any(String) })
    expect(plan.settings.ui_language).toBe(lang === "english" ? "en" : "tl")
  })
})
