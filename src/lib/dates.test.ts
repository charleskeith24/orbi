import { describe, expect, it } from "vitest"
import { formatRelativeDay } from "@/lib/dates"

// Local calendar days; 10:30 so a late or early clock time never changes the calendar-day difference.
const NOW = new Date(2026, 8, 16, 10, 30)
const day = (offset: number) => new Date(2026, 8, 16 + offset, 22, 15)

describe("formatRelativeDay", () => {
  it("returns the English it always did by default", () => {
    expect(formatRelativeDay(day(0), NOW)).toBe("Today")
    expect(formatRelativeDay(day(1), NOW)).toBe("Tomorrow")
    expect(formatRelativeDay(day(-1), NOW)).toBe("Yesterday")
    expect(formatRelativeDay(day(2), NOW)).toBe("in 2 days")
    expect(formatRelativeDay(day(14), NOW)).toBe("in 14 days")
    expect(formatRelativeDay(day(-2), NOW)).toBe("2 days ago")
    expect(formatRelativeDay(day(-14), NOW)).toBe("14 days ago")
    expect(formatRelativeDay(day(15), NOW)).toBe("Oct 1")
    expect(formatRelativeDay(day(-15), NOW)).toBe("Sep 1")
    expect(formatRelativeDay("2026-09-21", NOW)).toBe("in 5 days")
    expect(formatRelativeDay(null, NOW)).toBe("—")
  })

  it("is identical with an explicit English language", () => {
    for (let offset = -20; offset <= 20; offset++) {
      expect(formatRelativeDay(day(offset), NOW, "en")).toBe(formatRelativeDay(day(offset), NOW))
    }
    expect(formatRelativeDay(undefined, NOW, "en")).toBe("—")
  })

  it("speaks Taglish and keeps the short date past two weeks", () => {
    expect(formatRelativeDay(day(0), NOW, "tl")).toBe("Ngayon")
    expect(formatRelativeDay(day(1), NOW, "tl")).toBe("Bukas")
    expect(formatRelativeDay(day(-1), NOW, "tl")).toBe("Kahapon")
    expect(formatRelativeDay(day(3), NOW, "tl")).toBe("sa 3 araw")
    expect(formatRelativeDay(day(14), NOW, "tl")).toBe("sa 14 araw")
    expect(formatRelativeDay(day(-5), NOW, "tl")).toBe("5 araw ang nakalipas")
    expect(formatRelativeDay(day(-14), NOW, "tl")).toBe("14 araw ang nakalipas")
    expect(formatRelativeDay(day(15), NOW, "tl")).toBe("Oct 1")
    expect(formatRelativeDay(day(-15), NOW, "tl")).toBe("Sep 1")
    expect(formatRelativeDay("", NOW, "tl")).toBe("—")
  })
})
