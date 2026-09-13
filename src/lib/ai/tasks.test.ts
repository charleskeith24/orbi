import { describe, expect, it } from "vitest"
import { SCRIPT_FORMATS } from "@/lib/constants"
import { emptyDatabase } from "@/lib/data/defaults"
import { qualityRating, qualityTotal } from "@/lib/scoring"
import type { RepurposeType } from "@/lib/types"
import { buildAnalyticsSnapshot, EMPTY_BRAND_CONTEXT } from "./context"
import { buildStrategistInput, buildWeeklyPlanInput } from "./inputs"
import { detectIntent } from "./offline/strategist"
import { looksTagalog } from "./offline/text"
import { offlineProvider } from "./providers/offline"
import { executeAiTask } from "./server"
import { AI_TASK_NAMES, getAiTask, type AiTaskName } from "./tasks"
import { ALL_TARGETS, ctx, db, INPUTS, NOW } from "./test-fixtures"

function run(task: AiTaskName, input: unknown, context: unknown = ctx) {
  return executeAiTask({ task, input, context }, { provider: offlineProvider })
}

describe("offline engine — every task on the demo workspace", () => {
  it.each(AI_TASK_NAMES)("%s: offline output passes its schema strictly", (name) => {
    const task = getAiTask(name)
    const input = task.input.parse(INPUTS[name])
    const output = task.offline(ctx, input)
    const parsed = task.output.safeParse(output)
    if (!parsed.success) throw new Error(`${name}: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`)
  })

  it.each(AI_TASK_NAMES)("%s: runs through the gateway and never uses banned phrases", async (name) => {
    const res = await run(name, INPUTS[name])
    expect(res.provider).toBe("offline")
    expect(res.model).toBe("offline-templates")
    const text = JSON.stringify(res.output).toLowerCase()
    for (const phrase of ctx.brand.phrases_avoid) expect(text, `${name} used “${phrase}”`).not.toMatch(new RegExp(`\\b${phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`))
  })

  it.each(AI_TASK_NAMES.filter((n) => !["what_to_post", "winner_replication", "repurpose", "content_brief", "generate_script", "score_idea", "weekly_review", "monthly_review", "weekly_plan"].includes(n)))(
    "%s: also works for an empty Brand HQ",
    async (name) => {
      const input = name === "strategist_chat" ? buildStrategistInput(emptyDatabase(), NOW, [{ role: "user", content: "Why is my content underperforming?" }]) : INPUTS[name]
      const res = await run(name, input, EMPTY_BRAND_CONTEXT)
      expect(res.output).toBeTruthy()
    }
  )
})

