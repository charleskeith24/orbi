/**
 * Cell readers for analytics exports (pure, no React):
 * - counts: "12,400", "1.234" (dot thousands), "1 234", "12.4K";
 * - percentages: "45.5%", "4,5 %";
 * - durations: "0:45", "1:02:03", "1h 2m 3s", or a plain number in the unit the header announces
 *   ("Watch time (hours)", "Minutes viewed", "Seconds viewed");
 * - dates: ISO (with or without a time zone), "09/01/2026 14:30" (Meta), "13.01.2026",
 *   "9/1/26 2:30 PM", "Oct 5, 2021" (YouTube), "5 Oct 2021", "Jan 15" (no year), Excel serials;
 * - blanks: "", "-", "—", "n/a", "null", "none".
 */
import { METRIC_FIELDS, type MetricKind } from "@/lib/constants"
import type { MetricKey } from "@/lib/types"

const METRIC_KIND = Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.kind])) as Record<MetricKey, MetricKind>

export function metricKind(key: MetricKey): MetricKind {
  return METRIC_KIND[key]
}

/** "Watch time (sec)" → "watch time sec": case-, accent-, spacing- and punctuation-insensitive. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const BLANK = /^(?:-+|—|–|n\/?a|null|none|nan|undefined|not available|\(not available\))$/i

/** Empty or a "no value" marker. */
export function isBlankCell(raw: string): boolean {
  const s = raw.trim()
  return !s || BLANK.test(s)
}

/* -------------------------------- Durations ------------------------------- */

export type TimeUnit = "seconds" | "minutes" | "hours"

const UNIT_FACTOR: Record<TimeUnit, number> = { seconds: 1, minutes: 60, hours: 3600 }

const CLOCK = /^(\d+):(\d{1,2})(?::(\d{1,2}))?(?:[.,](\d+))?$/
const UNIT_PART = /(\d+(?:[.,]\d+)?)\s*(hours|hour|hrs|hr|h|minutes|minute|mins|min|m|seconds|second|secs|sec|s)\b/g
const PART_FACTOR: Record<string, number> = { h: 3600, m: 60, s: 1 }

/** "0:45" → 45, "1:35" → 95 (m:ss), "1:02:03" → 3723 (h:mm:ss), "1h 2m 3s" → 3723; otherwise undefined. */
export function parseDuration(raw: string): number | undefined {
  const s = raw.trim().toLowerCase()
  if (!s) return undefined
  const clock = CLOCK.exec(s)
  if (clock) {
    const fraction = clock[4] ? Number(`0.${clock[4]}`) : 0
    if (clock[3] !== undefined) {
      const [h, m, sec] = [Number(clock[1]), Number(clock[2]), Number(clock[3])]
      if (m >= 60 || sec >= 60) return undefined
      return h * 3600 + m * 60 + sec + fraction
    }
    const [m, sec] = [Number(clock[1]), Number(clock[2])]
    if (sec >= 60) return undefined
    return m * 60 + sec + fraction
  }
  let total = 0
  let found = false
  const rest = s.replace(UNIT_PART, (_match, value: string, unit: string) => {
    found = true
    total += Number(value.replace(",", ".")) * PART_FACTOR[unit[0]]
    return " "
  })
  return found && !rest.replace(/[\s,]+/g, "") ? total : undefined
}

/** The time unit a header announces: "Watch time (hours)" → hours, "Minutes viewed" → minutes. */
export function headerTimeUnit(header: string): TimeUnit | null {
  const words = normalizeHeader(header).split(" ")
  if (words.some((w) => ["hours", "hour", "hrs", "hr", "h"].includes(w))) return "hours"
  if (words.some((w) => ["minutes", "minute", "mins", "min"].includes(w))) return "minutes"
  if (words.some((w) => ["seconds", "second", "secs", "sec", "s"].includes(w))) return "seconds"
  return null
}

/* --------------------------------- Numbers -------------------------------- */

/**
 * "12,400" → 12400, "12.4k" → 12400, "45.5%" → 45.5, "1.234" → 1234 (counts), "4,5" → 4.5,
 * "1:35" → 95 and "2.5" with `unit` "hours" → 9000 (watch time); blank → null (missing);
 * unreadable → undefined.
 */
