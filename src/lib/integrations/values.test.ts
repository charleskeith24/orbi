import { describe, expect, it } from "vitest"
import {
  detectDateOrder,
  headerTimeUnit,
  isBlankCell,
  normalizeHeader,
  parseDuration,
  parseImportDate,
  parseMetricNumber,
} from "./values"

const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime()

describe("normalizeHeader", () => {
  it("ignores case, spacing, accents and punctuation", () => {
    expect(normalizeHeader("  Watch time (hours) ")).toBe("watch time hours")
    expect(normalizeHeader("Impressions click-through rate (%)")).toBe("impressions click through rate")
    expect(normalizeHeader("VIDEO_LINK")).toBe("video link")
    expect(normalizeHeader("Reactions, Comments and Shares")).toBe("reactions comments and shares")
    expect(normalizeHeader("Descripción")).toBe("descripcion")
  })
})

describe("parseDuration", () => {
  it("reads clock times and unit phrases", () => {
    expect(parseDuration("0:45")).toBe(45)
    expect(parseDuration("1:35")).toBe(95)
    expect(parseDuration("1:02:03")).toBe(3723)
    expect(parseDuration("0:07:47")).toBe(467)
    expect(parseDuration("12:05.5")).toBe(725.5)
    expect(parseDuration("1h 2m 3s")).toBe(3723)
    expect(parseDuration("2 min 5 sec")).toBe(125)
    expect(parseDuration("45s")).toBe(45)
    expect(parseDuration("1.5 hours")).toBe(5400)
  })

  it("rejects anything else", () => {
    expect(parseDuration("1:75")).toBeUndefined()
    expect(parseDuration("1:61:00")).toBeUndefined()
    expect(parseDuration("12 views")).toBeUndefined()
    expect(parseDuration("")).toBeUndefined()
  })

  it("knows the unit a header announces", () => {
    expect(headerTimeUnit("Watch time (hours)")).toBe("hours")
    expect(headerTimeUnit("Minutes viewed")).toBe("minutes")
    expect(headerTimeUnit("Seconds viewed")).toBe("seconds")
    expect(headerTimeUnit("Watch time (sec)")).toBe("seconds")
    expect(headerTimeUnit("Average view duration")).toBeNull()
    expect(headerTimeUnit("Views")).toBeNull()
  })
})

describe("parseMetricNumber", () => {
  it("reads thousands separators, suffixes and percentages", () => {
    expect(parseMetricNumber("12,400", "views")).toBe(12400)
    expect(parseMetricNumber("1 234", "views")).toBe(1234)
    expect(parseMetricNumber("1 234", "views")).toBe(1234)
    expect(parseMetricNumber("1.204.330", "views")).toBe(1204330)
    expect(parseMetricNumber("12.4K", "views")).toBe(12400)
    expect(parseMetricNumber("45.5%", "avg_retention")).toBe(45.5)
    expect(parseMetricNumber("41,5 %", "avg_retention")).toBe(41.5)
    expect(parseMetricNumber("−12", "followers_gained")).toBe(-12)
  })

  it("converts watch time to seconds from clock times or the header's unit", () => {
    expect(parseMetricNumber("1,523.4411", "watch_time_seconds", "hours")).toBeCloseTo(1523.4411 * 3600, 3)
    expect(parseMetricNumber("90", "watch_time_seconds", "minutes")).toBe(5400)
    expect(parseMetricNumber("0:05:01", "watch_time_seconds", "hours")).toBe(301)
    expect(parseMetricNumber("1.234,5", "watch_time_seconds")).toBe(1234.5)
  })

  it("tells blanks (null) from unreadable values (undefined)", () => {
    for (const blank of ["", " ", "-", "--", "—", "n/a", "N/A", "null"]) expect(parseMetricNumber(blank, "views")).toBeNull()
    expect(isBlankCell("0")).toBe(false)
    expect(parseMetricNumber("lots", "views")).toBeUndefined()
    expect(parseMetricNumber("-5", "views")).toBeUndefined()
    expect(parseMetricNumber("120", "avg_retention")).toBeUndefined()
  })
})

