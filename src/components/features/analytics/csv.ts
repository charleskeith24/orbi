/**
 * RFC 4180 CSV building (pure) and a browser download helper.
 */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

/** Leading characters spreadsheets would evaluate as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

/** One escaped cell: quoted when needed, formula-looking text neutralised with a leading apostrophe. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")]
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","))
  return lines.join("\r\n")
}

/** Saves `csv` as a UTF-8 file (BOM so spreadsheet apps keep accents and dashes). Browser only. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
