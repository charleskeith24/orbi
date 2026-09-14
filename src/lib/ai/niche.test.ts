import { describe, expect, it } from "vitest"
import { buildBrandContext, EMPTY_BRAND_CONTEXT, type BrandContext } from "./context"
import { createKit } from "./offline/brand"
import { generateOfflineIdeas } from "./offline/ideas"
import { nicheInterests } from "./offline/niche"
import { looksTagalog } from "./offline/text"
import { brandVoiceSystemPrompt } from "./prompts/system"
import { offlineProvider } from "./providers/offline"
import { executeAiTask } from "./server"
import { getAiTask, type AiTaskName } from "./tasks"
import type { NicheDiscoveryOutput } from "./tasks/niche-discovery"
import { ctx, db, INPUTS } from "./test-fixtures"

const run = (task: AiTaskName, input: unknown, context: unknown = ctx) => executeAiTask({ task, input, context }, { provider: offlineProvider })

const ENGLISH = {
  language: "english",
  name: "Paolo Santos",
  interests: ["Home cooking", "Baking", "Travel"],
  skills: ["Pastry", "Food costing", "Customer service"],
  help_requests: "Friends ask me how much to charge for cakes",
  years_experience: 4,
  proof: "Sold 300+ cakes from my home kitchen in 2025",
  audiences: ["Home bakers", "Stay-at-home moms"],
  audience_level: "Beginner",
  audience_stage: "Baking for family, thinking of selling",
  audience_goal: "Earn from baking at home",
  audience_problems: ["Underprices cakes and works for free", "Doesn't know how to get orders outside friends and family", "No time to bake and post"],
  aims: ["products", "community"],
}
const TAGLISH = INPUTS.niche_discovery

const GENERIC_PILLARS = /^(education|authority|journey|leadership|personal|business)$/i

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === "object") return Object.values(value).flatMap(strings)
  return []
}

async function niches(input: unknown, context: unknown = EMPTY_BRAND_CONTEXT): Promise<NicheDiscoveryOutput> {
  const res = await run("niche_discovery", input, context)
  expect(res.provider).toBe("offline")
  return res.output as NicheDiscoveryOutput
}

function expectWellFormed(out: NicheDiscoveryOutput) {
  expect(getAiTask("niche_discovery").output.safeParse(out).success).toBe(true)
  expect(out.options.map((o) => o.kind)).toEqual(["expertise", "passion", "audience"])
  for (const o of out.options) {
    expect(o.pillars.length).toBeGreaterThanOrEqual(4)
    expect(o.pillars.length).toBeLessThanOrEqual(6)
    expect(o.pillars.reduce((a, p) => a + p.target_percentage, 0)).toBe(100)
    expect(o.pillars.every((p) => Number.isInteger(p.target_percentage) && p.target_percentage >= 1)).toBe(true)
    expect(o.pillars.some((p) => GENERIC_PILLARS.test(p.name.trim()))).toBe(false)
    expect(new Set(o.pillars.map((p) => p.name.toLowerCase())).size).toBe(o.pillars.length)
    expect(o.pillars.every((p) => p.name.length <= 40 && p.description.trim())).toBe(true)
    expect(o.sample_posts).toHaveLength(5)
    expect(new Set(o.sample_posts.map((p) => p.title.toLowerCase())).size).toBe(5)
    expect(o.monetization.length).toBeGreaterThanOrEqual(2)
    for (const key of ["passion", "expertise", "demand"] as const) {
      expect(Number.isInteger(o.fit[key].score)).toBe(true)
      expect(o.fit[key].score).toBeGreaterThanOrEqual(1)
      expect(o.fit[key].score).toBeLessThanOrEqual(10)
      expect(o.fit[key].reason.length).toBeGreaterThan(10)
    }
    expect(o.positioning_statement).toMatch(/^I help .+ through .+\.$/)
    expect(o.niche_statement.split(/(?<=[.!?])\s+[A-Z]/).length).toBe(1)
    expect(o.niche_statement.length).toBeLessThanOrEqual(160)
    expect(o.why_it_fits.trim()).not.toBe("")
    expect(o.risk.trim()).not.toBe("")
  }
  // Three genuinely different directions.
  const names = out.options.map((o) => o.name.toLowerCase())
  expect(new Set(names).size).toBe(3)
  expect(new Set(out.options.map((o) => o.niche_statement.toLowerCase())).size).toBe(3)
  expect(new Set(out.options.map((o) => o.pillars.map((p) => p.name).join("|"))).size).toBe(3)
  // Shown verbatim: no placeholders or template leaks.
  for (const line of strings(out)) {
    expect(line).not.toMatch(/\b(?:undefined|null|NaN)\b|\[object Object\]|\$\{|\{\w+\}|\[(?:add|your|insert|topic|audience)[^\]]*\]|___/i)
    expect(line).not.toMatch(/\bmga mga\b|\s{2,}|\s[,.]/)
  }
}

