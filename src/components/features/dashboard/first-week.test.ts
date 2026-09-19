import { addDays } from "date-fns"
import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { createStarterDatabase } from "@/lib/data/starter"
import type { Database, InsertRow, TableName } from "@/lib/types"
import { workspaceStartKey } from "./first-run"
import { firstWeek, firstWeekStartKey, hasReviewOrNextPlan, isFirstWeekVisible, type FirstWeek, type MissionKey } from "./first-week"

const USER = "user-1"
/** Setup ran on Monday, Sep 14 2026 (the starter settings' week starts on Monday). */
const START = new Date(2026, 8, 14, 10)
/** Local noon on day `n` of the plan. */
const dayOf = (n: number) => {
  const d = addDays(START, n - 1)
  d.setHours(12, 0, 0, 0)
  return d
}

const row = <T extends TableName>(table: T, values: InsertRow<T>, at: Date = START) => buildRow(table, values, USER, at)

/** The workspace as Quick setup leaves it: a niche, starter ideas from setup, no voice and no problems yet. */
function afterSetup(): Database {
  const db = createStarterDatabase(USER, START)
  const setupIdeas = Array.from({ length: 30 }, (_, i) => row("content_ideas", { title: `Starter idea ${i + 1}`, source: "onboarding" }))
  return {
    ...db,
    brand_profiles: [{ ...db.brand_profiles[0], niche: "Budget meal prep for night-shift nurses", tones: [], personality_traits: [], onboarding_completed: true }],
    content_ideas: setupIdeas,
  }
}

const own = (n: number, at: Date) => Array.from({ length: n }, (_, i) => row("content_ideas", { title: `My idea ${i + 1}`, source: "quick_capture" }, at))
const byKey = (plan: FirstWeek) => Object.fromEntries(plan.missions.map((m) => [m.key, m])) as Record<Exclude<MissionKey, "collab">, FirstWeek["missions"][number]>

/** Every mission's signal in place (a review with text covers day 7). */
function allDone(db: Database, at: Date): Database {
  const item = row("content_items", { title: "Night-shift meal prep", platform: "tiktok", stage: "published", published_at: at.toISOString() }, at)
  return {
    ...db,
    content_ideas: [...db.content_ideas, ...own(3, at)],
    content_items: [item],
    content_scripts: [row("content_scripts", { content_item_id: item.id, format: "short_video" }, at)],
    brand_profiles: [{ ...db.brand_profiles[0], tones: ["casual"] }],
    audience_problems: [row("audience_problems", { problem: "No time to cook after a 12-hour shift" }, at)],
    content_metrics: [row("content_metrics", { content_item_id: item.id, views: 1240 }, at)],
    weekly_reviews: [row("weekly_reviews", { week_start: "2026-09-14", what_worked: "The fridge-tour hook" }, at)],
  }
}

