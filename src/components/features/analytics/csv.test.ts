import { describe, expect, it } from "vitest"
import { csvCell, toCsv } from "./csv"
import { postsCsv } from "./post-csv"
import { makeRow } from "./test-fixtures"

describe("csvCell", () => {
  it("escapes per RFC 4180", () => {
    expect(csvCell(null)).toBe("")
    expect(csvCell(undefined)).toBe("")
    expect(csvCell(12.5)).toBe("12.5")
    expect(csvCell(Number.NaN)).toBe("")
    expect(csvCell("plain")).toBe("plain")
    expect(csvCell("a,b")).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"')
    expect(csvCell(" padded")).toBe('" padded"')
  })

  it("neutralises text a spreadsheet would run as a formula", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)")
    expect(csvCell("-5 hooks that work")).toBe("'-5 hooks that work")
    expect(csvCell("@raf")).toBe("'@raf")
    expect(csvCell(-5)).toBe("-5")
  })
})

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv([{ a: "x", b: 1 }], [
      { header: "A", value: (r) => r.a },
      { header: "B, total", value: (r) => r.b },
    ])
    expect(csv).toBe('A,"B, total"\r\nx,1')
  })
})

describe("postsCsv", () => {
  it("exports every column with raw counts, rounded rates and tier labels", () => {
    const measured = makeRow({
      title: "Stop boosting and start testing",
      publishedAt: new Date(2026, 8, 7, 20, 5),
      platform: "tiktok",
      metric: { views: 12000, reach: 9000, likes: 600, comments: 90, shares: 60, saves: 150, avg_retention: 41.237 },
      tier: { tier: "winner", ratio: 2.456 },
    })
    const unmeasured = makeRow({ title: "No numbers yet", publishedAt: new Date(2026, 8, 8, 9), metric: null })
    const [header, first, second] = postsCsv([measured, unmeasured], { pillars: new Map(), formats: new Map() }).split("\r\n")
    const columns = header.split(",")
    expect(columns).toContain("Engagement rate (%)")
    expect(columns).toContain("Watch time (sec)")
    expect(columns).toContain("Tier")
    const cells = first.split(",")
    expect(cells[0]).toBe("Stop boosting and start testing")
    expect(first).toContain("TikTok,2026-09-07 20:05")
    expect(cells[columns.indexOf("Views")]).toBe("12000")
    expect(cells[columns.indexOf("Avg. retention (%)")]).toBe("41.24")
    expect(cells[columns.indexOf("Engagement rate (%)")]).toBe("10")
    expect(cells[columns.indexOf("Tier")]).toBe("Winner")
    expect(cells[columns.indexOf("vs platform average (x)")]).toBe("2.46")
    expect(second.split(",")[columns.indexOf("Tier")]).toBe("No analytics")
  })
})
