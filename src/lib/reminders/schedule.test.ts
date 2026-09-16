import { describe, expect, it } from "vitest"
import {
  describeReminder,
  dueReminders,
  reminderOccurrences,
  timedSlots,
  upcomingReminders,
  weekStartKey,
  type ReminderItem,
  type ReminderSettings,
  type ReminderSlot,
} from "./schedule"

const SETTINGS: ReminderSettings = {
  timezone: "Asia/Manila",
  week_starts_on: 1,
  weekly_post_target: 5,
  reminders_daily_enabled: true,
  reminders_daily_time: "08:00",
  reminders_slot_enabled: true,
  reminders_slot_lead_minutes: 30,
  reminders_review_enabled: true,
  reminders_review_day: 0,
  reminders_review_time: "18:00",
}

const slot = (patch: Partial<ReminderSlot>): ReminderSlot => ({
  id: "slot-1",
  day_of_week: 3,
  label: "Educational / Authority",
  platforms: ["tiktok", "instagram"],
  time: "18:30",
  is_active: true,
  sort_order: 0,
  ...patch,
})

const item = (patch: Partial<ReminderItem>): ReminderItem => ({
  id: "item-1",
  title: "3 budgeting mistakes",
  stage: "scheduled",
  scheduled_at: null,
  due_date: null,
  published_at: null,
  ...patch,
})

// Wednesday 2026-09-16, 00:00 in Manila.
const WED_MIDNIGHT_MNL = new Date("2026-09-15T16:00:00.000Z")
const DAY = 24 * 3600_000

describe("reminderOccurrences", () => {
  it("computes a day of reminders in the workspace time zone", () => {
    const slots = [slot({})]
    const out = reminderOccurrences({ settings: SETTINGS, slots, from: WED_MIDNIGHT_MNL, to: new Date(WED_MIDNIGHT_MNL.getTime() + DAY) })
    expect(out.map((r) => [r.key, r.fireAt.toISOString(), r.localTime])).toEqual([
      ["daily:2026-09-16", "2026-09-16T00:00:00.000Z", "08:00"],
      ["slot:slot-1:2026-09-16", "2026-09-16T10:00:00.000Z", "18:00"],
    ])
    const slotReminder = out[1]
    expect(slotReminder.eventAt?.toISOString()).toBe("2026-09-16T10:30:00.000Z")
    expect(slotReminder.expiresAt.toISOString()).toBe("2026-09-16T10:30:00.000Z")
  })

  it("puts the weekly review on the chosen weekday", () => {
    const out = reminderOccurrences({
      settings: { ...SETTINGS, reminders_daily_enabled: false, reminders_slot_enabled: false },
      slots: [],
      from: WED_MIDNIGHT_MNL,
      to: new Date(WED_MIDNIGHT_MNL.getTime() + 7 * DAY),
    })
    expect(out.map((r) => [r.key, r.fireAt.toISOString()])).toEqual([["review:2026-09-20", "2026-09-20T10:00:00.000Z"]])
  })

  it("respects each toggle and skips inactive or untimed slots", () => {
    const slots = [slot({ id: "a" }), slot({ id: "b", time: null }), slot({ id: "c", is_active: false })]
    const range = { from: WED_MIDNIGHT_MNL, to: new Date(WED_MIDNIGHT_MNL.getTime() + 7 * DAY) }
    const none = { ...SETTINGS, reminders_daily_enabled: false, reminders_slot_enabled: false, reminders_review_enabled: false }
    expect(reminderOccurrences({ settings: none, slots, ...range })).toEqual([])
    const slotOnly = reminderOccurrences({ settings: { ...none, reminders_slot_enabled: true }, slots, ...range })
    expect(slotOnly.map((r) => r.slotId)).toEqual(["a"])
    expect(timedSlots(slots).map((s) => s.id)).toEqual(["a"])
  })

  it("moves a slot reminder to the previous day when the lead crosses midnight", () => {
    const out = reminderOccurrences({
      settings: { ...SETTINGS, reminders_daily_enabled: false, reminders_review_enabled: false, reminders_slot_lead_minutes: 60 },
      slots: [slot({ day_of_week: 4, time: "00:30" })],
      from: WED_MIDNIGHT_MNL,
      to: new Date(WED_MIDNIGHT_MNL.getTime() + DAY),
    })
    // Thursday 00:30 slot, reminder Wednesday 23:30 — keyed by the slot's day.
    expect(out.map((r) => [r.key, r.localTime, r.fireAt.toISOString()])).toEqual([["slot:slot-1:2026-09-17", "23:30", "2026-09-16T15:30:00.000Z"]])
  })

  it("uses the same wall-clock times in another zone, across daylight saving", () => {
    const settings = { ...SETTINGS, timezone: "America/New_York", reminders_slot_enabled: false, reminders_review_enabled: false }
    const out = reminderOccurrences({
      settings,
      slots: [],
      from: new Date("2026-10-31T00:00:00Z"),
      to: new Date("2026-11-03T00:00:00Z"),
    })
    expect(out.map((r) => [r.localDate, r.fireAt.toISOString()])).toEqual([
      ["2026-10-31", "2026-10-31T12:00:00.000Z"], // EDT
      ["2026-11-01", "2026-11-01T13:00:00.000Z"], // EST from Nov 1
      ["2026-11-02", "2026-11-02T13:00:00.000Z"],
    ])
  })

  it("falls back to Manila time for an unknown zone and ignores malformed times", () => {
    const out = reminderOccurrences({
      settings: { ...SETTINGS, timezone: "Nowhere/Land", reminders_review_time: "25:00", reminders_slot_enabled: false },
      slots: [],
      from: WED_MIDNIGHT_MNL,
      to: new Date(WED_MIDNIGHT_MNL.getTime() + 7 * DAY),
    })
    expect(out.every((r) => r.kind === "daily")).toBe(true)
    expect(out[0].fireAt.toISOString()).toBe("2026-09-16T00:00:00.000Z")
  })
})

