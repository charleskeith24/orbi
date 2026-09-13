/** Save text as a file in the browser (Blob + temporary link). Browser only. */
export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
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

/** UTF-8 CSV with a BOM so spreadsheet apps keep accents and dashes. */
export function downloadCsvFile(filename: string, csv: string): void {
  downloadFile(filename, `﻿${csv}`, "text/csv;charset=utf-8")
}

export function downloadJsonFile(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), "application/json")
}
