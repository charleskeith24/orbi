import { describe, expect, it } from "vitest"
import type { ContentItem, Database, InsertRow, PlatformId } from "@/lib/types"
import { itemPerformanceRows } from "./metrics"
import { computeTiers, getWinners, performanceValue, tierForRatio, topPerformers } from "./performance"
import { add, addMetric, addPublished, ids, makeDb, NOW, settingsOf } from "./test-fixtures"

/** One measured post per day on `platform`, oldest first, starting `startDaysAgo` days ago. */
function publishSeries(db: Database, platform: PlatformId, views: number[], startDaysAgo: number): ContentItem[] {
  return views.map((v, i) => addPublished(db, startDaysAgo - i, { platform }, { views: v, reach: v }))
}

function tierFor(value: number, settings: InsertRow<"app_settings"> = {}) {
  const db = makeDb(settings)
  publishSeries(db, "tiktok", [100, 100, 100], 10)
  const [target] = publishSeries(db, "tiktok", [value], 1)
  return computeTiers(db, settingsOf(db), NOW).get(target.id)
}

describe("tier thresholds", () => {
  it.each([
    [149, "normal"],
    [150, "good"],
    [199, "good"],
    [200, "winner"],
    [299, "winner"],
    [300, "breakout"],
    [900, "breakout"],
  ])("%d views vs a 100-view baseline → %s", (views, tier) => {
    expect(tierFor(views)?.tier).toBe(tier)
  })

  it("reports ratio, value, baseline and sample size", () => {
    expect(tierFor(250)).toEqual({ tier: "winner", ratio: 2.5, value: 250, baseline: 100, sampleSize: 3 })
  })

  it("honours custom thresholds", () => {
    expect(tierFor(130, { tier_good: 1.2, tier_winner: 1.3, tier_breakout: 5 })?.tier).toBe("winner")
  })

  it("tierForRatio treats null as normal", () => {
    const settings = settingsOf(makeDb())
    expect(tierForRatio(null, settings)).toBe("normal")
    expect(tierForRatio(3, settings)).toBe("breakout")
  })
})

describe("minimum sample", () => {
  it("keeps posts Normal with a null ratio until winner_min_sample comparison posts exist", () => {
    const db = makeDb() // winner_min_sample = 3
    const items = publishSeries(db, "tiktok", [100, 100, 1000], 10)
    const tiers = computeTiers(db, settingsOf(db), NOW)
    expect(tiers.get(items[0].id)).toMatchObject({ tier: "normal", ratio: null, sampleSize: 0, baseline: null })
    expect(tiers.get(items[2].id)).toMatchObject({ tier: "normal", ratio: null, sampleSize: 2, baseline: 100, value: 1000 })
  })

  it("assigns tiers once the minimum sample is met", () => {
    const db = makeDb({ winner_min_sample: 2 })
    const items = publishSeries(db, "tiktok", [100, 100, 1000], 10)
    expect(computeTiers(db, settingsOf(db), NOW).get(items[2].id)).toMatchObject({ tier: "breakout", ratio: 10, sampleSize: 2 })
  })

  it("caps the minimum sample at the window size so tiers can still be reached", () => {
    const db = makeDb({ winner_window: 2, winner_min_sample: 5 })
    const items = publishSeries(db, "tiktok", [100, 100, 300], 10)
    expect(computeTiers(db, settingsOf(db), NOW).get(items[2].id)).toMatchObject({ sampleSize: 2, ratio: 3, tier: "breakout" })
  })
})

describe("comparison window", () => {
  it("compares against the previous winner_window posts only", () => {
    const db = makeDb() // winner_window = 20
    publishSeries(db, "youtube", Array(5).fill(10_000), 60)
    publishSeries(db, "youtube", Array(20).fill(100), 40)
    const [target] = publishSeries(db, "youtube", [250], 5)
    expect(computeTiers(db, settingsOf(db), NOW).get(target.id)).toMatchObject({
      baseline: 100,
      sampleSize: 20,
      ratio: 2.5,
      tier: "winner",
    })
    const wide = computeTiers(db, { ...settingsOf(db), winner_window: 25 }, NOW).get(target.id)
    expect(wide).toMatchObject({ baseline: 2080, sampleSize: 25, tier: "normal" })
  })

  it("uses what exists when fewer than winner_window posts are available", () => {
    const db = makeDb()
    publishSeries(db, "x", [80, 120, 100, 100], 10)
    const [target] = publishSeries(db, "x", [300], 2)
    expect(computeTiers(db, settingsOf(db), NOW).get(target.id)).toMatchObject({ sampleSize: 4, baseline: 100, tier: "breakout" })
  })

  it("leaves unpublished items with analytics out of tiers and baselines", () => {
    const db = makeDb()
    publishSeries(db, "x", [100, 100, 100], 10)
    const draft = add(db, "content_items", { stage: "review", platform: "x" })
    addMetric(db, draft, { views: 100_000 })
    const [target] = publishSeries(db, "x", [200], 2)
    const tiers = computeTiers(db, settingsOf(db), NOW)
    expect(tiers.has(draft.id)).toBe(false)
    expect(tiers.get(target.id)).toMatchObject({ baseline: 100, sampleSize: 3, tier: "winner" })
  })

  it("only compares posts on the same platform", () => {
    const db = makeDb()
    for (let i = 0; i < 4; i++) {
      addPublished(db, 20 - 2 * i, { platform: "linkedin" }, { views: 100, reach: 100 })
      addPublished(db, 19 - 2 * i, { platform: "tiktok" }, { views: 10_000, reach: 10_000 })
    }
    const target = addPublished(db, 2, { platform: "linkedin" }, { views: 300, reach: 300 })
    const tiktok = addPublished(db, 1, { platform: "tiktok" }, { views: 10_000, reach: 10_000 })
    const tiers = computeTiers(db, settingsOf(db), NOW)
    expect(tiers.get(target.id)).toMatchObject({ baseline: 100, sampleSize: 4, tier: "breakout" })
    expect(tiers.get(tiktok.id)).toMatchObject({ baseline: 10_000, ratio: 1, tier: "normal" })
  })

  it("ignores unmeasured posts and posts published later", () => {
    const db = makeDb()
    publishSeries(db, "x", [100, 100, 100], 10)
    addPublished(db, 6, { platform: "x" }) // no analytics yet
    const target = addPublished(db, 5, { platform: "x" }, { views: 200 })
    addPublished(db, 1, { platform: "x" }, { views: 100_000 })
    const tiers = computeTiers(db, settingsOf(db), NOW)
    expect(tiers.get(target.id)).toMatchObject({ sampleSize: 3, baseline: 100, tier: "winner" })
    expect(tiers.size).toBe(5)
  })
})

