import { describe, expect, it } from "vitest"
import type { InsertRow } from "@/lib/types"
import { contentBuffer, contentToday, pipelineCounts } from "./pipeline"
import { add, addPublished, daysAgo, ids, makeDb, NOW, on, settingsOf } from "./test-fixtures"

describe("pipelineCounts", () => {
  it("counts stages and roll-up groups; Published only counts the last 30 days", () => {
    const db = makeDb()
    for (const stage of ["idea", "selected", "scripting", "recording", "editing", "revision"] as const) {
      add(db, "content_items", { stage })
    }
    add(db, "content_items", { stage: "scheduled", scheduled_at: daysAgo(-2).toISOString() })
    addPublished(db, 5)
    addPublished(db, 45)
    addPublished(db, 10, { stage: "repurpose" })
    add(db, "content_ideas", { status: "inbox" })
    add(db, "content_ideas", { status: "archived" })

    const counts = pipelineCounts(db, NOW)
    expect(counts.stages.published).toBe(2)
    expect(counts.stages.repurpose).toBe(1)
    expect(counts.groups).toEqual({
      idea: 2,
      brief: 0,
      script: 1,
      production: 2,
      review: 1,
      ready: 0,
      scheduled: 1,
      published: 2,
    })
    expect(counts.groupList.map((g) => g.id)).toEqual([
      "idea",
      "brief",
      "script",
      "production",
      "review",
      "ready",
      "scheduled",
      "published",
    ])
    expect(counts).toMatchObject({ inProgress: 7, openIdeas: 1, publishedWindowDays: 30 })
  })
})

describe("contentToday", () => {
  it("builds the Today lists as rows", () => {
    const db = makeDb()
    const dueToday = add(db, "content_items", { title: "Due", stage: "editing", due_date: "2026-09-10" })
    const tonight = add(db, "content_items", { title: "Tonight", stage: "scheduled", scheduled_at: on(2026, 9, 10, 19).toISOString() })
    const missed = add(db, "content_items", { title: "Missed", stage: "scheduled", scheduled_at: on(2026, 9, 10, 8).toISOString() })
    const late = add(db, "content_items", { title: "Late", stage: "scripting", due_date: "2026-09-08" })
    const ready = add(db, "content_items", { title: "Ready", stage: "ready_to_post" })
    const record = add(db, "content_items", { title: "Record", stage: "ready_for_production" })
    const review = add(db, "content_items", { title: "Review", stage: "review" })
    const out = addPublished(db, 0, { title: "Out", due_date: "2026-09-01" })
    add(db, "content_ideas", { title: "Fresh" })
    add(db, "content_ideas", { title: "Old" }, { created_at: daysAgo(3).toISOString() })

    const today = contentToday(db, NOW)
    expect(ids(today.dueToday)).toEqual([dueToday.id])
    expect(ids(today.scheduledToday)).toEqual([missed.id, tonight.id])
    expect(ids(today.publishedToday)).toEqual([out.id])
    expect(ids(today.awaitingProduction)).toEqual([dueToday.id, record.id])
    expect(ids(today.toRecord)).toEqual([record.id])
    expect(ids(today.toReview)).toEqual([review.id])
    expect(ids(today.awaitingApproval)).toEqual([review.id])
    expect(ids(today.toPost)).toEqual([missed.id, tonight.id, ready.id])
    expect(ids(today.overdue)).toEqual([late.id, missed.id])
    expect(today.ideasCapturedToday.map((i) => i.title)).toEqual(["Fresh"])
  })

  it("doesn't flag finished work as due or overdue, but flags missed publish times", () => {
    const db = makeDb()
    add(db, "content_items", { title: "Ready", stage: "ready_to_post", due_date: "2026-09-08" })
    add(db, "content_items", { title: "Queued", stage: "scheduled", due_date: "2026-09-10", scheduled_at: on(2026, 9, 12).toISOString() })
    const missed = add(db, "content_items", { title: "Missed", stage: "scheduled", due_date: "2026-09-01", scheduled_at: on(2026, 9, 9).toISOString() })
    const editing = add(db, "content_items", { title: "Editing", stage: "editing", due_date: "2026-09-10" })
    const today = contentToday(db, NOW)
    expect(ids(today.overdue)).toEqual([missed.id])
    expect(ids(today.dueToday)).toEqual([editing.id])
  })
})

describe("contentBuffer", () => {
  function bufferWith(ready: number, settings: InsertRow<"app_settings"> = {}) {
    const db = makeDb({ weekly_post_target: 7, buffer_healthy_days: 7, buffer_warning_days: 3, ...settings })
    for (let i = 0; i < ready; i++) add(db, "content_items", { stage: "ready_to_post" })
    return contentBuffer(db, NOW, settingsOf(db))
  }

  it.each([
    [10, "healthy", "Healthy"],
    [7, "healthy", "Healthy"],
    [6, "ok", "OK"],
    [3, "ok", "OK"],
    [2, "low", "Content Buffer Low"],
    [0, "low", "Content Buffer Low"],
  ])("%d ready posts at 1/day → %s", (ready, status, label) => {
    const buffer = bufferWith(ready)
    expect(buffer).toMatchObject({ status, label, days: ready, readyCount: ready })
  })

  it("days = ready ÷ (weekly target ÷ 7), rounded to 1 decimal", () => {
    expect(bufferWith(5, { weekly_post_target: 14 })).toMatchObject({ days: 2.5, dailyRate: 2, status: "low" })
    expect(bufferWith(2, { weekly_post_target: 3 }).days).toBe(4.7)
  })

  it("counts future scheduled posts but not missed ones, and breaks the pipeline down", () => {
    const db = makeDb({ weekly_post_target: 7 })
    add(db, "content_items", { stage: "ready_to_post" })
    add(db, "content_items", { stage: "scheduled", scheduled_at: daysAgo(-1).toISOString() })
    add(db, "content_items", { stage: "scheduled", scheduled_at: daysAgo(1).toISOString() })
    add(db, "content_items", { stage: "scheduled", scheduled_at: null })
    const scripted = add(db, "content_items", { stage: "scripting" })
    add(db, "content_scripts", { content_item_id: scripted.id, body: "Hook, value, CTA", is_current: true })
    const oldScript = add(db, "content_items", { stage: "scripting" })
    add(db, "content_scripts", { content_item_id: oldScript.id, body: "Old draft", is_current: false })
    add(db, "content_items", { stage: "ready_for_production" })
    for (const stage of ["editing", "review", "revision"] as const) add(db, "content_items", { stage })
    for (const status of ["validated", "selected", "inbox"] as const) add(db, "content_ideas", { status })

    const buffer = contentBuffer(db, NOW, settingsOf(db))
    expect(buffer).toMatchObject({ readyCount: 3, days: 3, status: "ok", targetDays: 7 })
    expect(buffer.breakdown).toEqual({ readyIdeas: 2, readyScripts: 2, readyToRecord: 1, edited: 3, readyToPublish: 3 })
  })
})
