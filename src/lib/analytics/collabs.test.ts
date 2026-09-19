import { describe, expect, it } from "vitest"
import type { ContentItem, Database, PlatformId } from "@/lib/types"
import { collabForItem, collabItemIds, collabLift, collabResults } from "./collabs"
import { add, addMetric, addPublished, makeDb, NOW } from "./test-fixtures"

/** A published post `daysAgo` on `platform` with the given followers gained and views. */
function post(db: Database, daysAgo: number, platform: PlatformId, followers: number, views: number): ContentItem {
  return addPublished(db, daysAgo, { platform }, { views, reach: views, likes: Math.round(views / 20), followers_gained: followers })
}

function collabWith(db: Database, items: ContentItem[], status: "published" | "declined" = "published") {
  return add(db, "collabs", { title: "Joint Live", type: "joint_live", status, content_item_ids: items.map((i) => i.id) })
}

describe("collabResults", () => {
  it("totals the latest snapshot of each linked post", () => {
    const db = makeDb()
    const a = post(db, 5, "tiktok", 30, 10_000)
    addMetric(db, a, { recorded_at: "2026-09-01", views: 1, followers_gained: 1 }) // older snapshot is ignored
    const b = post(db, 4, "facebook", 12, 2_000)
    const unmeasured = addPublished(db, 3, { platform: "instagram" })
    const collab = collabWith(db, [a, b, unmeasured])
    const r = collabResults(collab, db)
    expect(r).toMatchObject({ posts: 3, measured: 2, views: 12_000, followersGained: 42, engagements: 600 })
    expect(r.engagementRate).toBeCloseTo(5)
  })

  it("ignores ids of deleted posts and has no rate without data", () => {
    const db = makeDb()
    const collab = add(db, "collabs", { content_item_ids: ["gone"] })
    expect(collabResults(collab, db)).toEqual({ posts: 0, measured: 0, views: 0, engagements: 0, engagementRate: null, followersGained: 0 })
  })
})

describe("collabItemIds / collabForItem", () => {
  it("counts every collab except declined ones", () => {
    const db = makeDb()
    const a = post(db, 5, "tiktok", 1, 1)
    const b = post(db, 5, "tiktok", 1, 1)
    const live = collabWith(db, [a])
    collabWith(db, [b], "declined")
    expect([...collabItemIds(db.collabs)]).toEqual([a.id])
    expect(collabForItem(db.collabs, a.id)?.id).toBe(live.id)
    expect(collabForItem(db.collabs, b.id)).toBeNull()
  })
})

