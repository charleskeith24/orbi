import { subDays } from "date-fns"
import { describe, expect, it } from "vitest"
import { OPERATING_RHYTHM, SYSTEM_PRINCIPLES } from "@/lib/constants"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import { flywheel, principleMetrics, toneFor } from "./system-model"
import { coreLoop, rhythmEvidence } from "./system-rhythm"

const now = new Date(2026, 8, 13, 12)

function workspace() {
  const db = emptyDatabase()
  const settings = buildRow("app_settings", { id: "s" }, "", now)
  db.app_settings = [settings]
  db.brand_profiles = [buildRow("brand_profiles", { id: "b", expertise_areas: ["AI", "Growth"], years_experience: 11 }, "", now)]
  const item = (id: string, values: Record<string, unknown>) => buildRow("content_items", { id, ...values }, "", now)
  db.content_items = [
    item("p1", { stage: "published", published_at: subDays(now, 3).toISOString(), persona_id: "x", goal_id: "g", funnel_stage: "tofu" }),
    item("p2", { stage: "published", published_at: subDays(now, 40).toISOString(), persona_id: "x" }),
    item("d1", { stage: "scripting", persona_id: null }),
    item("old", { stage: "published", published_at: subDays(now, 200).toISOString() }),
  ]
  db.stories = [buildRow("stories", { id: "s1" }, "", subDays(now, 2))]
  return { db, settings }
}

describe("flywheel", () => {
  it("builds the nine steps with live evidence", () => {
    const { db } = workspace()
    const summary = flywheel(db, now, db.brand_profiles[0])
    expect(summary.steps.map((s) => s.key)).toEqual([
      "expertise",
      "content",
      "attention",
      "trust",
      "authority",
      "community",
      "opportunity",
      "experience",
      "more_content",
    ])
    expect(summary.steps[0]).toMatchObject({ value: "2", unit: "areas · 11 yrs", delta: null })
    expect(summary.steps[1]).toMatchObject({ value: "1", unit: "post" })
    expect(summary.steps[7].unit).toBe("stories · 1 new")
  })
})

describe("principleMetrics", () => {
  it("returns one metric per principle, measured on active content", () => {
    const { db, settings } = workspace()
    const metrics = principleMetrics(db, now, settings, 64)
    expect(metrics).toHaveLength(SYSTEM_PRINCIPLES.length)
    // Active content = the pipeline item plus posts from the last 90 days (p1, p2, d1).
    expect(metrics[0]).toMatchObject({ value: "67%", tone: "warning" })
    expect(metrics[1].value).toBe("33%")
    expect(metrics[9]).toMatchObject({ value: "64%", tone: "warning", href: "/strategy" })
  })

  it("maps scores to the health bands", () => {
    expect([toneFor(85), toneFor(65), toneFor(45), toneFor(10), toneFor(null)]).toEqual(["good", "warning", "serious", "critical", "neutral"])
  })
})

describe("rhythm and loop", () => {
  it("has evidence for every rhythm step and ten loop steps", () => {
    const { db, settings } = workspace()
    const evidence = rhythmEvidence(db, now, settings)
    for (const key of ["daily", "weekly", "monthly"] as const) expect(evidence[key]).toHaveLength(OPERATING_RHYTHM[key].steps.length)
    const loop = coreLoop(db, now, settings, 64)
    expect(loop).toHaveLength(10)
    expect(loop[0]).toEqual({ label: "Strategy", href: "/strategy", stat: "Brand HQ 64%" })
    expect(loop[loop.length - 1].label).toBe("New strategy")
  })
})
