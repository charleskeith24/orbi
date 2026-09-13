/**
 * Manual analytics import — the path that works without any integration. Read a CSV export,
 * map its columns to metrics, match each row to a published content item (content ID → URL →
 * title) and build the snapshot to log. Pure: the caller writes snapshots with `logMetrics`.
 */
import { isPublishedItem, publishedAtOf } from "@/lib/analytics"
import { METRIC_FIELDS, PLATFORM_IDS, PLATFORMS, type MetricKind } from "@/lib/constants"
import { isSameDay, toISODate } from "@/lib/dates"
import type { ContentItem, ContentMetric, Database, ID, ISODate, MetricKey, PlatformId } from "@/lib/types"
import { toCsv, type CsvTable } from "./csv"

/* --------------------------------- Fields --------------------------------- */

export type ImportKeyField = "content_id" | "url" | "title" | "platform" | "published"
export type ImportField = ImportKeyField | MetricKey

export const IMPORT_KEY_FIELDS: { key: ImportKeyField; label: string; description: string }[] = [
  { key: "content_id", label: "Content ID", description: "The id column of a Personal Brand OS export — the most reliable match." },
  { key: "url", label: "Post URL", description: "Matched against each post's published URL." },
  { key: "title", label: "Title", description: "Matched against content titles; captions that start with the title match too." },
  { key: "platform", label: "Platform", description: "Tells apart posts that share a title across platforms." },
  { key: "published", label: "Publish date", description: "Picks the right post when titles repeat." },
]

export const IMPORT_METRIC_KEYS: MetricKey[] = METRIC_FIELDS.map((f) => f.key)

const METRIC_KIND = Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.kind])) as Record<MetricKey, MetricKind>

/** CSV column index per field; a missing key means "not in this file". */
export type ColumnMapping = Partial<Record<ImportField, number>>

const KEY_SYNONYMS: Record<ImportKeyField, string[]> = {
  content_id: ["content id", "content item id", "item id", "pbos id"],
  url: ["url", "post url", "permalink", "link", "post link", "content url", "video url", "video link", "share url", "link to post", "permanent link"],
  title: ["title", "post title", "content title", "video title", "name", "post name", "post", "caption", "description", "message", "text", "post text", "content"],
  platform: ["platform", "network", "social network"],
  published: [
    "published",
    "publish time",
    "published at",
    "publish date",
    "published date",
    "date published",
    "posted",
    "posted at",
    "posted on",
    "post date",
    "date posted",
    "post time",
    "created",
    "created at",
    "creation date",
    "upload date",
    "date",
    "time",
  ],
}

const METRIC_SYNONYMS: Record<MetricKey, string[]> = {
  views: ["views", "video views", "total views", "plays", "video plays", "impressions", "post impressions"],
  reach: ["reach", "post reach", "accounts reached", "people reached", "unique viewers", "unique reach"],
  likes: ["likes", "like count", "reactions", "hearts"],
  comments: ["comments", "comment count", "replies"],
  shares: ["shares", "share count", "reposts", "retweets", "sends"],
  saves: ["saves", "saved", "save count", "bookmarks"],
  followers_gained: ["followers gained", "new followers", "follows", "followers", "net followers", "subscribers gained", "subscribers", "new subscribers"],
  profile_visits: ["profile visits", "profile views", "profile activity"],
  link_clicks: ["link clicks", "clicks", "url clicks", "website clicks", "outbound clicks", "link taps"],
  leads: ["leads", "inquiries", "enquiries", "sign ups", "signups", "form submissions"],
  sales: ["sales", "purchases", "orders", "conversions"],
  watch_time_seconds: ["watch time sec", "watch time seconds", "total watch time seconds", "watch time", "total watch time", "total time watched", "total play time"],
  avg_retention: [
    "avg retention",
    "average retention",
    "retention",
    "avg percentage viewed",
    "average percentage viewed",
    "average view percentage",
    "average percentage watched",
    "completion rate",
  ],
}

