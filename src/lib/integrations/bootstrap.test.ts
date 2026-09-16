import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { ContentItem, InsertRow } from "@/lib/types"
import { importCandidates, planImport, type ImportRow, type PlannedImportRow, type RowMatch } from "./analytics-import"
import { bootstrapItemValues, planBootstrap } from "./bootstrap"

const item = (values: InsertRow<"content_items">): ContentItem => buildRow("content_items", values, "user")

const LIVE = item({
  id: "live",
  title: "Hiring your first editor",
  platform: "instagram",
  stage: "published",
  published_at: new Date(2026, 7, 20, 12).toISOString(),
  published_url: "https://www.instagram.com/p/LIVE1/",
})
const DRAFT = item({ id: "draft", title: "Draft on TikTok", platform: "tiktok", stage: "scripting", published_url: "https://www.tiktok.com/@me/video/1" })
const candidates = importCandidates({ content_items: [LIVE, DRAFT] })

const row = (index: number, values: Partial<ImportRow>): ImportRow => ({
  index,
  line: index + 2,
  contentId: "",
  title: "",
  caption: "",
  url: "",
  platform: null,
  published: null,
  metrics: { views: 100 },
  invalid: [],
  isTotal: false,
  ...values,
})
const UNMATCHED: RowMatch = { status: "unmatched", itemId: null, candidateIds: [], via: null, reason: { code: "no_match" } }
const OPTIONS = { fallbackTitle: "Instagram post · Sep 14, 2026", fallbackDate: "2026-09-14", notes: "CSV import · test.csv" }

describe("planBootstrap", () => {
  it("offers only rows that match nothing, and says why a row can't create a post", () => {
    const rows = [
      row(0, { title: "Hiring your first editor" }), // matches the live post
      row(1, { url: "https://www.tiktok.com/@me/video/1" }), // a draft — publish it instead
      row(2, { title: "Brand new reel", url: "instagram.com/reel/NEW1" }),
      row(3, { title: "Brand new reel (again)", url: "https://www.instagram.com/p/NEW1/" }), // same post as line 4
      row(4, { title: "No numbers", metrics: {} }),
      row(5, { title: "Where was this posted?" }),
      row(6, { contentId: "unknown-id" }),
      row(7, { title: "Same caption", platform: "tiktok", published: new Date(2026, 8, 1, 18) }),
      row(8, { title: "Same caption", platform: "tiktok", published: new Date(2026, 8, 1, 21) }), // same day → same post
      row(9, { title: "Same caption", platform: "tiktok", published: new Date(2026, 8, 2, 18) }), // next day → another post
    ]
    const plan = planImport(rows, candidates, { platform: null })
    expect(plan.map((p) => p.match.status)).toEqual([
      "matched",
      "unpublished",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
      "unmatched",
    ])

    const boot = planBootstrap(plan, candidates, { platform: null })
    expect(boot.map((b) => [b.row.line, b.problem])).toEqual([
      [4, null],
      [5, "in_file"],
      [6, "no_values"],
      [7, "no_platform"],
      [8, "no_key"],
      [9, null],
      [10, "in_file"],
      [11, null],
    ])
    expect(boot[0]).toMatchObject({ platform: "instagram", url: "https://instagram.com/reel/NEW1", title: "Brand new reel" })
    expect(boot[1].firstLine).toBe(4)
    expect(boot[6].firstLine).toBe(9)
    // "Posts are from" supplies the platform the row doesn't name.
    expect(planBootstrap(plan, candidates, { platform: "facebook" }).find((b) => b.row.line === 7)?.problem).toBeNull()
  })

  it("never offers a post that already exists (same link, or same title on the same platform)", () => {
    const plan: PlannedImportRow[] = [
      { row: row(0, { title: "Anything", url: "https://instagram.com/reel/LIVE1" }), match: UNMATCHED },
      { row: row(1, { title: "Hiring your FIRST editor!", platform: "instagram" }), match: UNMATCHED },
      { row: row(2, { title: "Hiring your first editor", platform: "tiktok" }), match: UNMATCHED },
    ]
    expect(planBootstrap(plan, candidates, { platform: null }).map((b) => [b.problem, b.existingId])).toEqual([
      ["exists", "live"],
      ["exists", "live"],
      [null, null],
    ])
  })
})

describe("bootstrapItemValues", () => {
  it("creates a published post with the file's link, date and title (or fallbacks)", () => {
    const plan = planImport([row(0, { url: "instagram.com/p/NEW9" })], candidates, { platform: null })
    const [entry] = planBootstrap(plan, candidates, { platform: null })
    expect(entry.problem).toBeNull()

    const values = bootstrapItemValues(entry, OPTIONS)
    expect(values).toMatchObject({
      title: "Instagram post · Sep 14, 2026",
      platform: "instagram",
      stage: "published",
      published_url: "https://instagram.com/p/NEW9",
      notes: "CSV import · test.csv",
    })
    expect(new Date(values.published_at as string).getTime()).toBe(new Date(2026, 8, 14, 12).getTime())

    const dated = bootstrapItemValues({ ...entry, title: "Real title", publishedAt: new Date(2026, 8, 3, 18, 30) }, OPTIONS)
    expect(dated).toMatchObject({ title: "Real title", published_at: new Date(2026, 8, 3, 18, 30).toISOString() })
    expect(() => bootstrapItemValues({ ...entry, problem: "no_values" }, OPTIONS)).toThrow()
  })
})
