import { describe, expect, it } from "vitest"
import { formatRatio, formatValue, formatWatchTime, hourLabel, hourLongLabel, roundOrNull } from "./format"

describe("analytics formatters", () => {
  it("formats every metric kind and missing values", () => {
    expect(formatValue(12345, "count")).toBe("12,345")
    expect(formatValue(12345, "count", true)).toBe("12.3K")
    expect(formatValue(7.25, "percent")).toBe("7.3%")
    expect(formatValue(2.46, "multiple")).toBe("2.5×")
    expect(formatValue(null, "count")).toBe("—")
    expect(formatValue(Number.NaN, "percent")).toBe("—")
  })

  it("keeps watch time readable at any size", () => {
    expect(formatWatchTime(19.5)).toBe("20s")
    expect(formatWatchTime(95)).toBe("1:35")
    expect(formatWatchTime(356_402)).toBe("99h")
    expect(formatWatchTime(5_400)).toBe("1.5h")
    expect(formatWatchTime(null)).toBe("—")
  })

  it("labels hours and ratios", () => {
    expect(hourLabel(0)).toBe("12a")
    expect(hourLabel(13)).toBe("1p")
    expect(hourLongLabel(20)).toBe("8 PM")
    expect(hourLongLabel(12)).toBe("12 PM")
    expect(formatRatio(1.834)).toBe("1.8×")
    expect(roundOrNull(41.237)).toBe(41.24)
    expect(roundOrNull(undefined)).toBeNull()
  })
})
