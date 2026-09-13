import { describe, expect, it } from "vitest"
import { createDemoDatabase } from "@/lib/data/seed"
import { emptyDatabase } from "@/lib/data/defaults"
import { brandContextSchema, buildAnalyticsSnapshot, buildBrandContext, parseBrandContext } from "./context"
import { brandVoiceSystemPrompt, renderBrandContext } from "./prompts/system"

const NOW = new Date(2026, 8, 11, 10, 0, 0)
const db = createDemoDatabase("demo-user", NOW)

describe("buildBrandContext", () => {
  it("captures the demo brand and stays compact", () => {
    const ctx = buildBrandContext(db, NOW, { focus: "content systems inspiration business owners" })
    expect(ctx.brand.brand_name).toBe("Northbound Commerce")
    expect(ctx.brand.language).toBe("taglish")
    expect(ctx.brand.positioning_statement).toMatch(/^I help /)
    expect(ctx.pillars.length).toBeGreaterThan(3)
    expect(ctx.personas.length).toBeGreaterThan(0)
    expect(ctx.stories.length).toBeGreaterThan(0)
    expect(ctx.stories.length).toBeLessThanOrEqual(12)
    expect(ctx.recent_titles.length).toBeLessThanOrEqual(30)
    // Payload to the gateway (UUIDs included) stays small…
    expect(JSON.stringify(ctx).length).toBeLessThan(45_000)
    // …and what the model actually reads (refs instead of UUIDs) stays under ~6k tokens.
    expect(renderBrandContext(ctx, { voice: false }).length).toBeLessThan(22_000)
    // Rules (~3.5k chars) + the context above.
    expect(brandVoiceSystemPrompt(ctx).length).toBeLessThan(26_000)
  })

  it("round-trips through the lenient server schema unchanged", () => {
    const ctx = buildBrandContext(db, NOW)
    expect(brandContextSchema.parse(JSON.parse(JSON.stringify(ctx)))).toEqual(ctx)
  })

  it("forces requested stories into the context in full", () => {
    const story = db.stories[db.stories.length - 1]
    const ctx = buildBrandContext(db, NOW, { storyIds: [story.id] })
    const found = ctx.stories.find((s) => s.id === story.id)
    expect(found?.situation).not.toBe("")
  })

  it("works on an empty workspace", () => {
    const ctx = buildBrandContext(emptyDatabase(), NOW)
    expect(ctx.pillars).toEqual([])
    expect(ctx.brand.language).toBe("english")
  })

  it("tolerates garbage on the server", () => {
    const ctx = parseBrandContext({ brand: "nope", pillars: [{ id: 1 }, { id: "p1", name: "Education" }], settings: null })
    expect(ctx.pillars).toHaveLength(1)
    expect(ctx.settings.weekly_post_target).toBe(10)
    expect(parseBrandContext(null).goals).toEqual([])
  })
})

describe("buildAnalyticsSnapshot", () => {
  it("summarises the demo workspace with real numbers", () => {
    const snap = buildAnalyticsSnapshot(db, NOW)
    expect(snap.health.score).toBeGreaterThan(0)
    expect(snap.weekly.target).toBeGreaterThan(0)
    expect(snap.platforms.length).toBeGreaterThan(0)
    expect(snap.recommendations.length).toBeGreaterThan(0)
    expect(JSON.stringify(snap).length).toBeLessThan(20_000)
  })
})
