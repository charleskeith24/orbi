import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { ContentItem, InsertRow, PostingSlot } from "@/lib/types"
import {
  adjacentStages,
  buildColumns,
  defaultScheduleTime,
  dueDateShortcuts,
  EMPTY_FACETS,
  facetValue,
  hasActiveFilters,
  hasFutureSchedule,
  isOnBoard,
  knownOwners,
  matchesFilters,
  nextPostingSlots,
  NONE,
  quickAddDefaults,
  sortStageItems,
  stageFromDroppable,
  type PipelineFilters,
} from "./board-model"

// Friday, Sep 11 2026, 10:00 local time.
const NOW = new Date(2026, 8, 11, 10, 0)
const item = (values: InsertRow<"content_items">): ContentItem => buildRow("content_items", values, "user", NOW)
const slot = (values: InsertRow<"content_calendar">): PostingSlot => buildRow("content_calendar", values, "user", NOW)
const filters = (patch: Partial<PipelineFilters> = {}): PipelineFilters => ({ ...EMPTY_FACETS, q: "", ...patch })
const daysAgo = (days: number) => new Date(2026, 8, 11 - days, 12).toISOString()

describe("isOnBoard", () => {
  it("keeps unpublished work and the whole repurpose queue", () => {
    expect(isOnBoard(item({ stage: "editing" }), NOW)).toBe(true)
    expect(isOnBoard(item({ stage: "repurpose", published_at: daysAgo(90) }), NOW)).toBe(true)
  })

  it("shows published posts from the last 14 days only", () => {
    expect(isOnBoard(item({ stage: "published", published_at: daysAgo(13) }), NOW)).toBe(true)
    expect(isOnBoard(item({ stage: "published", published_at: daysAgo(14) }), NOW)).toBe(false)
  })
})

describe("filters", () => {
  const post = item({ title: "SOP system", platform: "tiktok", owner: "  ", hook: "Stop hiring before this" })

  it("maps missing values to NONE", () => {
    expect(facetValue(post, "owner")).toBe(NONE)
    expect(facetValue(post, "pillar")).toBe(NONE)
    expect(matchesFilters(post, filters({ pillar: [NONE], owner: [NONE] }))).toBe(true)
    expect(matchesFilters(post, filters({ platform: ["facebook"] }))).toBe(false)
    expect(matchesFilters(post, filters({ platform: ["facebook", "tiktok"] }))).toBe(true)
  })

  it("searches title and hook", () => {
    expect(matchesFilters(post, filters({ q: "stop hiring" }))).toBe(true)
    expect(matchesFilters(post, filters({ q: "newsletter" }))).toBe(false)
  })

  it("ignores blank search when reporting active filters", () => {
    expect(hasActiveFilters(filters())).toBe(false)
    expect(hasActiveFilters(filters({ q: "  " }))).toBe(false)
    expect(hasActiveFilters(filters({ format: ["f1"] }))).toBe(true)
  })

  it("lists owners alphabetically with the default owner", () => {
    const owners = knownOwners([item({ owner: "Bea (Editor)" }), item({ owner: " Raf " }), item({ owner: "" })], "Raf")
    expect(owners).toEqual(["Bea (Editor)", "Raf"])
  })
})

describe("sortStageItems", () => {
  it("orders unpublished work by planned date, undated last, then priority", () => {
    const rows = [
      item({ title: "Undated", stage: "brief" }),
      item({ title: "Later", stage: "brief", due_date: "2026-09-20" }),
      item({ title: "Soon low", stage: "brief", due_date: "2026-09-12", priority: "low" }),
      item({ title: "Soon high", stage: "brief", due_date: "2026-09-12", priority: "high" }),
    ]
    expect(sortStageItems("brief", rows).map((i) => i.title)).toEqual(["Soon high", "Soon low", "Later", "Undated"])
  })

  it("orders published posts newest first", () => {
    const rows = [
      item({ title: "Old", stage: "published", published_at: daysAgo(9) }),
      item({ title: "New", stage: "published", published_at: daysAgo(1) }),
    ]
    expect(sortStageItems("published", rows).map((i) => i.title)).toEqual(["New", "Old"])
  })
})

describe("buildColumns", () => {
  it("counts totals before filters and overdue cards after", () => {
    const pool = [
      item({ stage: "editing", platform: "tiktok", due_date: "2026-09-01" }),
      item({ stage: "editing", platform: "facebook" }),
      item({ stage: "review", platform: "tiktok" }),
    ]
    const columns = buildColumns(pool, filters({ platform: ["tiktok"] }), NOW)
    expect(columns.editing.total).toBe(2)
    expect(columns.editing.items).toHaveLength(1)
    expect(columns.editing.overdue).toBe(1)
    expect(columns.review.items).toHaveLength(1)
    expect(columns.idea.items).toHaveLength(0)
  })
})