describe("collabLift", () => {
  it("compares medians per post: collab posts vs solo posts", () => {
    const db = makeDb()
    const collabPosts = [post(db, 10, "tiktok", 48, 30_000), post(db, 20, "tiktok", 60, 24_000), post(db, 30, "tiktok", 72, 40_000)]
    for (const [i, followers] of [10, 20, 25, 30, 40].entries()) post(db, 11 + i, "tiktok", followers, 10_000 + i * 1_000)
    collabWith(db, collabPosts)
    const lift = collabLift(db, NOW)
    expect(lift).toMatchObject({ enough: true, collabPosts: 3, soloPosts: 5, needCollab: 0, needSolo: 0, platforms: ["tiktok"] })
    // Followers: median 60 vs median 25 → 2.4×. Views: median 30,000 vs 12,000 → 2.5×.
    expect(lift.followers).toEqual({ lift: 2.4, collab: 60, solo: 25 })
    expect(lift.views?.lift).toBeCloseTo(2.5)
  })

  it("says there isn't enough data below the minimum, and what's missing", () => {
    const db = makeDb()
    const collabPosts = [post(db, 10, "tiktok", 48, 30_000), post(db, 20, "tiktok", 60, 24_000)]
    for (let i = 0; i < 4; i++) post(db, 11 + i, "tiktok", 20, 10_000)
    collabWith(db, collabPosts)
    const lift = collabLift(db, NOW)
    expect(lift).toMatchObject({ enough: false, collabPosts: 2, soloPosts: 4, needCollab: 1, needSolo: 1, followers: null, views: null })
  })

  it("never counts posts without analytics or outside the last 90 days", () => {
    const db = makeDb()
    const old = post(db, 120, "tiktok", 500, 90_000)
    const unmeasured = addPublished(db, 5, { platform: "tiktok" })
    const draft = add(db, "content_items", { platform: "tiktok", stage: "scripting" })
    collabWith(db, [old, unmeasured, draft, post(db, 3, "tiktok", 10, 1_000)])
    for (let i = 0; i < 5; i++) post(db, 4 + i, "tiktok", 5, 1_000)
    expect(collabLift(db, NOW)).toMatchObject({ enough: false, collabPosts: 1, needCollab: 2, soloPosts: 5 })
  })

  it("uses a same-platform baseline", () => {
    const db = makeDb()
    // Collab posts are on TikTok; LinkedIn solo posts gain far more followers but must not be the baseline.
    const collabPosts = [post(db, 5, "tiktok", 30, 5_000), post(db, 6, "tiktok", 30, 5_000), post(db, 7, "tiktok", 30, 5_000)]
    for (let i = 0; i < 5; i++) post(db, 10 + i, "tiktok", 10, 2_500)
    for (let i = 0; i < 8; i++) post(db, 10 + i, "linkedin", 400, 50_000)
    collabWith(db, collabPosts)
    const lift = collabLift(db, NOW)
    expect(lift).toMatchObject({ enough: true, collabPosts: 3, soloPosts: 5, platforms: ["tiktok"] })
    expect(lift.followers).toEqual({ lift: 3, collab: 30, solo: 10 })
    expect(lift.views?.lift).toBe(2)
  })

  it("matches each collab post with its own platform when collabs span platforms", () => {
    const db = makeDb()
    // TikTok collab (60 vs TikTok solo median 20) and LinkedIn collabs (300 vs LinkedIn solo median 100).
    const collabPosts = [post(db, 5, "tiktok", 60, 1_000), post(db, 6, "linkedin", 300, 1_000), post(db, 7, "linkedin", 300, 1_000)]
    for (let i = 0; i < 3; i++) post(db, 10 + i, "tiktok", 20, 1_000)
    for (let i = 0; i < 3; i++) post(db, 20 + i, "linkedin", 100, 1_000)
    collabWith(db, collabPosts)
    const lift = collabLift(db, NOW)
    expect(lift.soloPosts).toBe(6)
    // Baselines per collab post: [20, 100, 100] → median 100; collab values [60, 300, 300] → median 300.
    expect(lift.followers).toEqual({ lift: 3, collab: 300, solo: 100 })
  })

  it("leaves collab posts on a platform without solo posts out of the comparison", () => {
    const db = makeDb()
    const collabPosts = [post(db, 5, "youtube", 900, 90_000), post(db, 6, "tiktok", 30, 5_000)]
    for (let i = 0; i < 6; i++) post(db, 10 + i, "tiktok", 10, 2_000)
    collabWith(db, collabPosts)
    expect(collabLift(db, NOW)).toMatchObject({ enough: false, collabPosts: 1, unmatchedCollabPosts: 1, needCollab: 2 })
  })

  it("needs at least 3 solo posts on a platform before it serves as that platform's baseline", () => {
    const db = makeDb()
    // Two LinkedIn solo posts are too few to compare with, so the LinkedIn collab post is left out.
    const collabPosts = [post(db, 5, "linkedin", 300, 1_000), post(db, 6, "tiktok", 30, 1_000), post(db, 7, "tiktok", 30, 1_000), post(db, 8, "tiktok", 30, 1_000)]
    for (let i = 0; i < 2; i++) post(db, 10 + i, "linkedin", 100, 1_000)
    for (let i = 0; i < 5; i++) post(db, 20 + i, "tiktok", 10, 1_000)
    collabWith(db, collabPosts)
    const lift = collabLift(db, NOW)
    expect(lift).toMatchObject({ enough: true, collabPosts: 3, unmatchedCollabPosts: 1, soloPosts: 5, platforms: ["tiktok"] })
    expect(lift.followers).toEqual({ lift: 3, collab: 30, solo: 10 })
  })

  it("has no multiple when the solo median is zero", () => {
    const db = makeDb()
    const collabPosts = [post(db, 5, "tiktok", 12, 5_000), post(db, 6, "tiktok", 8, 5_000), post(db, 7, "tiktok", 10, 5_000)]
    for (let i = 0; i < 5; i++) post(db, 10 + i, "tiktok", 0, 2_000)
    collabWith(db, collabPosts)
    const lift = collabLift(db, NOW)
    expect(lift.followers).toEqual({ lift: null, collab: 10, solo: 0 })
    expect(lift.views?.lift).toBe(2.5)
  })

  it("counts every solo post toward the minimum until a collab post exists, and ignores declined collabs", () => {
    const db = makeDb()
    for (let i = 0; i < 4; i++) post(db, 10 + i, "linkedin", 10, 2_000)
    const declined = post(db, 3, "tiktok", 50, 9_000)
    collabWith(db, [declined], "declined")
    expect(collabLift(db, NOW)).toMatchObject({ enough: false, collabPosts: 0, soloPosts: 5, needCollab: 3, needSolo: 0 })
  })
})