export function parseMetricNumber(raw: string, key?: MetricKey, unit: TimeUnit = "seconds"): number | null | undefined {
  if (isBlankCell(raw)) return null
  const kind = key ? METRIC_KIND[key] : "count"
  if (kind === "duration") {
    const seconds = parseDuration(raw)
    if (seconds !== undefined) return seconds
  }
  let s = raw.trim().replace(/−/g, "-").replace(/[\s_'’]/g, "")
  if (kind === "count" && /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".")
  else if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+%?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".")
  else if (/^[+-]?\d+,\d{1,2}%?$/.test(s)) s = s.replace(",", ".")
  else s = s.replace(/,/g, "")
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))([kmb])?%?$/i.exec(s)
  if (!match) return undefined
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[match[2]?.toLowerCase() ?? ""] ?? 1
  const n = Number(match[1]) * multiplier
  if (!Number.isFinite(n)) return undefined
  if (n < 0 && key !== "followers_gained") return undefined
  if (kind === "percent" && n > 100) return undefined
  return kind === "duration" ? n * UNIT_FACTOR[unit] : n
}

/* ---------------------------------- Dates --------------------------------- */

/** Month-first ("09/01/2026" = Sep 1, US / Meta) or day-first ("09/01/2026" = 9 Jan). */
export type DateOrder = "mdy" | "dmy"

export interface DateOptions {
  /** How to read numeric dates whose parts are both ≤ 12. Default month first. */
  order?: DateOrder | null
  /** "Now" for dates without a year ("Jan 15" → the latest Jan 15 not after this). */
  reference?: Date
}

const MONTH_KEYS: [string, number][] = [
  ["jan", 0], ["feb", 1], ["mar", 2], ["apr", 3], ["may", 4], ["jun", 5], ["jul", 6], ["aug", 7], ["sep", 8], ["sept", 8], ["oct", 9], ["nov", 10], ["dec", 11],
  // Filipino exports: Ene, Peb, Abr, Hun, Hul, Ago, Set, Okt, Nob, Dis.
  ["ene", 0], ["peb", 1], ["abr", 3], ["hun", 5], ["hul", 6], ["ago", 7], ["set", 8], ["okt", 9], ["nob", 10], ["dis", 11],
]
const MONTHS = new Map<string, number>(MONTH_KEYS)
const FULL_MONTHS = new Map<string, number>(
  [
    "january february march april may june july august september october november december",
    "enero pebrero marso abril mayo hunyo hulyo agosto setyembre oktubre nobyembre disyembre",
  ].flatMap((line) => line.split(" ").map((name, i) => [name, i] as [string, number]))
)

function monthIndex(word: string): number | undefined {
  const w = word.toLowerCase().replace(/\.$/, "")
  return MONTHS.get(w) ?? FULL_MONTHS.get(w)
}

interface TimeOfDay {
  h: number
  m: number
  s: number
  /** Offset from UTC in minutes when the value names a zone; null = local time. */
  offset: number | null
}

const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?\s*(?:([ap])\.?\s?m\.?)?\s*(z|utc|gmt|[+-]\d{2}:?\d{2})?/i

function parseTime(rest: string): TimeOfDay | null | undefined {
  if (!rest.trim()) return null
  const t = TIME.exec(rest)
  // No clock time in the rest ("(Mon)", "UTC+8 export") → the date alone.
  if (!t) return null
  let h = Number(t[1])
  const m = Number(t[2])
  const s = Number(t[3] ?? 0)
  if (t[4]) {
    if (h < 1 || h > 12) return undefined
    h = (h % 12) + (t[4].toLowerCase() === "p" ? 12 : 0)
  }
  if (h > 23 || m > 59 || s > 59) return undefined
  let offset: number | null = null
  const zone = t[5]?.toLowerCase()
  if (zone === "z" || zone === "utc" || zone === "gmt") offset = 0
  else if (zone) {
    const sign = zone[0] === "-" ? -1 : 1
    const digits = zone.slice(1).replace(":", "")
    offset = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)))
  }
  return { h, m, s, offset }
}

