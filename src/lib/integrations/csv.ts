/**
 * Small RFC 4180 CSV reader/writer for manual imports (no dependencies, pure).
 * Handles quoted fields, escaped quotes, CRLF / LF / CR line endings, a UTF-8 BOM and
 * comma, semicolon or tab delimiters (auto-detected from the header line).
 */

export type CsvDelimiter = "," | ";" | "\t"

export interface CsvTable {
  headers: string[]
  /** Data rows, each padded / trimmed to `headers.length` cells. */
  rows: string[][]
  delimiter: CsvDelimiter
}

export type CsvReadResult = { ok: true; table: CsvTable } | { ok: false; error: string }

export const MAX_CSV_ROWS = 5000

const DELIMITERS: CsvDelimiter[] = [",", ";", "\t"]

/** Picks the delimiter that occurs most often (outside quotes) on the first non-empty line. */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ",": 0, ";": 0, "\t": 0 }
  let inQuotes = false
  let seenContent = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (seenContent) break
      continue
    }
    if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) counts[ch]++
    if (ch.trim()) seenContent = true
  }
  return DELIMITERS.reduce((best, d) => (counts[d] > counts[best] ? d : best), ",")
}

/** Parse CSV text into rows of cells. Rows whose cells are all blank are dropped. */
export function parseCsv(input: string, delimiter: CsvDelimiter = detectDelimiter(input)): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  const endField = () => {
    row.push(field)
    field = ""
  }
  const endRow = () => {
    endField()
    if (row.some((cell) => cell.trim() !== "")) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"' && field.trim() === "") {
      field = ""
      inQuotes = true
    } else if (ch === delimiter) endField()
    else if (ch === "\n") endRow()
    else if (ch === "\r") {
      endRow()
      if (text[i + 1] === "\n") i++
    } else field += ch
  }
  if (field !== "" || row.length) endRow()
  return rows
}

/** First row → headers (blank headers named, duplicates suffixed); remaining rows → data. */
export function readCsvTable(text: string): CsvReadResult {
  if (!text.trim()) return { ok: false, error: "The file is empty." }
  const delimiter = detectDelimiter(text)
  const all = parseCsv(text, delimiter)
  if (!all.length) return { ok: false, error: "The file is empty." }
  const [head, ...body] = all
  if (!body.length) return { ok: false, error: "The file has a header row but no data rows." }
  if (body.length > MAX_CSV_ROWS) {
    return { ok: false, error: `The file has ${body.length.toLocaleString("en-US")} rows — import at most ${MAX_CSV_ROWS.toLocaleString("en-US")} at a time.` }
  }

  const seen = new Map<string, number>()
  const headers = head.map((raw, i) => {
    const base = raw.trim() || `Column ${i + 1}`
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1
    seen.set(base.toLowerCase(), n)
    return n > 1 ? `${base} (${n})` : base
  })
  const width = headers.length
  const rows = body.map((cells) => (cells.length >= width ? cells.slice(0, width) : [...cells, ...Array<string>(width - cells.length).fill("")]))
  return { ok: true, table: { headers, rows, delimiter } }
}

/** Leading characters spreadsheets would evaluate as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

/** One escaped cell: quoted when needed; formula-looking text neutralised with an apostrophe. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}
