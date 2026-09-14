import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { createStarterDatabase } from "@/lib/data/starter"
import type { Database } from "@/lib/types"
import { firstSteps, hasPublishedContent, workspaceStartKey } from "./first-run"

const NOW = new Date(2026, 8, 13, 12)
const USER = "user-1"

describe("first run", () => {
  it("starts a new workspace on the day it was created, with nothing published and every step open", () => {
    const db = createStarterDatabase(USER, NOW)
    expect(hasPublishedContent(db.content_items)).toBe(false)
    expect(workspaceStartKey(db)).toBe("2026-09-13")
    const steps = firstSteps(db)
    expect(steps.map((s) => s.key)).toEqual(["niche", "pillars", "idea", "content", "publish", "analytics"])
    expect(steps.every((s) => !s.done)).toBe(true)
  })

  it("moves the start back to the earliest logged post and ticks steps off from real rows", () => {
    const base = createStarterDatabase(USER, NOW)
    const post = buildRow(
      "content_items",
      { title: "Old post", platform: "facebook", stage: "published", published_at: new Date(2026, 5, 2, 9).toISOString() },
      USER,
      NOW
    )
    const db: Database = {
      ...base,
      content_items: [post],
      brand_profiles: [{ ...base.brand_profiles[0], niche: "Bookkeeping for online sellers" }],
    }
    expect(hasPublishedContent(db.content_items)).toBe(true)
    expect(workspaceStartKey(db)).toBe("2026-06-02")
    expect(firstSteps(db).filter((s) => s.done).map((s) => s.key)).toEqual(["niche", "content", "publish"])
  })
})
