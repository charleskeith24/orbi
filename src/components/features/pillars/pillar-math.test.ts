import { describe, expect, it } from "vitest"
import type { ContentPillar } from "@/lib/types"
import {
  activeTargetTotal,
  describeUsage,
  formatPoints,
  missingPresets,
  nextPillarColor,
  normalizeTo100,
  reorderPatches,
  targetTotalError,
} from "./pillar-math"

const pillar = (id: string, sort_order: number, extra: Partial<ContentPillar> = {}): ContentPillar => ({
  id,
  user_id: "u",
  created_at: "",
  updated_at: "",
  name: id,
  description: "",
  color: "blue",
  icon: "Layers",
  target_percentage: 0,
  examples: [],
  sort_order,
  is_active: true,
  ...extra,
})

describe("normalizeTo100", () => {
  it("keeps a valid split untouched", () => {
    expect(normalizeTo100([30, 20, 20, 15, 10, 5])).toEqual([30, 20, 20, 15, 10, 5])
  })

  it("scales to whole numbers that add up to exactly 100", () => {
    expect(normalizeTo100([1, 1, 1])).toEqual([34, 33, 33])
    expect(normalizeTo100([50, 50, 20])).toEqual([42, 42, 16])
    expect(normalizeTo100([60, 30, 30])).toEqual([50, 25, 25])
    const odd = normalizeTo100([7, 13, 29, 3, 11])
    expect(odd.reduce((a, b) => a + b, 0)).toBe(100)
    expect(odd.every(Number.isInteger)).toBe(true)
  })

  it("splits evenly when nothing is set", () => {
    expect(normalizeTo100([0, 0, 0, 0])).toEqual([25, 25, 25, 25])
    expect(normalizeTo100([null, undefined])).toEqual([50, 50])
    expect(normalizeTo100([])).toEqual([])
  })
})

describe("target validation", () => {
  it("only accepts exactly 100", () => {
    expect(targetTotalError(100)).toBeNull()
    expect(targetTotalError(95)).toContain("5 pts left")
    expect(targetTotalError(110)).toContain("remove 10 pts")
  })

  it("sums active pillars only", () => {
    expect(
      activeTargetTotal([
        pillar("a", 0, { target_percentage: 60 }),
        pillar("b", 1, { target_percentage: 40 }),
        pillar("c", 2, { target_percentage: 25, is_active: false }),
      ])
    ).toBe(100)
  })

  it("formats deviations as points", () => {
    expect(formatPoints(0.4)).toBe("on target")
    expect(formatPoints(4.6)).toBe("+5 pts")
    expect(formatPoints(-3)).toBe("−3 pts")
  })
})

describe("reorderPatches", () => {
  it("swaps with the neighbour and renumbers", () => {
    const pillars = [pillar("a", 0), pillar("b", 1), pillar("c", 2)]
    expect(reorderPatches(pillars, "b", -1)).toEqual([
      { id: "b", patch: { sort_order: 0 } },
      { id: "a", patch: { sort_order: 1 } },
    ])
  })

  it("does nothing at the edges", () => {
    const pillars = [pillar("a", 0), pillar("b", 1)]
    expect(reorderPatches(pillars, "a", -1)).toEqual([])
    expect(reorderPatches(pillars, "b", 1)).toEqual([])
    expect(reorderPatches(pillars, "missing", 1)).toEqual([])
  })

  it("moves within the active group and numbers paused pillars after it", () => {
    const pillars = [pillar("a", 0), pillar("p", 0, { is_active: false }), pillar("b", 1)]
    expect(reorderPatches(pillars, "b", -1)).toEqual([
      { id: "b", patch: { sort_order: 0 } },
      { id: "a", patch: { sort_order: 1 } },
      { id: "p", patch: { sort_order: 2 } },
    ])
  })
})

describe("presets and usage", () => {
  it("lists recommended pillars that are missing (case-insensitive)", () => {
    const missing = missingPresets([{ name: "Education" }, { name: " authority " }])
    expect(missing.map((p) => p.name)).toEqual(["Journey", "Leadership", "Personal", "Business"])
  })

  it("picks the first unused colour in the fixed order", () => {
    expect(nextPillarColor([{ color: "blue" }, { color: "orange" }])).toBe("aqua")
  })

  it("describes linked records", () => {
    expect(describeUsage({ items: 2, ideas: 1, other: 0, total: 3 })).toBe("2 content items and 1 idea")
    expect(describeUsage({ items: 3, ideas: 2, other: 4, total: 9 })).toBe("3 content items, 2 ideas and 4 other records")
    expect(describeUsage({ items: 0, ideas: 0, other: 0, total: 0 })).toBe("")
  })
})