/** Generic words that only count as an exact header match (never "contained" in a longer header). */
const EXACT_ONLY = new Set(["post", "name", "text", "content", "message", "description", "date", "time", "link", "created", "posted", "published"])

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  ...(Object.fromEntries(IMPORT_KEY_FIELDS.map((f) => [f.key, f.label])) as Record<ImportKeyField, string>),
  ...(Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.label])) as Record<MetricKey, string>),
}

/** "Watch time (sec)" → "watch time sec". */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Guess which column holds which field. Exact names first, then the longest contained synonym. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const used = new Set<number>()
  const mapping: ColumnMapping = {}
  const entries = [
    ...(Object.entries(KEY_SYNONYMS) as [ImportField, string[]][]),
    ...(Object.entries(METRIC_SYNONYMS) as [ImportField, string[]][]),
  ]

  for (const [field, synonyms] of entries) {
    for (const synonym of synonyms) {
      const index = normalized.findIndex((h, i) => !used.has(i) && h === synonym)
      if (index >= 0) {
        mapping[field] = index
        used.add(index)
        break
      }
    }
  }

  const contained = entries
    .flatMap(([field, synonyms]) => synonyms.filter((s) => !EXACT_ONLY.has(s)).map((synonym) => ({ field, synonym })))
    .sort((a, b) => b.synonym.length - a.synonym.length)
  for (const { field, synonym } of contained) {
    if (mapping[field] !== undefined) continue
    const multiWord = synonym.includes(" ")
    const index = normalized.findIndex(
      (h, i) => !used.has(i) && (multiWord ? ` ${h} `.includes(` ${synonym} `) : h.startsWith(`${synonym} `))
    )
    if (index >= 0) {
      mapping[field] = index
      used.add(index)
    }
  }
  return mapping
}

/* --------------------------------- Values --------------------------------- */

/**
 * "12,400" → 12400, "12.4k" → 12400, "45.5%" → 45.5, "1.234" → 1234 (counts), "4,5" → 4.5,
 * "1:35" → 95 (watch time); blank / "—" / "n/a" → null (missing); unreadable → undefined.
 */
export function parseMetricNumber(raw: string, key?: MetricKey): number | null | undefined {
  let s = raw.trim()
  if (!s || /^(?:-|—|–|n\/?a|null|none|nan)$/i.test(s)) return null
  const kind = key ? METRIC_KIND[key] : "count"
  if (kind === "duration" && /^\d+(?::\d{1,2}){1,2}$/.test(s)) {
    return s.split(":").reduce((acc, part) => acc * 60 + Number(part), 0)
  }
  s = s.replace(/[\s_'’]/g, "")
  if (kind === "count" && /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".")
  else if (/^[+-]?\d+,\d{1,2}%?$/.test(s)) s = s.replace(",", ".")
  else s = s.replace(/,/g, "")
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))([kmb])?%?$/i.exec(s)
  if (!match) return undefined
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[match[2]?.toLowerCase() ?? ""] ?? 1
  const n = Number(match[1]) * multiplier
  if (!Number.isFinite(n)) return undefined
  if (n < 0 && key !== "followers_gained") return undefined
  if (kind === "percent" && n > 100) return undefined
  return n
}

const PLATFORM_ALIASES: Record<string, PlatformId> = {
  facebook: "facebook",
  fb: "facebook",
  meta: "facebook",
  "facebook page": "facebook",
  "facebook reels": "facebook",
  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",
  "instagram reels": "instagram",
  tiktok: "tiktok",
  "tik tok": "tiktok",
  tt: "tiktok",
  youtube: "youtube",
  yt: "youtube",
  "youtube shorts": "youtube",
  linkedin: "linkedin",
  "linked in": "linkedin",
  x: "x",
  twitter: "x",
  "x twitter": "x",
  "twitter x": "x",
  threads: "threads",
}

/** "IG", "Facebook Page", "Twitter" … → platform id; null when unknown. */
export function parsePlatform(raw: string): PlatformId | null {
  const key = normalizeHeader(raw)
  if (!key) return null
  if (PLATFORM_ALIASES[key]) return PLATFORM_ALIASES[key]
  const words = key.split(" ")
  return PLATFORM_IDS.find((id) => id !== "x" && words.includes(PLATFORMS[id].label.toLowerCase())) ?? null
}

const HOST_PLATFORMS: [RegExp, PlatformId][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
]

