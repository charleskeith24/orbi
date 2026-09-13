import { describe, expect, it } from "vitest"
import type { GeneratedIdea } from "@/lib/ai"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import type { Database } from "@/lib/types"
import {
  briefFromTaskInput,
  briefToInput,
  DEFAULT_COUNT,
  describeBrief,
  draftFromIdea,
  draftToIdeaValues,
  EMPTY_BRIEF,
  exampleBriefs,
  matchFormatId,
  moreLikeThisBrief,
  parseBriefParams,
  recentGenerations,
  timeAgo,
  titleKey,
  writeBriefParams,
} from "./generator-model"

const USER = "user-1"
const NOW = new Date("2026-09-10T10:00:00.000Z")

function workspace(): Database {
  const db = emptyDatabase()
  db.app_settings = [buildRow("app_settings", {}, USER, NOW)]
  db.brand_profiles = [buildRow("brand_profiles", { main_platforms: ["linkedin"] }, USER, NOW)]
  db.content_pillars = [
    buildRow("content_pillars", { id: "pil-edu", name: "Education", target_percentage: 50 }, USER, NOW),
    buildRow("content_pillars", { id: "pil-lead", name: "Leadership", target_percentage: 50 }, USER, NOW),
  ]
  db.audience_personas = [buildRow("audience_personas", { id: "per-founder", name: "Founders", is_primary: true }, USER, NOW)]
  db.audience_problems = [
    buildRow(
      "audience_problems",
      { id: "prob-1", problem: "Can't price the first offer", persona_id: "per-founder", pillar_id: "pil-edu", severity: 5 },
      USER,
      NOW
    ),
  ]
  db.content_goals = [buildRow("content_goals", { id: "goal-leads", category: "leads", name: "More inquiries", is_active: true }, USER, NOW)]
  db.angles = [
    buildRow("angles", { id: "ang-framework", name: "Framework", is_default: true }, USER, NOW),
    buildRow("angles", { id: "ang-bva", name: "Before vs After", is_default: true }, USER, NOW),
  ]
  db.content_formats = [
    buildRow("content_formats", { id: "fmt-short", name: "Short-form Video" }, USER, NOW),
    buildRow("content_formats", { id: "fmt-long", name: "Long-form Video" }, USER, NOW),
    buildRow("content_formats", { id: "fmt-carousel", name: "Carousel" }, USER, NOW),
  ]
  return db
}

function generated(overrides: Partial<GeneratedIdea> = {}): GeneratedIdea {
  return {
    title: "Price your first offer  with the 3-number rule",
    core_idea: "Floor, anchor, ceiling. ",
    why_it_matters: "Your most severe problem.",
    hook: "Most founders price by gut.",
    hook_category: "contrarian",
    format: "short-form video",
    angle: "framework",
    talking_points: ["Cost floor", "  ", "Value ceiling"],
    cta: "Save this",
    platform: "tiktok",
    funnel_stage: "mofu",
    pillar_id: "pil-edu",
    persona_id: "per-founder",
    problem_id: "prob-1",
    ...overrides,
  }
}

