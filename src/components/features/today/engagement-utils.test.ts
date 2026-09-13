import { describe, expect, it } from "vitest"
import { DEFAULT_ENGAGEMENT_TASKS } from "@/lib/constants"
import { buildRow } from "@/lib/data/defaults"
import type { EngagementLog, InsertRow } from "@/lib/types"
import {
  allTasksDone,
  counterPatch,
  engagementHistory,
  logForDay,
  normalizeQuestion,
  toggleTaskPatch,
  trackerRows,
} from "./engagement-utils"

const NOW = new Date(2026, 8, 13, 10, 0)
const tasks = DEFAULT_ENGAGEMENT_TASKS
const log = (values: InsertRow<"engagement_logs">, updated = NOW): EngagementLog =>
  buildRow("engagement_logs", { date: "2026-09-13", ...values }, "u", updated)

describe("trackerRows", () => {
  it("gives tasks their counter and lists uncovered counters after them", () => {
    const rows = trackerRows(tasks, log({ comments_replied: 4, completed_tasks: ["answer_questions"] }))
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey.reply_comments).toMatchObject({ kind: "task", counter: "comments_replied", count: 4, target: 10, done: false })
    expect(byKey.answer_questions).toMatchObject({ kind: "task", counter: null, done: true })
    expect(byKey.ideas_captured).toMatchObject({ kind: "counter", counter: "ideas_captured", count: 0 })
    expect(rows.filter((r) => r.counter === "comments_replied")).toHaveLength(1)
  })
})

describe("counterPatch", () => {
  it("ticks a task when its counter reaches the target and unticks below it", () => {
    const up = counterPatch(log({ dms_replied: 4 }), tasks, "dms_replied", 1)
    expect(up.dms_replied).toBe(5)
    expect(up.completed_tasks).toContain("reply_dms")
    const down = counterPatch(log({ dms_replied: 5, completed_tasks: ["reply_dms"] }), tasks, "dms_replied", -1)
    expect(down.dms_replied).toBe(4)
    expect(down.completed_tasks).not.toContain("reply_dms")
  })

  it("never goes below zero and starts from zero without a log", () => {
    expect(counterPatch(null, tasks, "creator_comments", -1).creator_comments).toBe(0)
    expect(counterPatch(null, tasks, "ideas_captured", 1).ideas_captured).toBe(1)
  })

  it("keeps completed tasks in configured order", () => {
    const patch = toggleTaskPatch(log({ completed_tasks: ["collect_questions"] }), tasks, "reply_comments", true)
    expect(patch.completed_tasks).toEqual(["reply_comments", "collect_questions"])
    expect(toggleTaskPatch(log({ completed_tasks: ["reply_comments"] }), tasks, "reply_comments", false).completed_tasks).toEqual([])
  })

  it("knows when every task is done", () => {
    expect(allTasksDone(tasks.map((t) => t.key), tasks)).toBe(true)
    expect(allTasksDone(["reply_comments"], tasks)).toBe(false)
    expect(allTasksDone([], [])).toBe(false)
  })
})

describe("logForDay and history", () => {
  it("picks the most recently updated row for a day", () => {
    const older = log({ notes: "old" }, new Date(2026, 8, 13, 8))
    const newer = log({ notes: "new" }, new Date(2026, 8, 13, 9))
    expect(logForDay([older, newer], "2026-09-13")?.notes).toBe("new")
    expect(logForDay([older], "2026-09-12")).toBeNull()
  })

  it("covers the last 7 days ending today", () => {
    const days = engagementHistory(
      [log({ date: "2026-09-12", comments_replied: 3, dms_replied: 2, completed_tasks: ["reply_dms"] })],
      tasks,
      NOW
    )
    expect(days).toHaveLength(7)
    expect(days[0].date).toBe("2026-09-07")
    expect(days[6]).toMatchObject({ date: "2026-09-13", isToday: true, logged: false })
    expect(days[5]).toMatchObject({ date: "2026-09-12", logged: true, completed: 1, total: tasks.length, replies: 5 })
  })
})

describe("normalizeQuestion", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeQuestion("  How much should I spend on ads?! ")).toBe(normalizeQuestion("how much should i spend on ads"))
  })
})