function build(year: number, month: number, day: number, time: TimeOfDay | null): Date | null {
  const y = year < 100 ? 2000 + year : year
  if (month < 0 || month > 11 || day < 1 || day > 31 || y < 2000 || y > 2100) return null
  const { h, m, s, offset } = time ?? { h: 0, m: 0, s: 0, offset: null }
  const date =
    offset === null ? new Date(y, month, day, h, m, s) : new Date(Date.UTC(y, month, day, h, m, s) - offset * 60_000)
  // Reject rollovers like Feb 31 (checked on the calendar day as written).
  const check = offset === null ? date : new Date(Date.UTC(y, month, day))
  const [cy, cm, cd] = offset === null ? [check.getFullYear(), check.getMonth(), check.getDate()] : [check.getUTCFullYear(), check.getUTCMonth(), check.getUTCDate()]
  return cy === y && cm === month && cd === day ? date : null
}

/** Votes the order from values whose first (day-first) or second (month-first) part is over 12. */
export function detectDateOrder(values: Iterable<string>): DateOrder | null {
  let dmy = false
  let mdy = false
  for (const value of values) {
    const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(value)
    if (!m) continue
    if (Number(m[1]) > 12) dmy = true
    if (Number(m[2]) > 12) mdy = true
  }
  if (dmy === mdy) return null
  return dmy ? "dmy" : "mdy"
}

const WEEKDAY = /^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i

/**
 * Reads the date formats platform exports use. Numeric dates are day-first when the first part is
 * over 12, month-first when the second is, otherwise `options.order` (default month first).
 */
export function parseImportDate(raw: string, options: DateOptions = {}): Date | null {
  const s = raw.trim().replace(WEEKDAY, "")
  if (!s) return null

  // Excel serial day numbers (a date column saved as numbers): 36526 = 2000-01-01.
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const serial = Number(s)
    if (serial < 36526 || serial > 73050) return null
    const whole = Math.floor(serial)
    const date = new Date(1899, 11, 30 + whole)
    date.setSeconds(Math.round((serial - whole) * 86_400))
    return date
  }

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])(.*)$/.exec(s)
  if (iso) {
    const time = parseTime(iso[4].replace(/^T/i, " "))
    return time === undefined ? null : build(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), time)
  }

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])(.*)$/.exec(s)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const dayFirst = a > 12 ? true : b > 12 ? false : options.order === "dmy"
    const time = parseTime(numeric[4])
    if (time === undefined) return null
    return build(Number(numeric[3]), (dayFirst ? b : a) - 1, dayFirst ? a : b, time)
  }

  const dayMonth = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+\.?),?[\s-]+(\d{4}|\d{2})(?![\d:])(.*)$/i.exec(s)
  if (dayMonth) {
    const month = monthIndex(dayMonth[2])
    const time = parseTime(dayMonth[4])
    if (month === undefined || time === undefined) return null
    return build(Number(dayMonth[3]), month, Number(dayMonth[1]), time)
  }

  const monthDay = /^([a-z]+\.?)\s+(\d{1,2})(?:st|nd|rd|th)?(?![\d:])(?:,?\s*(\d{4})(?![\d:]))?,?(.*)$/i.exec(s)
  if (monthDay) {
    const month = monthIndex(monthDay[1])
    const time = parseTime(monthDay[4].replace(/^\s*at\s+/i, " "))
    if (month === undefined || time === undefined) return null
    const day = Number(monthDay[2])
    if (monthDay[3]) return build(Number(monthDay[3]), month, day, time)
    const reference = options.reference ?? new Date()
    const thisYear = build(reference.getFullYear(), month, day, time)
    if (thisYear && thisYear.getTime() <= reference.getTime() + 86_400_000) return thisYear
    return build(reference.getFullYear() - 1, month, day, time)
  }

  if (!/[a-z]/i.test(s)) return null
  const parsed = Date.parse(s)
  if (!Number.isFinite(parsed)) return null
  const date = new Date(parsed)
  return date.getFullYear() >= 2000 && date.getFullYear() <= 2100 ? date : null
}
