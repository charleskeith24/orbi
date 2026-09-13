import { describe, expect, it } from "vitest"
import type { GeneratedIdea } from "@/lib/ai"
import { onboardingStrategyTask } from "@/lib/ai/tasks/onboarding-strategy"
import { CATEGORICAL_COLORS, PLATFORM_IDS } from "@/lib/constants"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import { useDataStore } from "@/lib/store"
import { applyOnboardingPlan } from "./apply-onboarding"
import { assignPillars, goalForIdea, matchProblem, type IdeaDraft } from "./onboarding-ideas"
import {
  answersFromWorkspace,
  distributeTotal,
  emptyAnswers,
  evenPillars,
  firstInvalidStep,
  largestRemainder,
  parsePositioning,
  pillarColors,
  pillarTotal,
  presetPillars,
  rebalancePillars,
  recommendedSchedule,
  sanitizeAnswers,
  strategyInput,
  validateStep,
  weeklyTotal,
  type OnboardingAnswers,
} from "./onboarding-model"
import { planOnboarding, planStarterLibrary, storyTitle } from "./onboarding-plan"

const NOW = new Date(2026, 8, 13, 10, 0, 0)
const USER = "00000000-0000-4000-8000-000000000001"
const total = (values: number[]) => values.reduce((a, b) => a + b, 0)

function filledAnswers(): OnboardingAnswers {
  return {
    ...emptyAnswers(),
    name: "Maria Santos",
    brand_name: "Santos Studio",
    role: "Founder",
    industry: "E-commerce",
    years_experience: 8,
    location: "Manila",
    audience: "first-time e-commerce founders",
    result: "grow profitably without burning cash",
    method: "simple ad systems",
    known_for: "Making ads boring and profitable.",
    persona_name: "First-time founders",
    persona_profession: "Store owner",
    persona_experience: "Beginner",
    persona_goals: ["Hit ₱1M a month"],
    persona_problems: ["Ad costs keep rising while sales stay flat", "No time to create content"],
    persona_platforms: ["facebook", "tiktok"],
    expertise_areas: ["E-commerce", "Advertising"],
    story: "In 2022 we almost closed our first store because sales dropped. We fixed the offer and doubled revenue.",
    platforms: ["facebook", "tiktok", "linkedin"],
    split: { facebook: 3, tiktok: 3, linkedin: 2 },
    primary_goal: "leads",
    secondary_goal: "authority",
    tones: ["conversational", "educational"],
    personality: ["direct", "practical"],
  }
}

function idea(over: Partial<IdeaDraft> = {}): IdeaDraft {
  return {
    title: "Why your ad costs keep rising while sales stay flat",
    core_idea: "The offer, not the ads, is usually the problem.",
    why_it_matters: "The top problem your persona named.",
    hook: "Your ads aren't broken.",
    hook_category: "problem",
    format: "Short-form Video",
    angle: "Problem",
    talking_points: ["Check the offer first", "Then the creative"],
    cta: "Comment OFFER",
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
    const a = { platforms: ["facebook", "tiktok", "linkedin"] as const, split: {} }
    const answers = { platforms: [...a.platforms], split: a.split }
    expect(weeklyTotal(answers)).toBe(8)
    const split = distributeTotal(12, answers)
    expect(total(Object.values(split) as number[])).toBe(12)
    expect(Object.values(split).every((n) => (n ?? 0) >= 1)).toBe(true)
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

  it("validates required answers per step", () => {
    const blank = emptyAnswers()
    expect(Object.keys(validateStep("identity", blank)).sort()).toEqual(["industry", "name", "role"])
    expect(validateStep("positioning", blank).known_for).toBeTruthy()
    expect(validateStep("goals", blank).primary_goal).toBeTruthy()
    expect(firstInvalidStep(filledAnswers())).toBe(-1)
    const pillars = filledAnswers()
    pillars.pillars[0] = { ...pillars.pillars[0], target: 40 }
    expect(validateStep("pillars", pillars).pillars).toMatch(/110%/)
  })

  it("builds an AI request the onboarding_strategy task accepts", () => {
    const a = filledAnswers()
    a.name = "x".repeat(500)
    a.expertise_areas = Array.from({ length: 20 }, (_, i) => `Area ${i}`)
    const parsed = onboardingStrategyTask.input.safeParse(strategyInput(a))
    expect(parsed.success).toBe(true)
    expect(strategyInput(a).goals).toEqual(["leads", "authority"])
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
    const restored = sanitizeAnswers({ name: 5, platforms: ["facebook", "myspace"], tones: ["casual", "loud"], language: "klingon" })
    expect(restored.name).toBe("")
    expect(restored.platforms).toEqual(["facebook"])
    expect(restored.tones).toEqual(["casual"])
    expect(restored.language).toBe("english")
    expect(sanitizeAnswers(JSON.parse(JSON.stringify(filledAnswers())))).toEqual(filledAnswers())
  })

  it("prefills a re-run from the workspace", () => {
    const demo = createDemoDatabase(USER, NOW)
    const a = answersFromWorkspace(demo, { rerun: true })
    expect(a.name).toBe(demo.brand_profiles[0].name)
    expect(a.pillars.filter((p) => p.selected).length).toBe(demo.content_pillars.filter((p) => p.is_active).length)
    expect(a.persona_name).toBeTruthy()
    expect(a.primary_goal).not.toBeNull()
    expect(a.schedule_mode).toBe("custom")
  })
})

