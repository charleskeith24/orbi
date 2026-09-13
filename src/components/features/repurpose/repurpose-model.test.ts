import { describe, expect, it } from "vitest"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import type { Database, InsertRow, Row, TableName } from "@/lib/types"
import {
  draftToSections,
  recommendedTypes,
  repurposeTileStates,
  reusableSuggestionRow,
  sectionsText,
  sourceTextFor,
} from "./repurpose-model"

const NOW = new Date(2026, 8, 10, 12)
type Meta = { created_at?: string; updated_at?: string }
let seq = 0

function add<T extends TableName>(db: Database, table: T, values: InsertRow<T> & Meta = {} as InsertRow<T> & Meta): Row<T> {
  const id = (values as { id?: string }).id ?? `${table}-${++seq}`
  const row = buildRow(table, { ...values, id } as InsertRow<T>, "user-test", NOW)
  ;(db[table] as unknown as Row<T>[]).push(row)
  return row
}

describe("repurposeTileStates", () => {
  it("merges created rows with parent_id children and keeps the newest open suggestion", () => {
    const db = emptyDatabase()
    const source = add(db, "content_items", { platform: "facebook", stage: "published" })
    const viaRow = add(db, "content_items", { parent_id: source.id, repurpose_type: "carousel", platform: "instagram", created_at: "2026-09-01T00:00:00.000Z" })
    add(db, "content_repurposing", { source_item_id: source.id, target_item_id: viaRow.id, type: "carousel", status: "created" })
    const childOnly = add(db, "content_items", { parent_id: source.id, repurpose_type: "carousel", platform: "instagram", created_at: "2026-09-03T00:00:00.000Z" })
    add(db, "content_repurposing", { source_item_id: source.id, type: "x_thread", status: "suggested", updated_at: "2026-09-01T00:00:00.000Z" })
    const newer = add(db, "content_repurposing", { source_item_id: source.id, type: "x_thread", status: "drafted", updated_at: "2026-09-02T00:00:00.000Z" })
    add(db, "content_repurposing", { source_item_id: source.id, type: "newsletter", status: "dismissed" })

    const states = repurposeTileStates(db, source)
    expect(states.carousel.created.map((i) => i.id)).toEqual([childOnly.id, viaRow.id])
    expect(states.x_thread.suggestion?.id).toBe(newer.id)
    expect(states.newsletter.suggestion).toBeNull()
    expect(states.facebook_post.samePlatform).toBe(true)
    expect(states.follow_up.platform).toBe("facebook")
    expect(states.follow_up.samePlatform).toBe(false)
  })
})

describe("reusableSuggestionRow", () => {
  it("prefers an open suggestion, then a dismissed one, never a created row", () => {
    const db = emptyDatabase()
    const created = add(db, "content_repurposing", { source_item_id: "s", target_item_id: "t", type: "carousel", status: "created" })
    expect(reusableSuggestionRow(db, "s", "carousel")).toBeNull()
    const dismissed = add(db, "content_repurposing", { source_item_id: "s", type: "carousel", status: "dismissed", updated_at: "2026-09-05T00:00:00.000Z" })
    expect(reusableSuggestionRow(db, "s", "carousel")?.id).toBe(dismissed.id)
    const open = add(db, "content_repurposing", { source_item_id: "s", type: "carousel", status: "suggested", updated_at: "2026-09-01T00:00:00.000Z" })
    expect(reusableSuggestionRow(db, "s", "carousel")?.id).toBe(open.id)
    expect(created.status).toBe("created")
  })
})

