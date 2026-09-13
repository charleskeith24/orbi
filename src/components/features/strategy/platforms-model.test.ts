import { subDays } from "date-fns"
import { describe, expect, it } from "vitest"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import { paceVsPlan, planMessage, platformPatch, platformPlan, validatePlatform, platformFormValues } from "./platforms-model"

const now = new Date(2026, 8, 13, 12)

function workspace(target = 10) {
  const db = emptyDatabase()
  const settings = buildRow("app_settings", { id: "s", weekly_post_target: target }, "", now)
  db.app_settings = [settings]
  db.content_platforms = [
    buildRow("content_platforms", { id: "fb", platform: "facebook", posting_frequency: 3 }, "", now),
    buildRow("content_platforms", { id: "tt", platform: "tiktok", posting_frequency: 4.5 }, "", now),
    buildRow("content_platforms", { id: "x", platform: "x", posting_frequency: 5, is_active: false }, "", now),
  ]
  db.content_items = [1, 3, 6].map((daysAgo) =>
    buildRow("content_items", { id: `p${daysAgo}`, platform: "facebook", stage: "published", published_at: subDays(now, daysAgo).toISOString() }, "", now)
  )
  return { db, settings }
}

describe("platformPlan", () => {
  it("totals active platforms and compares with the weekly target", () => {
    const { db, settings } = workspace()
    const plan = platformPlan(db, now, settings)
    expect(plan.rows).toHaveLength(7)
    expect(plan.weeklyTotal).toBe(7.5)
    expect(plan.delta).toBe(-2.5)
    expect(plan.activeCount).toBe(2)
    const fb = plan.rows.find((r) => r.platform === "facebook")
    expect(fb?.perf?.posts).toBe(3)
    expect(fb?.planned30).toBe(12.9)
    expect(fb && paceVsPlan(fb)).toBe("behind")
    expect(plan.rows.find((r) => r.platform === "youtube")?.strategy).toBeNull()
  })

  it("explains mismatches", () => {
    expect(planMessage({ weeklyTotal: 11, target: 10, delta: 1, activeCount: 5 })).toMatchObject({ tone: "warning" })
    expect(planMessage({ weeklyTotal: 10.2, target: 10, delta: 0.2, activeCount: 5 }).tone).toBe("good")
    expect(planMessage({ weeklyTotal: 0, target: 10, delta: -10, activeCount: 0 }).text).toMatch(/No active platforms/)
  })
})

describe("platform form", () => {
  it("cleans the handle and rounds integer columns", () => {
    const { db } = workspace()
    const values = { ...platformFormValues(db.content_platforms[0]), handle: " @@raf.mendoza ", current_followers: 48200.4, posting_frequency: 2.25 }
    expect(platformPatch(values)).toMatchObject({ handle: "raf.mendoza", current_followers: 48200, posting_frequency: 2.3 })
  })

  it("validates frequency and followers", () => {
    const { db } = workspace()
    const values = platformFormValues(db.content_platforms[0])
    expect(validatePlatform(values)).toEqual({})
    expect(validatePlatform({ ...values, posting_frequency: null }).posting_frequency).toBeTruthy()
    expect(validatePlatform({ ...values, posting_frequency: 60 }).posting_frequency).toBeTruthy()
    expect(validatePlatform({ ...values, current_followers: -1 }).current_followers).toBeTruthy()
  })
})
