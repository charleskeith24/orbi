import { describe, expect, it } from "vitest"
import { createDemoDatabase } from "@/lib/data/seed"
import { buildBrandContext } from "./context"
import { brandVoiceSystemPrompt, renderBrandContext } from "./prompts/system"
import { refOf, resolveRef } from "./refs"
import { AI_TASK_NAMES, getAiTask } from "./tasks"

const NOW = new Date(2026, 8, 11, 10, 0, 0)
const db = createDemoDatabase("demo-user", NOW)
const ctx = buildBrandContext(db, NOW)
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

describe("brandVoiceSystemPrompt", () => {
  const prompt = brandVoiceSystemPrompt(ctx)

  it("names the brand, the language and the rules", () => {
    expect(prompt).toContain("Northbound Commerce")
    expect(prompt).toContain("Taglish")
    expect(prompt).toContain(ctx.brand.always_do.slice(0, 40))
    expect(prompt).toContain(ctx.brand.never_do.slice(0, 40))
    for (const phrase of ctx.brand.phrases_avoid) expect(prompt).toContain(phrase)
    expect(prompt).toContain(ctx.brand.phrases_used[0])
    expect(prompt).toMatch(/never claim to predict virality/i)
    expect(prompt).toMatch(/never copy or closely paraphrase/i)
    expect(prompt).toMatch(/never invent/i)
  })

  it("switches the language rule", () => {
    expect(brandVoiceSystemPrompt({ ...ctx, brand: { ...ctx.brand, language: "english" } })).toContain("plain, conversational English")
    expect(brandVoiceSystemPrompt({ ...ctx, brand: { ...ctx.brand, language: "tagalog" } })).toContain("Filipino (Tagalog)")
  })

  it("shows short refs, never UUIDs", () => {
    expect(renderBrandContext(ctx)).not.toMatch(UUID)
    expect(prompt).not.toMatch(UUID)
    expect(prompt).toContain(`P1 ${ctx.pillars[0].name}`)
  })

  it("maps refs back to real ids and rejects invented ones", () => {
    const pillar = ctx.pillars[1]
    expect(refOf(ctx, "pillar", pillar.id)).toBe("P2")
    expect(resolveRef(ctx, "pillar", "P2")).toBe(pillar.id)
    expect(resolveRef(ctx, "pillar", "p2 Authority")).toBe(pillar.id)
    expect(resolveRef(ctx, "pillar", pillar.name)).toBe(pillar.id)
    expect(resolveRef(ctx, "pillar", pillar.id)).toBe(pillar.id)
    expect(resolveRef(ctx, "pillar", "P99")).toBeNull()
    expect(resolveRef(ctx, "pillar", "made-up-id")).toBeNull()
  })

  it("handles an empty Brand HQ honestly", () => {
    const empty = buildBrandContext({ ...db, brand_profiles: [], content_pillars: [] }, NOW)
    expect(brandVoiceSystemPrompt(empty)).toMatch(/not been filled in yet/)
  })
})

describe("task prompts", () => {
  it.each(AI_TASK_NAMES)("%s: has a description, a token budget and no UUIDs in its prompt", (name) => {
    const task = getAiTask(name)
    expect(task.description.length).toBeGreaterThan(10)
    expect(task.maxTokens).toBeGreaterThan(0)
    expect(task.maxTokens).toBeLessThanOrEqual(16000)
  })

  it("generate_ideas turns id filters into refs", () => {
    const task = getAiTask("generate_ideas")
    const pillar = ctx.pillars[2]
    const { user } = task.buildPrompt(ctx, task.input.parse({ count: 5, pillar_id: pillar.id, topic: "cash flow" }))
    expect(user).toContain(`P3 ${pillar.name}`)
    expect(user).not.toMatch(UUID)
    expect(user).toContain("exactly 5")
  })

  it("score_content states it is a quality evaluation, not a virality prediction", () => {
    const task = getAiTask("score_content")
    const { user } = task.buildPrompt(ctx, task.input.parse({ text: "Draft", platform: "tiktok", format: "short_video" }))
    expect(user).toMatch(/quality evaluation/i)
    expect(user).toMatch(/not a prediction/i)
  })

  it("adapt_reference demands originality", () => {
    const task = getAiTask("adapt_reference")
    const { user } = task.buildPrompt(ctx, task.input.parse({ analysis: {}, platform: "linkedin" }))
    expect(user).toMatch(/ORIGINAL/)
    expect(user).toMatch(/never reuse or paraphrase/i)
  })

  it("strategist_chat sends real multi-turn history plus the analytics snapshot", () => {
    const task = getAiTask("strategist_chat")
    const input = task.input.parse({
      messages: [
        { role: "user", content: "What's working?" },
        { role: "assistant", content: "Story hooks." },
        { role: "user", content: "Why?" },
      ],
      snapshot: {},
    })
    const parts = task.buildPrompt(ctx, input)
    expect(parts.history).toHaveLength(2)
    expect(parts.user).toBe("Why?")
    expect(parts.system).toMatch(/Content Health Score/)
  })
})