describe("stages", () => {
  it("knows each stage's neighbours", () => {
    expect(adjacentStages("idea")).toEqual({ prev: null, next: "selected" })
    expect(adjacentStages("review")).toEqual({ prev: "editing", next: "revision" })
    expect(adjacentStages("repurpose")).toEqual({ prev: "published", next: null })
  })

  it("parses droppable ids", () => {
    expect(stageFromDroppable("column:ready_to_post")).toBe("ready_to_post")
    expect(stageFromDroppable("column:nope")).toBeNull()
    expect(stageFromDroppable("abc")).toBeNull()
    expect(stageFromDroppable(null)).toBeNull()
  })
})

describe("quickAddDefaults", () => {
  it("uses facets filtered to exactly one real value", () => {
    const defaults = quickAddDefaults({
      ...EMPTY_FACETS,
      platform: ["tiktok"],
      pillar: ["p1", "p2"],
      campaign: [NONE],
      priority: ["high"],
      owner: ["Bea (Editor)"],
    })
    expect(defaults).toEqual({ platform: "tiktok", priority: "high", owner: "Bea (Editor)" })
  })

  it("ignores unknown platforms and priorities", () => {
    expect(quickAddDefaults({ ...EMPTY_FACETS, platform: ["myspace"], priority: ["urgent"] })).toEqual({})
  })
})

describe("scheduling", () => {
  const target = item({ platform: "facebook", stage: "ready_to_post" })

  it("detects a publish time still ahead", () => {
    expect(hasFutureSchedule({ scheduled_at: new Date(2026, 8, 11, 18).toISOString() }, NOW)).toBe(true)
    expect(hasFutureSchedule({ scheduled_at: new Date(2026, 8, 11, 8).toISOString() }, NOW)).toBe(false)
    expect(hasFutureSchedule({ scheduled_at: null }, NOW)).toBe(false)
  })

  it("suggests open posting slots, skipping past times, other platforms and taken hours", () => {
    const slots = [
      slot({ day_of_week: 5, time: "09:00", platforms: ["facebook"], label: "Behind the Scenes" }),
      slot({ day_of_week: 5, time: "19:00", platforms: [], label: "Evening" }),
      slot({ day_of_week: 6, time: "10:00", platforms: ["tiktok"], label: "TikTok only" }),
      slot({ day_of_week: 1, time: "08:00", platforms: ["facebook"], label: "Educational / Authority" }),
    ]
    const taken = item({ platform: "facebook", stage: "scheduled", scheduled_at: new Date(2026, 8, 11, 19, 30).toISOString() })
    const result = nextPostingSlots(slots, [target, taken], target, NOW, 2)
    expect(result.map((s) => [s.label, s.at.getDate(), s.at.getHours()])).toEqual([
      ["Educational / Authority", 14, 8],
      ["Behind the Scenes", 18, 9],
    ])
  })

  it("suggests nothing without active slots", () => {
    expect(nextPostingSlots([slot({ day_of_week: 1, is_active: false })], [], target, NOW)).toEqual([])
  })

  it("defaults to the existing future time, then the next slot, then tomorrow at the old time", () => {
    const future = new Date(2026, 8, 15, 18, 0)
    expect(defaultScheduleTime({ scheduled_at: future.toISOString() }, [], NOW).getTime()).toBe(future.getTime())
    const suggestion = { at: new Date(2026, 8, 14, 8, 0), label: "Monday" }
    expect(defaultScheduleTime({ scheduled_at: null }, [suggestion], NOW)).toBe(suggestion.at)
    const fallback = defaultScheduleTime({ scheduled_at: new Date(2026, 8, 9, 19, 30).toISOString() }, [], NOW)
    expect([fallback.getDate(), fallback.getHours(), fallback.getMinutes()]).toEqual([12, 19, 30])
  })

  it("offers distinct due-date shortcuts that respect the week start", () => {
    expect(dueDateShortcuts(NOW, 1).map((s) => s.value)).toEqual(["2026-09-11", "2026-09-12", "2026-09-14"])
    expect(dueDateShortcuts(NOW, 0).map((s) => s.value)).toEqual(["2026-09-11", "2026-09-12", "2026-09-14", "2026-09-13"])
  })
})