describe("parseBriefParams", () => {
  it("validates ids, maps names and categories, fills persona and pillar from the problem", () => {
    const db = workspace()
    const parsed = parseBriefParams(
      new URLSearchParams("problem=prob-1&platform=TikTok&goal=leads&angle=before-vs-after&format=carousel&count=50&run=1&topic=%20pricing%20%20tiers%20"),
      db
    )
    expect(parsed.brief).toEqual({
      ...EMPTY_BRIEF,
      problemId: "prob-1",
      personaId: "per-founder",
      pillarId: "pil-edu",
      platform: "tiktok",
      goalId: "goal-leads",
      angleId: "ang-bva",
      formatId: "fmt-carousel",
      topic: "pricing tiers",
      count: 20,
    })
    expect(parsed.run).toBe(true)
    expect(parsed.hasBrief).toBe(true)
    expect(parsed.ignored).toEqual([])
  })

  it("reports parts of the link that no longer match the workspace", () => {
    const parsed = parseBriefParams(new URLSearchParams("persona=gone&platform=myspace&funnel=zofu&count=abc&angle=nope"), workspace())
    expect(parsed.brief).toEqual(EMPTY_BRIEF)
    expect(parsed.ignored).toEqual(["persona", "platform", "funnel stage", "angle", "number of ideas"])
    expect(parsed.hasBrief).toBe(true)
    expect(parsed.run).toBe(false)
  })

  it("has no brief without brief params", () => {
    const parsed = parseBriefParams(new URLSearchParams("open=x&run=1"), workspace())
    expect(parsed.hasBrief).toBe(false)
    expect(parsed.brief).toEqual(EMPTY_BRIEF)
  })

  it("round-trips through writeBriefParams, dropping run and the default count but keeping other keys", () => {
    const db = workspace()
    const brief = { ...EMPTY_BRIEF, pillarId: "pil-lead", funnel: "bofu" as const, topic: "hiring", angleId: "ang-framework" }
    const params = new URLSearchParams("run=1&foo=bar&count=9")
    writeBriefParams(params, brief)
    expect(params.get("run")).toBeNull()
    expect(params.get("count")).toBeNull()
    expect(params.get("foo")).toBe("bar")
    expect(parseBriefParams(params, db).brief).toEqual(brief)
  })
})

describe("briefToInput / briefFromTaskInput", () => {
  it("sends the angle by name and clamps the count", () => {
    const db = workspace()
    const input = briefToInput({ ...EMPTY_BRIEF, angleId: "ang-bva", topic: "  ", count: 99 }, db.angles)
    expect(input).toMatchObject({ angle: "Before vs After", topic: null, count: 20, pillar_id: null })
  })

  it("rebuilds a brief from a logged input, dropping deleted ids", () => {
    const db = workspace()
    const brief = briefFromTaskInput({ pillar_id: "pil-edu", persona_id: "deleted", angle: "Framework", platform: "x", count: 4, funnel_stage: "nope" }, db)
    expect(brief).toEqual({ ...EMPTY_BRIEF, pillarId: "pil-edu", angleId: "ang-framework", platform: "x", count: 4 })
  })

  it("describes a brief in short labels", () => {
    const db = workspace()
    expect(describeBrief({ ...EMPTY_BRIEF, pillarId: "pil-edu", personaId: "per-founder", platform: "tiktok", funnel: "tofu" }, db)).toEqual([
      "Education",
      "for Founders",
      "TikTok",
      "TOFU",
    ])
  })
})

describe("drafts", () => {
  it("maps the AI's format and angle names to library rows and cleans text", () => {
    const db = workspace()
    const draft = draftFromIdea(generated({ pillar_id: "missing" }), db, "b1:0")
    expect(draft).toMatchObject({
      key: "b1:0",
      title: "Price your first offer with the 3-number rule",
      core_idea: "Floor, anchor, ceiling.",
      format_id: "fmt-short",
      angle_id: "ang-framework",
      pillar_id: null,
      persona_id: "per-founder",
      talking_points: ["Cost floor", "Value ceiling"],
      saved_idea_id: null,
    })
  })

  it("only maps a partial format name when exactly one format fits", () => {
    const db = workspace()
    expect(matchFormatId("Video", db.content_formats)).toBeNull()
    expect(matchFormatId("Carousel post", db.content_formats)).toBe("fmt-carousel")
  })

  it("saves as an ai_generator inbox idea with the brief's goal and drops references that no longer exist", () => {
    const db = workspace()
    const draft = draftFromIdea(generated(), db, "b1:0")
    db.angles = db.angles.filter((a) => a.id !== "ang-framework")
    const values = draftToIdeaValues(draft, { ...EMPTY_BRIEF, goalId: "goal-leads", topic: "pricing" }, db)
    expect(values).toMatchObject({
      source: "ai_generator",
      status: "inbox",
      platforms: ["tiktok"],
      goal_id: "goal-leads",
      angle_id: null,
      format_id: "fmt-short",
      core_topic: "pricing",
      description: "Floor, anchor, ceiling.",
      hook_category: "contrarian",
    })
  })

  it("builds a 'More like this' brief around the draft's slot", () => {
    const db = workspace()
    const draft = draftFromIdea(generated(), db, "b1:0")
    expect(moreLikeThisBrief({ ...EMPTY_BRIEF, goalId: "goal-leads", angleId: "ang-bva" }, draft)).toEqual({
      pillarId: "pil-edu",
      personaId: "per-founder",
      problemId: "prob-1",
      platform: "tiktok",
      goalId: "goal-leads",
      topic: "Price your first offer with the 3-number rule",
      funnel: "mofu",
      angleId: null,
      formatId: "fmt-short",
      count: 3,
    })
  })

  it("compares titles without case or punctuation", () => {
    expect(titleKey("How to Price — your first offer!")).toBe(titleKey("how to price your first offer"))
  })
})

