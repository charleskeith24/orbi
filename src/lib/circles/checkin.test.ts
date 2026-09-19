import { describe, expect, it } from "vitest"
import { add, makeDb, NOW, on, settingsOf } from "@/lib/analytics/test-fixtures"
import { checkinDraft, checkinErrors, clampPosts } from "./checkin"

// NOW (analytics fixtures) is Thursday 10 Sep 2026, 12:00 local time.

describe("checkinDraft — the pre-computed check-in", () => {
  function build(weekStartsOn: 0 | 1) {
    const db = makeDb({ week_starts_on: weekStartsOn })
    add(db, "content_items", { stage: "published", published_at: on(2026, 9, 6, 9).toISOString() }) // Sun 6 Sep
    add(db, "content_items", { stage: "published", published_at: on(2026, 9, 7, 9).toISOString() }) // Mon 7 Sep
    add(db, "content_items", { stage: "repurpose", published_at: on(2026, 9, 9, 20).toISOString() }) // Wed, repurpose counts as published
    add(db, "content_items", { stage: "scheduled", scheduled_at: on(2026, 9, 11, 9).toISOString() }) // not yet published
    add(db, "content_items", { stage: "published", published_at: on(2026, 8, 31, 9).toISOString() }) // last week
    add(db, "content_ideas", { title: "An idea is not a post" })
    return checkinDraft(db, NOW, settingsOf(db))
  }

  it("counts this week's published posts from the workspace, Monday weeks", () => {
    expect(build(1)).toEqual({ weekStart: "2026-09-07", published: 2, posts: 2 })
  })

  it("follows week_starts_on (Sunday weeks)", () => {
    expect(build(0)).toEqual({ weekStart: "2026-09-06", published: 3, posts: 3 })
  })

  it("is 0 for an empty workspace", () => {
    const db = makeDb()
    expect(checkinDraft(db, NOW, settingsOf(db))).toEqual({ weekStart: "2026-09-07", published: 0, posts: 0 })
  })

  it("caps the pre-filled number at 50 (what a check-in may hold)", () => {
    const db = makeDb()
    for (let i = 0; i < 60; i++) add(db, "content_items", { stage: "published", published_at: on(2026, 9, 8, 9).toISOString() })
    expect(checkinDraft(db, NOW, settingsOf(db))).toEqual({ weekStart: "2026-09-07", published: 60, posts: 50 })
  })
})

describe("clampPosts / checkinErrors", () => {
  it("clamps to a whole number within 0–50", () => {
    expect([clampPosts(-3), clampPosts(2.6), clampPosts(99), clampPosts(Number.NaN)]).toEqual([0, 3, 50, 0])
  })

  it("validates the form", () => {
    expect(checkinErrors({ posts: 3, note: "" })).toEqual({})
    expect(checkinErrors({ posts: null, note: "" })).toEqual({ posts: "range" })
    expect(checkinErrors({ posts: 51, note: "" })).toEqual({ posts: "range" })
    expect(checkinErrors({ posts: 1.5, note: "" })).toEqual({ posts: "range" })
    expect(checkinErrors({ posts: 1, note: "x".repeat(281) })).toEqual({ note: "too_long" })
  })
})