function toUrl(raw: string): URL | null {
  const s = raw.trim()
  if (!s) return null
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
}

export function platformFromUrl(raw: string): PlatformId | null {
  const host = toUrl(raw)?.hostname.toLowerCase()
  if (!host) return null
  return HOST_PLATFORMS.find(([pattern]) => pattern.test(host))?.[1] ?? null
}

/** Comparable form of a post URL: no scheme, www or trailing slash; only content-identifying query params kept. */
export function normalizeUrl(raw: string): string {
  const url = toUrl(raw)
  if (!url) return raw.trim().replace(/\/+$/, "")
  let host = url.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "")
  let path = url.pathname.replace(/\/+$/, "")
  const keep: string[] = []
  if (host === "youtu.be") {
    keep.push(`v=${path.slice(1)}`)
    host = "youtube.com"
    path = "/watch"
  } else if (host === "youtube.com" && path === "/watch") {
    const v = url.searchParams.get("v")
    if (v) keep.push(`v=${v}`)
  } else if (host.endsWith("facebook.com")) {
    for (const param of ["story_fbid", "fbid", "v", "id"]) {
      const value = url.searchParams.get(param)
      if (value) keep.push(`${param}=${value}`)
    }
  }
  return `${host}${path}${keep.length ? `?${keep.join("&")}` : ""}`
}

/** Case-, accent- and punctuation-insensitive title key. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function validDate(d: Date): Date | null {
  return Number.isFinite(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100 ? d : null
}

/** "2026-09-01", "2026-09-01 14:30", "9/1/2026", "01/09/2026" (day first when > 12), "Sep 1, 2026". */
export function parseImportDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s)
  if (iso) {
    return validDate(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0)))
  }
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:[ ,T]+(\d{1,2}):(\d{2}))?/.exec(s)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3])
    const [month, day] = a > 12 ? [b, a] : [a, b]
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return validDate(new Date(year, month - 1, day, Number(numeric[4] ?? 0), Number(numeric[5] ?? 0)))
  }
  const parsed = Date.parse(s)
  return Number.isFinite(parsed) ? validDate(new Date(parsed)) : null
}

/* ---------------------------------- Rows ---------------------------------- */

export interface ImportRow {
  /** 0-based index into the data rows. */
  index: number
  /** Line in the file (the header is line 1). */
  line: number
  contentId: string
  title: string
  url: string
  platform: PlatformId | null
  published: Date | null
  metrics: Partial<Record<MetricKey, number>>
  /** Mapped metric cells that couldn't be read as numbers. */
  invalid: MetricKey[]
}

export function readImportRows(table: CsvTable, mapping: ColumnMapping): ImportRow[] {
  const cell = (cells: string[], field: ImportField) => {
    const index = mapping[field]
    return index === undefined ? "" : (cells[index] ?? "").trim()
  }
  return table.rows.map((cells, index) => {
    const metrics: Partial<Record<MetricKey, number>> = {}
    const invalid: MetricKey[] = []
    for (const key of IMPORT_METRIC_KEYS) {
      if (mapping[key] === undefined) continue
      const value = parseMetricNumber(cell(cells, key), key)
      if (value === undefined) invalid.push(key)
      else if (value !== null) metrics[key] = value
    }
    return {
      index,
      line: index + 2,
      contentId: cell(cells, "content_id"),
      title: cell(cells, "title"),
      url: cell(cells, "url"),
      platform: parsePlatform(cell(cells, "platform")),
      published: parseImportDate(cell(cells, "published")),
      metrics,
      invalid,
    }
  })
}

/* -------------------------------- Matching -------------------------------- */

export interface ImportCandidate {
  id: ID
  title: string
  platform: PlatformId
  url: string
  published: boolean
  publishedAt: Date | null
  normTitle: string
  normUrl: string
}

/** Every content item as a match candidate (unpublished ones are only reported, never imported into). */
export function importCandidates(db: Pick<Database, "content_items">): ImportCandidate[] {
  return db.content_items.map((item: ContentItem) => {
    const published = isPublishedItem(item)
    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      url: item.published_url,
      published,
      publishedAt: published ? publishedAtOf(item) : null,
      normTitle: normalizeTitle(item.title),
      normUrl: item.published_url.trim() ? normalizeUrl(item.published_url) : "",
    }
  })
}

