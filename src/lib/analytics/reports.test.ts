import { describe, expect, it } from "vitest"
import { monthlyReport, weeklyReport } from "./reports"
import { add, addPublished, makeDb, NOW, on, settingsOf } from "./test-fixtures"

describe("weeklyReport", () => {
  it("is empty-safe", () => {
    const db = makeDb()
    const report = weeklyReport(db, NOW, settingsOf(db))
    expect(report).toMatchObject({
      range: { start: "2026-09-07", end: "2026-09-13" },
      previousRange: { start: "2026-08-31", end: "2026-09-06" },
      published: 0,
      consistencyPct: 0,
      bestPost: null,
      worstPost: null,
      bestPlatform: null,
      bestPillar: null,
      bestTopic: null,
      bestFormat: null,
      bestHook: null,
      topPosts: [],
      winners: 0,
    })
    expect(report.deltas.views).toBeNull()
    expect(report.contentMix.pillars.rows).toEqual([])
  })

  it("summarises the week with best/worst posts, highlights and deltas", () => {
    const db = makeDb({ weekly_post_target: 4 })
    const education = add(db, "content_pillars", { name: "Education" })
    const leadership = add(db, "content_pillars", { name: "Leadership", sort_order: 1 })
    const reel = add(db, "content_formats", { name: "Reel" })
    const best = addPublished(
      db,
      2,
      { pillar_id: education.id, platform: "tiktok", format_id: reel.id, hook_category: "story" },
      { views: 900, reach: 900, likes: 90 }
    )
    const mid = addPublished(db, 1, { pillar_id: leadership.id, platform: "linkedin", hook_category: "list" }, { views: 400, reach: 400, likes: 20 })
    const worst = addPublished(db, 3, { pillar_id: leadership.id, platform: "linkedin", hook_category: "list" }, { views: 100, reach: 100, likes: 5 })
    addPublished(db, 8, { pillar_id: education.id, platform: "tiktok" }, { views: 700, reach: 700 })

    const report = weeklyReport(db, on(2026, 9, 9), settingsOf(db))
    expect(report).toMatchObject({ published: 3, target: 4, consistencyPct: 75 })
    expect(report.bestPost?.id).toBe(best.id)
    expect(report.worstPost?.id).toBe(worst.id)
    expect(report.topPosts.map((p) => p.id)).toEqual([best.id, mid.id, worst.id])
    expect(report.totals.views).toBe(1400)
    expect(report.previousTotals.views).toBe(700)
    expect(report.deltas.views).toBe(100)
    expect(report.bestPlatform).toMatchObject({ label: "TikTok", value: 900, metricLabel: "avg. views", posts: 1 })
    expect(report.bestPillar?.label).toBe("Education")
    expect(report.bestTopic?.label).toBe("Education")
    expect(report.bestHook?.label).toBe("Story")
    expect(report.bestFormat?.label).toBe("Reel")
    expect(report.contentMix.pillars.total).toBe(3)
  })

  it("compares a week in progress with the same days of last week", () => {
    const db = makeDb()
    addPublished(db, 2, {}, { views: 300 }) // Tue 8 Sep
    addPublished(db, 9, {}, { views: 100 }) // Tue 1 Sep
    addPublished(db, 5, {}, { views: 5000 }) // Sat 5 Sep — later in last week than today is in this one
    const report = weeklyReport(db, NOW, settingsOf(db), NOW)
    expect(report.previousRange).toEqual({ start: "2026-08-31", end: "2026-09-06" })
    expect(report.previousTotals).toMatchObject({ start: "2026-08-31", end: "2026-09-03", views: 100 })
    expect(report.deltas.views).toBe(200)
    // Completed weeks compare in full.
    expect(weeklyReport(db, on(2026, 9, 1), settingsOf(db)).previousTotals).toMatchObject({ start: "2026-08-24", end: "2026-08-30" })
  })

  it("has no worst post with a single measured post", () => {
    const db = makeDb()
    addPublished(db, 1, {}, { views: 100 })
    expect(weeklyReport(db, NOW, settingsOf(db)).worstPost).toBeNull()
  })
})

describe("monthlyReport", () => {
  it("is empty-safe", () => {
    const db = makeDb()
    const report = monthlyReport(db, NOW, settingsOf(db))
    expect(report).toMatchObject({ totalContent: 0, totalReach: 0, bestContent: null, top10: [], winners: 0 })
    expect(report.range).toEqual({ start: "2026-09-01", end: "2026-09-30" })
    expect(report.followerGrowthSeries).toHaveLength(30)
    expect(report.consistency.weeksTotal).toBe(5)
    expect(report.leadGeneration).toEqual({ total: 0, byPillar: [], byPlatform: [] })
  })

  it("caps a month in progress at now and compares like-for-like", () => {
    const db = makeDb()
    addPublished(db, 2, {}, { views: 300, followers_gained: 4 }) // 8 Sep
    addPublished(db, 35, {}, { views: 100 }) // 6 Aug
    addPublished(db, 20, {}, { views: 900 }) // 21 Aug — beyond the first 10 days of August
    const report = monthlyReport(db, NOW, settingsOf(db), NOW)
    expect(report.followerGrowthSeries).toHaveLength(10)
    expect(report.followerGrowthSeries.at(-1)).toMatchObject({ date: "2026-09-10", cumulative: 4 })
    expect(report.previousTotals).toMatchObject({ start: "2026-08-01", end: "2026-08-10", views: 100 })
    expect(report.deltas.views).toBe(200)
    // 31 March compares with the whole of February, never beyond it.
    expect(monthlyReport(db, on(2026, 3, 31), settingsOf(db), on(2026, 3, 31, 12)).previousTotals.end).toBe("2026-02-28")
  })

  it("builds the monthly review", () => {
    const db = makeDb({ weekly_post_target: 1 })
    const business = add(db, "content_pillars", { name: "Business" })
    addPublished(
      db,
      2,
      { platform: "tiktok", funnel_stage: "bofu", pillar_id: business.id },
      { views: 500, reach: 400, followers_gained: 20, leads: 4, sales: 1, link_clicks: 30 }
    )
    addPublished(db, 5, { platform: "linkedin", funnel_stage: "tofu" }, { views: 300, reach: 300, followers_gained: 5, leads: 1 })
    addPublished(db, 15, { platform: "linkedin" }, { views: 1000, reach: 900, followers_gained: 50 })

    const report = monthlyReport(db, on(2026, 9, 1), settingsOf(db))
    expect(report).toMatchObject({ totalContent: 2, totalReach: 700 })
    expect(report.audienceGrowth.total).toBe(25)
    expect(report.audienceGrowth.byPlatform[0]).toMatchObject({ platform: "tiktok", followersGained: 20 })
    expect(report.bestContent?.views).toBe(500)
    expect(report.top10).toHaveLength(2)
    expect(report.leadGeneration.total).toBe(5)
    expect(report.leadGeneration.byPillar.map((l) => [l.label, l.leads])).toEqual([
      ["Business", 4],
      ["No pillar", 1],
    ])
    expect(report.businessOpportunities).toMatchObject({ posts: 1, leads: 4, sales: 1, linkClicks: 30 })
    expect(report.deltas.views).toBe(-20)
    expect(report.followerGrowthSeries.at(-1)?.cumulative).toBe(25)
    expect(report.consistency).toMatchObject({ weeksTotal: 5, weeksHit: 2 })
    expect(report.platformPerformance.map((p) => p.platform)).toEqual(["tiktok", "linkedin"])
  })
})
