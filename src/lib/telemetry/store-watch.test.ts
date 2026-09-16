import { describe, expect, it } from "vitest"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import type { Database, InsertRow } from "@/lib/types"
import { BULK_THRESHOLD, detectKeyActions } from "./store-watch"

const NOW = new Date("2026-09-14T10:00:00.000Z")

const idea = (id: string, values: InsertRow<"content_ideas"> = {}) =>
  buildRow("content_ideas", { id, title: `Secret idea ${id}`, source: "quick_capture", ...values }, "u1", NOW)
const item = (id: string, values: InsertRow<"content_items"> = {}) =>
  buildRow("content_items", { id, title: `Private post ${id}`, platform: "tiktok", stage: "brief", ...values }, "u1", NOW)
const metric = (id: string, itemId: string) =>
  buildRow("content_metrics", { id, content_item_id: itemId, platform: "youtube", views: 1200 }, "u1", NOW)
const db = (patch: Partial<Database> = {}): Database => ({ ...emptyDatabase(), ...patch })

describe("detectKeyActions", () => {
  it("finds nothing when the workspace didn't change", () => {
    const state = db({ content_ideas: [idea("i1")] })
    expect(detectKeyActions(state, state)).toEqual([])
  })

  it("reports a captured idea with its source only", () => {
    const prev = db()
    const next = db({ content_ideas: [idea("i1", { source: "ai_generator" })] })
    expect(detectKeyActions(prev, next)).toEqual([{ name: "idea_captured", props: { source: "ai_generator" } }])
  })

  it("reports new content with platform, stage and whether it came from an idea", () => {
    const prev = db({ content_ideas: [idea("i1")] })
    const next = { ...prev, content_items: [item("c1", { idea_id: "i1", platform: "instagram" }), item("c2")] }
    expect(detectKeyActions(prev, next)).toEqual([
      { name: "content_created", props: { platform: "instagram", stage: "brief", from_idea: true } },
      { name: "content_created", props: { platform: "tiktok", stage: "brief", from_idea: false } },
    ])
  })

  it("counts a logged published post as created and published", () => {
    const prev = db()
    const next = db({ content_items: [item("c1", { stage: "published", platform: "facebook" })] })
    expect(detectKeyActions(prev, next)).toEqual([
      { name: "content_created", props: { platform: "facebook", stage: "published", from_idea: false } },
      { name: "post_published", props: { platform: "facebook" } },
    ])
  })

  it("reports an item moving into a published stage once", () => {
    const draft = item("c1", { stage: "ready_to_post" })
    const prev = db({ content_items: [draft] })
    const published = db({ content_items: [{ ...draft, stage: "published" }] })
    expect(detectKeyActions(prev, published)).toEqual([{ name: "post_published", props: { platform: "tiktok" } }])
    const repurposed = db({ content_items: [{ ...draft, stage: "repurpose" }] })
    expect(detectKeyActions(published, repurposed)).toEqual([])
  })

  it("ignores edits that don't add rows or publish", () => {
    const original = item("c1")
    const prev = db({ content_items: [original], content_ideas: [idea("i1")] })
    const next = { ...prev, content_items: [{ ...original, title: "Renamed", stage: "scripting" as const }] }
    expect(detectKeyActions(prev, next)).toEqual([])
  })

  it("reports logged analytics with the platform", () => {
    const prev = db({ content_items: [item("c1", { stage: "published" })] })
    const next = { ...prev, content_metrics: [metric("m1", "c1")] }
    expect(detectKeyActions(prev, next)).toEqual([{ name: "metrics_logged", props: { platform: "youtube" } }])
  })

  it("treats bulk changes (import, reset, moving to the cloud) as no user action", () => {
    const prev = db()
    const many = Array.from({ length: BULK_THRESHOLD + 1 }, (_, i) => idea(`i${i}`))
    const items = Array.from({ length: BULK_THRESHOLD + 1 }, (_, i) => item(`c${i}`, { stage: "published" }))
    const metrics = items.map((row, i) => metric(`m${i}`, row.id))
    expect(detectKeyActions(prev, db({ content_ideas: many, content_items: items, content_metrics: metrics }))).toEqual([])
  })

  it("never carries titles or other text", () => {
    const prev = db()
    const next = db({ content_ideas: [idea("i1")], content_items: [item("c1", { stage: "published" })], content_metrics: [metric("m1", "c1")] })
    const serialized = JSON.stringify(detectKeyActions(prev, next))
    expect(serialized).not.toMatch(/Secret|Private/)
  })
})
