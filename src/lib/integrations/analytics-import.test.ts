import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { ContentItem, InsertRow } from "@/lib/types"
import {
  autoMapColumns,
  buildImportSnapshot,
  buildTemplateCsv,
  importCandidates,
  matchImportRow,
  normalizeUrl,
  parseImportDate,
  parseMetricNumber,
  parsePlatform,
  planImport,
  readImportRows,
  summarizeImport,
  TEMPLATE_HEADERS,
  type ImportRow,
} from "./analytics-import"
import { readCsvTable } from "./csv"

const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).toISOString()
const item = (values: InsertRow<"content_items">): ContentItem => buildRow("content_items", values, "user")

const A = item({ id: "a", title: "How we cut CAC by 40%", platform: "facebook", stage: "published", published_at: at(9, 1), published_url: "https://facebook.com/northbound/posts/1" })
const B = item({ id: "b", title: "How we cut CAC by 40%", platform: "tiktok", stage: "published", published_at: at(9, 2) })
const C = item({ id: "c", title: "Hiring your first editor", platform: "linkedin", stage: "published", published_at: at(8, 20), published_url: "https://www.linkedin.com/posts/raf_hiring-123" })
const D = item({ id: "d", title: "Draft idea", platform: "instagram", stage: "scripting" })
const candidates = importCandidates({ content_items: [A, B, C, D] })

const row = (values: Partial<ImportRow>): ImportRow => ({
  index: 0,
  line: 2,
  contentId: "",
  title: "",
  url: "",
  platform: null,
  published: null,
  metrics: { views: 100 },
  invalid: [],
  ...values,
})
const none = { platform: null }

describe("autoMapColumns", () => {
  it("maps the template exactly", () => {
    const mapping = autoMapColumns(TEMPLATE_HEADERS)
    expect(mapping).toMatchObject({ content_id: 0, title: 1, url: 2, platform: 3, published: 4, views: 5 })
    expect(mapping.watch_time_seconds).toBe(TEMPLATE_HEADERS.indexOf("Watch time (sec)"))
    expect(mapping.avg_retention).toBe(TEMPLATE_HEADERS.indexOf("Avg. retention %"))
  })

  it("reads a platform export with different names", () => {
    const headers = ["Post ID", "Permalink", "Title", "Description", "Publish time", "Reach", "Impressions", "Reactions", "Comments", "Shares", "Profile views"]
    const mapping = autoMapColumns(headers)
    expect(mapping).toMatchObject({ url: 1, title: 2, published: 4, reach: 5, views: 6, likes: 7, comments: 8, shares: 9, profile_visits: 10 })
    expect(mapping.content_id).toBeUndefined()
  })

  it("reads this app's Post Performance export", () => {
    const headers = ["Title", "Platform", "Published", "Views", "Watch time (sec) (sec)", "Avg. retention % (%)", "Engagements", "Snapshot date", "URL", "Content ID"]
    expect(autoMapColumns(headers)).toMatchObject({
      title: 0,
      platform: 1,
      published: 2,
      views: 3,
      watch_time_seconds: 4,
      avg_retention: 5,
      url: 8,
      content_id: 9,
    })
  })
})

describe("value parsing", () => {
  it("reads numbers in common export formats", () => {
    expect(parseMetricNumber("12,400", "views")).toBe(12400)
    expect(parseMetricNumber("12.4k", "views")).toBe(12400)
    expect(parseMetricNumber("1.234", "views")).toBe(1234)
    expect(parseMetricNumber("45.5%", "avg_retention")).toBe(45.5)
    expect(parseMetricNumber("4,5", "avg_retention")).toBe(4.5)
    expect(parseMetricNumber("1:35", "watch_time_seconds")).toBe(95)
    expect(parseMetricNumber("", "views")).toBeNull()
    expect(parseMetricNumber("—", "views")).toBeNull()
    expect(parseMetricNumber("abc", "views")).toBeUndefined()
    expect(parseMetricNumber("-5", "views")).toBeUndefined()
    expect(parseMetricNumber("-5", "followers_gained")).toBe(-5)
    expect(parseMetricNumber("120", "avg_retention")).toBeUndefined()
  })

  it("recognises platforms and normalises post URLs", () => {
    expect(parsePlatform("IG")).toBe("instagram")
    expect(parsePlatform("Facebook Page")).toBe("facebook")
    expect(parsePlatform("Twitter")).toBe("x")
    expect(parsePlatform("Snapchat")).toBeNull()
    expect(normalizeUrl("https://www.youtube.com/watch?v=abc&t=10")).toBe(normalizeUrl("youtu.be/abc"))
    expect(normalizeUrl("https://m.facebook.com/page/posts/123/")).toBe(normalizeUrl("facebook.com/page/posts/123"))
  })

  it("reads dates, day-first when the first part is over 12", () => {
    expect(parseImportDate("2026-09-01")?.getDate()).toBe(1)
    expect(parseImportDate("9/1/2026")?.getMonth()).toBe(8)
    const dayFirst = parseImportDate("13/01/2026")
    expect([dayFirst?.getDate(), dayFirst?.getMonth()]).toEqual([13, 0])
    expect(parseImportDate("soon")).toBeNull()
  })
})

