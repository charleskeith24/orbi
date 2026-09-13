import { describe, expect, it } from "vitest"
import type { Database } from "@/lib/types"
import { consistencyScore, consistencyStats, postingHistory, postingStreakDays, weeklyPostingProgress } from "./consistency"
import { add, addPublished, makeDb, NOW, on, settingsOf } from "./test-fixtures"

/** `count` published posts on consecutive days from the given local date. */
function postFrom(db: Database, start: Date, count: number) {
  for (let i = 0; i < count; i++) {
    const at = new Date(start)
    at.setDate(at.getDate() + i)
    add(db, "content_items", { stage: "published", published_at: at.toISOString() })
  }
}

describe("weeklyPostingProgress", () => {
  // NOW is Thursday 10 Sep 2026: Sunday 6 Sep belongs to the Monday-start week of 31 Aug.
  function build(weekStartsOn: 0 | 1) {
    const db = makeDb({ week_starts_on: weekStartsOn, weekly_post_target: 5 })
    addPublished(db, 4) // Sun 6 Sep
    addPublished(db, 3) // Mon 7 Sep
    addPublished(db, 0) // Thu 10 Sep
    add(db, "content_items", { stage: "scheduled", scheduled_at: on(2026, 9, 12, 9).toISOString() }) // Sat
    add(db, "content_items", { stage: "scheduled", scheduled_at: on(2026, 9, 13, 9).toISOString() }) // Sun
    return weeklyPostingProgress(db, NOW, settingsOf(db))
  }

  it("uses Monday-start weeks", () => {
    expect(build(1)).toEqual({
      weekStart: "2026-09-07",
      weekEnd: "2026-09-13",
      published: 2,
      scheduledRemaining: 2,
      target: 5,
      pct: 40,
      remaining: 3,
      onTrack: false,
      daysLeft: 4,
    })
  })

  it("uses Sunday-start weeks", () => {
    expect(build(0)).toMatchObject({
      weekStart: "2026-09-06",
      weekEnd: "2026-09-12",
      published: 3,
      scheduledRemaining: 1,
      pct: 60,
      onTrack: false,
      daysLeft: 3,
    })
  })

  it("is on track when published + scheduled covers the target", () => {
    const db = makeDb({ weekly_post_target: 2 })
    addPublished(db, 1)
    add(db, "content_items", { stage: "scheduled", scheduled_at: on(2026, 9, 11).toISOString() })
    expect(weeklyPostingProgress(db, NOW, settingsOf(db)).onTrack).toBe(true)
  })
})

describe("postingHistory", () => {
  it("returns the last N weeks oldest first, ending with the current week", () => {
    const db = makeDb({ weekly_post_target: 2 })
    addPublished(db, 7)
    addPublished(db, 8)
    addPublished(db, 0)
    const history = postingHistory(db, NOW, settingsOf(db), 3)
    expect(history.map((w) => w.weekStart)).toEqual(["2026-08-24", "2026-08-31", "2026-09-07"])
    expect(history.map((w) => w.published)).toEqual([0, 2, 1])
    expect(history[1]).toMatchObject({ weekEnd: "2026-09-06", hit: true, consistent: true, pct: 100, isCurrent: false })
    expect(history[2]).toMatchObject({ isCurrent: true, hit: false })
  })
})

describe("consistencyScore", () => {
  it("weights recent completed weeks more and skips weeks before the first post", () => {
    const db = makeDb({ weekly_post_target: 5 }) // consistent at ≥ 4 posts
    postFrom(db, on(2026, 8, 10), 4) // week of 10 Aug: consistent (weight 5)
    postFrom(db, on(2026, 8, 17), 1) // 17 Aug: miss (weight 6)
    // 24 Aug: nothing (weight 7)
    postFrom(db, on(2026, 8, 31), 5) // 31 Aug: consistent (weight 8)
    postFrom(db, on(2026, 9, 7), 1) // current week is ignored
    const settings = settingsOf(db)
    expect(consistencyScore(db, NOW, settings)).toBe(50) // (5 + 8) / (5 + 6 + 7 + 8)
    expect(consistencyStats(db, NOW, settings)).toEqual({ score: 50, weeksCounted: 4, weeksConsistent: 2, hasHistory: true })
  })

  it("is 0 without history and null-scored in the first week", () => {
    const empty = makeDb()
    expect(consistencyScore(empty, NOW, settingsOf(empty))).toBe(0)
    expect(consistencyStats(empty, NOW, settingsOf(empty)).hasHistory).toBe(false)

    const firstWeek = makeDb()
    addPublished(firstWeek, 1)
    expect(consistencyStats(firstWeek, NOW, settingsOf(firstWeek))).toMatchObject({ score: null, hasHistory: true, weeksCounted: 0 })
    expect(consistencyScore(firstWeek, NOW, settingsOf(firstWeek))).toBe(0)
  })

  it("scores 100 when every week reaches 80% of the target", () => {
    const db = makeDb({ weekly_post_target: 5 })
    for (let week = 1; week <= 8; week++) postFrom(db, on(2026, 9, 7 - week * 7), 4)
    expect(consistencyScore(db, NOW, settingsOf(db))).toBe(100)
  })
})

describe("postingStreakDays", () => {
  it("counts consecutive posting days back from today, or from yesterday before today's post", () => {
    const db = makeDb()
    addPublished(db, 1)
    addPublished(db, 2)
    addPublished(db, 3)
    addPublished(db, 5)
    expect(postingStreakDays(db, NOW)).toBe(3)
    addPublished(db, 0)
    expect(postingStreakDays(db, NOW)).toBe(4)
    expect(postingStreakDays(makeDb(), NOW)).toBe(0)
  })
})