describe("parseImportDate", () => {
  it("reads ISO dates with and without a time zone", () => {
    expect(parseImportDate("2026-09-01")?.getTime()).toBe(local(2026, 9, 1))
    expect(parseImportDate("2026-08-22 18:30:11")?.getTime()).toBe(local(2026, 8, 22, 18, 30, 11))
    expect(parseImportDate("2026/09/01 18:30")?.getTime()).toBe(local(2026, 9, 1, 18, 30))
    expect(parseImportDate("2026-09-01T14:30:00Z")?.getTime()).toBe(Date.UTC(2026, 8, 1, 14, 30))
    expect(parseImportDate("2026-09-01T14:30:00+0800")?.getTime()).toBe(Date.UTC(2026, 8, 1, 6, 30))
    expect(parseImportDate("2026-09-01T14:30:00.000+08:00")?.getTime()).toBe(Date.UTC(2026, 8, 1, 6, 30))
  })

  it("reads numeric dates month-first (Meta) unless told or shown otherwise", () => {
    expect(parseImportDate("09/01/2026 14:30")?.getTime()).toBe(local(2026, 9, 1, 14, 30))
    expect(parseImportDate("09/01/2026", { order: "dmy" })?.getTime()).toBe(local(2026, 1, 9))
    expect(parseImportDate("13/01/2026")?.getTime()).toBe(local(2026, 1, 13))
    expect(parseImportDate("13.01.2026")?.getTime()).toBe(local(2026, 1, 13))
    expect(parseImportDate("9/1/26 2:30 PM")?.getTime()).toBe(local(2026, 9, 1, 14, 30))
    expect(parseImportDate("9/1/2026 12:15 AM")?.getTime()).toBe(local(2026, 9, 1, 0, 15))
  })

  it("reads month names (YouTube, TikTok, Filipino exports)", () => {
    expect(parseImportDate("Oct 5, 2021")?.getTime()).toBe(local(2021, 10, 5))
    expect(parseImportDate("5 Oct 2021")?.getTime()).toBe(local(2021, 10, 5))
    expect(parseImportDate("05-Oct-2021")?.getTime()).toBe(local(2021, 10, 5))
    expect(parseImportDate("October 5, 2021 at 10:00 AM")?.getTime()).toBe(local(2021, 10, 5, 10))
    expect(parseImportDate("Tue, Sep 1, 2026")?.getTime()).toBe(local(2026, 9, 1))
    expect(parseImportDate("Set 1, 2026")?.getTime()).toBe(local(2026, 9, 1))
    expect(parseImportDate("2026-09-01 (Tue)")?.getTime()).toBe(local(2026, 9, 1))
  })

  it("places dates without a year in the past year, and reads Excel serials", () => {
    const reference = new Date(2026, 8, 14, 9)
    expect(parseImportDate("Jan 15", { reference })?.getTime()).toBe(local(2026, 1, 15))
    expect(parseImportDate("Dec 20", { reference })?.getTime()).toBe(local(2025, 12, 20))
    expect(parseImportDate("46266")?.getTime()).toBe(local(2026, 9, 1))
  })

  it("rejects impossible or unreadable dates", () => {
    expect(parseImportDate("Feb 31, 2026")).toBeNull()
    expect(parseImportDate("02/30/2026")).toBeNull()
    expect(parseImportDate("25:00 soon")).toBeNull()
    expect(parseImportDate("soon")).toBeNull()
    expect(parseImportDate("")).toBeNull()
  })

  it("votes the numeric date order from a column's values", () => {
    expect(detectDateOrder(["09/01/2026", "13/01/2026"])).toBe("dmy")
    expect(detectDateOrder(["08/15/2026 20:00", "09/01/2026"])).toBe("mdy")
    expect(detectDateOrder(["09/01/2026", ""])).toBeNull()
    expect(detectDateOrder(["13/01/2026", "01/13/2026"])).toBeNull()
  })
})
