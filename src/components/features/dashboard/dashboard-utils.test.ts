import { describe, expect, it } from "vitest"
import { weeklyPostingProgress } from "@/lib/analytics"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import { computeDashboard } from "./dashboard-data"
import { buildWeekDays, dayMarks, firstName, formatSlotTime, ideaTitleFromText, overdueLabel, strategistPrompts, weekRangeLabel } from "./dashboard-utils"

const USER = "00000000-0000-4000-8000-000000000001"
const NOW = new Date(2026, 8, 11, 9, 15)

describe("firstName", () => {
  it("prefers a quoted nickname", () => {
    expect(firstName('Rafael "Raf" Mendoza')).toBe("Raf")
    expect(firstName("Beatriz “Bea” Cruz")).toBe("Bea")
  })
  it("falls back to the first word and ignores parentheticals", () => {
    expect(firstName("Maria Santos")).toBe("Maria")
    expect(firstName("(Founder) Leo Tan")).toBe("Leo")
    expect(firstName("   ")).toBe("")
  })
})

describe("weekRangeLabel", () => {
  it("keeps one month name within a month and both across months", () => {
    expect(weekRangeLabel(new Date(2026, 8, 14), new Date(2026, 8, 20))).toBe("Sep 14–20")
    expect(weekRangeLabel(new Date(2026, 8, 28), new Date(2026, 9, 4))).toBe("Sep 28 – Oct 4")
  })
})

describe("formatSlotTime", () => {
  it("formats 24h slot times", () => {
    expect(formatSlotTime("18:30")).toBe("6:30 PM")
    expect(formatSlotTime("00:05")).toBe("12:05 AM")
    expect(formatSlotTime("12:00")).toBe("12:00 PM")
  })
  it("returns null for empty or malformed times", () => {
    expect(formatSlotTime(null)).toBeNull()
    expect(formatSlotTime("25:00")).toBeNull()
    expect(formatSlotTime("soon")).toBeNull()
  })
})

describe("ideaTitleFromText", () => {
  it("uses the first sentence and drops its period", () => {
    expect(ideaTitleFromText("Why COD sellers lose money on returns. Then show the fix.")).toBe("Why COD sellers lose money on returns")
  })
  it("keeps question marks and collapses whitespace", () => {
    expect(ideaTitleFromText("  Is   Shopee Ads worth it for new sellers?  More later ")).toBe("Is Shopee Ads worth it for new sellers?")
  })
  it("doesn't stop at short abbreviations", () => {
    expect(ideaTitleFromText("E.g. a teardown of our 11.11 launch week")).toBe("E.g. a teardown of our 11.11 launch week")
  })
  it("cuts long text on a word boundary", () => {
    const title = ideaTitleFromText("word ".repeat(40))
    expect(title.length).toBeLessThanOrEqual(90)
    expect(title.endsWith("…")).toBe(true)
    expect(title).not.toMatch(/\s…$/)
  })
  it("returns an empty string for blank input", () => {
    expect(ideaTitleFromText("   ")).toBe("")
  })
})

describe("overdueLabel", () => {
  const afternoon = new Date(2026, 8, 11, 15, 0)
  const at = (day: number, hour = 9) => new Date(2026, 8, day, hour, 0).toISOString()

  it("names a publish time missed earlier today", () => {
    expect(overdueLabel({ scheduled_at: at(11), due_date: null }, afternoon)).toBe("Missed 9:00 AM")
  })
  it("counts days since a missed publish time", () => {
    expect(overdueLabel({ scheduled_at: at(9), due_date: null }, afternoon)).toBe("2 days late")
  })
  it("falls back to the production deadline", () => {
    expect(overdueLabel({ scheduled_at: null, due_date: "2026-09-08" }, afternoon)).toBe("Due 3 days ago")
    expect(overdueLabel({ scheduled_at: null, due_date: null }, afternoon)).toBe("Overdue")
  })
})

describe("buildWeekDays", () => {
  const db = createDemoDatabase(USER, NOW)
  const days = buildWeekDays(db, NOW, 1)

  it("returns the 7 days of the current week with exactly one today", () => {
    expect(days).toHaveLength(7)
    expect(days[0].date.getDay()).toBe(1)
    expect(days.filter((d) => d.isToday)).toHaveLength(1)
    expect(days.find((d) => d.isToday)?.key).toBe("2026-09-11")
  })

  it("places every active slot on its weekday", () => {
    const active = db.content_calendar.filter((s) => s.is_active).length
    expect(days.reduce((n, d) => n + d.slots.length, 0)).toBe(active)
    for (const day of days) for (const { slot } of day.slots) expect(slot.day_of_week).toBe(day.date.getDay())
  })

  it("never marks today or later as missed, nor earlier days as open", () => {
    for (const day of days) {
      for (const { status } of day.slots) {
        if (day.isPast) expect(status).not.toBe("open")
        else expect(status).not.toBe("missed")
      }
    }
  })

  it("sums each day into the week strip's marks, with no missed slots before the start", () => {
    for (const day of days) {
      const marks = dayMarks(day)
      expect(marks.published + marks.scheduled).toBe(day.items.length)
      expect(marks.open + marks.missed).toBe(day.slots.filter((s) => s.status !== "filled").length)
      expect(dayMarks(day, true)).toMatchObject({ open: 0, missed: 0 })
    }
  })
})

describe("strategistPrompts", () => {
  it("always offers three distinct prompts", () => {
    const db = createStarterDatabase(USER, NOW)
    const weekly = weeklyPostingProgress(db, NOW, db.app_settings[0])
    const prompts = strategistPrompts({ pillars: [], weekly })
    expect(prompts).toHaveLength(3)
    expect(new Set(prompts).size).toBe(3)
  })
})

describe("computeDashboard", () => {
  it("computes the demo workspace", () => {
    const db = createDemoDatabase(USER, NOW)
    const data = computeDashboard(db, db.app_settings[0], NOW)
    expect(data.weekDays).toHaveLength(7)
    expect(data.history).toHaveLength(8)
    expect(data.pipeline.groupList).toHaveLength(8)
    expect(data.top.length).toBeLessThanOrEqual(5)
    expect(data.prompts).toHaveLength(3)
    const followers = data.platforms.map((p) => p.followers)
    expect(followers).toEqual([...followers].sort((a, b) => b - a))
  })

  it("handles an empty workspace", () => {
    const db = createStarterDatabase(USER, NOW)
    const data = computeDashboard(db, db.app_settings[0], NOW)
    expect(data.top).toEqual([])
    expect(data.platforms).toEqual([])
    expect(data.today.dueToday).toEqual([])
    expect(data.health.score).toBeGreaterThanOrEqual(0)
  })
})