export type RowMatchStatus = "matched" | "ambiguous" | "unmatched" | "unpublished" | "duplicate" | "no_values" | "no_key" | "skipped"

export interface RowMatch {
  status: RowMatchStatus
  itemId: ID | null
  /** Posts to choose from when the row is ambiguous. */
  candidateIds: ID[]
  via: "id" | "url" | "title" | "manual" | null
  message: string
}

export interface MatchOptions {
  /** Platform the export comes from, used when the row itself doesn't say. */
  platform: PlatformId | null
}

const VIA_LABEL = { id: "content ID", url: "URL", title: "title", manual: "your choice" } as const

function matched(candidate: ImportCandidate, via: "id" | "url" | "title"): RowMatch {
  return { status: "matched", itemId: candidate.id, candidateIds: [], via, message: `Matched by ${VIA_LABEL[via]}` }
}

function ambiguous(list: ImportCandidate[], via: "url" | "title"): RowMatch {
  return {
    status: "ambiguous",
    itemId: null,
    candidateIds: list.map((c) => c.id),
    via,
    message: `${list.length} published posts match this ${VIA_LABEL[via]} — choose one`,
  }
}

function unpublished(candidate: ImportCandidate): RowMatch {
  return {
    status: "unpublished",
    itemId: null,
    candidateIds: [candidate.id],
    via: null,
    message: `“${candidate.title || "Untitled"}” isn't published yet — mark it published first`,
  }
}

function unmatched(message: string): RowMatch {
  return { status: "unmatched", itemId: null, candidateIds: [], via: null, message }
}

/** Content ID → URL → title (narrowed by platform, then by publish day). */
export function matchImportRow(row: ImportRow, candidates: readonly ImportCandidate[], options: MatchOptions): RowMatch {
  if (!row.contentId && !row.url && !row.title) {
    return { status: "no_key", itemId: null, candidateIds: [], via: null, message: "No title, URL or content ID to match on" }
  }
  const platform = row.platform ?? platformFromUrl(row.url) ?? options.platform
  const onPlatform = (list: ImportCandidate[]) => (platform ? list.filter((c) => c.platform === platform) : list)

  if (row.contentId) {
    const hit = candidates.find((c) => c.id === row.contentId)
    if (hit?.published) return matched(hit, "id")
    if (hit) return unpublished(hit)
  }

  if (row.url) {
    const key = normalizeUrl(row.url)
    const hits = key ? candidates.filter((c) => c.normUrl === key) : []
    const live = hits.filter((c) => c.published)
    if (live.length === 1) return matched(live[0], "url")
    if (live.length > 1) {
      const narrowed = onPlatform(live)
      return narrowed.length === 1 ? matched(narrowed[0], "url") : ambiguous(narrowed.length ? narrowed : live, "url")
    }
    if (hits.length) return unpublished(hits[0])
  }

  if (row.title) {
    const key = normalizeTitle(row.title)
    let hits = key ? candidates.filter((c) => c.normTitle === key) : []
    if (!hits.length && key.length >= 16) {
      hits = candidates.filter((c) => c.normTitle.length >= 16 && (c.normTitle.startsWith(key) || key.startsWith(c.normTitle)))
    }
    const live = hits.filter((c) => c.published)
    const narrowed = onPlatform(live)
    if (narrowed.length === 1) return matched(narrowed[0], "title")
    if (narrowed.length > 1) {
      if (row.published) {
        const sameDay = narrowed.filter((c) => c.publishedAt && isSameDay(c.publishedAt, row.published))
        if (sameDay.length === 1) return matched(sameDay[0], "title")
        if (sameDay.length > 1) return ambiguous(sameDay, "title")
      }
      return ambiguous(narrowed, "title")
    }
    if (live.length && platform) {
      const labels = [...new Set(live.map((c) => PLATFORMS[c.platform].label))].join(", ")
      return unmatched(`Published on ${labels}, not ${PLATFORMS[platform].label}`)
    }
    const drafts = onPlatform(hits.filter((c) => !c.published))
    if (drafts.length) return unpublished(drafts[0])
  }

  return unmatched(row.url && !row.title ? "No published post has this URL" : "No published post with this title or URL")
}

