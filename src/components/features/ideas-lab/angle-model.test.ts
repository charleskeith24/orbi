import { describe, expect, it } from "vitest"
import { anglePerformance } from "@/lib/analytics"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import type { Database } from "@/lib/types"
import { angleStats, filterAngles, generatorHref, sortAngles, untriedAngles, validateAngleName } from "./angle-model"

const USER = "user-1"
const NOW = new Date("2026-09-10T10:00:00.000Z")

function workspace(): Database {
  const db = emptyDatabase()
  db.app_settings = [buildRow("app_settings", {}, USER, NOW)]
  db.angles = [
    buildRow("angles", { id: "a-story", name: "Story", description: "A moment that changed things", is_default: true }, USER, NOW),
    buildRow("angles", { id: "a-myth", name: "Myth", description: "Break a belief", is_default: true }, USER, NOW),
    buildRow("angles", { id: "a-teardown", name: "Ad teardown", description: "Dissect a real ad", is_default: false }, USER, NOW),
  ]
  db.content_ideas = [
    buildRow("content_ideas", { id: "i1", title: "One", angle_id: "a-story" }, USER, NOW),
    buildRow("content_ideas", { id: "i2", title: "Two", angle_id: "a-teardown" }, USER, NOW),
  ]
  db.content_items = [
    buildRow(
      "content_items",
      { id: "c1", title: "Posted", angle_id: "a-teardown", platform: "tiktok", stage: "published", published_at: "2026-09-08T09:00:00.000Z" },
      USER,
      NOW
    ),
  ]
  db.content_metrics = [
    buildRow("content_metrics", { content_item_id: "c1", platform: "tiktok", recorded_at: "2026-09-09", views: 2500, reach: 2000, likes: 100 }, USER, NOW),
  ]
  return db
}

describe("angleStats", () => {
  it("counts ideas and content per angle and takes performance from anglePerformance", () => {
    const db = workspace()
    const stats = angleStats(db, NOW)
    expect(stats.get("a-story")).toMatchObject({ ideaIds: ["i1"], itemIds: [], uses: 1, performance: null })
    expect(stats.get("a-teardown")).toMatchObject({ ideaIds: ["i2"], itemIds: ["c1"], uses: 2 })
    expect(stats.get("a-teardown")?.performance).toEqual(anglePerformance(db, NOW).find((a) => a.angle.id === "a-teardown"))
    expect(stats.get("a-myth")?.uses).toBe(0)
  })
})

describe("filters, sorting and untried angles", () => {
  it("filters by kind and search", () => {
    const db = workspace()
    expect(filterAngles(db.angles, { q: "", kind: "custom" }).map((a) => a.id)).toEqual(["a-teardown"])
    expect(filterAngles(db.angles, { q: "belief", kind: "all" }).map((a) => a.id)).toEqual(["a-myth"])
    expect(filterAngles(db.angles, { q: "", kind: "default" })).toHaveLength(2)
  })

  it("sorts by performance (unmeasured last), usage and name", () => {
    const db = workspace()
    const stats = angleStats(db, NOW)
    expect(sortAngles(db.angles, "performance", stats).map((a) => a.id)).toEqual(["a-teardown", "a-story", "a-myth"])
    expect(sortAngles(db.angles, "uses", stats).map((a) => a.id)).toEqual(["a-teardown", "a-story", "a-myth"])
    expect(sortAngles(db.angles, "az", stats).map((a) => a.id)).toEqual(["a-teardown", "a-myth", "a-story"])
  })

  it("lists angles never used", () => {
    const db = workspace()
    expect(untriedAngles(db.angles, angleStats(db, NOW)).map((a) => a.id)).toEqual(["a-myth"])
  })
})

describe("validateAngleName", () => {
  it("requires a unique name of at most 40 characters", () => {
    const db = workspace()
    expect(validateAngleName("  ", db.angles)).toBe("Give the angle a name.")
    expect(validateAngleName("x".repeat(41), db.angles)).toMatch(/40 characters/)
    expect(validateAngleName("ad  TEARDOWN!", db.angles)).toBe("An angle with this name already exists.")
    expect(validateAngleName("Ad teardown", db.angles, "a-teardown")).toBeNull()
    expect(validateAngleName("Hot take", db.angles)).toBeNull()
  })

  it("links to the generator with the angle, started", () => {
    expect(generatorHref("a b")).toBe("/ideas/generator?angle=a%20b&run=1")
  })
})