describe("niche_discovery — offline engine", () => {
  it("returns three distinct, well-formed directions in English", async () => {
    const out = await niches(ENGLISH)
    expectWellFormed(out)
    const text = strings(out).join("\n").toLowerCase()
    // Built from what they typed.
    for (const word of ["pastry", "baking", "home bakers"]) expect(text).toContain(word)
    expect(out.options[0].fit.expertise.score).toBeGreaterThan(out.options[1].fit.expertise.score)
    expect(out.options[1].fit.passion.score).toBeGreaterThanOrEqual(out.options[0].fit.passion.score)
    expect(out.notes).toEqual([])
  })

  it("writes natural Taglish when Taglish is chosen", async () => {
    const out = await niches(TAGLISH)
    expectWellFormed(out)
    for (const o of out.options) {
      const lines = [o.niche_statement, o.why_it_fits, o.risk, o.fit.passion.reason, ...o.sample_posts.map((p) => p.hook)]
      expect(lines.filter((l) => looksTagalog(l)).length, o.name).toBeGreaterThanOrEqual(Math.ceil(lines.length / 2))
    }
    // Their own words carry through: skills, interests, audience and problems.
    const text = strings(out).join("\n")
    for (const word of ["BIR", "freelancers", "Hindi alam paano mag-file ng BIR", "ipon"]) expect(text).toContain(word)
  })

  it("is grounded only in the input — never the loaded demo workspace", async () => {
    const out = await niches(TAGLISH, ctx)
    const text = strings(out).join("\n")
    expect(text).not.toContain(ctx.brand.brand_name)
    expect(text).not.toContain(ctx.brand.name.split(" ")[0])
    for (const story of ctx.stories) expect(text).not.toContain(story.title)
  })

  it("still works from sparse input and says honestly what's missing", async () => {
    for (const input of [{ language: "english", interests: ["Cooking"] }, { language: "taglish", interests: ["Birdwatching", "Photography"] }, {}]) {
      const out = await niches(input)
      expectWellFormed(out)
      expect(out.notes.length).toBeGreaterThan(0)
      expect(out.notes.join(" ")).toMatch(/problem/i)
    }
    const thin = await niches({ ...ENGLISH, audience_problems: ENGLISH.audience_problems.slice(0, 2) })
    expect(thin.notes).toContain("Add one more audience problem to sharpen this — real problems are what make a niche specific.")
  })
})

