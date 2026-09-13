import { subDays } from "date-fns"
import { describe, expect, it } from "vitest"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import {
  focusPatch,
  goalPayload,
  goalReferences,
  goalsSummary,
  goalTargetText,
  kpisForCategoryChange,
  newGoalValues,
  validateGoal,
} from "./goals-model"

const now = new Date(2026, 8, 13, 12)

function workspace() {
  const db = emptyDatabase()
  const settings = buildRow("app_settings", { id: "settings" }, "", now)
  const leads = buildRow("content_goals", { id: "g-leads", category: "leads", name: "Qualified inquiries", target_metric: "leads", target_value: 40 }, "", now)
  const reach = buildRow("content_goals", { id: "g-reach", category: "awareness", name: "Reach", target_value: 1000 }, "", now)
  const off = buildRow("content_goals", { id: "g-off", category: "business", name: "Old goal", is_active: false }, "", now)
  db.app_settings = [settings]
  db.brand_profiles = [buildRow("brand_profiles", { id: "brand", primary_goal_id: "g-reach", secondary_goal_id: "g-leads" }, "", now)]
  db.content_goals = [off, leads, reach]
  const published = (id: string, goal: string | null, daysAgo: number) =>
    buildRow("content_items", { id, goal_id: goal, stage: "published", published_at: subDays(now, daysAgo).toISOString() }, "", now)
  db.content_items = [
    published("a", "g-leads", 2),
    published("b", "g-leads", 10),
    published("c", null, 5),
    published("old", "g-leads", 45),
    buildRow("content_items", { id: "d", goal_id: "g-reach", stage: "scripting" }, "", now),
  ]
  db.content_ideas = [
    buildRow("content_ideas", { id: "i1", goal_id: "g-leads", status: "validated" }, "", now),
    buildRow("content_ideas", { id: "i2", goal_id: "g-leads", status: "archived" }, "", now),
  ]
  return { db, settings }
}

describe("goalsSummary", () => {
  it("counts the last 30 days of content per goal", () => {
    const { db, settings } = workspace()
    const summary = goalsSummary(db, now, settings)
    expect(summary.posts30).toBe(3)
    expect(summary.unassigned30).toBe(1)
    expect(summary.byCategory.leads).toBe(2)
    const leads = summary.rows.find((r) => r.goal.id === "g-leads")
    expect(leads).toMatchObject({ published30: 2, share30: 67, inProduction: 0, ideas: 1, role: "secondary" })
    expect(summary.rows.find((r) => r.goal.id === "g-reach")).toMatchObject({ inProduction: 1, role: "primary" })
  })

  it("orders primary, secondary, active, then inactive goals", () => {
    const { db, settings } = workspace()
    expect(goalsSummary(db, now, settings).rows.map((r) => r.goal.id)).toEqual(["g-reach", "g-leads", "g-off"])
  })
})

describe("strategic focus", () => {
  const brand = { primary_goal_id: "a", secondary_goal_id: "b" }
  it("swaps roles instead of duplicating a goal", () => {
    expect(focusPatch(brand, "primary", "b")).toEqual({ primary_goal_id: "b", secondary_goal_id: "a" })
    expect(focusPatch(brand, "secondary", "a")).toEqual({ secondary_goal_id: "a", primary_goal_id: "b" })
    expect(focusPatch(brand, "primary", "c")).toEqual({ primary_goal_id: "c" })
    expect(focusPatch(brand, "secondary", null)).toEqual({ secondary_goal_id: null })
  })

  it("reports what references a goal", () => {
    const { db } = workspace()
    expect(goalReferences(db, "g-leads")).toMatchObject({ items: 3, ideas: 2, role: "secondary" })
  })
})

describe("goal form", () => {
  it("labels targets with the category's default metric", () => {
    expect(goalTargetText({ category: "awareness", target_metric: null, target_value: 150000, period: "monthly" })).toBe(
      "150,000 reach per month"
    )
    expect(goalTargetText({ category: "leads", target_metric: "leads", target_value: null, period: "weekly" })).toBe("")
  })

  it("validates and saves integer targets", () => {
    const values = { ...newGoalValues("leads"), name: "  Book calls ", target_value: 12.6 }
    expect(validateGoal(values)).toEqual({})
    expect(goalPayload(values)).toMatchObject({ name: "Book calls", target_value: 13 })
    expect(validateGoal({ ...values, name: "" }).name).toBeTruthy()
    expect(validateGoal({ ...values, target_value: 0 }).target_value).toBeTruthy()
  })

  it("switches default KPIs with the category unless edited", () => {
    const defaults = newGoalValues("awareness").kpis
    expect(kpisForCategoryChange(defaults, "awareness", "leads")).toEqual(newGoalValues("leads").kpis)
    expect(kpisForCategoryChange(["Custom"], "awareness", "leads")).toEqual(["Custom"])
  })
})
