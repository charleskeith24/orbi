/**
 * Pure helpers for the global capture dialogs: idea titles, metric drafts and live rates,
 * URL clean-up and the shared keyboard rule (⌘/Ctrl+Enter submits).
 */
import type { KeyboardEvent } from "react"
import { computeRates, type MetricRates } from "@/lib/analytics"
import type { MetricValues } from "@/lib/store"
import type { ContentFormat, ContentMetric, MetricKey, PlatformId } from "@/lib/types"

/* ---------------------------------- Ideas ---------------------------------- */

/** Sentences shorter than this are treated as abbreviations ("e.g.") and the title keeps going. */
const MIN_SENTENCE = 15
/** A first line shorter than this ("Idea:", "Hook") is a label, not a title. */
const MIN_FIRST_LINE = 12

/**
 * Idea title from a free-text note: the first sentence of the first line (trailing period dropped),
 * at most `max` characters, cut on a word boundary.
 */
export function ideaTitleFromText(text: string, max = 90): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
  if (!lines.length) return ""
  const first = lines[0].replace(/[:–—-]+$/, "").trim()
  const base = first.length >= MIN_FIRST_LINE || lines.length === 1 ? lines[0] : lines.join(" ")
  let sentence = base
  for (const match of base.matchAll(/[.!?](?=\s|$)/g)) {
    const end = (match.index ?? 0) + 1
    if (end >= MIN_SENTENCE) {
      sentence = base.slice(0, end)
      break
    }
  }
  sentence = sentence.replace(/[.:]$/, "").trim()
  if (sentence.length <= max) return sentence
  const cut = sentence.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space >= max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/* --------------------------------- Metrics --------------------------------- */

/** Whole-number counters (Postgres `integer`). */
export const COUNT_KEYS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers_gained",
  "profile_visits",
  "link_clicks",
  "leads",
  "sales",
] as const satisfies readonly MetricKey[]

export type CountKey = (typeof COUNT_KEYS)[number]

/** Form state for a snapshot: `null` = left blank. */
export type MetricDraft = Record<MetricKey, number | null>

const ALL_KEYS: readonly MetricKey[] = [...COUNT_KEYS, "watch_time_seconds", "avg_retention"]

export interface MetricGroup {
  id: "reach" | "engagement" | "conversion" | "video"
  label: string
  keys: MetricKey[]
}

/** Spec §25 grouping. The Video group only applies to video formats. */
export const METRIC_GROUPS: MetricGroup[] = [
  { id: "reach", label: "Reach", keys: ["views", "reach", "profile_visits"] },
  { id: "engagement", label: "Engagement", keys: ["likes", "comments", "shares", "saves"] },
  { id: "conversion", label: "Conversion", keys: ["followers_gained", "link_clicks", "leads", "sales"] },
  { id: "video", label: "Video", keys: ["watch_time_seconds", "avg_retention"] },
]

export function isCountKey(key: MetricKey): key is CountKey {
  return (COUNT_KEYS as readonly MetricKey[]).includes(key)
}

export function emptyMetricDraft(): MetricDraft {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, null])) as MetricDraft
}

/** Start from the latest snapshot — creators update cumulative numbers rather than retype them. */
export function draftFromSnapshot(metric: ContentMetric | null | undefined): MetricDraft {
  const draft = emptyMetricDraft()
  if (!metric) return draft
  for (const key of ALL_KEYS) {
    const value = metric[key]
    draft[key] = typeof value === "number" && Number.isFinite(value) ? value : null
  }
  return draft
}

export function hasAnyMetric(draft: MetricDraft): boolean {
  return ALL_KEYS.some((key) => (draft[key] ?? 0) > 0)
}

/** Draft → snapshot values: counters are whole numbers (blank = 0); watch time and retention stay null when blank. */
export function toMetricValues(draft: MetricDraft): MetricValues {
  const out: MetricValues = {}
  for (const key of COUNT_KEYS) out[key] = Math.max(0, Math.round(draft[key] ?? 0))
  const watch = draft.watch_time_seconds
  const retention = draft.avg_retention
  out.watch_time_seconds = watch === null ? null : Math.max(0, watch)
  out.avg_retention = retention === null ? null : Math.min(100, Math.max(0, retention))
  return out
}

/** Live rates for the form (same formulas as Analytics). */
export function draftRates(draft: MetricDraft): MetricRates {
  const count = (key: CountKey) => Math.max(0, Math.round(draft[key] ?? 0))
  return computeRates({
    views: count("views"),
    reach: count("reach"),
    likes: count("likes"),
    comments: count("comments"),
    shares: count("shares"),
    saves: count("saves"),
    followers_gained: count("followers_gained"),
    profile_visits: count("profile_visits"),
    link_clicks: count("link_clicks"),
    leads: count("leads"),
  })
}

/** Video / live formats get watch time and retention; without a format, TikTok and YouTube are video-first. */
export function isVideoContent(platform: PlatformId, format: Pick<ContentFormat, "category"> | null | undefined): boolean {
  if (format) return format.category === "video" || format.category === "live"
  return platform === "tiktok" || platform === "youtube"
}

/* ----------------------------------- URLs ---------------------------------- */

/** "facebook.com/raf/posts/1" → "https://facebook.com/raf/posts/1"; blank stays blank. */
export function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return ""
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
}

/** Blank is valid (the URL is optional); otherwise an http(s) address with a real host. */
export function isValidUrl(value: string): boolean {
  const v = normalizeUrl(value)
  if (!v) return true
  try {
    const url = new URL(v)
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".")
  } catch {
    return false
  }
}

/* --------------------------------- Keyboard -------------------------------- */

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"])

/**
 * Form `onKeyDown`: ⌘/Ctrl+Enter submits from anywhere in the form. A plain Enter in a one-line
 * field does nothing (multi-field forms shouldn't submit half-filled) unless `enterSubmits`.
 * Keys a widget already handled (a picker's Enter) are left alone.
 */
export function submitOnModEnter(
  event: KeyboardEvent<HTMLElement>,
  submit: () => void,
  options: { enterSubmits?: boolean } = {}
): void {
  if (event.key !== "Enter" || event.nativeEvent.isComposing || event.defaultPrevented) return
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault()
    submit()
    return
  }
  if (options.enterSubmits) return
  const target = event.target
  if (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) event.preventDefault()
}
