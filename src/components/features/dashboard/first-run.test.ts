import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { createStarterDatabase } from "@/lib/data/starter"
import type { Database } from "@/lib/types"
import { firstSteps, hasPublishedContent, workspaceStartKey } from "./first-run"

const NOW = new Date(2026, 8, 13, 12)
const USER = "user-1"

describe("first run", () => {
  it("starts a new workspace on the day it was created, with nothing published and every step open", () => {
    const db = createStarterDatabase(USER, NOW)
    expect(hasPublishedContent(db.content_items)).toBe(false)
    expect(workspaceStartKey(db)).toBe("2026-09-13")
    // As Quick setup leaves it before the creator picks a voice: no tones, no traits.
    const fresh: Database = { ...db, brand_profiles: [{ ...db.brand_profiles[0], tones: [], personality_traits: [] }] }
    const steps = firstSteps(fresh)
    // The loop: Strategy (niche, pillars, voice, problems) → Ideas → Create → Publish → Measure.
    expect(steps.map((s) => s.key)).toEqual(["niche", "pillars", "voice", "problems", "idea", "content", "publish", "analytics"])
    expect(steps.every((s) => !s.done)).toBe(true)
  })

  it("asks for the voice and the audience's problems until the workspace has them", () => {
    const base = createStarterDatabase(USER, NOW)
    const brand = { ...base.brand_profiles[0], tones: [], personality_traits: [] }
    const open = (db: Database) => Object.fromEntries(firstSteps(db).map((s) => [s.key, s]))
    const blank = open({ ...base, brand_profiles: [brand] })
    expect(blank.voice).toMatchObject({ done: false, action: { kind: "link", href: "/strategy#personality" } })
    expect(blank.problems).toMatchObject({ done: false, action: { kind: "link", href: "/audience/problems" } })

    expect(open({ ...base, brand_profiles: [{ ...brand, tones: ["casual"] }] }).voice.done).toBe(true)
    expect(open({ ...base, brand_profiles: [{ ...brand, personality_traits: ["direct"] }] }).voice.done).toBe(true)
    const problem = buildRow("audience_problems", { problem: "Doesn't know how to file taxes" }, USER, NOW)
    expect(open({ ...base, brand_profiles: [brand], audience_problems: [problem] }).problems.done).toBe(true)

    const tl = firstSteps({ ...base, brand_profiles: [brand] }, "tl")
    expect(tl.find((s) => s.key === "voice")?.label).toBe("I-set ang voice mo")
    expect(tl.find((s) => s.key === "problems")?.label).toBe("Idagdag ang problema ng audience mo")
  })

  it("moves the start back to the earliest logged post and ticks steps off from real rows", () => {
    const base = createStarterDatabase(USER, NOW)
    const post = buildRow(
      "content_items",
      { title: "Old post", platform: "facebook", stage: "published", published_at: new Date(2026, 5, 2, 9).toISOString() },
      USER,
      NOW
    )
    const db: Database = {
      ...base,
      content_items: [post],
      brand_profiles: [{ ...base.brand_profiles[0], niche: "Bookkeeping for online sellers" }],
    }
    expect(hasPublishedContent(db.content_items)).toBe(true)
    expect(workspaceStartKey(db)).toBe("2026-06-02")
    // The starter brand still carries the default "conversational" tone, so its voice counts as set.
    expect(firstSteps(db).filter((s) => s.done).map((s) => s.key)).toEqual(["niche", "voice", "content", "publish"])
  })
})
