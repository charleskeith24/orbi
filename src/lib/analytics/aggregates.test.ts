import { describe, expect, it } from "vitest"
import {
  aggregateGroups,
  campaignPerformance,
  comparePeriods,
  followerGrowthSeries,
  funnelPerformance,
  hookCategoryPerformance,
  percentChange,
  periodTotals,
  pillarPerformance,
  platformPerformance,
  previousPeriod,
  timeSeries,
  topicPerformance,
} from "./aggregates"
import { itemPerformanceRows } from "./metrics"
import { add, addPublished, daysAgo, makeDb, NOW } from "./test-fixtures"
import { toISODate } from "@/lib/dates"

describe("aggregateGroups", () => {
  it("computes engagement rate as Σ engagements ÷ Σ base and averages over measured posts", () => {
    const db = makeDb()
    const pillar = add(db, "content_pillars", { name: "Education" })
    addPublished(db, 3, { pillar_id: pillar.id }, { views: 2000, reach: 1000, likes: 100, avg_retention: 40 })
    addPublished(db, 2, { pillar_id: pillar.id }, { views: 500, reach: 0, likes: 50, avg_retention: 60 })
    addPublished(db, 1, { pillar_id: pillar.id })
    const [group] = aggregateGroups(itemPerformanceRows(db, NOW), (r) => r.pillarId)
    expect(group).toMatchObject({
      key: pillar.id,
      posts: 3,
      measured: 2,
      views: 2500,
      engagements: 150,
      avgViews: 1250,
      avgEngagements: 75,
      avgRetention: 50,
    })
    expect(group.engagementRate).toBeCloseTo(10)
  })

  it("skips empty keys and lets a row join several groups", () => {
    const db = makeDb()
    addPublished(db, 1, { title: "a" }, { views: 10 })
    addPublished(db, 2, { title: "b" }, { views: 20 })
    const groups = aggregateGroups(itemPerformanceRows(db, NOW), (r) => (r.item.title === "a" ? ["x", "y", "x"] : null))
    expect(groups.map((g) => [g.key, g.views])).toEqual([
      ["x", 10],
      ["y", 10],
    ])
  })
})