describe("upcomingReminders / dueReminders", () => {
  const slots = [slot({})]

  it("lists the next reminders from now", () => {
    const now = new Date("2026-09-16T01:00:00.000Z") // 09:00 Manila
    expect(upcomingReminders(SETTINGS, slots, now, 3).map((r) => r.key)).toEqual([
      "slot:slot-1:2026-09-16",
      "daily:2026-09-17",
      "daily:2026-09-18",
    ])
  })

  it("returns what is due and not stale, and nothing before notBefore", () => {
    const now = new Date("2026-09-16T10:10:00.000Z") // 18:10 Manila
    expect(dueReminders({ settings: SETTINGS, slots, now }).map((r) => r.key)).toEqual(["slot:slot-1:2026-09-16"])
    // The 08:00 digest went stale after 3 hours; with a longer life it would be due again.
    const early = new Date("2026-09-16T02:00:00.000Z") // 10:00 Manila
    expect(dueReminders({ settings: SETTINGS, slots, now: early }).map((r) => r.key)).toEqual(["daily:2026-09-16"])
    expect(dueReminders({ settings: SETTINGS, slots, now: early, notBefore: new Date("2026-09-16T01:00:00.000Z") })).toEqual([])
  })

  it("drops a slot reminder once the slot has started", () => {
    const afterSlot = new Date("2026-09-16T10:31:00.000Z")
    expect(dueReminders({ settings: SETTINGS, slots, now: afterSlot }).map((r) => r.key)).toEqual([])
    const noLead = { ...SETTINGS, reminders_slot_lead_minutes: 0 }
    expect(dueReminders({ settings: noLead, slots, now: afterSlot }).map((r) => r.key)).toEqual(["slot:slot-1:2026-09-16"])
  })
})

describe("weekStartKey", () => {
  it("honours week_starts_on", () => {
    expect(weekStartKey("2026-09-20", 1)).toBe("2026-09-14") // Sunday → Monday before
    expect(weekStartKey("2026-09-20", 0)).toBe("2026-09-20") // Sunday starts the week
    expect(weekStartKey("2026-09-16", 0)).toBe("2026-09-13")
  })
})