describe("first week", () => {
  it("starts on day 1 after setup with every mission open and the setup ideas not counted", () => {
    const plan = firstWeek(afterSetup(), dayOf(1))
    expect(plan).toMatchObject({ state: "active", day: 1, startKey: "2026-09-14", lastDayKey: "2026-09-27", doneCount: 0, focusReason: "today" })
    expect(isFirstWeekVisible(plan)).toBe(true)
    // capture → create → script → voice → publish → measure → review and plan
    expect(plan.missions.map((m) => [m.day, m.key])).toEqual([
      [1, "capture"],
      [2, "create"],
      [3, "script"],
      [4, "voice"],
      [5, "publish"],
      [6, "measure"],
      [7, "review"],
    ])
    expect(plan.missions.map((m) => m.timing)).toEqual(["today", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"])
    // 30 starter ideas from setup, none of them the creator's own.
    expect(plan.focus).toMatchObject({ key: "capture", done: false, progress: { current: 0, target: 3 }, action: { kind: "dialog", dialog: "quick-capture" } })
    expect(plan.totals.ideas).toBe(0)
    expect(plan.bonus).toMatchObject({ key: "collab", day: null, done: false, action: { kind: "link", href: "/collabs?new=1" } })
  })

  it("counts only ideas the creator added: three of their own tick day 1, setup ideas never do", () => {
    const base = afterSetup()
    const two = firstWeek({ ...base, content_ideas: [...base.content_ideas, ...own(2, dayOf(1))] }, dayOf(1))
    expect(byKey(two).capture).toMatchObject({ done: false, progress: { current: 2, target: 3 } })
    const three = firstWeek({ ...base, content_ideas: [...base.content_ideas, ...own(3, dayOf(1))] }, dayOf(1))
    expect(byKey(three).capture).toMatchObject({ done: true, timing: "done", progress: { current: 3, target: 3 } })
    // An idea from the Idea Generator is still the creator's own choice; a Niche Discovery re-run's aren't.
    const generated = row("content_ideas", { title: "Generated", source: "ai_generator" }, dayOf(1))
    const rerun = own(5, dayOf(1)).map((idea) => ({ ...idea, source: "onboarding" as const }))
    const mixed = firstWeek({ ...base, content_ideas: [...base.content_ideas, ...rerun, generated] }, dayOf(1))
    expect(byKey(mixed).capture.progress).toEqual({ current: 1, target: 3 })
  })

  it("paces by day: earlier open missions become catch-up, today's leads, later ones can be done early", () => {
    const base = afterSetup()
    // Day 3: day 1 done, day 2 skipped, nothing else yet.
    const day3 = { ...base, content_ideas: [...base.content_ideas, ...own(3, dayOf(1))] }
    const plan = firstWeek(day3, dayOf(3))
    const m = byKey(plan)
    expect(plan.day).toBe(3)
    expect([m.capture.timing, m.create.timing, m.script.timing, m.voice.timing]).toEqual(["done", "catch_up", "today", "upcoming"])
    expect(plan).toMatchObject({ focusReason: "today", focus: { key: "script" } })
    // No content yet, so the script mission's one action is to create it first.
    expect(m.script).toMatchObject({ action: { kind: "dialog", dialog: "new-content" } })

    // Publishing early (a logged post) ticks days 2 and 5 before their day.
    const post = row("content_items", { title: "Logged", platform: "facebook", stage: "published", published_at: dayOf(3).toISOString() }, dayOf(3))
    const early = byKey(firstWeek({ ...day3, content_items: [post] }, dayOf(3)))
    expect([early.create.timing, early.publish.timing, early.measure.timing]).toEqual(["done", "done", "upcoming"])
    expect(early.measure.action).toEqual({ kind: "dialog", dialog: "add-metrics", itemId: post.id })

    // Today's done and one is behind → lead with the catch-up; nothing behind → a head start on the next.
    const draft = row("content_items", { title: "Draft", platform: "tiktok", stage: "scripting" }, dayOf(3))
    const script = row("content_scripts", { content_item_id: draft.id, format: "short_video" }, dayOf(3))
    const scripted = firstWeek({ ...day3, content_scripts: [script] }, dayOf(3))
    expect(scripted).toMatchObject({ focusReason: "catch_up", focus: { key: "create", timing: "catch_up" } })
    const ahead = firstWeek({ ...day3, content_items: [draft], content_scripts: [script] }, dayOf(3))
    expect(ahead).toMatchObject({ focusReason: "ahead", focus: { key: "voice", timing: "upcoming" } })
    // Day 5 publishes the scripted piece from the Studio rather than logging a second copy.
    expect(byKey(ahead).publish).toMatchObject({ action: { kind: "link", href: `/studio/${draft.id}` } })
  })

  it("links the script mission to the newest unpublished piece without a script", () => {
    const base = afterSetup()
    const older = row("content_items", { title: "Older", platform: "tiktok", stage: "brief" }, dayOf(2))
    const newer = row("content_items", { title: "Newer", platform: "tiktok", stage: "brief" }, dayOf(3))
    const plan = firstWeek({ ...base, content_items: [older, newer] }, dayOf(3))
    expect(byKey(plan).script.action).toEqual({ kind: "link", href: `/studio/${newer.id}?tab=script` })
  })

  it("needs both a voice and an audience problem for day 4, and points at whichever is missing", () => {
    const base = afterSetup()
    const blank = byKey(firstWeek(base, dayOf(4))).voice
    expect(blank).toMatchObject({ done: false, action: { kind: "link", href: "/strategy#personality" } })
    expect(blank.parts.map((p) => [p.key, p.done])).toEqual([
      ["voice", false],
      ["problems", false],
    ])
    const voiced = { ...base, brand_profiles: [{ ...base.brand_profiles[0], personality_traits: ["direct" as const] }] }
    expect(byKey(firstWeek(voiced, dayOf(4))).voice).toMatchObject({ done: false, action: { kind: "link", href: "/audience/problems" } })
    const problem = row("audience_problems", { problem: "No time to cook" })
    expect(byKey(firstWeek({ ...voiced, audience_problems: [problem] }, dayOf(4))).voice.done).toBe(true)
  })

  it("ticks day 7 on a saved weekly review or a Weekly Planner plan for a later week", () => {
    const plan = (week_start: string) => row("weekly_reviews", { week_start, focus: "Consistency", stats: { plan: { source: "weekly_planner" } } })
    expect(hasReviewOrNextPlan([], "2026-09-14", 1)).toBe(false)
    // A plan for the week the workspace started in isn't "the next".
    expect(hasReviewOrNextPlan([plan("2026-09-14")], "2026-09-16", 1)).toBe(false)
    expect(hasReviewOrNextPlan([plan("2026-09-21")], "2026-09-16", 1)).toBe(true)
    // With Sunday weeks, a Wednesday start's week began on the 13th.
    expect(hasReviewOrNextPlan([plan("2026-09-13")], "2026-09-16", 0)).toBe(false)
    // A review row counts once it has text; an empty row (no text, no plan) doesn't.
    expect(hasReviewOrNextPlan([row("weekly_reviews", { week_start: "2026-09-14" })], "2026-09-14", 1)).toBe(false)
    expect(hasReviewOrNextPlan([row("weekly_reviews", { week_start: "2026-09-14", learned: "Hooks with numbers work" })], "2026-09-14", 1)).toBe(true)

    const base = afterSetup()
    expect(byKey(firstWeek({ ...base, weekly_reviews: [plan("2026-09-21")] }, dayOf(2))).review).toMatchObject({ done: true, timing: "done" })
  })

  it("finishes when all seven are done, with real totals and one next action", () => {
    const db = allDone(afterSetup(), dayOf(6))
    const plan = firstWeek(db, dayOf(7))
    expect(plan).toMatchObject({ state: "finished", doneCount: 7, focus: null, focusReason: null })
    expect(isFirstWeekVisible(plan)).toBe(true)
    expect(plan.totals).toEqual({ ideas: 3, content: 1, posts: 1, views: 1240 })
    expect(plan.next).toEqual({ cta: "Plan next week", action: { kind: "link", href: "/calendar/planner" } })
    // The bonus doesn't hold the finish back.
    expect(plan.bonus.done).toBe(false)

    // Next week already planned → Today instead.
    const planned = row("weekly_reviews", { week_start: "2026-09-21", stats: { plan: {} } })
    const withPlan = firstWeek({ ...db, weekly_reviews: [...db.weekly_reviews, planned] }, dayOf(7))
    expect(withPlan.next).toEqual({ cta: "Open Today", action: { kind: "link", href: "/today" } })
    const collab = row("collabs", { title: "Duet with a nurse creator" })
    expect(firstWeek({ ...db, collabs: [collab] }, dayOf(7)).bonus).toMatchObject({ done: true, timing: "done" })
  })

  it("hides once dismissed, whatever the day or progress", () => {
    const db = afterSetup()
    const dismissed = { ...db, app_settings: [{ ...db.app_settings[0], first_week_dismissed: true }] }
    expect(firstWeek(dismissed, dayOf(2)).state).toBe("dismissed")
    expect(firstWeek(allDone(dismissed, dayOf(2)), dayOf(3)).state).toBe("dismissed")
    expect(isFirstWeekVisible(firstWeek(dismissed, dayOf(2)))).toBe(false)
  })

  it("retires by itself 14 days after the start", () => {
    const db = afterSetup()
    const last = firstWeek(db, dayOf(14))
    expect(last).toMatchObject({ state: "active", day: 14, focusReason: "catch_up", focus: { key: "capture", timing: "catch_up" } })
    const retired = firstWeek(db, dayOf(15))
    expect(retired).toMatchObject({ state: "retired", day: 15 })
    expect(isFirstWeekVisible(retired)).toBe(false)
    // A finished plan retires too.
    expect(firstWeek(allDone(db, dayOf(3)), dayOf(15)).state).toBe("retired")
  })

  it("counts from when the workspace was created, not from dates the creator types", () => {
    const base = afterSetup()
    const oldPost = row(
      "content_items",
      { title: "Posted in July", platform: "facebook", stage: "published", published_at: new Date(2026, 6, 2, 9).toISOString() },
      dayOf(5)
    )
    const db = { ...base, content_items: [oldPost] }
    expect(workspaceStartKey(db)).toBe("2026-07-02")
    expect(firstWeekStartKey(db, dayOf(5))).toBe("2026-09-14")
    expect(firstWeek(db, dayOf(5))).toMatchObject({ state: "active", day: 5 })
    // A clock behind the start still reads as day 1.
    expect(firstWeek(base, new Date(2026, 8, 13, 9)).day).toBe(1)
  })

  it("writes the missions in the app language", () => {
    const plan = firstWeek(afterSetup(), dayOf(1), "tl")
    const m = byKey(plan)
    expect(m.capture.label).toBe("Mag-capture ng 3 sariling ideas")
    expect(m.review.label).toBe("I-review ang linggo at i-plan ang susunod")
    expect(m.voice.parts.map((p) => p.label)).toEqual(["I-set ang voice mo", "Idagdag ang problema ng audience mo"])
    expect(plan.bonus.label).toBe("Mag-save ng isang collab idea")
  })
})
