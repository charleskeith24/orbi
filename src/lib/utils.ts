export { cn } from "cn"

/** RFC 4122 v4 id. Uses crypto.randomUUID when available. */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/* --------------------------------- Numbers -------------------------------- */

const fullFormatter = new Intl.NumberFormat("en-US")
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

/** 1284 → "1,284". Null/NaN → "—". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return fullFormatter.format(Math.round(value))
}

/** 12900 → "12.9K", 4_200_000 → "4.2M". Values under 10,000 keep full precision. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return Math.abs(value) < 10_000 ? fullFormatter.format(Math.round(value)) : compactFormatter.format(value)
}

/** Input is already a percentage (0–100). 7.234 → "7.2%". */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${value.toFixed(digits)}%`
}

/** Signed delta for change indicators. 12.3 → "+12.3%". */
export function formatDelta(value: number | null | undefined, digits = 1, suffix = "%"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${Math.abs(value).toFixed(digits)}${suffix}`
}

/** 95 → "1:35". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—"
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function sum(values: number[]): number {
  let total = 0
  for (const v of values) total += Number.isFinite(v) ? v : 0
  return total
}

/** Mean of finite values; null when there are none. */
export function average(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v))
  return finite.length ? sum(finite) / finite.length : null
}

export function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!finite.length) return null
  const mid = Math.floor(finite.length / 2)
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2
}

/** Safe percentage a/b × 100; null when b is 0. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null
}

/* ------------------------------- Collections ------------------------------ */

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const k = key(item)
    ;(out[k] ??= []).push(item)
  }
  return out
}

export function countBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, number> {
  const out = {} as Record<K, number>
  for (const item of items) {
    const k = key(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export function uniq<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export function sortBy<T>(items: T[], key: (item: T) => number | string, direction: "asc" | "desc" = "asc"): T[] {
  const dir = direction === "asc" ? 1 : -1
  return [...items].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -dir : ka > kb ? dir : 0
  })
}

/* ---------------------------------- Text ---------------------------------- */

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text
}

/** "Rafael 'Raf' Mendoza" → "RM", "Bea (Editor)" → "B". Parenthetical roles and punctuation are ignored. */
export function initials(name: string): string {
  return (
    name
      .replace(/\([^)]*\)/g, " ")
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean)
      .filter((word, i, words) => i === 0 || i === words.length - 1)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "?"
  )
}

/** Case-insensitive "contains all words" match used by search boxes and filters. */
export function matchesQuery(query: string, ...fields: (string | null | undefined | string[])[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = fields
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

/** Split a comma/newline separated string into trimmed non-empty parts. */
export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