describe("niche alignment across the AI layer", () => {
  const niche = "BIR taxes and bookkeeping made simple for Filipino freelancers"
  const interests = ["Personal finance", "Ipon challenges", "Side hustles"]

  it("onboarding_strategy keeps the chosen pillars and stays inside the niche", async () => {
    const pillars = [
      { name: "BIR made simple", description: "Registration and filing", target_percentage: 40 },
      { name: "Bookkeeping systems", description: "Tracking income", target_percentage: 35 },
      { name: "Freelance money", description: "Saving on irregular income", target_percentage: 25 },
    ]
    const res = await run("onboarding_strategy", {
      name: "Mika Reyes",
      expertise_areas: ["Bookkeeping", "BIR & taxes"],
      audience: "freelancers",
      result: "stay tax-compliant",
      audience_problems: ["Hindi alam paano mag-file ng BIR", "Takot sa tax penalties"],
      goals: ["leads"],
      niche,
      interests,
      pillars,
      idea_count: 30,
    })
    const out = res.output as { pillar_suggestions: { name: string; target_percentage: number }[]; ideas: { title: string }[]; known_for: string }
    expect(out.pillar_suggestions.map((p) => [p.name, p.target_percentage])).toEqual(pillars.map((p) => [p.name, p.target_percentage]))
    expect(out.ideas).toHaveLength(30)
    expect(out.known_for).toContain("BIR taxes and bookkeeping")
    const onTopic = out.ideas.filter((i) => /\b(bir|tax|bookkeeping|finance|ipon|side hustle|freelanc|penalt)/i.test(i.title))
    expect(onTopic.length).toBeGreaterThanOrEqual(20)
  })

  it("Brand Context and the system prompt carry the niche", () => {
    const context = buildBrandContext(db, new Date(2026, 8, 11))
    expect(context.brand.niche).toBe(db.brand_profiles[0].niche)
    expect(context.brand.interests).toEqual(db.brand_profiles[0].interests)
    const prompt = brandVoiceSystemPrompt(context)
    expect(prompt).toContain(`Niche: ${db.brand_profiles[0].niche}`)
    expect(prompt).toMatch(/Stay inside the niche/)
    expect(brandVoiceSystemPrompt(EMPTY_BRAND_CONTEXT)).not.toMatch(/Stay inside the niche/)
  })

  it("the offline Idea Generator seeds from the niche and the interests that belong to it", () => {
    // A hobby outside the niche ("K-drama" in a tax niche) never becomes an idea topic.
    const context: BrandContext = { ...EMPTY_BRAND_CONTEXT, brand: { ...EMPTY_BRAND_CONTEXT.brand, name: "Mika Reyes", niche, interests: [...interests, "K-drama"] } }
    const ideas = generateOfflineIdeas(context, createKit(context, "niche-seeds"), { count: 12 })
    expect(ideas.length).toBeGreaterThanOrEqual(8)
    const text = ideas.map((i) => i.title).join(" ").toLowerCase()
    expect(text).toMatch(/bir taxes|bookkeeping/)
    expect(text).toMatch(/personal finance|ipon|side hustle/)
    expect(text).not.toMatch(/k-drama/)
    expect(nicheInterests("K-drama recaps for busy fans", ["K-drama", "Coffee"])).toEqual(["K-drama"])
    expect(nicheInterests("", ["K-drama"])).toEqual(["K-drama"])
  })
})

// NICHE_PRINT=/path/to/file.txt writes readable samples for review (vitest hides logs of passing tests).
if (process.env.NICHE_PRINT) {
  it("prints samples", async () => {
    const { writeFileSync } = await import("node:fs")
    const blocks: string[] = []
    for (const input of [TAGLISH, ENGLISH, { language: "english", interests: ["Cooking"] }]) {
      const out = await niches(input)
      const lines = out.options.map((o) =>
        [
          `## ${o.kind.toUpperCase()} · ${o.name}`,
          `Niche: ${o.niche_statement}`,
          `Audience: ${o.audience} · Industry: ${o.industry}`,
          `Positioning: ${o.positioning_statement}`,
          `Pillars: ${o.pillars.map((p) => `${p.name} ${p.target_percentage}% (${p.description})`).join(" | ")}`,
          ...o.sample_posts.map((p) => `- ${p.title} — “${p.hook}”`),
          `Money: ${o.monetization.join(" · ")}`,
          `Fit: passion ${o.fit.passion.score} (${o.fit.passion.reason}) · expertise ${o.fit.expertise.score} (${o.fit.expertise.reason}) · demand ${o.fit.demand.score} (${o.fit.demand.reason})`,
          `Why: ${o.why_it_fits}`,
          `Risk: ${o.risk}`,
        ].join("\n")
      )
      blocks.push(`${lines.join("\n\n")}\nNotes: ${out.notes.join(" | ")}\n=====`)
    }
    writeFileSync(process.env.NICHE_PRINT as string, blocks.join("\n\n"))
  })
}
