import { describe, expect, it } from "vitest"
import { addLocalDays, localDateOf, parseTime, safeTimeZone, zonedParts, zonedToUtc, zoneOffsetMs } from "./zoned"

describe("zonedParts", () => {
  it("reads the wall clock in another zone", () => {
    const instant = new Date("2026-09-15T23:30:00.000Z")
    expect(zonedParts(instant, "Asia/Manila")).toEqual({ year: 2026, month: 9, day: 16, hour: 7, minute: 30, second: 0, weekday: 3 })
    expect(zonedParts(instant, "America/Los_Angeles")).toMatchObject({ day: 15, hour: 16, weekday: 2 })
  })

  it("reports midnight as hour 0", () => {
    expect(zonedParts(new Date("2026-09-15T16:00:00.000Z"), "Asia/Manila")).toMatchObject({ day: 16, hour: 0, minute: 0 })
  })
})

describe("zonedToUtc", () => {
  it("converts a Manila wall time (no DST)", () => {
    expect(zonedToUtc({ year: 2026, month: 9, day: 16, hour: 8, minute: 0 }, "Asia/Manila").toISOString()).toBe("2026-09-16T00:00:00.000Z")
  })

  it("handles half-hour and 45-minute offsets", () => {
    expect(zonedToUtc({ year: 2026, month: 1, day: 1, hour: 9, minute: 0 }, "Asia/Kolkata").toISOString()).toBe("2026-01-01T03:30:00.000Z")
    expect(zonedToUtc({ year: 2026, month: 1, day: 1, hour: 9, minute: 0 }, "Asia/Kathmandu").toISOString()).toBe("2026-01-01T03:15:00.000Z")
  })

  it("follows daylight saving time on both sides of the change", () => {
    expect(zonedToUtc({ year: 2026, month: 3, day: 7, hour: 9, minute: 0 }, "America/New_York").toISOString()).toBe("2026-03-07T14:00:00.000Z")
    expect(zonedToUtc({ year: 2026, month: 3, day: 9, hour: 9, minute: 0 }, "America/New_York").toISOString()).toBe("2026-03-09T13:00:00.000Z")
  })

  it("moves a time skipped by spring-forward later, and picks the first of a repeated fall-back time", () => {
    // 2026-03-08 02:30 doesn't exist in New York → 03:30 EDT.
    expect(zonedToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z")
    // 2026-11-01 01:30 happens twice → the EDT one.
    expect(zonedToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z")
  })

  it("round-trips with zonedParts across a year in a DST zone", () => {
    for (let month = 1; month <= 12; month++) {
      const utc = zonedToUtc({ year: 2026, month, day: 15, hour: 18, minute: 45 }, "Europe/London")
      expect(zonedParts(utc, "Europe/London")).toMatchObject({ month, day: 15, hour: 18, minute: 45 })
    }
  })
})

describe("helpers", () => {
  it("measures zone offsets", () => {
    expect(zoneOffsetMs(Date.parse("2026-09-16T00:00:00Z"), "Asia/Manila")).toBe(8 * 3600_000)
    expect(zoneOffsetMs(Date.parse("2026-01-16T00:00:00Z"), "America/New_York")).toBe(-5 * 3600_000)
  })

  it("parses 24-hour times strictly", () => {
    expect(parseTime("08:00")).toEqual({ hour: 8, minute: 0 })
    expect(parseTime("7:05")).toEqual({ hour: 7, minute: 5 })
    expect(parseTime("24:00")).toBeNull()
    expect(parseTime("08:60")).toBeNull()
    expect(parseTime("8am")).toBeNull()
    expect(parseTime(null)).toBeNull()
  })

  it("adds calendar days across months and years", () => {
    expect(addLocalDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1, weekday: 5 })
    expect(addLocalDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28, weekday: 6 })
  })

  it("falls back for unknown zones", () => {
    expect(safeTimeZone("Mars/Olympus_Mons")).toBe("Asia/Manila")
    expect(safeTimeZone("")).toBe("Asia/Manila")
    expect(safeTimeZone("Europe/Paris")).toBe("Europe/Paris")
  })

  it("finds the local day of a timestamp", () => {
    expect(localDateOf("2026-09-15T17:00:00.000Z", "Asia/Manila")).toBe("2026-09-16")
    expect(localDateOf("not a date", "Asia/Manila")).toBeNull()
    expect(localDateOf(null, "Asia/Manila")).toBeNull()
  })
})
