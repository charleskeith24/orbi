import { describe, expect, it } from "vitest"
import { trailingDays } from "@/lib/analytics"
import { NO_PILLAR } from "./filters"
import { bucketFor, bucketSeries, kpiTotals, postingHeatmap, scopeRows, tierSummary } from "./scope"
import { makeRow, NOW } from "./test-fixtures"

describe("scopeRows", () => {
  const recentFb = makeRow({ publishedAt: new Date(2026, 8, 10, 9), platform: "facebook", pillarId: "a" })
  const recentTt = makeRow({ publishedAt: new Date(2026, 8, 1, 9), platform: "tiktok", pillarId: "b" })
  const oldFb = makeRow({ publishedAt: new Date(2026, 7, 1, 9), platform: "facebook", pillarId: null })
  const rows = [recentFb, recentTt, oldFb]

  it("scopes by range, platform and pillar (including no pillar)", () => {
    const range = trailingDays(NOW, 30)
    expect(scopeRows(rows, { platforms: [], pillars: [] }, range)).toEqual([recentFb, recentTt])
    expect(scopeRows(rows, { platforms: ["facebook"], pillars: [] }, range)).toEqual([recentFb])
    expect(scopeRows(rows, { platforms: [], pillars: [NO_PILLAR] }, null)).toEqual([oldFb])
  })
})

describe("kpiTotals", () => {
  it("applies the RATE_FIELDS formulas to the sums", () => {
    const totals = kpiTotals([
      makeRow({
        publishedAt: new Date(2026, 8, 1),
        metric: { views: 1000, reach: 800, likes: 40, comments: 10, shares: 8, saves: 12, link_clicks: 20, leads: 2, profile_visits: 50, followers_gained: 5 },
      }),
      makeRow({
        publishedAt: new Date(2026, 8, 2),
        metric: { views: 500, reach: 0, shares: 5, saves: 5, profile_visits: 10, leads: 1, followers_gained: 2 },
      }),
    ])
    expect(totals.posts).toBe(2)
    expect(totals.engagements).toBe(80)
    // Base = reach, falling back to views per post: 800 + 500.
    expect(totals.engagementRate).toBeCloseTo((80 / 1300) * 100)
    expect(totals.shareRate).toBeCloseTo(1)
    expect(totals.saveRate).toBeCloseTo((17 / 1300) * 100)
    expect(totals.leadConversion).toBeCloseTo(15)
    expect(totals.followerConversion).toBeCloseTo((7 / 60) * 100)
  })

  it("returns null rates without denominators", () => {
    const totals = kpiTotals([makeRow({ publishedAt: new Date(2026, 8, 1), metric: null })])
    expect(totals.measured).toBe(0)
    expect(totals.engagementRate).toBeNull()
    expect(totals.leadConversion).toBeNull()
  })
})

describe("bucketSeries", () => {
  const range = trailingDays(NOW, 30)

  it("counts 7-day periods back from today and drops the short leading period", () => {
    const points = bucketSeries(
      [
        makeRow({ publishedAt: new Date(2026, 7, 13, 9), metric: { followers_gained: 10 } }),
        makeRow({ publishedAt: new Date(2026, 8, 4, 20), metric: { followers_gained: 3 } }),
        makeRow({ publishedAt: new Date(2026, 8, 11, 8), metric: { views: 100, followers_gained: 5 } }),
      ],
      range,
      bucketFor(range)
    )
    expect(points.map((p) => p.date)).toEqual(["2026-08-15", "2026-08-22", "2026-08-29", "2026-09-05"])
    expect(points[3]).toMatchObject({ end: "2026-09-11", days: 7, posts: 1, views: 100 })
    expect(points[2]).toMatchObject({ end: "2026-09-04", posts: 1 })
    // The dropped Aug 13–14 period still seeds the running total.
    expect(points[0].cumulativeFollowers).toBe(10)
    expect(points[3].cumulativeFollowers).toBe(18)
  })

  it("uses daily periods for short windows", () => {
    const week = trailingDays(NOW, 7)
    expect(bucketFor(week)).toBe("day")
    expect(bucketFor(trailingDays(NOW, 14))).toBe("day")
    expect(bucketFor(range)).toBe("week")
    const points = bucketSeries([], week, "day")
    expect(points).toHaveLength(7)
    expect(points[6]).toMatchObject({ date: "2026-09-11", end: "2026-09-11", days: 1, posts: 0 })
  })

  it("spans first to last post for all time", () => {
    expect(bucketSeries([], null, "week")).toEqual([])
    const points = bucketSeries(
      [makeRow({ publishedAt: new Date(2026, 8, 1) }), makeRow({ publishedAt: new Date(2026, 8, 10) })],
      null,
      "week"
    )
    expect(points.map((p) => [p.date, p.end])).toEqual([
      ["2026-09-01", "2026-09-03"],
      ["2026-09-04", "2026-09-10"],
    ])
  })
})

describe("postingHeatmap", () => {
  it("averages views per weekday × hour and prefers slots with 2+ posts", () => {
    const data = postingHeatmap(
      [
        makeRow({ publishedAt: new Date(2026, 8, 7, 8, 0), metric: { views: 100 } }),
        makeRow({ publishedAt: new Date(2026, 8, 7, 8, 30), metric: { views: 300 } }),
        makeRow({ publishedAt: new Date(2026, 8, 11, 20, 0), metric: { views: 1000 } }),
        makeRow({ publishedAt: new Date(2026, 8, 9, 12, 0), metric: null }),
      ],
      1
    )
    expect(data.days).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(data.measured).toBe(3)
    expect(data.hours[0]).toBe(8)
    expect(data.hours.at(-1)).toBe(20)
    expect(data.slots).toContainEqual({ day: 1, hour: 8, posts: 2, avgViews: 200 })
    expect(data.best).toMatchObject({ day: 1, hour: 8 })
  })

  it("keeps at least six hour columns and falls back to single-post slots", () => {
    const data = postingHeatmap([makeRow({ publishedAt: new Date(2026, 8, 6, 23, 0), metric: { views: 50 } })], 0)
    expect(data.days[0]).toBe(0)
    expect(data.hours).toEqual([18, 19, 20, 21, 22, 23])
    expect(data.best).toMatchObject({ day: 0, hour: 23, posts: 1 })
    expect(postingHeatmap([], 1)).toMatchObject({ hours: [], slots: [], best: null, measured: 0 })
  })
})

describe("tierSummary", () => {
  it("separates tiered, untiered and unmeasured posts", () => {
    const summary = tierSummary([
      makeRow({ publishedAt: NOW, metric: { views: 900 }, tier: { tier: "winner", ratio: 2.2 } }),
      makeRow({ publishedAt: NOW, metric: { views: 300 }, tier: { tier: "normal", ratio: 0.9 } }),
      makeRow({ publishedAt: NOW, metric: { views: 300 } }),
      makeRow({ publishedAt: NOW, metric: null }),
    ])
    expect(summary.counts).toEqual({ breakout: 0, winner: 1, good: 0, normal: 1 })
    expect(summary).toMatchObject({ tiered: 2, untiered: 1, unmeasured: 1 })
  })
})