describe("winner metrics", () => {
  it("supports engagement rate", () => {
    const db = makeDb({ winner_metric: "engagement_rate" })
    for (let i = 0; i < 3; i++) addPublished(db, 10 - i, { platform: "instagram" }, { reach: 1000, likes: 50 })
    const target = addPublished(db, 3, { platform: "instagram" }, { reach: 500, likes: 50 })
    expect(computeTiers(db, settingsOf(db), NOW).get(target.id)).toMatchObject({ ratio: 2, tier: "winner" })
  })

  it("composite averages the ratios of views, ER, shares and saves and skips zero baselines", () => {
    const db = makeDb({ winner_metric: "composite" })
    for (let i = 0; i < 3; i++) {
      addPublished(db, 10 - i, { platform: "facebook" }, { views: 100, reach: 100, likes: 6, shares: 2, saves: 2, leads: 0 })
    }
    const target = addPublished(db, 2, { platform: "facebook" }, { views: 200, reach: 100, likes: 12, shares: 4, saves: 4, leads: 7 })
    const tier = computeTiers(db, settingsOf(db), NOW).get(target.id)
    expect(tier?.ratio).toBeCloseTo(2)
    expect(tier).toMatchObject({ tier: "winner", baseline: 1, sampleSize: 3 })
  })

  it("performanceValue is null without a snapshot or composite baselines", () => {
    const db = makeDb()
    addPublished(db, 1)
    addPublished(db, 2, {}, { views: 10 })
    const [unmeasured, measured] = itemPerformanceRows(db, NOW)
    expect(performanceValue(unmeasured, "views")).toBeNull()
    expect(performanceValue(measured, "composite")).toBeNull()
    expect(performanceValue(measured, "views")).toBe(10)
  })
})

describe("getWinners", () => {
  it("lists winners, breakouts and pinned posts, best ratio first", () => {
    const db = makeDb()
    publishSeries(db, "tiktok", [100, 100, 100], 20)
    const winner = addPublished(db, 10, { platform: "tiktok" }, { views: 220 })
    const breakout = addPublished(db, 8, { platform: "tiktok" }, { views: 1000 })
    addPublished(db, 6, { platform: "tiktok" }, { views: 100 })
    const pinned = addPublished(db, 4, { platform: "linkedin", pinned_winner: true })
    const settings = settingsOf(db)

    const winners = getWinners(db, settings, NOW)
    expect(ids(winners)).toEqual([breakout.id, winner.id, pinned.id])
    expect(winners[0].tier).toBe("breakout")
    expect(winners[1].tier).toBe("winner")
    expect(winners[2]).toMatchObject({ tier: "normal", ratio: null })
    expect(ids(getWinners(db, settings, NOW, { days: 9 }))).toEqual([breakout.id, pinned.id])
  })
})

describe("topPerformers", () => {
  it("ranks recent measured posts by the chosen metric", () => {
    const db = makeDb()
    const a = addPublished(db, 3, {}, { views: 500, reach: 500, likes: 5 })
    const b = addPublished(db, 2, {}, { views: 300, reach: 300, likes: 60 })
    addPublished(db, 45, {}, { views: 10_000 })
    addPublished(db, 1)
    const settings = settingsOf(db)
    expect(ids(topPerformers(db, settings, NOW))).toEqual([a.id, b.id])
    expect(ids(topPerformers(db, settings, NOW, { by: "engagement_rate" }))).toEqual([b.id, a.id])
    expect(topPerformers(db, settings, NOW, { limit: 1 })).toHaveLength(1)
    expect(topPerformers(db, settings, NOW, { days: 90 })[0].views).toBe(10_000)
    expect(topPerformers(db, settings, NOW, { platform: "tiktok" })).toEqual([])
  })
})