describe("dimension performance", () => {
  it("lists every active pillar in order (zero rows included) plus a No pillar group", () => {
    const db = makeDb()
    const education = add(db, "content_pillars", { name: "Education", sort_order: 0, color: "blue" })
    add(db, "content_pillars", { name: "Leadership", sort_order: 1 })
    add(db, "content_pillars", { name: "Retired", sort_order: 2, is_active: false })
    addPublished(db, 2, { pillar_id: education.id }, { views: 100, leads: 2 })
    addPublished(db, 3, {}, { views: 50 })

    const all = pillarPerformance(db, NOW)
    expect(all.map((p) => p.label)).toEqual(["Education", "Leadership", "No pillar"])
    expect(all[0]).toMatchObject({ posts: 1, leads: 2, avgViews: 100, color: "blue" })
    expect(all[1]).toMatchObject({ posts: 0, avgViews: null, engagementRate: null })

    const recent = pillarPerformance(db, NOW, { days: 3 })
    expect(recent.map((p) => p.label)).toEqual(["Education", "Leadership"])
  })

  it("files posts whose pillar was deleted under No pillar", () => {
    const db = makeDb()
    const education = add(db, "content_pillars", { name: "Education" })
    addPublished(db, 2, { pillar_id: education.id }, { views: 100 })
    addPublished(db, 3, { pillar_id: "deleted-pillar" }, { views: 40 })
    expect(pillarPerformance(db, NOW).map((p) => [p.label, p.posts, p.views])).toEqual([
      ["Education", 1, 100],
      ["No pillar", 1, 40],
    ])
  })

  it("ranks hook styles by average views", () => {
    const db = makeDb()
    addPublished(db, 1, { hook_category: "story" }, { views: 1000 })
    addPublished(db, 2, { hook_category: "story" }, { views: 800 })
    addPublished(db, 3, { hook_category: "list" }, { views: 300 })
    addPublished(db, 4, {}, { views: 50 })
    const styles = hookCategoryPerformance(db, NOW)
    expect(styles.map((s) => s.label)).toEqual(["Story", "List", "No hook style"])
    expect(styles[0]).toMatchObject({ category: "story", avgViews: 900 })
  })

  it("groups by platform and always lists the three funnel stages", () => {
    const db = makeDb()
    addPublished(db, 1, { platform: "linkedin", funnel_stage: "bofu" }, { views: 100, leads: 3 })
    addPublished(db, 2, { platform: "tiktok" }, { views: 900 })
    expect(platformPerformance(db, NOW).map((p) => p.label)).toEqual(["TikTok", "LinkedIn"])
    const funnel = funnelPerformance(db, NOW)
    expect(funnel.map((f) => f.label)).toEqual(["TOFU", "MOFU", "BOFU", "Unassigned"])
    expect(funnel[2]).toMatchObject({ posts: 1, leads: 3 })
  })

  it("uses the idea's core topic, then tag names, then the pillar name", () => {
    const db = makeDb()
    const pillar = add(db, "content_pillars", { name: "Leadership" })
    const idea = add(db, "content_ideas", { title: "Hiring", core_topic: "Hiring your first manager" })
    const sales = add(db, "tags", { name: "sales" })
    const ai = add(db, "tags", { name: "ai" })
    addPublished(db, 3, { idea_id: idea.id, pillar_id: pillar.id }, { views: 100 })
    const tagged = addPublished(db, 2, { pillar_id: pillar.id }, { views: 200 })
    add(db, "content_tags", { tag_id: sales.id, entity_type: "content_items", entity_id: tagged.id })
    add(db, "content_tags", { tag_id: ai.id, entity_type: "content_items", entity_id: tagged.id })
    addPublished(db, 1, { pillar_id: pillar.id }, { views: 50 })

    const topics = Object.fromEntries(topicPerformance(db, NOW).map((t) => [t.label, t]))
    expect(Object.keys(topics).sort()).toEqual(["Hiring your first manager", "Leadership", "ai", "sales"])
    expect(topics.sales).toMatchObject({ views: 200, source: "tag" })
    expect(topics.ai).toMatchObject({ views: 200, source: "tag" })
    expect(topics.Leadership).toMatchObject({ views: 50, source: "pillar" })
    expect(topics["Hiring your first manager"]).toMatchObject({ views: 100, source: "idea" })
  })
})

describe("campaignPerformance", () => {
  it("reports totals, progress against target and the best post", () => {
    const db = makeDb()
    const campaign = add(db, "content_campaigns", { name: "Launch", target_posts: 4, end_date: "2026-09-20" })
    addPublished(db, 2, { campaign_id: campaign.id, platform: "tiktok" }, { views: 500 })
    addPublished(db, 1, { campaign_id: campaign.id, platform: "linkedin" }, { views: 200 })
    add(db, "content_items", { campaign_id: campaign.id, stage: "editing" })
    addPublished(db, 1, {}, { views: 9999 })

    const perf = campaignPerformance(db, campaign.id, NOW)
    if (!perf) throw new Error("expected campaign performance")
    expect(perf).toMatchObject({ published: 2, planned: 1, targetPosts: 4, progressPct: 50, daysRemaining: 10 })
    expect(perf.totals.views).toBe(700)
    expect(perf.bestPost?.views).toBe(500)
    expect(perf.byPlatform.map((p) => p.platform)).toEqual(["tiktok", "linkedin"])
    expect(campaignPerformance(db, "missing", NOW)).toBeNull()
  })
})

