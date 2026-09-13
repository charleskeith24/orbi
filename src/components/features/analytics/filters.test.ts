import { describe, expect, it } from "vitest"
import {
  comparisonRange,
  defaultFilters,
  describeRange,
  hrefWithFilters,
  isDefaultFilters,
  OVERVIEW_DEFAULTS,
  parseFilters,
  POSTS_DEFAULTS,
  readListParam,
  resolveFilterRange,
  validISODate,
  writeFilters,
} from "./filters"
import { NOW } from "./test-fixtures"

const qs = (value: string) => new URLSearchParams(value)

describe("parseFilters", () => {
  it("falls back to the page defaults", () => {
    expect(parseFilters(qs(""), OVERVIEW_DEFAULTS)).toEqual({ range: "30", from: null, to: null, platforms: [], pillars: [] })
    expect(parseFilters(qs(""), POSTS_DEFAULTS).range).toBe("all")
  })

  it("only accepts All time where the page offers it", () => {
    expect(parseFilters(qs("range=all"), OVERVIEW_DEFAULTS).range).toBe("30")
    expect(parseFilters(qs("range=all"), POSTS_DEFAULTS).range).toBe("all")
    expect(parseFilters(qs("range=365"), OVERVIEW_DEFAULTS).range).toBe("30")
  })

  it("needs a valid start for a custom range", () => {
    expect(parseFilters(qs("range=custom"), OVERVIEW_DEFAULTS).range).toBe("30")
    expect(parseFilters(qs("range=custom&from=2026-02-31"), OVERVIEW_DEFAULTS).range).toBe("30")
    expect(parseFilters(qs("range=custom&from=2026-08-01&to=2026-08-31"), OVERVIEW_DEFAULTS)).toMatchObject({
      range: "custom",
      from: "2026-08-01",
      to: "2026-08-31",
    })
  })

  it("drops unknown platforms and duplicates", () => {
    expect(parseFilters(qs("platform=facebook,myspace,tiktok,facebook"), OVERVIEW_DEFAULTS).platforms).toEqual(["facebook", "tiktok"])
    expect(readListParam(qs("pillar= a , b,,a"), "pillar")).toEqual(["a", "b"])
  })
})

describe("writeFilters", () => {
  it("omits the default range and custom dates of presets, keeps other params", () => {
    const params = qs("open=abc&range=7")
    writeFilters(params, { range: "30", from: "2026-01-01", to: null, platforms: ["x", "tiktok"], pillars: [] }, OVERVIEW_DEFAULTS)
    expect(params.get("open")).toBe("abc")
    expect(params.has("range")).toBe(false)
    expect(params.has("from")).toBe(false)
    expect(params.get("platform")).toBe("x,tiktok")
    expect(params.has("pillar")).toBe(false)
  })

  it("round-trips a custom range", () => {
    const params = qs("")
    const filters = { range: "custom" as const, from: "2026-08-01", to: "2026-08-15", platforms: [], pillars: ["none"] }
    writeFilters(params, filters, OVERVIEW_DEFAULTS)
    expect(parseFilters(params, OVERVIEW_DEFAULTS)).toEqual(filters)
  })
})

describe("ranges", () => {
  it("resolves presets as trailing days ending today", () => {
    const range = resolveFilterRange({ ...defaultFilters(OVERVIEW_DEFAULTS) }, NOW)
    expect(range?.start.getTime()).toBe(new Date(2026, 7, 13).getTime())
    expect(range?.end.getDate()).toBe(11)
    expect(range?.end.getHours()).toBe(23)
  })

  it("swaps a reversed custom range and treats All time as unbounded", () => {
    const range = resolveFilterRange({ range: "custom", from: "2026-09-10", to: "2026-09-01", platforms: [], pillars: [] }, NOW)
    expect(range?.start.getTime()).toBe(new Date(2026, 8, 1).getTime())
    expect(range?.end.getDate()).toBe(10)
    expect(resolveFilterRange({ ...defaultFilters(POSTS_DEFAULTS) }, NOW)).toBeNull()
  })

  it("compares with the equally long window just before", () => {
    const previous = comparisonRange(resolveFilterRange(defaultFilters(OVERVIEW_DEFAULTS), NOW))
    expect(describeRange(previous)).toBe("Jul 14 – Aug 12, 2026")
    expect(comparisonRange(null)).toBeNull()
  })

  it("describes ranges", () => {
    expect(describeRange(null)).toBe("All time")
    expect(describeRange({ start: new Date(2025, 11, 20), end: new Date(2026, 0, 5, 23, 59) })).toBe("Dec 20, 2025 – Jan 5, 2026")
  })
})

describe("links", () => {
  it("writes the range explicitly when the target page has another default", () => {
    expect(hrefWithFilters("/analytics/posts", defaultFilters(OVERVIEW_DEFAULTS), POSTS_DEFAULTS, { tier: "none" })).toBe(
      "/analytics/posts?range=30&tier=none"
    )
    expect(hrefWithFilters("/analytics", defaultFilters(OVERVIEW_DEFAULTS), OVERVIEW_DEFAULTS)).toBe("/analytics")
  })

  it("knows when filters are at their defaults", () => {
    expect(isDefaultFilters(defaultFilters(OVERVIEW_DEFAULTS), OVERVIEW_DEFAULTS)).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(OVERVIEW_DEFAULTS), platforms: ["x"] }, OVERVIEW_DEFAULTS)).toBe(false)
  })

  it("validates calendar dates", () => {
    expect(validISODate("2026-02-28")).toBe("2026-02-28")
    expect(validISODate("2026-02-31")).toBeNull()
    expect(validISODate("Sep 1")).toBeNull()
  })
})
