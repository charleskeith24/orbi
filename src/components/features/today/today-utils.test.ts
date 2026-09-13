import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { DEFAULT_ENGAGEMENT_TASKS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import type { InsertRow } from "@/lib/types"
import { dailyRhythm, overdueLabel, postCopy, reschedulePatch, slotTime, todaysContent } from "./today-utils"

/** Sunday, Sep 13 2026, 10:00 local time. */
const NOW = new Date(2026, 8, 13, 10, 0)
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes).toISOString()
const item = (values: InsertRow<"content_items">) => buildRow("content_items", values, "u", NOW)

describe("todaysContent", () => {
  it("lists scheduled items by publish time, then deadlines, each once", () => {
    const late = item({ id: "late", title: "Late", scheduled_at: at(13, 18) })
    const early = item({ id: "early", title: "Early", scheduled_at: at(13, 9) })
    const due = item({ id: "due", title: "Due", due_date: "2026-09-13" })
    const list = todaysContent({ scheduledToday: [late, early], dueToday: [due, early] })
    expect(list.map((i) => i.id)).toEqual(["early", "late", "due"])
  })
})

describe("overdueLabel", () => {
  it("explains why an item is late", () => {
    expect(overdueLabel({ scheduled_at: at(13, 9), due_date: null }, NOW)).toBe("Missed 9:00 AM")
    expect(overdueLabel({ scheduled_at: at(11, 9), due_date: null }, NOW)).toBe("2 days late")
    expect(overdueLabel({ scheduled_at: null, due_date: "2026-09-10" }, NOW)).toBe("Due 3 days ago")
  })
})

describe("reschedulePatch", () => {
  it("keeps a missed publish time's time of day", () => {
    const patch = reschedulePatch(item({ stage: "scheduled", scheduled_at: at(12, 18, 30) }), "2026-09-14", NOW)
    expect(patch.scheduled_at).toBe(at(14, 18, 30))
    expect(patch.due_date).toBeUndefined()
  })

  it("moves a missed production deadline", () => {
    const patch = reschedulePatch(item({ stage: "editing", due_date: "2026-09-10" }), "2026-09-15", NOW)
    expect(patch).toEqual({ due_date: "2026-09-15" })
  })

  it("leaves the deadline of approved content alone", () => {
    const patch = reschedulePatch(item({ stage: "ready_to_post", due_date: "2026-09-10", scheduled_at: at(12, 9) }), "2026-09-14", NOW)
    expect(patch).toEqual({ scheduled_at: at(14, 9) })
  })
})

describe("postCopy", () => {
  const script = (values: InsertRow<"content_scripts">) => buildRow("content_scripts", { content_item_id: "i", ...values }, "u", NOW)
  const brief = (caption: string) => buildRow("content_briefs", { content_item_id: "i", caption }, "u", NOW)

  it("prefers the script caption with its hashtags", () => {
    expect(postCopy(script({ caption: "Save this.", hashtags: ["ads", "#growth"], body: "Body" }), brief("Brief"))).toEqual({
      text: "Save this.\n\n#ads #growth",
      label: "Copy caption",
    })
  })

  it("falls back to the brief caption, then the script body", () => {
    expect(postCopy(script({ body: "The script" }), brief("From the brief")).text).toBe("From the brief")
    expect(postCopy(script({ body: "The script" }), undefined)).toEqual({ text: "The script", label: "Copy script" })
    expect(postCopy(undefined, undefined).text).toBe("")
  })
})

describe("slotTime", () => {
  it("formats HH:mm as a 12-hour time", () => {
    expect(slotTime("18:30")).toBe("6:30 PM")
    expect(slotTime("00:05")).toBe("12:05 AM")
    expect(slotTime(null)).toBeNull()
    expect(slotTime("25:00")).toBeNull()
  })
})

describe("dailyRhythm", () => {
  const idea = buildRow("content_ideas", { title: "Idea" }, "u", NOW)
  const reviewItem = item({ stage: "review" })
  const tasks = DEFAULT_ENGAGEMENT_TASKS

  it("ticks each habit only when today's data proves it", () => {
    const log = buildRow(
      "engagement_logs",
      { date: toISODate(NOW), completed_tasks: tasks.map((t) => t.key) },
      "u",
      NOW
    )
    const steps = dailyRhythm({
      db: { content_items: [item({ stage: "scripting" })], content_scripts: [] },
      today: { ideasCapturedToday: [idea], toReview: [], publishedToday: [], scheduledToday: [] },
      now: NOW,
      log,
      tasks,
    })
    expect(steps.map((s) => s.key)).toEqual(["capture", "create", "review", "publish", "engage"])
    expect(Object.fromEntries(steps.map((s) => [s.key, s.done]))).toEqual({
      capture: true,
      create: true,
      review: true,
      publish: false,
      engage: true,
    })
    expect(steps[0].detail).toBe("1 idea captured")
  })

  it("leaves habits open when nothing happened yet", () => {
    const yesterday = new Date(2026, 8, 12, 10)
    const old = buildRow("content_items", { stage: "editing" }, "u", yesterday)
    const steps = dailyRhythm({
      db: { content_items: [old], content_scripts: [] },
      today: { ideasCapturedToday: [], toReview: [reviewItem], publishedToday: [], scheduledToday: [] },
      now: NOW,
      log: null,
      tasks,
    })
    expect(steps.every((s) => !s.done)).toBe(true)
    expect(steps[2].detail).toBe("1 item waiting")
    expect(steps[4].detail).toBe(`0 of ${tasks.length} tasks`)
  })
})
