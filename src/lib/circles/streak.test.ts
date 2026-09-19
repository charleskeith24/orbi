import { describe, expect, it } from "vitest"
import { circleStreak, circleWeek, compareMembers, currentCheckin, dayNumber, isCurrentWeek } from "./streak"
import type { CircleCheckin, CircleMember } from "./types"

// Thursday 17 Sep 2026. Monday weeks: 14 Sep (this), 7 Sep (last), 31 Aug, 24 Aug …
const TODAY = "2026-09-17"
const c = (week_start: string, posts = 1, extra: Partial<CircleCheckin> = {}): CircleCheckin => ({
  id: `${week_start}-${posts}`,
  circle_id: "circle",
  user_id: "me",
  week_start,
  posts,
  note: "",
  created_at: `${week_start}T10:00:00.000Z`,
  updated_at: `${week_start}T10:00:00.000Z`,
  ...extra,
})

describe("dayNumber / isCurrentWeek", () => {
  it("counts calendar days", () => {
    expect(dayNumber("2026-09-17") - dayNumber("2026-09-14")).toBe(3)
    expect(dayNumber("2026-03-01") - dayNumber("2026-02-28")).toBe(1)
    expect(dayNumber("nope")).toBeNaN()
  })

  it("knows the week containing today, for Monday and Sunday weeks", () => {
    expect(isCurrentWeek("2026-09-14", TODAY)).toBe(true) // Monday week
    expect(isCurrentWeek("2026-09-13", TODAY)).toBe(true) // Sunday week
    expect(isCurrentWeek("2026-09-17", TODAY)).toBe(true)
    expect(isCurrentWeek("2026-09-10", TODAY)).toBe(false)
    expect(isCurrentWeek("2026-09-21", TODAY)).toBe(false)
  })
})

describe("circleStreak", () => {
  it("is 0 without check-ins", () => {
    expect(circleStreak([], TODAY)).toBe(0)
  })

  it("counts consecutive weeks ending this week", () => {
    expect(circleStreak([c("2026-09-14"), c("2026-09-07"), c("2026-08-31")], TODAY)).toBe(3)
  })

  it("keeps a streak that ended last week (this week isn't over)", () => {
    expect(circleStreak([c("2026-09-07"), c("2026-08-31")], TODAY)).toBe(2)
  })

  it("is 0 when the last qualifying week is older than last week", () => {
    expect(circleStreak([c("2026-08-31"), c("2026-08-24")], TODAY)).toBe(0)
  })

  it("stops at a missing week", () => {
    expect(circleStreak([c("2026-09-14"), c("2026-09-07"), c("2026-08-24"), c("2026-08-17")], TODAY)).toBe(2)
  })

  it("doesn't count weeks with 0 posts — they break the run", () => {
    expect(circleStreak([c("2026-09-14", 2), c("2026-09-07", 0), c("2026-08-31", 3)], TODAY)).toBe(1)
    // A 0-post check-in this week doesn't break a streak that ran through last week.
    expect(circleStreak([c("2026-09-14", 0), c("2026-09-07", 1), c("2026-08-31", 1)], TODAY)).toBe(2)
  })

  it("survives a switch between Monday and Sunday weeks", () => {
    // Sunday weeks until 30 Aug, Monday weeks since.
    expect(circleStreak([c("2026-09-14"), c("2026-09-07"), c("2026-08-30"), c("2026-08-23")], TODAY)).toBe(4)
    // Two check-ins for overlapping weeks count once.
    expect(circleStreak([c("2026-09-14"), c("2026-09-13"), c("2026-09-07")], TODAY)).toBe(2)
  })

  it("ignores future and malformed weeks", () => {
    expect(circleStreak([c("2026-09-21"), c("2026-09-14"), c("bad")], TODAY)).toBe(1)
  })

  it("runs as long as the history does", () => {
    const weeks = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 14 - i * 7))
      return c(d.toISOString().slice(0, 10))
    })
    expect(circleStreak(weeks, TODAY)).toBe(30)
  })
})

describe("currentCheckin", () => {
  it("picks this week's check-in, the latest when there are two", () => {
    const older = c("2026-09-13", 1, { id: "sun", updated_at: "2026-09-13T10:00:00.000Z" })
    const newer = c("2026-09-14", 2, { id: "mon", updated_at: "2026-09-15T10:00:00.000Z" })
    expect(currentCheckin([c("2026-09-07"), older, newer], TODAY)?.id).toBe("mon")
    expect(currentCheckin([c("2026-09-07")], TODAY)).toBeNull()
  })
})

describe("circleWeek", () => {
  const member = (user_id: string, display_name: string, role: CircleMember["role"] = "member"): CircleMember => ({
    circle_id: "circle",
    user_id,
    display_name,
    role,
    joined_at: "2026-08-01T00:00:00.000Z",
  })
  const members = [member("u-zed", "zed"), member("me", "Ana", "owner"), member("u-mika", "Mika"), { ...member("u-x", "Xander"), circle_id: "other" }]
  const checkins = [
    c("2026-09-14", 3, { user_id: "u-mika" }),
    c("2026-09-07", 2, { user_id: "u-mika" }),
    c("2026-09-07", 1, { user_id: "me" }),
    c("2026-09-14", 0, { user_id: "u-zed", note: "Rest week" }),
    c("2026-09-14", 5, { user_id: "u-x", circle_id: "other" }),
  ]

  it("lists the circle's members by name (not by score), with this week's check-in and streak", () => {
    const week = circleWeek({ members, checkins }, "circle", "me", TODAY)
    expect(week.rows.map((r) => r.member.display_name)).toEqual(["Ana", "Mika", "zed"])
    expect(week.rows.map((r) => [r.checkin?.posts ?? null, r.streak])).toEqual([
      [null, 1],
      [3, 2],
      [0, 0],
    ])
    expect(week).toMatchObject({ checkedIn: 2, total: 3, selfRole: "owner" })
    expect(week.self?.member.user_id).toBe("me")
  })

  it("has no self row for a circle you aren't in", () => {
    expect(circleWeek({ members, checkins }, "other", "me", TODAY)).toMatchObject({ self: null, selfRole: null, total: 1, checkedIn: 1 })
  })

  it("sorts names case-insensitively, then by id", () => {
    expect(compareMembers({ display_name: "ana", user_id: "b" }, { display_name: "Ana", user_id: "a" })).toBeGreaterThan(0)
  })
})
