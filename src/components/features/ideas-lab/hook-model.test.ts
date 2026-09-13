import { describe, expect, it } from "vitest"
import { hookPerformance } from "@/lib/analytics"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import type { Database } from "@/lib/types"
import {
  countBlanks,
  EMPTY_HOOK_FILTERS,
  fillBlanks,
  filterHooks,
  formatHookMetric,
  hookFacetCounts,
  hookMatcher,
  hookStats,
  newHookValues,
  sortHooks,
  splitBlanks,
  templatePattern,
} from "./hook-model"

const USER = "user-1"
const NOW = new Date("2026-09-10T10:00:00.000Z")
const DAY = 86_400_000

function workspace(): Database {
  const db = emptyDatabase()
  db.app_settings = [buildRow("app_settings", {}, USER, NOW)]
  db.hooks = [
    buildRow("hooks", { id: "h-tpl", text: "Most people are doing ___ completely wrong.", category: "contrarian", is_template: true, source: "library" }, USER, NOW),
    buildRow("hooks", { id: "h-own", text: "Our best ad angle came from a 1-star review.", category: "story", source: "content", is_favorite: true }, USER, new Date(NOW.getTime() - DAY)),
    buildRow("hooks", { id: "h-generic", text: "Is ___ worth it?", category: "question", is_template: true, source: "library" }, USER, NOW),
  ]
  const published = (id: string, hookId: string | null, hook: string, daysAgo: number) =>
    buildRow(
      "content_items",
      { id, title: id, hook_id: hookId, hook, platform: "tiktok", stage: "published", published_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString() },
      USER,
      NOW
    )
  db.content_items = [
    published("i1", "h-own", "Our best ad angle came from a 1-star review.", 3),
    published("i2", null, "Something else entirely", 4),
    buildRow("content_items", { id: "i3", title: "draft", hook_id: "h-tpl", stage: "scripting", platform: "linkedin" }, USER, NOW),
  ]
  db.content_metrics = [
    buildRow("content_metrics", { content_item_id: "i1", platform: "tiktok", recorded_at: "2026-09-08", views: 4000, reach: 3000, likes: 200, comments: 20, shares: 10, saves: 30, leads: 2 }, USER, NOW),
    buildRow("content_metrics", { content_item_id: "i2", platform: "tiktok", recorded_at: "2026-09-08", views: 1000, reach: 800, likes: 40 }, USER, NOW),
  ]
  db.content_ideas = [
    buildRow("content_ideas", { id: "idea-1", title: "Retargeting", hook: "Most people are doing retargeting completely wrong!" }, USER, NOW),
    buildRow("content_ideas", { id: "idea-2", title: "Copy", hook: "our best AD angle came from a 1-star review" }, USER, NOW),
    buildRow("content_ideas", { id: "idea-3", title: "Unrelated", hook: "Is hiring worth it?" }, USER, NOW),
  ]
  return db
}

describe("blanks", () => {
  it("splits, counts and fills ___ blanks", () => {
    const text = "___ isn't the problem. ____ is."
    expect(countBlanks(text)).toBe(2)
    expect(splitBlanks(text)).toEqual([
      { text: "___", blank: true, index: 0 },
      { text: " isn't the problem. ", blank: false },
      { text: "____", blank: true, index: 1 },
      { text: " is.", blank: false },
    ])
    expect(fillBlanks(text, ["Traffic", "  your offer "])).toBe("Traffic isn't the problem. your offer is.")
    expect(fillBlanks(text, ["Traffic"])).toBe("Traffic isn't the problem. ___ is.")
  })

  it("marks hooks with blanks as templates", () => {
    expect(newHookValues({ text: "  Stop doing ___   today ", category: "warning", source: "user" })).toEqual({
      text: "Stop doing ___ today",
      category: "warning",
      source: "user",
      pillar_id: null,
      notes: "",
      is_template: true,
    })
  })
})

describe("hookMatcher", () => {
  it("matches the same text or a filled-in template, ignoring case and closing punctuation", () => {
    expect(hookMatcher("Most people are doing ___ completely wrong.")("Most people are doing Facebook ads completely wrong!")).toBe(true)
    expect(hookMatcher("Most people are doing ___ completely wrong.")("Most people are doing it right.")).toBe(false)
    expect(hookMatcher("Our best ad angle came from a 1-star review.")("our best ad angle came from a 1-star review")).toBe(true)
  })

  it("doesn't match templates that are too generic", () => {
    expect(templatePattern("Is ___ worth it?")).toBeNull()
    expect(hookMatcher("Is ___ worth it?")("Is hiring worth it?")).toBe(false)
  })
})

describe("hookStats", () => {
  it("counts linked content, ideas written from the hook, and performance from hookPerformance", () => {
    const db = workspace()
    const stats = hookStats(db, NOW)
    expect(stats.get("h-tpl")).toMatchObject({ itemIds: ["i3"], ideaIds: ["idea-1"], uses: 2, performance: null })
    const own = stats.get("h-own")
    expect(own).toMatchObject({ itemIds: ["i1"], ideaIds: ["idea-2"], uses: 2 })
    expect(own?.performance).toEqual(hookPerformance(db, NOW).find((a) => a.hook.id === "h-own"))
    expect(own?.performance?.avgViews).toBe(4000)
    expect(stats.get("h-generic")).toMatchObject({ uses: 0 })
  })
})

describe("filters and sorting", () => {
  it("filters by search, category, source and favourites, with facet counts", () => {
    const db = workspace()
    expect(filterHooks(db.hooks, { ...EMPTY_HOOK_FILTERS, q: "wrong" }).map((h) => h.id)).toEqual(["h-tpl"])
    expect(filterHooks(db.hooks, { ...EMPTY_HOOK_FILTERS, categories: ["story", "question"] }).map((h) => h.id)).toEqual(["h-own", "h-generic"])
    expect(filterHooks(db.hooks, { ...EMPTY_HOOK_FILTERS, sources: ["library"], favorites: true })).toEqual([])
    const counts = hookFacetCounts(db.hooks, { ...EMPTY_HOOK_FILTERS, categories: ["story"] }, "categories")
    expect(counts.get("contrarian")).toBe(1)
    expect(counts.get("story")).toBe(1)
  })

  it("sorts by performance (unmeasured last), usage, recency and text", () => {
    const db = workspace()
    const stats = hookStats(db, NOW)
    expect(sortHooks(db.hooks, "performance", stats).map((h) => h.id)).toEqual(["h-own", "h-tpl", "h-generic"])
    expect(sortHooks(db.hooks, "uses", stats)[2].id).toBe("h-generic")
    expect(sortHooks(db.hooks, "newest", stats).at(-1)?.id).toBe("h-own")
    expect(sortHooks(db.hooks, "az", stats).map((h) => h.id)).toEqual(["h-generic", "h-tpl", "h-own"])
  })

  it("formats metrics per kind", () => {
    expect(formatHookMetric(12_900, "views")).toBe("12.9K")
    expect(formatHookMetric(48.26, "retention")).toBe("48.3%")
    expect(formatHookMetric(1.25, "leads")).toBe("1.3")
    expect(formatHookMetric(null, "engagement")).toBe("—")
  })
})
