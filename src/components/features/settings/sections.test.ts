import { describe, expect, it } from "vitest"
import {
  ENGAGEMENT_DEFAULTS,
  engagementPatch,
  engagementValid,
  FUNNEL_DEFAULTS,
  GENERAL_DEFAULTS,
  generalPatch,
  generalResetValues,
  normalizeFunnel,
  PERFORMANCE_DEFAULTS,
  performancePatch,
  taskKey,
  validateEngagement,
  validateFunnel,
  validateGeneral,
  validatePerformance,
} from "./sections"

describe("general", () => {
  it("accepts the defaults and rejects bad values", () => {
    expect(validateGeneral(GENERAL_DEFAULTS)).toEqual({})
    const errors = validateGeneral({ ...GENERAL_DEFAULTS, weekly_post_target: 0, pillar_tolerance: null, timezone: "Mars/Base" })
    expect(Object.keys(errors).sort()).toEqual(["pillar_tolerance", "timezone", "weekly_post_target"])
    expect(validateGeneral({ ...GENERAL_DEFAULTS, weekly_post_target: 7.5 }).weekly_post_target).toBeDefined()
  })

  it("carries language, Simple mode and currency, and saves a clean currency code", () => {
    expect(GENERAL_DEFAULTS).toMatchObject({ ui_language: "en", simple_mode: true, currency: "PHP" })
    expect(validateGeneral({ ...GENERAL_DEFAULTS, currency: "peso" }).currency).toBeDefined()
    expect(generalPatch({ ...GENERAL_DEFAULTS, ui_language: "tl", simple_mode: false, currency: " usd " })).toMatchObject({
      ui_language: "tl",
      simple_mode: false,
      currency: "USD",
    })
  })

  it("resets the rules but keeps personal preferences", () => {
    const mine = { ...GENERAL_DEFAULTS, ui_language: "tl" as const, simple_mode: false, currency: "USD", timezone: "Asia/Tokyo", weekly_post_target: 3 }
    expect(generalResetValues(mine)).toEqual({ ...GENERAL_DEFAULTS, ui_language: "tl", simple_mode: false, currency: "USD", timezone: "Asia/Tokyo" })
  })
})

describe("performance", () => {
  it("requires Good < Winner < Breakout and a sample inside the window", () => {
    expect(validatePerformance(PERFORMANCE_DEFAULTS)).toEqual({})
    expect(validatePerformance({ ...PERFORMANCE_DEFAULTS, tier_good: 1 }).tier_good).toBeDefined()
    expect(validatePerformance({ ...PERFORMANCE_DEFAULTS, tier_winner: 1.5 }).tier_winner).toBeDefined()
    expect(validatePerformance({ ...PERFORMANCE_DEFAULTS, tier_breakout: 2 }).tier_breakout).toBeDefined()
    expect(validatePerformance({ ...PERFORMANCE_DEFAULTS, winner_window: 5, winner_min_sample: 6 }).winner_min_sample).toBeDefined()
    expect(validatePerformance({ ...PERFORMANCE_DEFAULTS, buffer_warning_days: 7 }).buffer_warning_days).toBeDefined()
  })

  it("saves whole numbers for integer columns", () => {
    const patch = performancePatch({ ...PERFORMANCE_DEFAULTS, winner_window: 20.4, buffer_healthy_days: 6.6, tier_good: 1.456 })
    expect(patch).toMatchObject({ winner_window: 20, buffer_healthy_days: 7, tier_good: 1.46 })
  })
})

describe("funnel", () => {
  it("requires targets to add up to 100", () => {
    expect(validateFunnel(FUNNEL_DEFAULTS)).toEqual({})
    expect(validateFunnel({ tofu: 50, mofu: 30, bofu: 15 }).total).toMatch(/95%/)
    expect(validateFunnel({ tofu: 50.5, mofu: 34.5, bofu: 15 }).tofu).toBeDefined()
  })

  it("normalises to exactly 100 with whole numbers", () => {
    const normalized = normalizeFunnel({ tofu: 50, mofu: 30, bofu: 15 })
    expect(normalized).toEqual({ tofu: 53, mofu: 31, bofu: 16 })
    expect(normalizeFunnel({ tofu: 0, mofu: 0, bofu: 0 })).toEqual(FUNNEL_DEFAULTS)
  })
})

describe("engagement", () => {
  it("flags blank and duplicate task names", () => {
    expect(engagementValid(validateEngagement(ENGAGEMENT_DEFAULTS))).toBe(true)
    const errors = validateEngagement({
      tasks: [
        { rid: "1", key: "reply", label: "Reply", target: 3 },
        { rid: "2", key: "", label: "reply", target: 1 },
        { rid: "3", key: "", label: " ", target: 1.5 },
      ],
    })
    expect(errors.rows["2"]?.label).toBeDefined()
    expect(errors.rows["3"]).toMatchObject({ label: expect.any(String), target: expect.any(String) })
  })

  it("keeps saved keys and gives new tasks unique ones", () => {
    expect(taskKey("Reply to comments!", new Set(["reply_to_comments"]))).toBe("reply_to_comments_2")
    const patch = engagementPatch({
      tasks: [
        { rid: "reply_comments", key: "reply_comments", label: " Reply to comments ", target: 10.2 },
        { rid: "new-1", key: "", label: "Reply comments", target: 2 },
      ],
    })
    expect(patch.engagement_tasks).toEqual([
      { key: "reply_comments", label: "Reply to comments", target: 10 },
      { key: "reply_comments_2", label: "Reply comments", target: 2 },
    ])
  })
})