describe("timeSeries", () => {
  it("zero-fills daily buckets and sums by publish date", () => {
    const db = makeDb()
    addPublished(db, 0, {}, { views: 10 })
    addPublished(db, 0, {}, { views: 5 })
    addPublished(db, 2, {}, { views: 7 })
    addPublished(db, 9, {}, { views: 1000 })
    const series = timeSeries(db, NOW, { days: 7 })
    expect(series).toHaveLength(7)
    expect(series[0]).toMatchObject({ date: "2026-09-04", label: "Sep 4", value: 0 })
    expect(series.at(-1)).toMatchObject({ date: "2026-09-10", value: 15 })
    expect(series.find((p) => p.date === "2026-09-08")?.value).toBe(7)
    expect(series.reduce((acc, p) => acc + (p.value ?? 0), 0)).toBe(22)
    expect(timeSeries(db, NOW, { days: 7, metric: "posts" }).at(-1)?.value).toBe(2)
  })

  it("buckets weeks on week_starts_on", () => {
    const db = makeDb()
    addPublished(db, 4, {}, { views: 40 }) // Sun 6 Sep
    addPublished(db, 3, {}, { views: 30 }) // Mon 7 Sep
    const monday = timeSeries(db, NOW, { days: 14, bucket: "week", weekStartsOn: 1 })
    expect(monday.map((p) => p.date)).toEqual(["2026-08-24", "2026-08-31", "2026-09-07"])
    expect(monday.map((p) => p.value)).toEqual([0, 40, 30])
    const sunday = timeSeries(db, NOW, { days: 14, bucket: "week", weekStartsOn: 0 })
    expect(sunday.map((p) => p.date)).toEqual(["2026-08-23", "2026-08-30", "2026-09-06"])
    expect(sunday.map((p) => p.value)).toEqual([0, 0, 70])
  })

  it("returns null rates for empty buckets", () => {
    const db = makeDb()
    addPublished(db, 1, {}, { reach: 200, likes: 10, comments: 10 })
    const series = timeSeries(db, NOW, { days: 3, metric: "engagement_rate" })
    expect(series.map((p) => p.value)).toEqual([null, 10, null])
  })

  it("accumulates follower growth", () => {
    const db = makeDb()
    addPublished(db, 2, {}, { followers_gained: 5 })
    addPublished(db, 0, {}, { followers_gained: 7 })
    const growth = followerGrowthSeries(db, NOW, { days: 3 })
    expect(growth.map((p) => [p.value, p.cumulative])).toEqual([
      [5, 5],
      [0, 5],
      [7, 12],
    ])
  })
})

describe("period totals", () => {
  it("sums a period and compares it with the previous one", () => {
    const db = makeDb()
    addPublished(db, 1, {}, { views: 300, reach: 200, likes: 20, followers_gained: 5, leads: 2 })
    addPublished(db, 2, {}, { views: 100, reach: 100, likes: 10, followers_gained: 5 })
    addPublished(db, 8, {}, { views: 200, reach: 100, likes: 10, followers_gained: 10 })

    const current = periodTotals(db, daysAgo(6), NOW)
    const previous = periodTotals(db, daysAgo(13), daysAgo(7))
    expect(current).toMatchObject({ start: "2026-09-04", end: "2026-09-10", posts: 2, views: 400, followers: 10, leads: 2 })
    expect(current.engagementRate).toBeCloseTo(10)

    const deltas = comparePeriods(current, previous)
    expect(deltas.views).toBe(100)
    expect(deltas.posts).toBe(100)
    expect(deltas.followers).toBe(0)
    expect(deltas.engagementRate).toBe(0)
    expect(deltas.leads).toBeNull()
  })

  it("percentChange is null against a zero or missing previous value", () => {
    expect(percentChange(5, 0)).toBeNull()
    expect(percentChange(null, 4)).toBeNull()
    expect(percentChange(3, 4)).toBe(-25)
  })

  it("previousPeriod is the equally long window just before", () => {
    const range = previousPeriod(daysAgo(6), NOW)
    expect([toISODate(range.start), toISODate(range.end)]).toEqual(["2026-08-28", "2026-09-03"])
  })
})