export interface PlannedImportRow {
  row: ImportRow
  match: RowMatch
}

/**
 * Match every row. `overrides` (row index → item id, or null to skip) win over automatic matching.
 * Rows without metric values and second rows for the same post are never imported.
 */
export function planImport(
  rows: readonly ImportRow[],
  candidates: readonly ImportCandidate[],
  options: MatchOptions,
  overrides: ReadonlyMap<number, ID | null> = new Map()
): PlannedImportRow[] {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const firstLine = new Map<ID, number>()
  return rows.map((row) => {
    let match: RowMatch
    if (overrides.has(row.index)) {
      const candidate = byId.get(overrides.get(row.index) ?? "")
      match =
        candidate && candidate.published
          ? { status: "matched", itemId: candidate.id, candidateIds: [], via: "manual", message: "Matched by your choice" }
          : { status: "skipped", itemId: null, candidateIds: [], via: null, message: "Skipped" }
    } else {
      match = matchImportRow(row, candidates, options)
    }
    if (match.status === "matched" && !Object.keys(row.metrics).length) {
      match = { ...match, status: "no_values", message: row.invalid.length ? "Metric values couldn't be read" : "No metric values in this row" }
    }
    if (match.status === "matched" && match.itemId) {
      const first = firstLine.get(match.itemId)
      if (first !== undefined) match = { ...match, status: "duplicate", message: `Same post as line ${first}` }
      else firstLine.set(match.itemId, row.line)
    }
    return { row, match }
  })
}

export type ImportSummary = Record<RowMatchStatus, number> & { total: number }

export function summarizeImport(plan: readonly PlannedImportRow[]): ImportSummary {
  const summary: ImportSummary = {
    total: plan.length,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    unpublished: 0,
    duplicate: 0,
    no_values: 0,
    no_key: 0,
    skipped: 0,
  }
  for (const { match } of plan) summary[match.status]++
  return summary
}

/* -------------------------------- Snapshots ------------------------------- */

export type ImportSnapshot = Pick<ContentMetric, MetricKey | "recorded_at" | "notes" | "source">

function normalizeMetric(key: MetricKey, value: number): number {
  if (METRIC_KIND[key] === "percent") return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10
  if (key === "followers_gained") return Math.round(value)
  return Math.max(0, Math.round(value))
}

/**
 * The snapshot for one row. Metrics that aren't in the file carry over from the post's latest
 * snapshot, so importing only views never wipes the leads you logged by hand.
 */
export function buildImportSnapshot(row: ImportRow, previous: ContentMetric | null | undefined, recordedAt: ISODate, notes: string): ImportSnapshot {
  const value = (key: MetricKey, fallback: number | null): number | null => {
    const fromFile = row.metrics[key]
    if (fromFile !== undefined) return normalizeMetric(key, fromFile)
    const carried = previous?.[key]
    return carried === undefined ? fallback : carried
  }
  const count = (key: MetricKey) => value(key, 0) ?? 0
  return {
    recorded_at: recordedAt,
    notes,
    source: "import",
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
    sales: count("sales"),
    watch_time_seconds: value("watch_time_seconds", null),
    avg_retention: value("avg_retention", null),
  }
}

/* -------------------------------- Template -------------------------------- */

export const TEMPLATE_HEADERS = ["Content ID", "Title", "URL", "Platform", "Published", ...METRIC_FIELDS.map((f) => f.label)]

/** A fill-in sheet: your most recent published posts with empty metric columns. */
export function buildTemplateCsv(candidates: readonly ImportCandidate[], limit = 60): string {
  const rows = candidates
    .filter((c): c is ImportCandidate & { publishedAt: Date } => c.published && c.publishedAt !== null)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit)
    .map((c) => [c.id, c.title, c.url, PLATFORMS[c.platform].label, toISODate(c.publishedAt), ...METRIC_FIELDS.map(() => "")])
  return toCsv([TEMPLATE_HEADERS, ...rows])
}
