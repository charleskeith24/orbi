import { describe, expect, it } from "vitest"
import { goalProgress } from "./goals"
import { add, addPublished, makeDb, NOW, settingsOf } from "./test-fixtures"

function seeded(weekStartsOn: 0 | 1 = 1) {
  const db = makeDb({ week_starts_on: weekStartsOn })
  addPublished(db, 3, {}, { views: 100, leads: 2 }) // Mon 7 Sep
  addPublished(db, 4, {}, { views: 50, leads: 1 }) // Sun 6 Sep
  addPublished(db, 12, {}, { views: 10, leads: 5 }) // Sat 29 Aug
  add(db, "content_items", { stage: "editing" })
  return db
}

describe("goalProgress", () => {
  it("sums the goal metric over items published in the current week", () => {
    const db = seeded()
    const goal = add(db, "content_goals", { period: "weekly", target_metric: "views", target_value: 400 })
    expect(goalProgress(db, goal, NOW, settingsOf(db))).toMatchObject({
      metric: "views",
      current: 100,
      target: 400,
      pct: 25,
      periodStart: "2026-09-07",
      periodEnd: "2026-09-13",
    })
  })

  it("honours week_starts_on = Sunday", () => {
    const db = seeded(0)
    const goal = add(db, "content_goals", { period: "weekly", target_metric: "views", target_value: 300 })
    expect(goalProgress(db, goal, NOW, settingsOf(db))).toMatchObject({ current: 150, pct: 50, periodStart: "2026-09-06" })
  })

  it("covers calendar months and quarters, counting publications for 'posts'", () => {
    const db = seeded()
    const leads = add(db, "content_goals", { period: "monthly", target_metric: "leads", target_value: 6 })
    expect(goalProgress(db, leads, NOW, settingsOf(db))).toMatchObject({
      current: 3,
      pct: 50,
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
    })
    const posts = add(db, "content_goals", { period: "quarterly", target_metric: "posts", target_value: 12 })
    expect(goalProgress(db, posts, NOW, settingsOf(db))).toMatchObject({
      current: 3,
      pct: 25,
      periodStart: "2026-07-01",
      periodEnd: "2026-09-30",
    })
  })

  it("falls back to the category metric and reports goals without a target", () => {
    const db = seeded()
    const goal = add(db, "content_goals", { category: "community", target_metric: null, target_value: null })
    expect(goalProgress(db, goal, NOW, settingsOf(db))).toMatchObject({ metric: "comments", current: 0, target: null, pct: null, onTrack: null })
  })

  it("reports elapsed share of the period and pace", () => {
    const db = seeded()
    const goal = add(db, "content_goals", { period: "monthly", target_metric: "leads", target_value: 6 })
    const progress = goalProgress(db, goal, NOW, settingsOf(db))
    expect(progress.elapsedPct).toBe(32)
    expect(progress.onTrack).toBe(true)
    const stretch = add(db, "content_goals", { period: "monthly", target_metric: "leads", target_value: 60 })
    expect(goalProgress(db, stretch, NOW, settingsOf(db)).onTrack).toBe(false)
  })
})
