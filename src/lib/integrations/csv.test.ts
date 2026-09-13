import { describe, expect, it } from "vitest"
import { csvCell, detectDelimiter, parseCsv, readCsvTable, toCsv } from "./csv"

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    const text = 'a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n'
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", "2"],
    ])
  })

  it("keeps line breaks inside quoted fields", () => {
    expect(parseCsv('title\n"line 1\nline 2"')).toEqual([["title"], ["line 1\nline 2"]])
  })

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"])
  })
})

describe("detectDelimiter", () => {
  it("picks the delimiter used on the header line, ignoring quoted text", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";")
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t")
    expect(detectDelimiter('"x,y";b;c\n1;2;3')).toBe(";")
    expect(detectDelimiter("title")).toBe(",")
  })
})

describe("readCsvTable", () => {
  it("names blank headers, suffixes duplicates and pads short rows", () => {
    const result = readCsvTable("Views,,Views\n1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.table.headers).toEqual(["Views", "Column 2", "Views (2)"])
    expect(result.table.rows).toEqual([["1", "", ""]])
  })

  it("rejects empty and header-only files", () => {
    expect(readCsvTable("").ok).toBe(false)
    expect(readCsvTable("a,b\n").ok).toBe(false)
  })
})

describe("csvCell / toCsv", () => {
  it("quotes when needed and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""')
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)")
    expect(csvCell(null)).toBe("")
    expect(toCsv([["a", 1], [null, "x"]])).toBe("a,1\r\n,x")
  })
})
