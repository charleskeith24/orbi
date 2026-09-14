import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { ContentExperiment, InsertRow } from "@/lib/types"
import {
  experimentTiming,
  formatMetricValue,
  formValuesOf,
  groupExperiments,
  lessonIdeaValues,
  transitionPatch,
  validateExperiment,
} from "./experiment-model"

const exp = (values: InsertRow<"content_experiments">): ContentExperiment =>
  buildRow("content_experiments", values, "", new Date(2026, 0, 1))

describe("transitionPatch", () => {
  it("stamps today as the start when a planned experiment starts early", () => {
    const e = exp({ status: "planned", start_date: "2026-09-20", end_date: "2026-10-18" })
    expect(transitionPatch(e, "running", "2026-09-13")).toEqual({ status: "running", start_date: "2026-09-13" })
  })

  it("keeps a past start and clears an end date that falls before the new start", () => {
    expect(transitionPatch(exp({ status: "planned", start_date: "2026-09-01" }), "running", "2026-09-13")).toEqual({ status: "running" })
    expect(transitionPatch(exp({ status: "planned", end_date: "2026-09-10" }), "running", "2026-09-13")).toEqual({
      status: "running",
      start_date: "2026-09-13",
      end_date: null,
    })
  })

  it("never completes in the future", () => {
    const running = exp({ status: "running", start_date: "2026-09-03", end_date: "2026-10-01" })
    expect(transitionPatch(running, "completed", "2026-09-13")).toEqual({ status: "completed", end_date: "2026-09-13" })
    const overdue = exp({ status: "running", start_date: "2026-08-01", end_date: "2026-09-01" })
    expect(transitionPatch(overdue, "completed", "2026-09-13")).toEqual({ status: "completed" })
  })
})

describe("validateExperiment", () => {
  it("requires a name, two different variants and an end after the start", () => {
    const errors = validateExperiment({
      ...formValuesOf(null),
      variant_a: "Short hook",
      variant_b: " short hook ",
      start_date: "2026-09-10",
      end_date: "2026-09-01",
    })
    expect(Object.keys(errors).sort()).toEqual(["end_date", "name", "variant_b"])
  })

  it("accepts a complete design", () => {
    expect(validateExperiment({ ...formValuesOf(null), name: "Hooks", variant_a: "Short", variant_b: "Long" })).toEqual({})
  })
})

describe("formatMetricValue", () => {
  it("formats percents, durations and count means", () => {
    expect(formatMetricValue("avg_retention", 55.333)).toBe("55.3%")
    expect(formatMetricValue("engagement_rate", 7)).toBe("7.0%")
    expect(formatMetricValue("watch_time_seconds", 95)).toBe("1:35")
    expect(formatMetricValue("leads", 5.5)).toBe("5.5")
    expect(formatMetricValue("views", 12345.6)).toBe("12,346")
    expect(formatMetricValue("comments", null)).toBe("—")
  })
})

describe("groupExperiments", () => {
  it("orders non-empty groups running → planned → completed, soonest first", () => {
    const groups = groupExperiments([
      exp({ name: "done", status: "completed" }),
      exp({ name: "later", status: "planned", start_date: "2026-10-01" }),
      exp({ name: "sooner", status: "planned", start_date: "2026-09-20" }),
      exp({ name: "live", status: "running" }),
    ])
    expect(groups.map((g) => g.status)).toEqual(["running", "planned", "completed"])
    expect(groups[1].experiments.map((e) => e.name)).toEqual(["sooner", "later"])
  })
})

describe("experimentTiming", () => {
  it("counts the days of a running experiment", () => {
    const timing = experimentTiming(exp({ status: "running", start_date: "2026-09-03", end_date: "2026-10-01" }), new Date(2026, 8, 13, 10))
    expect(timing.label).toBe("Day 11 of 29 · 18 days left")
    expect(timing.progress).toBeCloseTo(11 / 29)
  })

  it("counts down to a planned start", () => {
    expect(experimentTiming(exp({ status: "planned", start_date: "2026-09-20" }), new Date(2026, 8, 13)).label).toBe("Starts in 7 days")
  })
})

describe("lessonIdeaValues", () => {
  it("uses the first sentence as the title and the whole lesson as the description", () => {
    const e = exp({ name: "Hooks", winner: "a", variant_a: "Short hook", result: "A won by 29%." })
    expect(lessonIdeaValues(e, "Lead with the claim, not the context. Numbers first.")).toMatchObject({
      title: "Lead with the claim, not the context",
      description: "Lead with the claim, not the context. Numbers first.",
      why_it_matters: "A won by 29%.",
      source: "manual",
      source_ref_id: e.id,
    })
  })
})
