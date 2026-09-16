import { describe, expect, it } from "vitest"
import { csvCell, decodeCsvBytes, detectDelimiter, isSpreadsheetFileName, MAX_CSV_ROWS, parseCsv, readCsvTable, toCsv } from "./csv"

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
    expect(parseCsv('title\r\n"line 1\r\nline 2"\r\n')).toEqual([["title"], ["line 1\r\nline 2"]])
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

  it("isn't fooled by unquoted commas in a tab file or by a title line", () => {
    expect(detectDelimiter("Title\tViews\nHello, world, again\t5\nBye\t3")).toBe("\t")
    expect(detectDelimiter("Report: Aug 1, 2026 - Aug 31, 2026\nTitle,Views,Likes\nA,1,2\nB,3,4")).toBe(",")
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

  it("rejects empty, header-only and oversized files with a code", () => {
    expect(readCsvTable("")).toMatchObject({ ok: false, code: "empty" })
    expect(readCsvTable("a,b\n")).toMatchObject({ ok: false, code: "no_rows" })
    const big = ["Title,Views", ...Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `Post ${i},${i}`)].join("\n")
    expect(readCsvTable(big)).toMatchObject({ ok: false, code: "too_many_rows", rows: MAX_CSV_ROWS + 1 })
  })

  it("honours Excel's sep= line", () => {
    expect(readCsvTable("sep=;\r\nTitle;Views\r\nA, B;1.204\r\n")).toMatchObject({
      ok: true,
      table: { delimiter: ";", headers: ["Title", "Views"], rows: [["A, B", "1.204"]], headerRow: 0 },
    })
  })

  it("skips report titles above the header row and drops an empty trailing column", () => {
    const result = readCsvTable("Content report\nAug 1 – Aug 31, 2026\n\nTitle,Views,Likes,\nHello,10,2,\nWorld,5,,\n")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.table.headerRow).toBe(2)
    expect(result.table.headers).toEqual(["Title", "Views", "Likes"])
    expect(result.table.rows).toEqual([
      ["Hello", "10", "2"],
      ["World", "5", ""],
    ])
  })
})

describe("decodeCsvBytes", () => {
  const bytes = (...values: number[]) => new Uint8Array(values)
  const utf16le = (text: string, bom: boolean) => {
    const offset = bom ? 2 : 0
    const out = new Uint8Array(offset + text.length * 2)
    if (bom) out.set([0xff, 0xfe])
    for (let i = 0; i < text.length; i++) out[offset + i * 2] = text.charCodeAt(i)
    return out
  }

  it("refuses Excel workbooks and other binary files", () => {
    expect(decodeCsvBytes(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00))).toEqual({ ok: false, code: "spreadsheet" })
    expect(decodeCsvBytes(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00))).toEqual({ ok: false, code: "spreadsheet" })
    expect(decodeCsvBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d))).toEqual({ ok: false, code: "binary" })
    expect(isSpreadsheetFileName("Table data.xlsx")).toBe(true)
    expect(isSpreadsheetFileName("export.XLS")).toBe(true)
    expect(isSpreadsheetFileName("Table data.csv")).toBe(false)
  })

  it("reads UTF-8 (with or without BOM), UTF-16 (with or without BOM) and Windows-1252", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("﻿Title,Views\n"))).toEqual({ ok: true, text: "Title,Views\n", encoding: "utf-8" })
    expect(decodeCsvBytes(utf16le("Title\tViews\r\nCafé\t12\r\n", true))).toEqual({ ok: true, text: "Title\tViews\r\nCafé\t12\r\n", encoding: "utf-16le" })
    expect(decodeCsvBytes(utf16le("Title\tViews\r\n", false))).toMatchObject({ ok: true, text: "Title\tViews\r\n", encoding: "utf-16le" })
    expect(decodeCsvBytes(bytes(0x43, 0x61, 0x66, 0xe9, 0x2c, 0x31))).toEqual({ ok: true, text: "Café,1", encoding: "windows-1252" })
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
