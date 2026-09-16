/**
 * Small RFC 4180 CSV reader/writer for manual imports (no dependencies, pure).
 * Handles quoted fields (commas, quotes and line breaks inside), CRLF / LF / CR line endings, a
 * UTF-8 or UTF-16 BOM, Windows-1252 text, Excel's `sep=;` hint line, report-title lines above the
 * header row, trailing empty columns and comma, semicolon or tab delimiters (detected from the
 * opening records). Excel workbooks are recognised by their bytes so the UI can ask for a CSV.
 */

export type CsvDelimiter = "," | ";" | "\t"

export interface CsvTable {
  headers: string[]
  /** Data rows, each padded / trimmed to `headers.length` cells. */
  rows: string[][]
  delimiter: CsvDelimiter
  /** Non-blank records above the header row that were skipped (report titles, date ranges). */
  headerRow: number
}

export type CsvErrorCode = "empty" | "no_rows" | "too_many_rows"

export type CsvReadResult =
  | { ok: true; table: CsvTable }
  | { ok: false; code: CsvErrorCode; /** English, for logs and tests. */ error: string; rows?: number }

export const MAX_CSV_ROWS = 5000

const DELIMITERS: CsvDelimiter[] = [",", ";", "\t"]

/* ---------------------------------- Bytes --------------------------------- */

export type CsvDecodeResult =
  | { ok: true; text: string; encoding: "utf-8" | "utf-16le" | "utf-16be" | "windows-1252" }
  | { ok: false; code: "spreadsheet" | "binary" }

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] // .xlsx / .xlsm / .ods / .numbers
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] // legacy .xls

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b)

/** File names of spreadsheet workbooks (not CSV). */
export function isSpreadsheetFileName(name: string): boolean {
  return /\.(xlsx|xlsm|xlsb|xls|ods|numbers)$/i.test(name.trim())
}

/**
 * Bytes → text. Workbooks (zip / OLE containers) and other binary files are refused; UTF-16 is
 * recognised with or without a BOM (Excel's "Unicode text"); invalid UTF-8 falls back to
 * Windows-1252 (Excel's "CSV (Comma delimited)" on Windows).
 */
export function decodeCsvBytes(bytes: Uint8Array): CsvDecodeResult {
  if (startsWith(bytes, ZIP_SIGNATURE) || startsWith(bytes, OLE_SIGNATURE)) return { ok: false, code: "spreadsheet" }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { ok: true, text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { ok: true, text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" }

  const sample = bytes.subarray(0, 1024)
  let evenZeros = 0
  let oddZeros = 0
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      if (i % 2) oddZeros++
      else evenZeros++
    }
  }
  if (sample.length >= 4 && evenZeros === 0 && oddZeros > sample.length / 4) {
    return { ok: true, text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" }
  }
  if (sample.length >= 4 && oddZeros === 0 && evenZeros > sample.length / 4) {
    return { ok: true, text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" }
  }
  if (evenZeros + oddZeros > 0) return { ok: false, code: "binary" }

  let text: string
  let encoding: "utf-8" | "windows-1252" = "utf-8"
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes)
    encoding = "windows-1252"
  }
  return { ok: true, text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, encoding }
}

/* --------------------------------- Parsing -------------------------------- */

/**
 * The delimiter whose per-record count is the most consistent across the opening records
 * (outside quotes) — robust to title lines and to tab files with unquoted commas in captions.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const zero = (): Record<CsvDelimiter, number> => ({ ",": 0, ";": 0, "\t": 0 })
  const records: Record<CsvDelimiter, number>[] = []
  let counts = zero()
  let inQuotes = false
  let hasContent = false
  for (let i = 0; i < text.length && records.length < 20; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
      hasContent = true
      continue
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (hasContent) records.push(counts)
      counts = zero()
      hasContent = false
      continue
    }
    if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) counts[ch]++
    if (ch.trim()) hasContent = true
  }
  if (hasContent) records.push(counts)

  let best: CsvDelimiter = ","
  let bestScore: [number, number] = [0, 0]
  for (const d of DELIMITERS) {
    const frequency = new Map<number, number>()
    for (const record of records) if (record[d] > 0) frequency.set(record[d], (frequency.get(record[d]) ?? 0) + 1)
    // [records sharing the most common count, that count]
    let score: [number, number] = [0, 0]
    for (const [count, n] of frequency) if (n > score[0] || (n === score[0] && count > score[1])) score = [n, count]
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      best = d
      bestScore = score
    }
  }
  return best
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

/**
 * Index of the header row: the first of the opening records that fills (nearly) the table's full
 * width — header cells are all named, so the header is the widest record. Report titles
 * ("Content · Aug 1 – Aug 31, 2026") above the real header are skipped.
 */
export function findHeaderRow(rows: string[][]): number {
  const filled = rows.slice(0, 50).map((cells) => cells.filter((cell) => cell.trim()).length)
  const widest = Math.max(0, ...filled)
  if (widest < 2) return 0
  const threshold = Math.max(2, Math.ceil(widest * 0.8))
  const index = filled.slice(0, 10).findIndex((n) => n >= threshold)
  return index < 0 ? 0 : index
}

function fail(code: CsvErrorCode, rows?: number): CsvReadResult {
  const error =
    code === "empty"
      ? "The file is empty."
      : code === "no_rows"
        ? "The file has a header row but no data rows."
        : `The file has ${(rows ?? 0).toLocaleString("en-US")} rows — import at most ${MAX_CSV_ROWS.toLocaleString("en-US")} at a time.`
  return { ok: false, code, error, rows }
}

/** Header row → headers (blank headers named, duplicates suffixed); following rows → data. */
export function readCsvTable(input: string): CsvReadResult {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  let forced: CsvDelimiter | null = null
  const sep = /^sep=([,;\t])[^\S\r\n]*(?:\r\n|\n|\r)/i.exec(text)
  if (sep) {
    forced = sep[1] as CsvDelimiter
    text = text.slice(sep[0].length)
  }
  if (!text.trim()) return fail("empty")
  const delimiter = forced ?? detectDelimiter(text)
  const all = parseCsv(text, delimiter)
  if (!all.length) return fail("empty")
  const headerRow = findHeaderRow(all)
  const [head, ...body] = all.slice(headerRow)
  if (!body.length) return fail("no_rows")
  if (body.length > MAX_CSV_ROWS) return fail("too_many_rows", body.length)

  // Rows that end with a delimiter leave an unnamed, empty last column.
  let width = head.length
  while (width > 1 && !head[width - 1].trim() && body.every((cells) => !(cells[width - 1] ?? "").trim())) width--

  const seen = new Map<string, number>()
  const headers = head.slice(0, width).map((raw, i) => {
    const base = raw.trim() || `Column ${i + 1}`
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1
    seen.set(base.toLowerCase(), n)
    return n > 1 ? `${base} (${n})` : base
  })
  const rows = body.map((cells) => (cells.length >= width ? cells.slice(0, width) : [...cells, ...Array<string>(width - cells.length).fill("")]))
  return { ok: true, table: { headers, rows, delimiter, headerRow } }
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
