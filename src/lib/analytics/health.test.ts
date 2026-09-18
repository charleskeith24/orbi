import { describe, expect, it } from "vitest"
import { PIPELINE_STAGES, PLATFORM_IDS } from "@/lib/constants"
import type { Database } from "@/lib/types"
import { contentHealthScore, engagementTrendPoints, healthBand, HEALTH_COMPONENTS } from "./health"
import { monthlyReport, weeklyReport } from "./reports"
import { recommendNextContent, strategicInsights } from "./recommendations"
import { add, addPublished, daysAgo, makeDb, NOW, settingsOf } from "./test-fixtures"

/** Daily posts for 12 weeks alternating two 50% pillars, a repurposed breakout and a full buffer. */
function healthyDb(): Database {
  const db = makeDb({ weekly_post_target: 7, buffer_healthy_days: 7 })
  const a = add(db, "content_pillars", { name: "Education", target_percentage: 50 })
  const b = add(db, "content_pillars", { name: "Journey", target_percentage: 50, sort_order: 1 })
  for (let day = 0; day < 84; day++) {
    const recent = day < 30
    const breakout = day === 10
    const views = breakout ? 500 : 100
    const likes = breakout ? 65 : recent ? 13 : 10
    const dueDate = day === 3 || day === 5 ? daysAgo(day).toISOString().slice(0, 10) : null
    const item = addPublished(db, day, { pillar_id: day % 2 ? b.id : a.id, due_date: dueDate }, { views, reach: views, likes })
    if (breakout) add(db, "content_items", { stage: "brief", parent_id: item.id, title: "Follow-up" })
  }
  for (let i = 0; i < 7; i++) add(db, "content_items", { stage: "ready_to_post" })
  return db
}

describe("contentHealthScore", () => {
  it("stays within 0–100 on an empty workspace and explains every component", () => {
    const db = makeDb()
    const health = contentHealthScore(db, NOW, settingsOf(db))
    expect(health.components.map((c) => c.key)).toEqual(["consistency", "balance", "engagement", "completion", "repurposing", "backlog"])
    expect(health.components.reduce((acc, c) => acc + c.max, 0)).toBe(100)
    for (const c of health.components) {
      expect(c.detail.length).toBeGreaterThan(10)
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(c.max)
    }
    // No posts and no buffer score 0; the rest can't be measured and score half.
    expect(health.components.map((c) => c.score)).toEqual([0, 10, 7.5, 7.5, 5, 0])
    expect(health.score).toBe(30)
    expect(health.band).toEqual({ label: "Critical", tone: "critical" })
  })

  it("scores a consistent, balanced, growing system at 100", () => {
    const db = healthyDb()
    const health = contentHealthScore(db, NOW, settingsOf(db))
    expect(health.components.map((c) => [c.key, c.score])).toEqual([
      ["consistency", 25],
      ["balance", 20],
      ["engagement", 15],
      ["completion", 15],
      ["repurposing", 10],
      ["backlog", 15],
    ])
    expect(health.score).toBe(100)
    expect(health.band.label).toBe("Healthy Content System")
  })

  it("loses the backlog points when the buffer empties", () => {
    const db = healthyDb()
    db.content_items = db.content_items.filter((i) => i.stage !== "ready_to_post")
    const health = contentHealthScore(db, NOW, settingsOf(db))
    expect(health.components.find((c) => c.key === "backlog")).toMatchObject({ score: 0 })
    expect(health.score).toBe(85)
  })

  it("stays within bounds for randomised workspaces (and nothing else throws)", () => {
    let seed = 42
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)]
    for (let run = 0; run < 25; run++) {
      const db = makeDb({
        weekly_post_target: Math.floor(random() * 20),
        buffer_healthy_days: 1 + Math.floor(random() * 14),
        buffer_warning_days: Math.floor(random() * 5),
        pillar_tolerance: Math.floor(random() * 30),
        winner_metric: pick(["views", "engagement_rate", "engagements", "leads", "composite"] as const),
        week_starts_on: pick([0, 1] as const),
      })
      const pillars = Array.from({ length: Math.floor(random() * 5) }, (_, i) =>
        add(db, "content_pillars", { name: `P${i}`, target_percentage: Math.floor(random() * 60) })
      )
      for (let i = 0; i < 60; i++) {
        const stage = pick(PIPELINE_STAGES).id
        const when = daysAgo(Math.floor(random() * 240) - 60).toISOString()
        const item = add(db, "content_items", {
          stage,
          platform: pick(PLATFORM_IDS),
          pillar_id: pillars.length && random() > 0.2 ? pick(pillars).id : null,
          published_at: stage === "published" || stage === "repurpose" ? when : null,
          scheduled_at: random() > 0.5 ? when : null,
          due_date: random() > 0.5 ? when.slice(0, 10) : null,
          funnel_stage: pick(["tofu", "mofu", "bofu", null] as const),
          pinned_winner: random() > 0.9,
        })
        if (random() > 0.3) {
          add(db, "content_metrics", {
            content_item_id: item.id,
            views: Math.floor(random() * 5000),
            reach: Math.floor(random() * 4000),
            likes: Math.floor(random() * 300),
            shares: Math.floor(random() * 50),
            leads: Math.floor(random() * 5),
          })
        }
      }
      for (let i = 0; i < 10; i++) add(db, "content_ideas", { status: pick(["inbox", "validated", "selected", "archived"] as const), score: Math.floor(random() * 100) })
      const settings = settingsOf(db)
      const health = contentHealthScore(db, NOW, settings)
      expect(Number.isFinite(health.score)).toBe(true)
      expect(health.score).toBeGreaterThanOrEqual(0)
      expect(health.score).toBeLessThanOrEqual(100)
      for (const c of health.components) {
        expect(c.score).toBeGreaterThanOrEqual(0)
        expect(c.score).toBeLessThanOrEqual(HEALTH_COMPONENTS[c.key].max)
      }
      expect(strategicInsights(db, NOW, settings).length).toBeLessThanOrEqual(8)
      for (const rec of recommendNextContent(db, NOW, settings, { limit: 20 })) {
        expect(rec.score).toBeGreaterThanOrEqual(0)
        expect(rec.score).toBeLessThanOrEqual(100)
      }
      expect(() => weeklyReport(db, NOW, settings)).not.toThrow()
      expect(() => monthlyReport(db, NOW, settings)).not.toThrow()
    }
  })
})

