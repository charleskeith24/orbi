import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import {
  draftFromSnapshot,
  draftRates,
  emptyMetricDraft,
  hasAnyMetric,
  ideaTitleFromText,
  isValidUrl,
  isVideoContent,
  normalizeUrl,
  toMetricValues,
} from "./capture-utils"

describe("ideaTitleFromText", () => {
  it("uses the first sentence without its period", () => {
    expect(ideaTitleFromText("Most founders manage content on inspiration. They post when they feel like it.")).toBe(
      "Most founders manage content on inspiration"
    )
  })

  it("reads past short abbreviations", () => {
    expect(ideaTitleFromText("E.g. hiring for skills instead of ownership. More later.")).toBe(
      "E.g. hiring for skills instead of ownership"
    )
  })

  it("takes the first line of a multi-line note, unless it's only a label", () => {
    expect(ideaTitleFromText("Stop boosting posts\nBuild a testing system instead.")).toBe("Stop boosting posts")
    expect(ideaTitleFromText("Idea:\nHire for ownership, not skills")).toBe("Idea: Hire for ownership, not skills")
  })

  it("cuts long text on a word boundary", () => {
    const title = ideaTitleFromText("word ".repeat(40))
    expect(title.length).toBeLessThanOrEqual(90)
    expect(title.endsWith("…")).toBe(true)
    expect(title).not.toMatch(/\s…$/)
  })

  it("returns an empty string for blank input", () => {
    expect(ideaTitleFromText("  \n ")).toBe("")
  })
})

describe("metric drafts", () => {
  it("starts blank and knows when nothing was entered", () => {
    const draft = emptyMetricDraft()
    expect(Object.values(draft).every((v) => v === null)).toBe(true)
    expect(hasAnyMetric(draft)).toBe(false)
    expect(hasAnyMetric({ ...draft, saves: 3 })).toBe(true)
  })

  it("saves counters as whole numbers and keeps watch time / retention nullable", () => {
    const values = toMetricValues({ ...emptyMetricDraft(), views: 1200.6, likes: -4, avg_retention: 130 })
    expect(values.views).toBe(1201)
    expect(values.likes).toBe(0)
    expect(values.reach).toBe(0)
    expect(values.watch_time_seconds).toBeNull()
    expect(values.avg_retention).toBe(100)
  })

  it("pre-fills from a snapshot", () => {
    const metric = buildRow("content_metrics", { content_item_id: "i1", views: 900, reach: 800, likes: 40, avg_retention: 35.5 }, "u")
    const draft = draftFromSnapshot(metric)
    expect(draft.views).toBe(900)
    expect(draft.avg_retention).toBe(35.5)
    expect(draft.watch_time_seconds).toBeNull()
  })

  it("computes live rates with the Analytics formulas", () => {
    const rates = draftRates({ ...emptyMetricDraft(), reach: 1000, likes: 50, comments: 10, shares: 20, saves: 20, profile_visits: 40, followers_gained: 10 })
    expect(rates.engagement_rate).toBe(10)
    expect(rates.share_rate).toBe(2)
    expect(rates.follower_conversion_rate).toBe(25)
    expect(rates.lead_conversion_rate).toBe(0)
  })
})

describe("urls and formats", () => {
  it("adds https:// and validates hosts", () => {
    expect(normalizeUrl("facebook.com/raf/posts/1")).toBe("https://facebook.com/raf/posts/1")
    expect(normalizeUrl("  ")).toBe("")
    expect(isValidUrl("")).toBe(true)
    expect(isValidUrl("facebook.com/raf")).toBe(true)
    expect(isValidUrl("not a link")).toBe(false)
    expect(isValidUrl("ftp://files.example.com")).toBe(false)
  })

  it("treats video and live formats (or TikTok / YouTube without a format) as video", () => {
    expect(isVideoContent("facebook", { category: "video" })).toBe(true)
    expect(isVideoContent("tiktok", { category: "text" })).toBe(false)
    expect(isVideoContent("youtube", null)).toBe(true)
    expect(isVideoContent("linkedin", undefined)).toBe(false)
  })
})