describe("matching", () => {
  it("matches by content ID, then URL, then title", () => {
    expect(matchImportRow(row({ contentId: "c" }), candidates, none)).toMatchObject({ status: "matched", itemId: "c", via: "id" })
    expect(matchImportRow(row({ url: "linkedin.com/posts/raf_hiring-123/" }), candidates, none)).toMatchObject({ status: "matched", itemId: "c", via: "url" })
    expect(matchImportRow(row({ title: "hiring your FIRST editor!" }), candidates, none)).toMatchObject({ status: "matched", itemId: "c", via: "title" })
  })

  it("matches captions that start with the title", () => {
    expect(matchImportRow(row({ title: "Hiring your first editor — here's what I learned" }), candidates, none)).toMatchObject({ itemId: "c" })
  })

  it("uses platform and publish day to tell apart repeated titles", () => {
    const title = "How we cut CAC by 40%"
    expect(matchImportRow(row({ title }), candidates, none)).toMatchObject({ status: "ambiguous", candidateIds: ["a", "b"] })
    expect(matchImportRow(row({ title, platform: "tiktok" }), candidates, none)).toMatchObject({ status: "matched", itemId: "b" })
    expect(matchImportRow(row({ title }), candidates, { platform: "facebook" })).toMatchObject({ status: "matched", itemId: "a" })
    expect(matchImportRow(row({ title, published: new Date(2026, 8, 1) }), candidates, none)).toMatchObject({ status: "matched", itemId: "a" })
    expect(matchImportRow(row({ title }), candidates, { platform: "youtube" }).status).toBe("unmatched")
  })

  it("reports unpublished and unknown posts", () => {
    expect(matchImportRow(row({ title: "Draft idea" }), candidates, none).status).toBe("unpublished")
    expect(matchImportRow(row({ title: "Something else" }), candidates, none).status).toBe("unmatched")
    expect(matchImportRow(row({}), candidates, none).status).toBe("no_key")
  })

  it("plans duplicates, empty rows and manual choices", () => {
    const rows = [
      row({ index: 0, line: 2, contentId: "c" }),
      row({ index: 1, line: 3, title: "Hiring your first editor" }),
      row({ index: 2, line: 4, contentId: "a", metrics: {} }),
      row({ index: 3, line: 5, title: "How we cut CAC by 40%" }),
      row({ index: 4, line: 6, contentId: "b" }),
    ]
    const plan = planImport(rows, candidates, none, new Map([[3, "a"], [4, null]]))
    expect(plan.map((p) => p.match.status)).toEqual(["matched", "duplicate", "no_values", "matched", "skipped"])
    expect(plan[3].match.via).toBe("manual")
    expect(summarizeImport(plan)).toMatchObject({ total: 5, matched: 2, duplicate: 1, no_values: 1, skipped: 1 })
  })
})

describe("snapshots and template", () => {
  it("carries metrics that aren't in the file over from the latest snapshot", () => {
    const previous = buildRow("content_metrics", { content_item_id: "c", views: 50, leads: 5, watch_time_seconds: 900 }, "user")
    const snapshot = buildImportSnapshot(row({ metrics: { views: 1000.4, avg_retention: 48.26 } }), previous, "2026-09-13", "CSV import")
    expect(snapshot).toMatchObject({ views: 1000, leads: 5, watch_time_seconds: 900, avg_retention: 48.3, source: "import", recorded_at: "2026-09-13" })
    expect(buildImportSnapshot(row({ metrics: { likes: 3 } }), undefined, "2026-09-13", "").watch_time_seconds).toBeNull()
  })

  it("builds a template of published posts that re-imports by content ID", () => {
    const read = readCsvTable(buildTemplateCsv(candidates))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    // Newest first; the unpublished draft is left out.
    expect(read.table.rows.map((r) => r[0])).toEqual(["b", "a", "c"])
    const rows = readImportRows(read.table, autoMapColumns(read.table.headers))
    const plan = planImport(rows, candidates, none)
    expect(plan.every((p) => p.match.status === "no_values" && p.match.via === "id")).toBe(true)
  })
})
