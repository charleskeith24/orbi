/**
 * End to end on the realistic exports in ./fixtures: bytes → CSV → preset → mapping → rows →
 * matches against the demo workspace → bootstrap through the real domain operations → re-import.
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { createDemoDatabase } from "@/lib/data/seed"
import { logMetrics, logPublishedPost, useDataStore } from "@/lib/store"
import type { Database } from "@/lib/types"
import { autoMapColumns, buildImportSnapshot, importCandidates, planImport, readImportRows, summarizeImport } from "./analytics-import"
import { bootstrapItemValues, planBootstrap } from "./bootstrap"
import { decodeCsvBytes, readCsvTable } from "./csv"
import { detectPreset } from "./presets"

const USER = "user-fixtures"
const NOW = new Date(2026, 8, 14, 9, 0)

const FIXTURES = [
  "meta-facebook-posts.csv",
  "meta-instagram-posts.csv",
  "tiktok-studio-content.csv",
  "youtube-table-data.csv",
  "manual-log-excel-eu.csv",
] as const

function fixtureTable(name: string) {
  const decoded = decodeCsvBytes(new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url))))
  if (!decoded.ok) throw new Error(`${name}: ${decoded.code}`)
  const read = readCsvTable(decoded.text)
  if (!read.ok) throw new Error(`${name}: ${read.error}`)
  return read.table
}

function load(name: string, db: Database = createDemoDatabase(USER, NOW)) {
  const table = fixtureTable(name)
  const detection = detectPreset(table.headers, table.rows)
  const preset = detection?.preset ?? null
  const mapping = autoMapColumns(table.headers, preset)
  const rows = readImportRows(table, mapping, { preset, reference: NOW })
  const candidates = importCandidates(db)
  const plan = planImport(rows, candidates, { platform: preset?.platform ?? null })
  return { table, detection, preset, mapping, rows, candidates, plan, summary: summarizeImport(plan) }
}

const statuses = (plan: ReturnType<typeof load>["plan"]) => plan.map((p) => p.match.status)

describe("fixtures", () => {
  it("Meta Business Suite · Facebook posts (BOM, CRLF, quoted captions with commas, quotes and line breaks)", () => {
    const r = load("meta-facebook-posts.csv")
    expect(r.table.headers[0]).toBe("Post ID")
    expect(r.detection).toMatchObject({ preset: { id: "meta_facebook" }, host: "facebook.com" })
    expect(r.detection?.headers).toEqual(expect.arrayContaining(["Permalink", "Publish time", "Reactions, Comments and Shares"]))
    expect(r.table.headers[r.mapping.likes ?? -1]).toBe("Reactions")
    expect(r.table.headers[r.mapping.watch_time_seconds ?? -1]).toBe("Seconds viewed")

    expect(r.rows[0]).toMatchObject({
      title: "Stop boosting posts. Do this instead.",
      metrics: { views: 24310, reach: 15902, likes: 902, comments: 188, shares: 56, link_clicks: 211 },
    })
    expect(r.rows[0].published?.getTime()).toBe(new Date(2026, 5, 16, 20, 30).getTime())
    expect(r.rows[1].metrics.watch_time_seconds).toBe(1742380)
    expect(r.rows[3].caption).toContain('"25 minutes max"')
    expect(r.rows[5].metrics.views).toBeUndefined()

    expect(statuses(r.plan)).toEqual(["matched", "matched", "matched", "unmatched", "unmatched", "unmatched"])
    for (const { match } of r.plan.slice(0, 3)) {
      expect(match.via).toBe("title")
      expect(r.candidates.find((c) => c.id === match.itemId)?.platform).toBe("facebook")
    }
  })

  it("Meta Business Suite · Instagram posts (captions as titles, post types, a post without caption)", () => {
    const r = load("meta-instagram-posts.csv")
    expect(r.detection).toMatchObject({ preset: { id: "meta_instagram" }, host: "instagram.com", postType: "IG carousel" })
    expect(r.rows[0]).toMatchObject({
      title: "Offer > Ads: the 5-part offer checklist 👇",
      metrics: { views: 31208, reach: 12944, likes: 1302, shares: 214, followers_gained: 86, comments: 57, saves: 903 },
    })
    expect(r.rows[1].caption).toContain('Comment "PROMPTS"')
    expect(r.rows[5]).toMatchObject({ title: "", url: "https://www.instagram.com/p/DOm4Qr5St6U/" })
    expect(statuses(r.plan)).toEqual(["matched", "matched", "matched", "unmatched", "unmatched", "unmatched"])
  })

  it("TikTok Studio content file (hashtag captions, same title on two platforms)", () => {
    const r = load("tiktok-studio-content.csv")
    expect(r.detection).toMatchObject({ preset: { id: "tiktok_studio" }, host: "tiktok.com" })
    expect(statuses(r.plan)).toEqual(["matched", "matched", "matched", "matched", "unmatched", "unmatched", "unmatched"])
    // "Monday Marketing Lesson: how to read an ads breakdown…" is on TikTok and Facebook — the TikTok one wins.
    expect(r.candidates.find((c) => c.id === r.plan[2].match.itemId)?.platform).toBe("tiktok")
    expect(r.rows[0].published?.getTime()).toBe(new Date(2026, 7, 22, 18, 30, 11).getTime())
    expect(r.rows[6].metrics).toEqual({ likes: 412, shares: 21, views: 7954 })
  })

  it("YouTube Studio Table data.csv (Total row, video IDs, watch time in hours)", () => {
    const r = load("youtube-table-data.csv")
    expect(r.detection).toMatchObject({ preset: { id: "youtube_studio" }, host: "youtube.com" })
    expect(statuses(r.plan)).toEqual(["totals", "matched", "matched", "matched", "matched", "unmatched"])
    expect(r.rows[1]).toMatchObject({
      url: "https://www.youtube.com/watch?v=Hq3vT9xLm2A",
      metrics: { views: 12408, followers_gained: 104, likes: 702, comments: 131, shares: 64, avg_retention: 31.49 },
    })
    expect(r.rows[1].metrics.watch_time_seconds).toBeCloseTo(1612.7302 * 3600, 3)
    expect(r.rows[1].published?.getTime()).toBe(new Date(2026, 7, 13).getTime())
  })

  it("a manual log saved from Excel with European settings (sep=;, day-first dates, dot thousands)", () => {
    const r = load("manual-log-excel-eu.csv")
    expect(r.detection).toBeNull()
    expect(r.table.delimiter).toBe(";")
    expect(r.rows[0].published?.getTime()).toBe(new Date(2026, 4, 18).getTime())
    expect(r.rows[1]).toMatchObject({
      title: "Stop boosting posts; do this instead",
      platform: "tiktok",
      metrics: { views: 1204330, likes: 58210, comments: 1402, avg_retention: 41.5 },
    })
    expect(statuses(r.plan)).toEqual(["matched", "matched", "unmatched"])
  })
})

describe("bootstrap through the domain operations", () => {
  beforeEach(() => {
    useDataStore.setState({ db: createDemoDatabase(USER, NOW), status: "ready", userId: USER, adapter: null })
  })

  it.each(FIXTURES)("creates each unmatched post once, with its snapshot, and re-imports into it — %s", (name) => {
    const first = load(name, useDataStore.getState().db)
    const boot = planBootstrap(first.plan, first.candidates, { platform: first.preset?.platform ?? null })
    const creatable = boot.filter((b) => !b.problem)
    expect(creatable.length).toBe(first.summary.unmatched)

    const before = useDataStore.getState().db
    const created: string[] = []
    for (const entry of creatable) {
      const post = logPublishedPost({ item: bootstrapItemValues(entry, { fallbackTitle: "Untitled post", fallbackDate: "2026-09-14", notes: `CSV import · ${name}` }) })
      logMetrics(post.id, buildImportSnapshot(entry.row, undefined, "2026-09-14", `CSV import · ${name}`))
      created.push(post.id)
    }

    const after = useDataStore.getState().db
    expect(after.content_items.length).toBe(before.content_items.length + creatable.length)
    expect(after.content_metrics.length).toBe(before.content_metrics.length + creatable.length)
    for (const [i, id] of created.entries()) {
      const post = after.content_items.find((c) => c.id === id)
      expect(post).toMatchObject({ stage: "published", platform: creatable[i].platform, published_url: creatable[i].url })
      expect(after.content_briefs.some((b) => b.content_item_id === id)).toBe(true)
      expect(after.content_metrics.filter((m) => m.content_item_id === id)).toHaveLength(1)
    }

    // Import the same file again: every row now finds its post and nothing is offered for creation.
    const again = load(name, after)
    expect(again.summary.unmatched).toBe(0)
    expect(again.summary.matched).toBe(first.summary.matched + creatable.length)
    expect(planBootstrap(again.plan, again.candidates, { platform: again.preset?.platform ?? null })).toHaveLength(0)
  })
})
