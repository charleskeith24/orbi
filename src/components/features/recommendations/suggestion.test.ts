import { describe, expect, it } from "vitest"
import type { AiTaskOutput } from "@/lib/ai"
import type { ContentRecommendation } from "@/lib/analytics"
import { buildRow } from "@/lib/data/defaults"
import { extraSignals, fromAiOutput, fromRecommendation, type SuggestionLookups } from "./suggestion"

const NOW = new Date(2026, 8, 13, 10)
const format = buildRow("content_formats", { id: "f1", name: "Short-form Video", category: "video" }, "u", NOW)
const carousel = buildRow("content_formats", { id: "f2", name: "Carousel", category: "visual" }, "u", NOW)
const angle = buildRow("angles", { id: "a1", name: "Contrarian" }, "u", NOW)
const idea = buildRow("content_ideas", { id: "idea1", title: "Stop boosting posts" }, "u", NOW)
const item = buildRow("content_items", { id: "item1", title: "Hiring for ownership", idea_id: "idea9" }, "u", NOW)

const lookups: SuggestionLookups = {
  formats: new Map([
    [format.id, format],
    [carousel.id, carousel],
  ]),
  angles: new Map([[angle.id, angle]]),
  ideas: new Map([[idea.id, idea]]),
  items: new Map([[item.id, item]]),
}

const rec = (overrides: Partial<ContentRecommendation>): ContentRecommendation => ({
  kind: "idea",
  id: idea.id,
  title: idea.title,
  pillarId: null,
  platform: "tiktok",
  formatId: format.id,
  angleId: angle.id,
  hook: "Boosting is a tax on impatience.",
  cta: "",
  score: 72,
  reasons: { topic: "Asked 5× in your Question Bank", platform: "Planned for TikTok", format: "Planned as Short-form Video", angle: "Uses the “Contrarian” angle" },
  signals: ["Asked 5× in your Question Bank", "Idea Score 80 — high priority"],
  breakdown: { pillarGap: 10, slot: 0, ideaScore: 16, demand: 15, winnerSimilarity: 12, platform: 9, freshness: 5 },
  ...overrides,
})

const pick = (overrides: Partial<AiTaskOutput<"what_to_post">["pick"]>): AiTaskOutput<"what_to_post">["pick"] => ({
  title: "AI title",
  idea_id: null,
  item_id: null,
  pillar_id: null,
  platform: "instagram",
  format: "carousel",
  angle: "—",
  hook: "Sharper hook",
  cta: "Save this",
  why_topic: "Because the audience keeps asking",
  why_platform: "",
  why_format: "Carousels get saved",
  why_angle: "",
  ...overrides,
})

describe("fromRecommendation", () => {
  it("resolves format and angle names and the idea behind an item", () => {
    const s = fromRecommendation(rec({}), lookups)
    expect(s).toMatchObject({ key: "idea:idea1", ideaId: "idea1", formatName: "Short-form Video", angleName: "Contrarian", score: 72 })
    const fromItem = fromRecommendation(rec({ kind: "item", id: item.id, title: item.title }), lookups)
    expect(fromItem.ideaId).toBe("idea9")
  })
})

describe("fromAiOutput", () => {
  const engine = [fromRecommendation(rec({}), lookups)]

  it("maps picks to known rows, keeping the engine's score and filling blanks from it", () => {
    const [s] = fromAiOutput({ pick: pick({ idea_id: idea.id }), alternatives: [] }, engine, lookups)
    expect(s).toMatchObject({
      key: "idea:idea1",
      title: "Stop boosting posts",
      platform: "instagram",
      formatId: "f2",
      formatName: "Carousel",
      angleName: "Contrarian",
      hook: "Sharper hook",
      score: 72,
    })
    expect(s.reasons.topic).toBe("Because the audience keeps asking")
    expect(s.reasons.platform).toBe("Planned for TikTok")
  })

  it("drops picks for rows that don't exist and duplicates", () => {
    const out = fromAiOutput(
      { pick: pick({ idea_id: "missing" }), alternatives: [pick({ item_id: item.id }), pick({ item_id: item.id })] },
      engine,
      lookups
    )
    expect(out.map((s) => s.key)).toEqual(["item:item1"])
    expect(out[0].score).toBeNull()
  })
})

describe("extraSignals", () => {
  it("skips signals already shown as a reason", () => {
    expect(extraSignals(fromRecommendation(rec({}), lookups))).toEqual(["Idea Score 80 — high priority"])
  })
})
