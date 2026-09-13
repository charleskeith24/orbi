import { describe, expect, it } from "vitest"
import type { Database, ID } from "@/lib/types"
import { funnelMix, isMixUnbalanced, pillarMix } from "./balance"
import { add, addPublished, daysAgo, makeDb, NOW, settingsOf } from "./test-fixtures"

function withPillars(targets: Record<string, number>) {
  const db = makeDb({ pillar_tolerance: 10 })
  const pillars: Record<string, ID> = {}
  Object.entries(targets).forEach(([name, target], i) => {
    pillars[name] = add(db, "content_pillars", { name, target_percentage: target, sort_order: i }).id
  })
  return { db, pillars }
}

function publish(db: Database, pillarId: ID | null, count: number, startDaysAgo = 1) {
  for (let i = 0; i < count; i++) addPublished(db, startDaysAgo + (i % 25), { pillar_id: pillarId })
}

describe("pillarMix", () => {
  it("flags over- and under-represented pillars beyond the tolerance", () => {
    const { db, pillars } = withPillars({ Education: 50, Journey: 30, Business: 20 })
    publish(db, pillars.Education, 8)
    publish(db, pillars.Journey, 2)
    const mix = pillarMix(db, NOW, settingsOf(db))
    expect(mix.rows.map((r) => [r.label, r.count, r.actualPct, r.targetPct, r.deviation, r.status])).toEqual([
      ["Education", 8, 80, 50, 30, "over"],
      ["Journey", 2, 20, 30, -10, "on_target"],
      ["Business", 0, 0, 20, -20, "under"],
    ])
    expect(mix.warnings.map((w) => w.message)).toEqual([
      "Education is at 80% vs a 50% target — over-represented",
      "Business is at 0% vs a 20% target — under-represented",
    ])
    expect(isMixUnbalanced(mix)).toBe(true)
  })

  it("flags a small pillar that is off by more than half its target", () => {
    const { db, pillars } = withPillars({ Education: 60, Journey: 35, Business: 5 })
    publish(db, pillars.Education, 30)
    publish(db, pillars.Journey, 19)
    publish(db, pillars.Business, 1)
    const mix = pillarMix(db, NOW, settingsOf(db))
    expect(mix.warnings.map((w) => w.message)).toEqual(["Business is at 2% vs a 5% target — under-represented"])
  })

  it("stays quiet within tolerance and without enough data", () => {
    const { db, pillars } = withPillars({ Education: 50, Journey: 50 })
    publish(db, pillars.Education, 3)
    publish(db, pillars.Journey, 2)
    expect(pillarMix(db, NOW, settingsOf(db)).warnings).toEqual([])

    const sparse = withPillars({ Education: 50, Journey: 50 })
    publish(sparse.db, sparse.pillars.Education, 3)
    const mix = pillarMix(sparse.db, NOW, settingsOf(sparse.db))
    expect(mix).toMatchObject({ total: 3, enoughData: false, warnings: [] })
    expect(isMixUnbalanced(mix)).toBe(false)
  })

  it("counts upcoming scheduled items, skips old posts and reports unassigned items", () => {
    const { db, pillars } = withPillars({ Education: 50, Journey: 50 })
    publish(db, pillars.Education, 2)
    addPublished(db, 40, { pillar_id: pillars.Journey })
    add(db, "content_items", { stage: "scheduled", pillar_id: pillars.Journey, scheduled_at: daysAgo(-3).toISOString() })
    add(db, "content_items", { stage: "scheduled", pillar_id: pillars.Journey, scheduled_at: daysAgo(-20).toISOString() })
    publish(db, null, 1)
    const mix = pillarMix(db, NOW, settingsOf(db))
    expect(mix.rows.map((r) => r.count)).toEqual([2, 1])
    expect(mix).toMatchObject({ total: 3, unassigned: 1 })
    expect(mix.window.end).toBe("2026-09-17")
    expect(pillarMix(db, NOW, settingsOf(db), { upcomingDays: 0 }).rows.map((r) => r.count)).toEqual([2, 0])
  })

  it("counts items whose pillar was deleted or deactivated as unassigned", () => {
    const { db, pillars } = withPillars({ Education: 50, Journey: 50 })
    const retired = add(db, "content_pillars", { name: "Retired", is_active: false })
    publish(db, pillars.Education, 3)
    publish(db, "deleted-pillar", 1)
    publish(db, retired.id, 1)
    const mix = pillarMix(db, NOW, settingsOf(db))
    expect(mix).toMatchObject({ total: 3, unassigned: 2 })
    expect(mix.rows.map((r) => r.label)).toEqual(["Education", "Journey"])
  })

  it("normalises targets that don't add up to 100", () => {
    const { db, pillars } = withPillars({ Education: 40, Journey: 20, Business: 20 })
    publish(db, pillars.Education, 5)
    const mix = pillarMix(db, NOW, settingsOf(db))
    expect(mix.targetTotal).toBe(80)
    expect(mix.rows.map((r) => r.targetPct)).toEqual([50, 25, 25])
  })
})

describe("funnelMix", () => {
  it("compares TOFU / MOFU / BOFU with settings.funnel_targets", () => {
    const db = makeDb() // targets 50 / 35 / 15, tolerance 10
    for (let i = 0; i < 8; i++) addPublished(db, 1 + i, { funnel_stage: "tofu" })
    for (let i = 0; i < 2; i++) addPublished(db, 1 + i, { funnel_stage: "mofu" })
    addPublished(db, 2)
    const mix = funnelMix(db, NOW, settingsOf(db))
    expect(mix.rows.map((r) => [r.key, r.actualPct, r.targetPct, r.status])).toEqual([
      ["tofu", 80, 50, "over"],
      ["mofu", 20, 35, "under"],
      ["bofu", 0, 15, "under"],
    ])
    expect(mix.unassigned).toBe(1)
    expect(mix.warnings.map((w) => w.message)).toContain("BOFU is at 0% vs a 15% target — under-represented")
  })
})
