import { describe, expect, it } from "vitest"
import { toISODate } from "@/lib/dates"
import { cadenceLabel, nextEpisodeDate, nextOnOrAfter, relativeDayLabel, snapToWeekday } from "./series-schedule"

// 2026-09-11 is a Friday.
const FRI = new Date(2026, 8, 11, 15, 30)
const iso = (d: Date) => toISODate(d)

describe("nextOnOrAfter", () => {
  it("returns the same day when it already matches", () => {
    expect(iso(nextOnOrAfter(FRI, 5))).toBe("2026-09-11")
  })
  it("moves forward to the next matching weekday", () => {
    expect(iso(nextOnOrAfter(FRI, 1))).toBe("2026-09-14")
    expect(iso(nextOnOrAfter(FRI, 0))).toBe("2026-09-13")
  })
  it("keeps the day when no weekday is set", () => {
    expect(iso(nextOnOrAfter(FRI, null))).toBe("2026-09-11")
  })
})

describe("snapToWeekday", () => {
  it("snaps to the closest occurrence", () => {
    expect(iso(snapToWeekday(new Date(2026, 8, 13), 4))).toBe("2026-09-10") // Sun → previous Thu (−3)
    expect(iso(snapToWeekday(new Date(2026, 8, 12), 1))).toBe("2026-09-14") // Sat → Mon (+2)
  })
})

describe("nextEpisodeDate", () => {
  it("starts at the first series weekday from today without history", () => {
    expect(iso(nextEpisodeDate({ frequency: "weekly", day_of_week: 1 }, null, FRI))).toBe("2026-09-14")
    expect(iso(nextEpisodeDate({ frequency: "daily", day_of_week: 3 }, null, FRI))).toBe("2026-09-11")
  })
  it("adds one interval after the latest episode", () => {
    const lastMonday = new Date(2026, 8, 7)
    expect(iso(nextEpisodeDate({ frequency: "weekly", day_of_week: 1 }, lastMonday, FRI))).toBe("2026-09-14")
    const lastWed = new Date(2026, 8, 2)
    expect(iso(nextEpisodeDate({ frequency: "biweekly", day_of_week: 3 }, lastWed, FRI))).toBe("2026-09-16")
    expect(iso(nextEpisodeDate({ frequency: "daily", day_of_week: null }, FRI, FRI))).toBe("2026-09-12")
  })
  it("chains from an already planned future episode", () => {
    const plannedMonday = new Date(2026, 8, 14)
    expect(iso(nextEpisodeDate({ frequency: "weekly", day_of_week: 1 }, plannedMonday, FRI))).toBe("2026-09-21")
  })
  it("snaps monthly episodes to the series weekday", () => {
    const lastThu = new Date(2026, 7, 13)
    expect(iso(nextEpisodeDate({ frequency: "monthly", day_of_week: 4 }, lastThu, new Date(2026, 8, 1)))).toBe("2026-09-10")
  })
  it("restarts from today when the series has lapsed", () => {
    const longAgo = new Date(2026, 5, 1)
    expect(iso(nextEpisodeDate({ frequency: "weekly", day_of_week: 1 }, longAgo, FRI))).toBe("2026-09-14")
  })
  it("allows today when today is the series day", () => {
    const lastFriday = new Date(2026, 8, 4)
    expect(iso(nextEpisodeDate({ frequency: "weekly", day_of_week: 5 }, lastFriday, FRI))).toBe("2026-09-11")
  })
})

describe("relativeDayLabel", () => {
  it("counts calendar days in both directions", () => {
    expect(relativeDayLabel(new Date(2026, 8, 11, 23), FRI)).toBe("today")
    expect(relativeDayLabel(new Date(2026, 8, 12), FRI)).toBe("tomorrow")
    expect(relativeDayLabel(new Date(2026, 8, 24), FRI)).toBe("in 13 days")
    expect(relativeDayLabel(new Date(2026, 7, 20), FRI)).toBe("22 days ago")
  })
})

describe("cadenceLabel", () => {
  it("names frequency and weekday", () => {
    expect(cadenceLabel({ frequency: "weekly", day_of_week: 1 })).toBe("Weekly · Mondays")
    expect(cadenceLabel({ frequency: "biweekly", day_of_week: 3 }, true)).toBe("Every 2 weeks · Wed")
    expect(cadenceLabel({ frequency: "daily", day_of_week: 2 })).toBe("Daily")
    expect(cadenceLabel({ frequency: "monthly", day_of_week: null })).toBe("Monthly")
  })
})