describe("idea matching", () => {
  const pillars = [
    { name: "Education", description: "Teach", examples: [], target: 50 },
    { name: "Personal", description: "Stories", examples: [], target: 50 },
  ]

  it("prefers relevant pillars and spreads the rest by target", () => {
    const tutorials = Array.from({ length: 10 }, (_, i) => idea({ key: `t${i}`, angle: "Tutorial", title: `Tutorial ${i}` }) as GeneratedIdea)
    expect(new Set(assignPillars(tutorials, pillars))).toEqual(new Set(["Education"]))
    const neutral = Array.from({ length: 10 }, (_, i) =>
      idea({ key: `n${i}`, angle: "", title: `Qwerty ${i}`, core_idea: "", hook: "", talking_points: [] }) as GeneratedIdea
    )
    const counts = assignPillars(neutral, pillars).reduce<Record<string, number>>((acc, name) => ({ ...acc, [name ?? ""]: (acc[name ?? ""] ?? 0) + 1 }), {})
    expect(counts).toEqual({ Education: 5, Personal: 5 })
  })

  it("links problems and goals", () => {
    expect(matchProblem(idea(), ["No time to create content", "Ad costs keep rising while sales stay flat"])).toBe(1)
    expect(matchProblem(idea({ title: "Morning routine", core_idea: "", hook: "", why_it_matters: "", talking_points: [] }), ["Ad costs keep rising"])).toBe(-1)
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

  it("plans a first run on a fresh starter workspace", () => {
    const db = createStarterDatabase(USER, NOW)
    const a = filledAnswers()
    const ideas = [
      { idea: idea(), title: "Why your ad costs keep rising while sales stay flat", pillar: "Education" },
      { idea: idea({ key: "idea-1", funnel_stage: "bofu", angle: "Case Study", format: "LinkedIn Post", platform: "linkedin" }), title: "How one audit doubled a store's margin", pillar: "Business" },
    ]
    const plan = planOnboarding(db, { answers: a, ideas, now: NOW })
    const goal = (category: string) => db.content_goals.find((g) => g.category === category)!

    expect(plan.summary.libraryRows).toBe(0)
    expect(plan.inserts.content_goals ?? []).toHaveLength(0)
    expect((plan.updates.content_goals ?? []).map((u) => u.id).sort()).toEqual([goal("leads").id, goal("authority").id].sort())
    expect(plan.brand).toMatchObject({ onboarding_completed: true, primary_goal_id: goal("leads").id, secondary_goal_id: goal("authority").id })
    expect(plan.brand.who_am_i).toMatch(/^I'm Maria Santos — Founder at Santos Studio\./)

    const pillars = plan.inserts.content_pillars ?? []
    expect(pillars.map((p) => p.color)).toEqual(CATEGORICAL_COLORS.slice(0, 6))
    expect(total(pillars.map((p) => p.target_percentage ?? 0))).toBe(100)

    const persona = plan.inserts.audience_personas?.[0]
    expect(persona?.is_primary).toBe(true)
    const problems = plan.inserts.audience_problems ?? []
    expect(problems).toHaveLength(2)
    expect(problems.every((p) => p.persona_id === persona?.id && p.category === "beginner")).toBe(true)

    // The starter's seven slots are updated in place, restricted to the chosen platforms.
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
    expect(created[0].problem_id).toBe(problems[0].id)
    expect(created[0].pillar_id).toBe(pillars.find((p) => p.name === "Education")?.id)
    expect(created[1].goal_id).toBe(goal("leads").id)
    expect(created[0].format_id).toBe(db.content_formats.find((f) => f.name === "Short-form Video")?.id)
    expect(plan.inserts.stories ?? []).toHaveLength(1)
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

  it("applies through the store without duplicates on a second run", () => {
    useDataStore.setState({ db: createStarterDatabase(USER, NOW), status: "ready", userId: USER, adapter: null })
    const answers = filledAnswers()
    const ideas = [{ idea: idea(), title: "Why your ad costs keep rising while sales stay flat", pillar: "Education" }]
    applyOnboardingPlan(planOnboarding(useDataStore.getState().db, { answers, ideas, now: NOW }))
    let db = useDataStore.getState().db
    expect(db.brand_profiles[0].onboarding_completed).toBe(true)
    expect(db.content_pillars).toHaveLength(6)
    expect(db.audience_personas).toHaveLength(1)
    expect(db.content_ideas.filter((i) => i.source === "onboarding")).toHaveLength(1)
    expect(db.content_calendar).toHaveLength(7)
    expect(db.app_settings[0].weekly_post_target).toBe(8)

    applyOnboardingPlan(planOnboarding(db, { answers, ideas, now: NOW }))
    db = useDataStore.getState().db
    expect(db.content_pillars).toHaveLength(6)
    expect(db.audience_personas).toHaveLength(1)
    expect(db.audience_problems).toHaveLength(2)
    expect(db.content_goals).toHaveLength(5)
    expect(db.content_ideas.filter((i) => i.source === "onboarding")).toHaveLength(1)
    expect(db.stories).toHaveLength(1)
  })
})
