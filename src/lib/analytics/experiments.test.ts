import { describe, expect, it } from "vitest"
import type { ExperimentMetric } from "@/lib/types"
import { experimentResults } from "./experiments"
import { add, addPublished, makeDb } from "./test-fixtures"

function run(aViews: number[], bViews: number[], metric: ExperimentMetric = "views") {
  const db = makeDb()
  const a = aViews.map((v, i) => addPublished(db, 10 + i, {}, { views: v, reach: v, likes: v / 10 }))
  const b = bViews.map((v, i) => addPublished(db, 5 + i, {}, { views: v, reach: v, likes: v / 5 }))
  const experiment = add(db, "content_experiments", {
    metric,
    variant_a_item_ids: a.map((x) => x.id),
    variant_b_item_ids: b.map((x) => x.id),
  })
  return experimentResults(db, experiment)
}

describe("experimentResults", () => {
  it("suggests B when it beats A by at least 10%", () => {
    const result = run([100, 200], [180, 180])
    expect(result).toMatchObject({ lift: 20, suggestedWinner: "b" })
    expect(result.a).toMatchObject({ n: 2, mean: 150 })
    expect(result.b).toMatchObject({ n: 2, mean: 180 })
    expect(result.reason).toBe("B beat A by 20% on views")
  })

  it("suggests A when B is at least 10% lower", () => {
    expect(run([200, 200], [150, 170])).toMatchObject({ lift: -20, suggestedWinner: "a" })
  })

  it("treats exactly 10% as decisive", () => {
    expect(run([100, 100], [110, 110])).toMatchObject({ lift: 10, suggestedWinner: "b" })
  })

  it("is inconclusive with fewer than 2 measured posts per variant", () => {
    const result = run([100], [500, 600])
    expect(result.suggestedWinner).toBe("inconclusive")
    expect(result.reason).toContain("at least 2 measured posts")
  })

  it("is inconclusive when |lift| is under 10%", () => {
    const result = run([100, 100], [105, 108])
    expect(result).toMatchObject({ lift: 6.5, suggestedWinner: "inconclusive" })
    expect(result.reason).toContain("too close to call")
  })

  it("evaluates rate metrics", () => {
    // A: 10% engagement, B: 20% engagement
    expect(run([100, 200], [100, 200], "engagement_rate")).toMatchObject({ lift: 100, suggestedWinner: "b" })
  })

  it("ignores unmeasured and deleted items", () => {
    const db = makeDb()
    const measured = [addPublished(db, 3, {}, { views: 10 }), addPublished(db, 4, {}, { views: 30 })]
    const unmeasured = addPublished(db, 5)
    const experiment = add(db, "content_experiments", {
      variant_a_item_ids: [...measured.map((m) => m.id), unmeasured.id, "deleted-id"],
      variant_b_item_ids: [],
      metric: "views",
    })
    const result = experimentResults(db, experiment)
    expect(result.a.items).toHaveLength(3)
    expect(result.a).toMatchObject({ n: 2, mean: 20 })
    expect(result.b).toMatchObject({ n: 0, mean: null })
    expect(result).toMatchObject({ lift: null, suggestedWinner: "inconclusive" })
  })
})