describe("describeReminder", () => {
  const now = new Date("2026-09-16T00:00:00.000Z")
  const [daily, slotReminder] = reminderOccurrences({ settings: SETTINGS, slots: [slot({})], from: now, to: new Date(now.getTime() + DAY / 2) })

  it("summarises today's work in the digest", () => {
    const items = [
      item({ id: "s1", scheduled_at: "2026-09-16T09:00:00.000Z" }),
      item({ id: "s2", scheduled_at: "2026-09-15T17:30:00.000Z" }), // 01:30 on the 16th in Manila
      item({ id: "d1", stage: "editing", due_date: "2026-09-16" }),
      item({ id: "o1", stage: "review", due_date: "2026-09-14" }),
      item({ id: "o2", scheduled_at: "2026-09-15T09:00:00.000Z" }),
      item({ id: "p1", stage: "published", scheduled_at: "2026-09-16T01:00:00.000Z" }),
    ]
    const message = describeReminder(daily, { settings: SETTINGS, slots: [slot({})], items, lang: "en" })
    expect(message).toEqual({
      title: "Today in Orbi",
      body: "2 posts scheduled · 1 due · 2 overdue · Slot: Educational / Authority",
      url: "/today",
      tag: "orbi-daily:2026-09-16",
    })
  })

  it("has an empty-day digest, in Taglish too", () => {
    const en = describeReminder(daily, { settings: SETTINGS, slots: [], items: [], lang: "en" })
    expect(en.body).toBe("Nothing planned today. Capture one idea or plan your next post.")
    const tl = describeReminder(daily, { settings: SETTINGS, slots: [], items: [], lang: "tl" })
    expect(tl.title).toBe("Today sa Orbi")
    expect(tl.body).toMatch(/^Walang naka-plan ngayon/)
  })

  it("names the slot, its platforms and the post that's ready for it", () => {
    const items = [
      item({ id: "far", title: "Morning post", scheduled_at: "2026-09-16T01:00:00.000Z" }),
      item({ id: "near", title: "Evening carousel", scheduled_at: "2026-09-16T10:30:00.000Z" }),
    ]
    const message = describeReminder(slotReminder, { settings: SETTINGS, slots: [slot({})], items, lang: "en" })
    expect(message).toEqual({
      title: "Posting slot in 30 min",
      body: "Educational / Authority · TikTok, Instagram\nReady: Evening carousel",
      url: "/studio/near",
      tag: "orbi-slot:slot-1:2026-09-16",
    })
    const empty = describeReminder(slotReminder, { settings: { ...SETTINGS, reminders_slot_lead_minutes: 0 }, slots: [slot({ label: "" })], items: [], lang: "en" })
    expect(empty.title).toBe("Time to post")
    expect(empty.body).toMatch(/^Posting slot · TikTok, Instagram\nNothing scheduled/)
    expect(empty.url).toBe("/today")
  })

  it("counts this week's published posts for the review (week start and time zone aware)", () => {
    const [review] = reminderOccurrences({
      settings: { ...SETTINGS, reminders_daily_enabled: false, reminders_slot_enabled: false },
      slots: [],
      from: now,
      to: new Date(now.getTime() + 7 * DAY),
    })
    const items = [
      item({ id: "a", stage: "published", published_at: "2026-09-14T02:00:00.000Z" }), // Mon
      item({ id: "b", stage: "repurpose", published_at: "2026-09-20T09:00:00.000Z" }), // Sun 17:00 Manila
      item({ id: "c", stage: "published", published_at: "2026-09-13T15:30:00.000Z" }), // Sun 23:30 Manila, last week
      item({ id: "d", stage: "published", published_at: "2026-09-13T16:30:00.000Z" }), // Mon 00:30 Manila, this week
      item({ id: "e", stage: "scheduled", scheduled_at: "2026-09-15T02:00:00.000Z" }),
    ]
    const monday = describeReminder(review, { settings: SETTINGS, slots: [], items, lang: "en" })
    expect(monday).toMatchObject({ title: "Weekly review time", url: "/reports", body: expect.stringMatching(/^3 of 5 posts published/) })
    const sunday = describeReminder(review, { settings: { ...SETTINGS, week_starts_on: 0 }, slots: [], items, lang: "en" })
    expect(sunday.body).toMatch(/^1 of 5 posts published/)
  })
})