describe("contentHealthScore language", () => {
  it("defaults to English and scores the same in Taglish", () => {
    const db = healthyDb()
    const settings = settingsOf(db)
    const en = contentHealthScore(db, NOW, settings)
    expect(contentHealthScore(db, NOW, settings, "en")).toEqual(en)
    const tl = contentHealthScore(db, NOW, settings, "tl")
    expect(tl.score).toBe(en.score)
    expect(tl.components.map((c) => [c.key, c.score, c.max])).toEqual(en.components.map((c) => [c.key, c.score, c.max]))
    expect(tl.components.find((c) => c.key === "consistency")?.label).toBe("Consistency sa pag-post")
    expect(tl.components.find((c) => c.key === "backlog")?.label).toBe("Content Buffer")
    expect(tl.band.label).toBe("Healthy na Content System")
    for (const c of tl.components) {
      expect(c.detail).not.toBe(en.components.find((e) => e.key === c.key)?.detail)
      expect(c.detail).not.toMatch(/\{\w+\}/)
    }
  })
})

describe("engagementTrendPoints", () => {
  it.each([
    [0.3, 3],
    [0.6, 3],
    [0.8, 6.5],
    [1, 10],
    [1.15, 12.5],
    [1.3, 15],
    [2, 15],
  ])("%sx → %s points", (ratio, points) => {
    expect(engagementTrendPoints(ratio)).toBeCloseTo(points)
  })
})

describe("healthBand", () => {
  it.each([
    [100, "good"],
    [80, "good"],
    [79, "warning"],
    [60, "warning"],
    [40, "serious"],
    [39, "critical"],
    [0, "critical"],
  ])("%d → %s", (score, tone) => {
    expect(healthBand(score).tone).toBe(tone)
  })
})
