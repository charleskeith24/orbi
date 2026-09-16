/**
 * The calendar file is checked by parsing it back: CRLF lines, folding at 75 octets, balanced
 * components, the properties RFC 5545 requires, recurrence rules, alarms and time zone onsets.
 */
import { describe, expect, it } from "vitest"
import { buildRemindersIcs, escapeText, foldLine, remindersIcsFileName, vtimezone } from "./ics"
import type { ReminderSettings, ReminderSlot } from "./schedule"

const SETTINGS: ReminderSettings & { id: string } = {
  id: "settings-1",
  timezone: "Asia/Manila",
  week_starts_on: 1,
  weekly_post_target: 5,
  reminders_daily_enabled: true,
  reminders_daily_time: "08:00",
  reminders_slot_enabled: true,
  reminders_slot_lead_minutes: 45,
  reminders_review_enabled: true,
  reminders_review_day: 0,
  reminders_review_time: "18:00",
}

const SLOTS: ReminderSlot[] = [
  { id: "s-wed", day_of_week: 3, label: "Educational, Authority; Tips", platforms: ["tiktok", "instagram"], time: "18:30", is_active: true, sort_order: 0 },
  { id: "s-mon", day_of_week: 1, label: "", platforms: [], time: "07:00", is_active: true, sort_order: 1 },
  { id: "s-untimed", day_of_week: 5, label: "No time", platforms: [], time: null, is_active: true, sort_order: 2 },
  { id: "s-off", day_of_week: 2, label: "Paused", platforms: [], time: "12:00", is_active: false, sort_order: 3 },
]

// Wednesday 2026-09-16, 10:00 in Manila.
const NOW = new Date("2026-09-16T02:00:00.000Z")

interface Property {
  name: string
  params: Record<string, string>
  value: string
}
interface Component {
  type: string
  props: Property[]
  children: Component[]
}

/** A small RFC 5545 reader: unfolds lines, parses properties and nests components. */
function parseIcs(text: string): Component {
  expect(text.endsWith("\r\n")).toBe(true)
  const physical = text.slice(0, -2).split("\r\n")
  for (const line of physical) {
    expect(line.includes("\n") || line.includes("\r"), "bare line break").toBe(false)
    expect(new TextEncoder().encode(line).length, `line too long: ${line}`).toBeLessThanOrEqual(75)
  }
  const lines: string[] = []
  for (const line of physical) {
    if (line.startsWith(" ")) lines[lines.length - 1] += line.slice(1)
    else lines.push(line)
  }
  const root: Component = { type: "ROOT", props: [], children: [] }
  const stack = [root]
  for (const line of lines) {
    const colon = line.indexOf(":")
    expect(colon, `no colon: ${line}`).toBeGreaterThan(0)
    const [name, ...paramParts] = line.slice(0, colon).split(";")
    const value = line.slice(colon + 1)
    if (name === "BEGIN") {
      const child: Component = { type: value, props: [], children: [] }
      stack[stack.length - 1].children.push(child)
      stack.push(child)
    } else if (name === "END") {
      expect(stack.pop()?.type).toBe(value)
    } else {
      const params = Object.fromEntries(paramParts.map((p) => p.split("=") as [string, string]))
      stack[stack.length - 1].props.push({ name, params, value })
    }
  }
  expect(stack).toHaveLength(1)
  expect(root.children).toHaveLength(1)
  return root.children[0]
}

const prop = (c: Component, name: string) => c.props.find((p) => p.name === name)
const value = (c: Component, name: string) => prop(c, name)?.value
const unescape = (text: string) => text.replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1")