describe("sourceTextFor", () => {
  it("uses the current script body", () => {
    const db = emptyDatabase()
    const item = add(db, "content_items", { title: "Title", hook: "Hook" })
    add(db, "content_scripts", { content_item_id: item.id, is_current: false, body: "Old version" })
    const script = add(db, "content_scripts", { content_item_id: item.id, is_current: true, body: "Stop boosting posts.\n\nFix the offer first." })
    const text = sourceTextFor(db, item)
    expect(text.origin).toBe("script")
    expect(text.script?.id).toBe(script.id)
    expect(text.text).toBe("Stop boosting posts.\n\nFix the offer first.")
    expect(text.words).toBe(7)
  })

  it("falls back to the brief, hook first", () => {
    const db = emptyDatabase()
    const item = add(db, "content_items", { title: "Title", hook: "Stop boosting posts" })
    add(db, "content_briefs", { content_item_id: item.id, main_message: "Fix the offer", supporting_points: ["Margin", "CPA trend"] })
    expect(sourceTextFor(db, item)).toMatchObject({ origin: "brief", text: "Stop boosting posts\n\nFix the offer\n\nMargin\n\nCPA trend" })
  })

  it("uses the idea when the brief is empty, then the hook, then the title", () => {
    const db = emptyDatabase()
    const idea = add(db, "content_ideas", { description: "Why offers win", talking_points: ["Point one"] })
    const linked = add(db, "content_items", { title: "Offer post", idea_id: idea.id })
    add(db, "content_briefs", { content_item_id: linked.id })
    expect(sourceTextFor(db, linked)).toMatchObject({ origin: "brief", text: "Offer post\n\nWhy offers win\n\nPoint one" })
    const hookOnly = add(db, "content_items", { title: "T", hook: "A hook" })
    expect(sourceTextFor(db, hookOnly)).toMatchObject({ origin: "hook", text: "A hook" })
    const bare = add(db, "content_items", { title: "Just a title" })
    expect(sourceTextFor(db, bare)).toMatchObject({ origin: "title", text: "Just a title", words: 3 })
  })
})

describe("draftToSections", () => {
  it("puts a one-line draft into the first section", () => {
    const sections = draftToSections("Just the hook.", "linkedin_post")
    expect(sections).toHaveLength(6)
    expect(sections[0]).toEqual({ key: "hook", label: "Hook", content: "Just the hook." })
    expect(sections.slice(1).every((s) => s.content === "")).toBe(true)
  })

  it("keeps the first and last paragraphs single and spreads the rest over the middle", () => {
    expect(draftToSections("H\n\nA\n\nB\n\nC\n\nCTA", "x_thread").map((s) => s.content)).toEqual(["H", "A\n\nB\n\nC", "CTA"])
    expect(draftToSections("1\n\n2\n\n3\n\n4\n\n5\n\n6\n\n7", "facebook_post").map((s) => s.content)).toEqual(["1", "2\n\n3", "4\n\n5", "6", "7"])
  })

  it("reads labelled drafts", () => {
    const sections = draftToSections("Hook:\nStop.\nStory / Problem\nWe lost.\n\nCTA\nComment below", "facebook_post")
    expect(sections.map((s) => s.content)).toEqual(["Stop.", "We lost.", "", "", "Comment below"])
  })

  it("joins everything for single-section formats and survives empty drafts", () => {
    expect(draftToSections("a\n\nb", "custom")).toEqual([{ key: "body", label: "Body", content: "a\n\nb" }])
    expect(draftToSections("   ", "carousel").every((s) => s.content === "")).toBe(true)
    expect(sectionsText(draftToSections("One\n\nTwo", "facebook_post"))).toBe("One\n\nTwo")
  })
})

describe("recommendedTypes", () => {
  it("leads with a follow-up for winners, then one open type per active platform", () => {
    const db = emptyDatabase()
    const source = add(db, "content_items", { platform: "tiktok", stage: "published" })
    add(db, "content_repurposing", { source_item_id: source.id, type: "linkedin_post", status: "suggested" })
    const states = repurposeTileStates(db, source)
    const active = ["facebook", "instagram", "linkedin", "tiktok", "youtube"] as const
    expect(recommendedTypes(states, { activePlatforms: [...active], winner: true })).toEqual(["follow_up", "facebook_post", "carousel"])
    expect(recommendedTypes(states, { activePlatforms: [...active], winner: false })).toEqual(["facebook_post", "carousel", "youtube_short"])
  })

  it("never recommends a type on the source's own platform", () => {
    const db = emptyDatabase()
    const source = add(db, "content_items", { platform: "facebook" })
    const picks = recommendedTypes(repurposeTileStates(db, source), { activePlatforms: ["facebook", "linkedin"], winner: false })
    expect(picks).toEqual(["linkedin_post"])
  })
})