describe("recentGenerations", () => {
  it("reads successful generate_ideas calls newest first and flags shortened copies", () => {
    const db = workspace()
    const cut = `${"x".repeat(80)}…`
    db.ai_generations = [
      buildRow("ai_generations", { id: "old", task: "generate_ideas", provider: "offline", status: "success", input: { count: 2 }, output: { ideas: [generated(), generated({ title: "Second" })] } }, USER, new Date("2026-09-09T10:00:00Z")),
      buildRow("ai_generations", { id: "new", task: "generate_ideas", provider: "offline", status: "success", input: { count: 6 }, output: { ideas: [generated({ core_idea: cut })] } }, USER, new Date("2026-09-10T09:00:00Z")),
      buildRow("ai_generations", { id: "big", task: "generate_ideas", provider: "offline", status: "success", input: {}, output: { truncated: true, preview: "{" } }, USER, new Date("2026-09-08T09:00:00Z")),
      buildRow("ai_generations", { id: "err", task: "generate_ideas", provider: "offline", status: "error", input: {}, output: null }, USER, new Date("2026-09-10T09:30:00Z")),
      buildRow("ai_generations", { id: "hooks", task: "generate_hooks", provider: "offline", status: "success", input: {}, output: {} }, USER, new Date("2026-09-10T09:40:00Z")),
    ]
    const recent = recentGenerations(db.ai_generations, db)
    expect(recent.map((g) => g.id)).toEqual(["new", "old", "big"])
    expect(recent[0]).toMatchObject({ requested: 6, trimmed: true })
    expect(recent[0].ideas).toHaveLength(1)
    expect(recent[1]).toMatchObject({ requested: 2, trimmed: false })
    expect(recent[1].ideas.map((i) => i.title)).toEqual(["Price your first offer with the 3-number rule", "Second"])
    expect(recent[2]).toMatchObject({ trimmed: true, ideas: [] })
  })
})

describe("exampleBriefs", () => {
  it("builds briefs from real workspace gaps", () => {
    const db = workspace()
    const examples = exampleBriefs(db, NOW, db.app_settings[0])
    expect(examples.map((e) => e.id)).toEqual(["problem", "reach", "leads", "balanced"])
    expect(examples[0].brief).toMatchObject({ problemId: "prob-1", personaId: "per-founder", pillarId: "pil-edu", count: 5 })
    expect(examples[1].brief).toMatchObject({ personaId: "per-founder", platform: "linkedin", funnel: "tofu", count: DEFAULT_COUNT })
  })

  it("falls back to a balanced batch in an empty workspace", () => {
    const db = emptyDatabase()
    db.app_settings = [buildRow("app_settings", {}, USER, NOW)]
    expect(exampleBriefs(db, NOW, db.app_settings[0]).map((e) => e.id)).toEqual(["balanced"])
  })
})

describe("timeAgo", () => {
  it("reads naturally", () => {
    expect(timeAgo("2026-09-10T09:59:40.000Z", NOW)).toBe("just now")
    expect(timeAgo("2026-09-10T09:48:00.000Z", NOW)).toBe("12 min ago")
    expect(timeAgo("2026-09-10T07:00:00.000Z", NOW)).toBe("3 h ago")
    expect(timeAgo("2026-09-09T08:00:00.000Z", NOW)).toBe("yesterday")
  })
})