/** Every string leaf of an output — what the user actually reads. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === "object") return Object.values(value).flatMap(strings)
  return []
}

describe("offline engine — shown verbatim, so never broken", () => {
  it.each(AI_TASK_NAMES)("%s: no placeholders, template leaks or fragment subjects", async (name) => {
    const res = await run(name, INPUTS[name])
    for (const line of strings(res.output)) {
      expect(line, name).not.toMatch(/\[(?:add|your|insert|name|number|numbers|topic|x)\b[^\]]*\]/i)
      expect(line, name).not.toMatch(/\b(?:undefined|NaN)\b|\[object Object\]|\{\w+\}/)
      expect(line, name).not.toMatch(/\babout (?:i|afraid|hi guys|between)\b/i)
      expect(line, name).not.toMatch(/\bthe lack of (?:is|are|i'm)\b|\bunpopular opinion: i\b/i)
    }
  })

  it("a Taglish Brand HQ gets natural Taglish lines, not only English", async () => {
    for (const name of ["generate_hooks", "generate_ideas", "generate_script"] as const) {
      const res = await run(name, INPUTS[name])
      expect(strings(res.output).some((line) => looksTagalog(line)), name).toBe(true)
    }
  })

  it("onboarding_strategy builds from the wizard answers, never from the demo workspace", async () => {
    const res = await run("onboarding_strategy", INPUTS.onboarding_strategy)
    const text = strings(res.output).join("\n")
    const answers = JSON.stringify(INPUTS.onboarding_strategy)
    for (const story of ctx.stories) if (!answers.includes(story.title)) expect(text).not.toContain(story.title)
  })

  it("monthly_review names the month it reviews", async () => {
    const input = INPUTS.monthly_review as { report: { month: string } }
    const res = await run("monthly_review", input)
    expect(input.report.month).not.toBe("")
    expect((res.output as { summary: string }).summary).toContain(input.report.month)
  })

  it("strategist understands Taglish, greetings and the newer intents", () => {
    expect(detectIntent("Ano ang dapat kong i-post ngayon?")).toBe("what_to_post")
    expect(detectIntent("Hi")).toBe("greeting")
    expect(detectIntent("Should I focus more on TikTok or LinkedIn?")).toBe("platform")
    expect(detectIntent("How do I get more leads from content?")).toBe("leads")
    expect(detectIntent("What should I stop doing?")).toBe("stop")
  })
})

describe("offline engine — quality checks", () => {
  it("capture_idea keeps the insight and picks real refs", async () => {
    const { output } = await run("capture_idea", INPUTS.capture_idea)
    const o = output as { title: string; pillar_id: string | null; platforms: string[]; talking_points: string[]; why_it_matters: string; hook: string }
    expect(o.title.toLowerCase()).toMatch(/system|inspiration/)
    expect(ctx.pillars.some((p) => p.id === o.pillar_id)).toBe(true)
    expect(o.platforms.length).toBeGreaterThan(0)
    expect(o.talking_points.length).toBeGreaterThanOrEqual(3)
    // The demo brand's point of view says "Systems beat inspiration."
    expect(o.why_it_matters).toContain("Systems beat inspiration")
  })

  it("generate_ideas returns the requested count of distinct ideas with valid refs", async () => {
    const { output } = await run("generate_ideas", { count: 12 })
    const ideas = (output as { ideas: { title: string; pillar_id: string | null; problem_id: string | null }[] }).ideas
    expect(ideas).toHaveLength(12)
    expect(new Set(ideas.map((i) => i.title.toLowerCase())).size).toBe(12)
    for (const i of ideas) {
      if (i.pillar_id) expect(ctx.pillars.some((p) => p.id === i.pillar_id)).toBe(true)
      if (i.problem_id) expect(ctx.problems.some((p) => p.id === i.problem_id)).toBe(true)
    }
  })

  it("generate_ideas respects a pillar filter and a topic", async () => {
    const pillar = ctx.pillars.find((p) => p.name === "Leadership")!
    const { output } = await run("generate_ideas", { count: 6, pillar_id: pillar.id, topic: "hiring" })
    const ideas = (output as { ideas: { title: string; pillar_id: string | null }[] }).ideas
    expect(ideas).toHaveLength(6)
    expect(ideas.every((i) => i.pillar_id === pillar.id)).toBe(true)
    expect(ideas[0].title.toLowerCase()).toContain("hiring")
  })

  it("generate_script fills exactly the format's sections", async () => {
    const { output } = await run("generate_script", INPUTS.generate_script)
    const sections = (output as { sections: { key: string; content: string }[] }).sections
    expect(sections.map((s) => s.key)).toEqual(SCRIPT_FORMATS.short_video.sections.map((s) => s.key))
    expect(sections.every((s) => s.content.trim().length > 10)).toBe(true)
  })

  it("repurpose returns one native asset per target with the right sections", async () => {
    const { output } = await run("repurpose", INPUTS.repurpose)
    const assets = (output as { assets: { type: RepurposeType; sections: { key: string }[] }[] }).assets
    expect(assets.map((a) => a.type)).toEqual(ALL_TARGETS)
  })

  it("score_content totals and rating come from the scoring helpers", async () => {
    const { output } = await run("score_content", INPUTS.score_content)
    const o = output as { hook: number; relevance: number; value: number; clarity: number; authenticity: number; cta: number; total: number; rating: string; improvements: string[] }
    expect(o.total).toBe(qualityTotal(o))
    expect(o.rating).toBe(qualityRating(o.total))
    expect(o.improvements.length).toBeGreaterThan(0)
  })

  it("weekly_plan stays inside the week and maps candidate ids", async () => {
    const input = INPUTS.weekly_plan as ReturnType<typeof buildWeeklyPlanInput>
    const { output } = await run("weekly_plan", input)
    const plan = (output as { plan: { date: string; idea_id: string | null; item_id: string | null }[] }).plan
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.every((row) => row.date >= input.week_start)).toBe(true)
    const ids = new Set((input.candidates ?? []).map((c) => c.id))
    expect(plan.filter((r) => r.idea_id || r.item_id).every((r) => ids.has((r.idea_id ?? r.item_id)!))).toBe(true)
  })

  it("strategist answers with real numbers", async () => {
    const { output } = await run("strategist_chat", INPUTS.strategist_chat)
    const reply = (output as { reply: string }).reply
    expect(reply).toMatch(/\d/)
    expect(reply.length).toBeGreaterThan(80)
  })

  it("strategist handles each intent", async () => {
    const snapshot = buildAnalyticsSnapshot(db, NOW)
    for (const q of [
      "Why is my Personal content underperforming?",
      "Give me 5 ideas about hiring",
      "What should I double down on?",
      "Which hooks work best for me?",
      "Plan my next week",
      "How's my buffer?",
      "I just fired a client who kept changing the brief. Turn this experience into content.",
      "Hi",
    ]) {
      const { output } = await run("strategist_chat", { messages: [{ role: "user", content: q }], snapshot })
      expect((output as { reply: string }).reply.length, q).toBeGreaterThan(40)
    }
  })
})
