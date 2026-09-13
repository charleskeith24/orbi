import { describe, expect, it } from "vitest"
import {
  comboCount,
  generateCombinations,
  goalStageFit,
  MATRIX_LIMIT,
  problemTopic,
  workingTitle,
  type MatrixCoverage,
  type MatrixSelection,
} from "./matrix-engine"

const coverage = (entries: [string, number][] = [], covered: string[] = []): MatrixCoverage => ({
  pillarFormat: new Map(entries),
  covered: new Set(covered),
})

const selection: MatrixSelection = {
  pillars: [
    { id: "p1", name: "Education", need: 0.6, deviation: -9 },
    { id: "p2", name: "Business", need: -0.5, deviation: 6 },
  ],
  formats: [
    { id: "f1", name: "Carousel" },
    { id: "f2", name: "Short video" },
  ],
  problems: [
    {
      id: "q1",
      text: "ROAS collapses every time budget is increased by more than 20%",
      severity: 5,
      personaId: null,
      pillarId: null,
      ideaCount: 0,
      itemCount: 0,
    },
    {
      id: "q2",
      text: "Doesn't know which creatives to test first",
      severity: 2,
      personaId: null,
      pillarId: null,
      ideaCount: 3,
      itemCount: 4,
    },
  ],
  goals: [{ id: "g1", name: "Become the go-to voice", category: "authority" }],
  stages: [
    { id: "tofu", label: "TOFU", need: 0 },
    { id: "mofu", label: "MOFU", need: 0 },
    { id: "bofu", label: "BOFU", need: 0 },
  ],
}

describe("generateCombinations", () => {
  it("counts the cartesian product", () => {
    expect(comboCount(selection)).toBe(24)
    expect(comboCount({ ...selection, goals: [] })).toBe(0)
    expect(generateCombinations({ ...selection, goals: [] }, coverage())).toEqual([])
  })

  it("returns every combination under the cap, ranked and unique", () => {
    const combos = generateCombinations(selection, coverage())
    expect(combos).toHaveLength(24)
    expect(new Set(combos.map((c) => c.key)).size).toBe(24)
    expect(combos.map((c) => c.rank)).toEqual(combos.map((_, i) => i + 1))
  })

  it("is deterministic", () => {
    expect(generateCombinations(selection, coverage())).toEqual(generateCombinations(selection, coverage()))
  })

  it("leads with the under-target pillar, the severe untapped problem and the goal's natural stage", () => {
    const [first] = generateCombinations(selection, coverage())
    expect(first.pillar.id).toBe("p1")
    expect(first.problem.id).toBe("q1")
    expect(first.stage.id).toBe("mofu")
    expect(first.reasons[0]).toBe("Education is 9 pts under target")
    expect(first.reasons).toContain("Untapped problem — no content yet")
    expect(first.reasons).toHaveLength(3)
  })

  it("rotates pillars instead of stacking the top one", () => {
    const top = generateCombinations(selection, coverage()).slice(0, 6)
    expect(new Set(top.map((c) => c.pillar.id)).size).toBe(2)
  })

  it("demotes combinations that already exist", () => {
    const [first] = generateCombinations(selection, coverage([], ["p1|f1|q1"]))
    expect(first.key.startsWith("p1|f1|q1")).toBe(false)
  })

  it("caps long lists", () => {
    const many: MatrixSelection = {
      ...selection,
      problems: Array.from({ length: 30 }, (_, i) => ({ ...selection.problems[0], id: `q${i}`, severity: (i % 5) + 1 })),
    }
    expect(comboCount(many)).toBeGreaterThan(MATRIX_LIMIT)
    expect(generateCombinations(many, coverage())).toHaveLength(MATRIX_LIMIT)
  })
})

describe("titles", () => {
  it("uses the first clause of a problem when it stands on its own", () => {
    expect(problemTopic("Doesn't know contribution margin per product, so a 'good' ROAS can still lose money")).toBe(
      "Doesn't know contribution margin per product"
    )
    expect(problemTopic("Product pages leak conversions: weak photos, no reviews")).toBe("Product pages leak conversions")
    expect(problemTopic("No structured creative testing — winning ads are found by accident")).toBe(
      "No structured creative testing"
    )
  })

  it("trims long topics on a word boundary", () => {
    const topic = problemTopic("word ".repeat(40))
    expect(topic.length).toBeLessThanOrEqual(72)
    expect(topic.endsWith("…")).toBe(true)
  })

  it("is stable per combination", () => {
    const a = workingTitle("p1|f1|q1|g1|tofu", "Journey", "Creatives fatigue in 2–3 weeks", "tofu")
    expect(a).toBe(workingTitle("p1|f1|q1|g1|tofu", "Journey", "Creatives fatigue in 2–3 weeks", "tofu"))
    expect(a).toMatch(/: Creatives fatigue in 2–3 weeks$/)
  })

  it("maps goals to their natural funnel stage", () => {
    expect(goalStageFit("awareness", "tofu")).toBe(1)
    expect(goalStageFit("awareness", "mofu")).toBe(0)
    expect(goalStageFit("awareness", "bofu")).toBe(-1)
    expect(goalStageFit("leads", "bofu")).toBe(1)
  })
})