describe("buildRemindersIcs", () => {
  const calendar = parseIcs(buildRemindersIcs({ settings: SETTINGS, slots: SLOTS, lang: "en", now: NOW, appUrl: "https://orbi.example.com/" })!)
  const events = calendar.children.filter((c) => c.type === "VEVENT")
  const byUid = (name: string) => events.find((e) => value(e, "UID") === `orbi-${name}-settings-1@orbi.reminders`)!

  it("is a valid VCALENDAR with a VTIMEZONE for the workspace zone", () => {
    expect(calendar.type).toBe("VCALENDAR")
    expect(value(calendar, "VERSION")).toBe("2.0")
    expect(value(calendar, "PRODID")).toBe("-//Orbi//Reminders//EN")
    const zones = calendar.children.filter((c) => c.type === "VTIMEZONE")
    expect(zones).toHaveLength(1)
    expect(value(zones[0], "TZID")).toBe("Asia/Manila")
    expect(zones[0].children.map((c) => [c.type, value(c, "TZOFFSETFROM"), value(c, "TZOFFSETTO")])).toEqual([["STANDARD", "+0800", "+0800"]])
  })

  it("has one event per enabled reminder and per timed, active slot", () => {
    expect(events.map((e) => value(e, "UID")).sort()).toEqual(
      ["daily", "review", "slot-s-mon", "slot-s-wed"].map((n) => `orbi-${n}-settings-1@orbi.reminders`).sort()
    )
    for (const e of events) {
      for (const required of ["UID", "DTSTAMP", "DTSTART", "DURATION", "RRULE", "SUMMARY"]) expect(prop(e, required), required).toBeDefined()
      expect(value(e, "DTSTAMP")).toBe("20260916T020000Z")
      expect(prop(e, "DTSTART")?.params.TZID).toBe("Asia/Manila")
      const alarm = e.children.find((c) => c.type === "VALARM")!
      expect(value(alarm, "ACTION")).toBe("DISPLAY")
      expect(value(alarm, "DESCRIPTION")).toBeTruthy()
    }
  })

  it("repeats the digest daily from today at the digest time", () => {
    const daily = byUid("daily")
    expect(value(daily, "DTSTART")).toBe("20260916T080000")
    expect(value(daily, "RRULE")).toBe("FREQ=DAILY")
    expect(value(daily.children[0], "TRIGGER")).toBe("PT0M")
    expect(value(daily, "URL")).toBe("https://orbi.example.com/today")
  })

  it("repeats slots weekly on their day, with the alarm lead time", () => {
    const wed = byUid("slot-s-wed")
    expect(value(wed, "DTSTART")).toBe("20260916T183000")
    expect(value(wed, "RRULE")).toBe("FREQ=WEEKLY;BYDAY=WE")
    expect(value(wed.children[0], "TRIGGER")).toBe("-PT45M")
    expect(unescape(value(wed, "SUMMARY")!)).toBe("Post: Educational, Authority; Tips")
    expect(unescape(value(wed, "DESCRIPTION")!)).toBe(
      "Posting slot from your Posting Schedule. Platforms: TikTok, Instagram.\nhttps://orbi.example.com/today"
    )
    const mon = byUid("slot-s-mon")
    expect(value(mon, "DTSTART")).toBe("20260921T070000")
    expect(value(mon, "RRULE")).toBe("FREQ=WEEKLY;BYDAY=MO")
    expect(unescape(value(mon, "SUMMARY")!)).toBe("Post: Posting slot")
  })

  it("puts the weekly review on the next review day", () => {
    const review = byUid("review")
    expect(value(review, "DTSTART")).toBe("20260920T180000")
    expect(value(review, "RRULE")).toBe("FREQ=WEEKLY;BYDAY=SU")
    expect(value(review, "URL")).toBe("https://orbi.example.com/reports")
  })

  it("returns null when nothing is switched on", () => {
    const off = { ...SETTINGS, reminders_daily_enabled: false, reminders_slot_enabled: false, reminders_review_enabled: false }
    expect(buildRemindersIcs({ settings: off, slots: SLOTS, lang: "en", now: NOW })).toBeNull()
    const slotsOnlyButNoTimes = { ...off, reminders_slot_enabled: true }
    expect(buildRemindersIcs({ settings: slotsOnlyButNoTimes, slots: [SLOTS[2], SLOTS[3]], lang: "en", now: NOW })).toBeNull()
  })

  it("writes Taglish text, folds long lines without splitting characters, and omits links without an origin", () => {
    const text = buildRemindersIcs({ settings: { ...SETTINGS, reminders_slot_enabled: false }, slots: [], lang: "tl", now: NOW })!
    const tl = parseIcs(text)
    const review = tl.children.find((c) => c.type === "VEVENT" && value(c, "RRULE")?.includes("WEEKLY"))!
    expect(unescape(value(review, "DESCRIPTION")!)).toBe("Balikan ang linggo sa Weekly Report: ano ang worked, ano ang dapat i-repeat.")
    expect(prop(review, "URL")).toBeUndefined()
    expect(text).toContain("\r\n ")
  })
})

describe("vtimezone", () => {
  it("lists daylight-saving onsets for zones that change", () => {
    const zone = parseIcs(`BEGIN:VCALENDAR\r\n${vtimezone("America/New_York", 2026, 2026).join("\r\n")}\r\nEND:VCALENDAR\r\n`).children[0]
    expect(zone.children.map((c) => [c.type, value(c, "DTSTART"), value(c, "TZOFFSETFROM"), value(c, "TZOFFSETTO")])).toEqual([
      ["STANDARD", "19700101T000000", "-0500", "-0500"],
      ["DAYLIGHT", "20260308T020000", "-0500", "-0400"],
      ["STANDARD", "20261101T020000", "-0400", "-0500"],
    ])
  })

  it("handles southern-hemisphere and non-hour offsets", () => {
    const lines = vtimezone("Australia/Adelaide", 2026, 2026)
    expect(lines).toContain("TZOFFSETTO:+1030")
    expect(lines).toContain("TZOFFSETTO:+0930")
    expect(vtimezone("Asia/Kathmandu", 2026, 2027)).toContain("TZOFFSETTO:+0545")
  })
})

describe("text helpers", () => {
  it("escapes TEXT values", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne")
  })

  it("folds at 75 octets, counting multi-byte characters", () => {
    const folded = foldLine(`DESCRIPTION:${"ñ".repeat(80)}`)
    const parts = folded.split("\r\n")
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(`DESCRIPTION:${"ñ".repeat(80)}`)
    expect(foldLine("SHORT:line")).toBe("SHORT:line")
  })

  it("names the file by local date", () => {
    expect(remindersIcsFileName(new Date("2026-09-15T17:00:00Z"), "Asia/Manila")).toBe("orbi-reminders-2026-09-16.ics")
  })
})
