import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { ContentMetric } from "@/lib/types"
import { computeRates, engagementsOf, itemPerformanceRows, latestMetricsByItem, metricValue } from "./metrics"
import { add, addMetric, addPublished, ids, makeDb, NOW } from "./test-fixtures"

const snapshot = (values: Partial<ContentMetric>): ContentMetric => buildRow("content_metrics", values, "u", NOW)

describe("engagementsOf", () => {
  it("sums likes, comments, shares and saves", () => {
    expect(engagementsOf(snapshot({ likes: 10, comments: 5, shares: 3, saves: 2, views: 999 }))).toBe(20)
  })

  it("is 0 without a snapshot", () => {
    expect(engagementsOf(null)).toBe(0)
  })
})

describe("computeRates", () => {
  it("uses reach as the base when available", () => {
    const rates = computeRates(
      snapshot({
        views: 2000,
        reach: 1000,
        likes: 60,
        comments: 20,
        shares: 10,
        saves: 10,
        link_clicks: 40,
        leads: 4,
        profile_visits: 200,
        followers_gained: 10,
      })
    )
    expect(rates.engagement_rate).toBeCloseTo(10)
    expect(rates.share_rate).toBeCloseTo(1)
    expect(rates.save_rate).toBeCloseTo(1)
    expect(rates.lead_conversion_rate).toBeCloseTo(10)
    expect(rates.follower_conversion_rate).toBeCloseTo(5)
  })

  it("falls back to views when reach is 0", () => {
    expect(computeRates(snapshot({ views: 500, reach: 0, likes: 25 })).engagement_rate).toBeCloseTo(5)
  })

  it("returns null for every rate when there is nothing to divide by", () => {
    expect(computeRates(snapshot({ likes: 5, shares: 2, leads: 1, followers_gained: 2 }))).toEqual({
      engagement_rate: null,
      share_rate: null,
      save_rate: null,
      lead_conversion_rate: null,
      follower_conversion_rate: null,
    })
    expect(computeRates(null).engagement_rate).toBeNull()
    expect(computeRates(undefined).lead_conversion_rate).toBeNull()
  })

  it("lead conversion divides by link clicks, then profile visits — never by reach (RATE_FIELDS formula)", () => {
    expect(computeRates(snapshot({ reach: 1000, link_clicks: 20, profile_visits: 50, leads: 5 })).lead_conversion_rate).toBeCloseTo(25)
    expect(computeRates(snapshot({ reach: 1000, profile_visits: 50, leads: 5 })).lead_conversion_rate).toBeCloseTo(10)
    expect(computeRates(snapshot({ reach: 1000, leads: 5 })).lead_conversion_rate).toBeNull()
  })

  it("follower conversion divides by profile visits only (RATE_FIELDS formula)", () => {
    expect(computeRates(snapshot({ views: 400, profile_visits: 40, followers_gained: 8 })).follower_conversion_rate).toBeCloseTo(20)
    expect(computeRates(snapshot({ views: 400, followers_gained: 8 })).follower_conversion_rate).toBeNull()
  })
})

describe("latestMetricsByItem", () => {
  it("keeps the snapshot with the latest recorded_at, then updated_at", () => {
    const db = makeDb()
    const a = addPublished(db, 3)
    const b = addPublished(db, 3)
    addMetric(db, a, { recorded_at: "2026-09-08", views: 100 }, "2026-09-10T00:00:00.000Z")
    addMetric(db, a, { recorded_at: "2026-09-09", views: 200 }, "2026-09-09T00:00:00.000Z")
    addMetric(db, a, { recorded_at: "2026-09-07", views: 50 })
    addMetric(db, b, { recorded_at: "2026-09-09", views: 10 }, "2026-09-09T08:00:00.000Z")
    addMetric(db, b, { recorded_at: "2026-09-09", views: 20 }, "2026-09-09T09:00:00.000Z")
    const latest = latestMetricsByItem(db)
    expect(latest.get(a.id)?.views).toBe(200)
    expect(latest.get(b.id)?.views).toBe(20)
    expect(latest.size).toBe(2)
  })
})

describe("metricValue", () => {
  const m = snapshot({ views: 300, reach: 200, likes: 15, comments: 5, avg_retention: null, watch_time_seconds: 90 })

  it("reads raw fields, derived rates and engagements", () => {
    expect(metricValue(m, "views")).toBe(300)
    expect(metricValue(m, "watch_time_seconds")).toBe(90)
    expect(metricValue(m, "engagement_rate")).toBeCloseTo(10)
    expect(metricValue(m, "engagements")).toBe(20)
  })

  it("returns null for missing values and snapshots", () => {
    expect(metricValue(m, "avg_retention")).toBeNull()
    expect(metricValue(null, "views")).toBeNull()
    expect(metricValue(snapshot({}), "share_rate")).toBeNull()
  })
})

describe("itemPerformanceRows", () => {
  it("returns one enriched row per published item, newest first", () => {
    const db = makeDb()
    const hook = add(db, "hooks", { text: "Three years ago…", category: "story" })
    const measured = addPublished(db, 2, { hook_id: hook.id, platform: "tiktok" }, { views: 100, reach: 80, likes: 8, leads: 1 })
    const unmeasured = addPublished(db, 1)
    add(db, "content_items", { stage: "editing" })
    addPublished(db, -2) // go-live date after today
    const rows = itemPerformanceRows(db, NOW)

    expect(ids(rows)).toEqual([unmeasured.id, measured.id])
    expect(rows[1]).toMatchObject({
      views: 100,
      base: 80,
      engagements: 8,
      leads: 1,
      platform: "tiktok",
      hookCategory: "story",
      ageDays: 2,
    })
    expect(rows[1].rates.engagement_rate).toBeCloseTo(10)
    expect(rows[0]).toMatchObject({ metric: null, views: 0, engagements: 0, ageDays: 1 })
    expect(rows[0].rates.engagement_rate).toBeNull()
  })

  it("leaves out unpublished items even when they have analytics", () => {
    const db = makeDb()
    const draft = add(db, "content_items", { stage: "editing" })
    addMetric(db, draft, { views: 500 })
    const live = addPublished(db, 1, {}, { views: 100 })
    expect(ids(itemPerformanceRows(db, NOW))).toEqual([live.id])
  })

  it("treats Repurpose as published and falls back to scheduled_at for the date", () => {
    const db = makeDb()
    const item = add(db, "content_items", { stage: "repurpose", published_at: null, scheduled_at: NOW.toISOString() })
    const [row] = itemPerformanceRows(db, NOW)
    expect(row.id).toBe(item.id)
    expect(row.publishedAt.getTime()).toBe(NOW.getTime())
  })
})
