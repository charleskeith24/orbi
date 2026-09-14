import { describe, expect, it } from "vitest"
import type { WeeklyReview } from "@/lib/types"
import { formatDayRange, monthOptions, resolveMonthParam, resolveWeekParam, weekOptions } from "./report-periods"
import { experimentFromRecommendation, findWeeklyReview, mergeStats } from "./review-model"

const wed = new Date(2026, 8, 16, 10) // Wed Sep 16 2026

describe("resolveWeekParam", () => {
  it("defaults to the last completed week", () => {
    const period = resolveWeekParam(null, wed, 1)
    expect(period).toMatchObject({ key: "2026-09-07", endISO: "2026-09-13", isCurrent: false, label: "Sep 7 – 13, 2026" })
  })

  it("normalises any day to its week start and honours Sunday weeks", () => {
    expect(resolveWeekParam("2026-09-10", wed, 1).key).toBe("2026-09-07")
    expect(resolveWeekParam("2026-09-10", wed, 0).key).toBe("2026-09-06")
  })

  it("clamps future weeks to this week and ignores junk", () => {
    expect(resolveWeekParam("2026-12-01", wed, 1)).toMatchObject({ key: "2026-09-14", isCurrent: true })
    expect(resolveWeekParam("nope", wed, 1).key).toBe("2026-09-07")
  })
})

describe("resolveMonthParam", () => {
  it("defaults to last month, accepts YYYY-MM and full dates, clamps the future", () => {
    expect(resolveMonthParam(null, wed)).toMatchObject({ key: "2026-08", label: "August 2026", startISO: "2026-08-01", endISO: "2026-08-31" })
    expect(resolveMonthParam("2026-07-15", wed).startISO).toBe("2026-07-01")
    expect(resolveMonthParam("2027-01", wed)).toMatchObject({ key: "2026-09", isCurrent: true })
    expect(resolveMonthParam("2026-13", wed).key).toBe("2026-08")
  })
})

describe("labels and options", () => {
  it("formats day ranges within and across months and years", () => {
    expect(formatDayRange(new Date(2026, 8, 7), new Date(2026, 8, 13))).toBe("Sep 7 – 13, 2026")
    expect(formatDayRange(new Date(2026, 7, 31), new Date(2026, 8, 6))).toBe("Aug 31 – Sep 6, 2026")
    expect(formatDayRange(new Date(2025, 11, 29), new Date(2026, 0, 4))).toBe("Dec 29, 2025 – Jan 4, 2026")
  })

  it("lists recent weeks newest first, with hints and the selected week", () => {
    const options = weekOptions(wed, 1, resolveWeekParam("2026-01-05", wed, 1), new Map([["2026-08-31", "Reviewed"]]), 4)
    expect(options[0]).toMatchObject({ value: "2026-09-14", hint: "This week" })
    expect(options[1]).toMatchObject({ value: "2026-09-07", hint: "Last week" })
    expect(options.find((o) => o.value === "2026-08-31")?.hint).toBe("Reviewed")
    expect(options.at(-1)?.value).toBe("2026-01-05")
  })

  it("lists recent months newest first", () => {
    expect(monthOptions(wed, resolveMonthParam(null, wed), new Map(), 3).map((o) => o.value)).toEqual(["2026-09", "2026-08", "2026-07"])
  })
})

describe("review model", () => {
  it("keeps the Weekly Planner's stats when replacing the report snapshot", () => {
    expect(mergeStats({ plan: { target: 6 }, report: { old: true } }, { published: 5 })).toEqual({ plan: { target: 6 }, report: { published: 5 } })
    expect(mergeStats(null, { published: 1 })).toEqual({ report: { published: 1 } })
  })

  it("finds a week's review saved under another week start", () => {
    const rows = [
      { id: "a", week_start: "2026-09-06" },
      { id: "b", week_start: "2026-09-08" },
    ] as unknown as WeeklyReview[]
    expect(findWeeklyReview(rows, resolveWeekParam("2026-09-07", wed, 1))?.id).toBe("b")
  })

  it("turns template recommendations into experiments with the template's variants and metric", () => {
    const experiment = experimentFromRecommendation("Short hooks vs long hooks: Hook under 8 words vs Hook of 15+ words, measured on avg retention.")
    expect(experiment).toMatchObject({ name: "Short hooks vs long hooks", variant_a: "Hook under 8 words", variant_b: "Hook of 15+ words", metric: "avg_retention" })
  })

  it("names free-text experiments by their first clause and infers variants and metric", () => {
    const text = "Carousel vs reel on LinkedIn — which one earns more saves?"
    expect(experimentFromRecommendation(text)).toEqual({
      name: "Carousel vs reel on LinkedIn",
      hypothesis: text,
      variant_a: "Carousel",
      variant_b: "Reel on LinkedIn",
      metric: "saves",
    })
  })
})
