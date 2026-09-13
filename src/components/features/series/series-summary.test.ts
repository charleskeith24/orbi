import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { toISODate } from "@/lib/dates"
import type { InsertRow } from "@/lib/types"
import { episodeKey, recentEpisodes, summarizeSeries } from "./series-summary"

const NOW = new Date(2026, 8, 11, 10) // Friday
const series = buildRow(
  "content_series",
  { id: "s1", name: "Monday Lesson", frequency: "weekly", day_of_week: 1, platforms: ["tiktok", "facebook"] },
  "u",
  NOW
)
const item = (id: string, values: InsertRow<"content_items">) => buildRow("content_items", { id, series_id: "s1", ...values }, "u", NOW)

describe("summarizeSeries", () => {
  const items = [
    item("a", { title: "Lesson one", platform: "facebook", stage: "published", published_at: "2026-08-31T09:00:00" }),
    item("b", { title: "Lesson one", platform: "tiktok", stage: "published", published_at: "2026-08-31T12:00:00" }),
    item("c", { title: "Lesson two", platform: "tiktok", stage: "published", published_at: "2026-09-07T09:00:00" }),
    item("d", { title: "Lesson three", platform: "tiktok", stage: "scheduled", scheduled_at: "2026-09-14T09:00:00" }),
    item("e", { title: "Lesson four", platform: "tiktok", stage: "brief" }),
  ]
  const summary = summarizeSeries(series, items, new Map(), NOW)

  it("groups platform versions into one episode, series platform first", () => {
    expect(summary.episodes.length).toBe(4)
    expect(summary.posts).toBe(5)
    expect(summary.episodes[0].items.map((i) => i.id)).toEqual(["b", "a"])
    expect(toISODate(summary.episodes[0].date as Date)).toBe("2026-08-31")
  })

  it("numbers episodes chronologically with undated last", () => {
    expect(summary.episodes.map((e) => [e.number, e.primary.id])).toEqual([
      [1, "b"],
      [2, "c"],
      [3, "d"],
      [4, "e"],
    ])
  })

  it("finds last, next and suggested episodes", () => {
    expect(summary.published.length).toBe(2)
    expect(summary.lastPublished?.primary.id).toBe("c")
    expect(summary.nextPlanned?.primary.id).toBe("d")
    expect(toISODate(summary.suggestedNext)).toBe("2026-09-21")
    expect(recentEpisodes(summary, NOW)).toBe(2)
  })

  it("groups by idea before title", () => {
    const a = item("x", { title: "Short version", idea_id: "i1", platform: "tiktok" })
    const b = item("y", { title: "Long version", idea_id: "i1", platform: "youtube" })
    expect(episodeKey(a)).toBe(episodeKey(b))
  })

  it("keeps same-titled posts on different days apart", () => {
    const a = item("p", { title: "Recap", published_at: "2026-09-01T09:00:00", stage: "published" })
    const b = item("q", { title: "Recap", published_at: "2026-09-08T09:00:00", stage: "published" })
    expect(episodeKey(a)).not.toBe(episodeKey(b))
  })
})
