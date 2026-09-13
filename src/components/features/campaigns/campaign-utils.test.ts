import { describe, expect, it } from "vitest"
import { campaignPace, campaignWindow, dateRangeLabel, nextCampaignColor, timeLabel } from "./campaign-utils"

const NOW = new Date(2026, 8, 11, 10)

describe("campaignWindow", () => {
  it("tracks a running campaign day by day", () => {
    const win = campaignWindow({ start_date: "2026-09-01", end_date: "2026-09-30" }, NOW)
    expect(win.phase).toBe("running")
    expect(win.totalDays).toBe(30)
    expect(win.dayIndex).toBe(11)
    expect(win.daysLeft).toBe(20)
    expect(Math.round(win.elapsedPct ?? 0)).toBe(37)
    expect(timeLabel(win)).toBe("Day 11 of 30 · 20 days left")
  })
  it("counts down to an upcoming campaign", () => {
    const win = campaignWindow({ start_date: "2026-09-12", end_date: "2026-10-01" }, NOW)
    expect(win.phase).toBe("upcoming")
    expect(win.elapsedPct).toBe(0)
    expect(timeLabel(win)).toBe("Starts tomorrow")
  })
  it("marks a finished campaign as ended", () => {
    const win = campaignWindow({ start_date: "2026-07-07", end_date: "2026-08-06" }, NOW)
    expect(win.phase).toBe("ended")
    expect(win.elapsedPct).toBe(100)
    expect(timeLabel(win)).toBe("Ended Aug 6")
  })
  it("is undated when a date is missing", () => {
    expect(campaignWindow({ start_date: "", end_date: "2026-08-06" }, NOW).phase).toBe("undated")
  })
})

describe("campaignPace", () => {
  const running = campaignWindow({ start_date: "2026-09-01", end_date: "2026-09-30" }, NOW) // ~37% elapsed
  it("is null without a target", () => {
    expect(campaignPace("active", 3, null, running)).toBeNull()
  })
  it("compares published pieces with an even pace", () => {
    expect(campaignPace("active", 11, 30, running)?.label).toBe("On pace")
    expect(campaignPace("active", 8, 30, running)?.label).toBe("Behind pace")
    expect(campaignPace("active", 2, 30, running)?.tone).toBe("serious")
  })
  it("reports the outcome of a finished campaign", () => {
    const ended = campaignWindow({ start_date: "2026-07-07", end_date: "2026-08-06" }, NOW)
    expect(campaignPace("completed", 20, 20, ended)?.label).toBe("Target met")
    expect(campaignPace("completed", 16, 20, ended)?.label).toBe("Short of target")
    expect(campaignPace("completed", 5, 20, ended)?.label).toBe("Missed target")
  })
  it("says not started before the window opens", () => {
    const upcoming = campaignWindow({ start_date: "2026-10-01", end_date: "2026-10-30" }, NOW)
    expect(campaignPace("planning", 0, 12, upcoming)?.label).toBe("Not started")
  })
})

describe("labels and defaults", () => {
  it("formats ranges within and across years", () => {
    expect(dateRangeLabel({ start_date: "2026-08-28", end_date: "2026-10-09" })).toBe("Aug 28 – Oct 9, 2026")
    expect(dateRangeLabel({ start_date: "2026-12-01", end_date: "2027-01-15" })).toBe("Dec 1, 2026 – Jan 15, 2027")
  })
  it("picks the first unused categorical colour", () => {
    expect(nextCampaignColor([{ color: "blue" }, { color: "aqua" }])).toBe("orange")
  })
})
