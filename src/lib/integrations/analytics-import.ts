/**
 * Manual analytics import — the path that works without any integration. Read a CSV export,
 * recognise it (Meta Business Suite, TikTok Studio, YouTube Studio — see presets.ts) or map its
 * columns by hand, match each row to a published content item (content ID → URL → title) and build
 * the snapshot to log. Pure: the caller writes snapshots with `logMetrics`; rows that match nothing
 * can become published posts (bootstrap.ts). User-facing wording lives in the UI (reason codes).
 */
import { isPublishedItem, publishedAtOf } from "@/lib/analytics"
import { METRIC_FIELDS, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { isSameDay, toISODate } from "@/lib/dates"
import type { ContentItem, ContentMetric, Database, ID, ISODate, MetricKey, PlatformId } from "@/lib/types"
import { toCsv, type CsvTable } from "./csv"
import { presetMapping, type ImportPreset } from "./presets"
import {
  detectDateOrder,
  headerTimeUnit,
  metricKind,
  normalizeHeader,
  parseImportDate,
  parseMetricNumber,
  type DateOrder,
  type TimeUnit,
} from "./values"

/* --------------------------------- Fields --------------------------------- */

export type ImportKeyField = "content_id" | "url" | "title" | "caption" | "platform" | "published"
export type ImportField = ImportKeyField | MetricKey

export const IMPORT_KEY_FIELDS: { key: ImportKeyField; label: string; description: string }[] = [
  { key: "content_id", label: "Content ID", description: "The id column of an Orbi export — the most reliable match." },
  { key: "url", label: "Post URL", description: "Matched against each post's published URL." },
  { key: "title", label: "Title", description: "Matched against content titles; captions that start with the title match too." },
  { key: "caption", label: "Caption", description: "Used as the title when a row has none (Meta and TikTok put the post text here)." },
  { key: "platform", label: "Platform", description: "Tells apart posts that share a title across platforms." },
  { key: "published", label: "Publish date", description: "Picks the right post when titles repeat." },
]

export const IMPORT_METRIC_KEYS: MetricKey[] = METRIC_FIELDS.map((f) => f.key)

/** CSV column index per field; a missing key means "not in this file". */
export type ColumnMapping = Partial<Record<ImportField, number>>

const KEY_SYNONYMS: Record<ImportKeyField, string[]> = {
  content_id: ["content id", "content item id", "item id", "pbos id", "orbi id"],
  url: ["url", "post url", "permalink", "link", "post link", "content url", "video url", "video link", "share url", "link to post", "permanent link"],
  title: ["title", "post title", "content title", "video title", "name", "post name", "post"],
  caption: ["caption", "description", "message", "text", "post text", "post message", "post caption", "video description", "content"],
  platform: ["platform", "network", "social network"],
  published: [
    "published",
    "publish time",
    "published at",
    "publish date",
    "published date",
    "date published",
    "video publish time",
    "posted",
    "posted at",
    "posted on",
    "post date",
    "date posted",
    "post time",
    "created",
    "created at",
    "created time",
    "create time",
    "creation date",
    "upload date",
    "date",
    "time",
  ],
}

const METRIC_SYNONYMS: Record<MetricKey, string[]> = {
  views: ["views", "video views", "total views", "plays", "video plays", "reel plays", "total plays", "impressions", "post impressions"],
  reach: ["reach", "post reach", "accounts reached", "people reached", "unique viewers", "unique reach", "viewers", "total reach"],
  likes: ["likes", "like count", "total likes", "reactions", "total reactions", "hearts"],
  comments: ["comments", "comment count", "total comments", "comments added", "replies"],
  shares: ["shares", "share count", "total shares", "reposts", "retweets", "sends"],
  saves: ["saves", "saved", "save count", "total saves", "bookmarks", "favorites", "total favorites"],
  followers_gained: ["followers gained", "new followers", "follows", "followers", "net followers", "subscribers gained", "subscribers", "new subscribers"],
  profile_visits: ["profile visits", "profile views", "profile activity"],
  link_clicks: ["link clicks", "clicks", "url clicks", "website clicks", "outbound clicks", "link taps"],
  leads: ["leads", "inquiries", "enquiries", "sign ups", "signups", "form submissions"],
  sales: ["sales", "purchases", "orders", "conversions"],
  watch_time_seconds: [
    "watch time sec",
    "watch time seconds",
    "total watch time seconds",
    "watch time hours",
    "watch time minutes",
    "seconds viewed",
    "minutes viewed",
    "watch time",
    "total watch time",
    "total time watched",
    "total play time",
  ],
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
const EXACT_ONLY = new Set(["post", "name", "text", "content", "message", "description", "date", "time", "link", "created", "posted", "published", "viewers"])

/** Engagement totals ("Reactions, comments and shares") are never read as one of their parts. */
const ENGAGEMENT_TOTAL = /^(?:reactions comments and shares|interactions|engagements?|total engagements?|total interactions|engagement rate)\b/

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  ...(Object.fromEntries(IMPORT_KEY_FIELDS.map((f) => [f.key, f.label])) as Record<ImportKeyField, string>),
  ...(Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, f.label])) as Record<MetricKey, string>),
}

/**
 * Guess which column holds which field: a preset's own columns first, then exact names, then the
 * longest contained synonym. Per-view averages ("Average watch time") never fill totals.
 */
export function autoMapColumns(headers: string[], preset?: ImportPreset | null): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: ColumnMapping = preset ? presetMapping(preset, headers) : {}
  const used = new Set<number>(Object.values(mapping) as number[])
  const entries = [
    ...(Object.entries(KEY_SYNONYMS) as [ImportField, string[]][]),
    ...(Object.entries(METRIC_SYNONYMS) as [ImportField, string[]][]),
  ]

  for (const [field, synonyms] of entries) {
    if (mapping[field] !== undefined) continue
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
      (h, i) =>
        !used.has(i) &&
        !ENGAGEMENT_TOTAL.test(h) &&
        (field === "avg_retention" || !/^(?:average|avg)\b/.test(h)) &&
        (multiWord ? ` ${h} `.includes(` ${synonym} `) : h.startsWith(`${synonym} `))
    )
    if (index >= 0) {
      mapping[field] = index
      used.add(index)
    }
  }
  return mapping
}

/* --------------------------------- Values --------------------------------- */

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
  if (!s || /\s/.test(s)) return null
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

/** A cell that looks like a web link ("instagram.com/p/…", "https://…"). */
export function looksLikeUrl(raw: string): boolean {
  const url = toUrl(raw)
  return Boolean(url && url.hostname.includes(".") && /^https?:$/.test(url.protocol))
}

/**
 * Comparable form of a post URL: no scheme, www or trailing slash; only content-identifying query
 * params kept; YouTube Shorts / live / embed links and Instagram reel / tv / user-prefixed links
 * reduced to one canonical form.
 */
export function normalizeUrl(raw: string): string {
  const url = toUrl(raw)
  if (!url) return raw.trim().replace(/\/+$/, "")
  let host = url.hostname.toLowerCase().replace(/^(www|m|mobile|web|music)\./, "")
  let path = url.pathname.replace(/\/+$/, "")
  const keep: string[] = []
  if (host === "youtu.be") {
    keep.push(`v=${path.slice(1)}`)
    host = "youtube.com"
    path = "/watch"
  } else if (host === "youtube.com") {
    const short = /^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]+)/.exec(path)
    const v = short?.[1] ?? (path === "/watch" ? url.searchParams.get("v") : null)
    if (v) {
      keep.push(`v=${v}`)
      path = "/watch"
    }
  } else if (host === "instagram.com") {
    const post = /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(path)
    if (post) path = `/p/${post[1]}`
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

/** First line of a caption, flattened and cut at a word boundary — a usable title. */
export function captionTitle(caption: string, max = 120): string {
  const line = caption
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .find(Boolean)
  if (!line) return ""
  const flat = line.replace(/\s+/g, " ")
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Month/day order of the mapped publish-date column: from its values, else the preset's. */
export function columnDateOrder(table: CsvTable, mapping: ColumnMapping, preset?: ImportPreset | null): DateOrder | null {
  const index = mapping.published
  const detected = index === undefined ? null : detectDateOrder(table.rows.map((cells) => cells[index] ?? ""))
  return detected ?? preset?.dateOrder ?? null
}

/** Unit of the mapped watch-time column, from its header ("Watch time (hours)" → hours). */
export function watchTimeUnit(table: CsvTable, mapping: ColumnMapping): TimeUnit {
  const index = mapping.watch_time_seconds
  return (index === undefined ? null : headerTimeUnit(table.headers[index] ?? "")) ?? "seconds"
}

/* ---------------------------------- Rows ---------------------------------- */

export interface ImportRow {
  /** 0-based index into the data rows. */
  index: number
  /** Row in the file (the header row is row 1). */
  line: number
  contentId: string
  /** The title column, or the first line of the caption when there's no title. */
  title: string
  caption: string
  /** Post link (YouTube video IDs become watch URLs). */
  url: string
  platform: PlatformId | null
  published: Date | null
  metrics: Partial<Record<MetricKey, number>>
  /** Mapped metric cells that couldn't be read as numbers. */
  invalid: MetricKey[]
  /** A "Total" summary row (YouTube's first data row), not a post. */
  isTotal: boolean
}

export interface ReadOptions {
  preset?: ImportPreset | null
  /** Overrides the detected numeric date order. */
  dateOrder?: DateOrder | null
  /** "Now" for dates without a year. */
  reference?: Date
}

const TOTAL_LABEL = /^(?:grand\s+)?totals?$/i

export function readImportRows(table: CsvTable, mapping: ColumnMapping, options: ReadOptions = {}): ImportRow[] {
  const preset = options.preset ?? null
  const order = options.dateOrder ?? columnDateOrder(table, mapping, preset)
  const unit = watchTimeUnit(table, mapping)
  const cell = (cells: string[], field: ImportField) => {
    const index = mapping[field]
    return index === undefined ? "" : (cells[index] ?? "").trim()
  }
  return table.rows.map((cells, index) => {
    const metrics: Partial<Record<MetricKey, number>> = {}
    const invalid: MetricKey[] = []
    for (const key of IMPORT_METRIC_KEYS) {
      if (mapping[key] === undefined) continue
      const value = parseMetricNumber(cell(cells, key), key, key === "watch_time_seconds" ? unit : "seconds")
      if (value === undefined) invalid.push(key)
      else if (value !== null) metrics[key] = value
    }
    const rawUrl = cell(cells, "url")
    const contentId = cell(cells, "content_id")
    const titleCell = cell(cells, "title")
    const caption = cell(cells, "caption")
    const publishedCell = cell(cells, "published")
    const firstKey = [contentId, rawUrl, titleCell, caption].find(Boolean) ?? ""
    return {
      index,
      line: index + table.headerRow + 2,
      contentId,
      title: titleCell || captionTitle(caption),
      caption,
      url: rawUrl && preset?.urlFromCell ? preset.urlFromCell(rawUrl) : rawUrl,
      platform: parsePlatform(cell(cells, "platform")),
      published: parseImportDate(publishedCell, { order, reference: options.reference }),
      metrics,
      invalid,
      isTotal: TOTAL_LABEL.test(firstKey) && !publishedCell,
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

export type RowMatchStatus =
  | "matched"
  | "ambiguous"
  | "unmatched"
  | "unpublished"
  | "duplicate"
  | "no_values"
  | "no_key"
  | "skipped"
  | "totals"

export type MatchVia = "id" | "url" | "title" | "manual"

/** Why a row got its status — the UI turns it into words. */
export type MatchReason =
  | { code: "matched"; via: MatchVia }
  | { code: "ambiguous"; via: "url" | "title"; count: number }
  | { code: "unpublished"; title: string }
  | { code: "other_platform"; published: PlatformId[]; platform: PlatformId }
  | { code: "no_url_match" }
  | { code: "no_match" }
  | { code: "no_key" }
  | { code: "no_values"; unreadable: boolean }
  | { code: "duplicate"; line: number }
  | { code: "skipped" }
  | { code: "totals" }

export interface RowMatch {
  status: RowMatchStatus
  itemId: ID | null
  /** Posts to choose from when the row is ambiguous. */
  candidateIds: ID[]
  via: MatchVia | null
  reason: MatchReason
}

export interface MatchOptions {
  /** Platform the export comes from, used when the row itself doesn't say. */
  platform: PlatformId | null
}

function matched(candidate: ImportCandidate, via: "id" | "url" | "title"): RowMatch {
  return { status: "matched", itemId: candidate.id, candidateIds: [], via, reason: { code: "matched", via } }
}

function ambiguous(list: ImportCandidate[], via: "url" | "title"): RowMatch {
  return { status: "ambiguous", itemId: null, candidateIds: list.map((c) => c.id), via, reason: { code: "ambiguous", via, count: list.length } }
}

function unpublished(candidate: ImportCandidate): RowMatch {
  return { status: "unpublished", itemId: null, candidateIds: [candidate.id], via: null, reason: { code: "unpublished", title: candidate.title } }
}

function unmatched(reason: MatchReason): RowMatch {
  return { status: "unmatched", itemId: null, candidateIds: [], via: null, reason }
}

/** Content ID → URL → title (narrowed by platform, then by publish day). */
export function matchImportRow(row: ImportRow, candidates: readonly ImportCandidate[], options: MatchOptions): RowMatch {
  if (!row.contentId && !row.url && !row.title) {
    return { status: "no_key", itemId: null, candidateIds: [], via: null, reason: { code: "no_key" } }
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
      return unmatched({ code: "other_platform", published: [...new Set(live.map((c) => c.platform))], platform })
    }
    const drafts = onPlatform(hits.filter((c) => !c.published))
    if (drafts.length) return unpublished(drafts[0])
  }

  return unmatched(row.url && !row.title ? { code: "no_url_match" } : { code: "no_match" })
}

export interface PlannedImportRow {
  row: ImportRow
  match: RowMatch
}

/**
 * Match every row. `overrides` (row index → item id, or null to skip) win over automatic matching.
 * Totals rows, rows without metric values and second rows for the same post are never imported.
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
    if (row.isTotal) {
      match = { status: "totals", itemId: null, candidateIds: [], via: null, reason: { code: "totals" } }
    } else if (overrides.has(row.index)) {
      const candidate = byId.get(overrides.get(row.index) ?? "")
      match =
        candidate && candidate.published
          ? { status: "matched", itemId: candidate.id, candidateIds: [], via: "manual", reason: { code: "matched", via: "manual" } }
          : { status: "skipped", itemId: null, candidateIds: [], via: null, reason: { code: "skipped" } }
    } else {
      match = matchImportRow(row, candidates, options)
    }
    if (match.status === "matched" && !Object.keys(row.metrics).length) {
      match = { ...match, status: "no_values", reason: { code: "no_values", unreadable: row.invalid.length > 0 } }
    }
    if (match.status === "matched" && match.itemId) {
      const first = firstLine.get(match.itemId)
      if (first !== undefined) match = { ...match, status: "duplicate", reason: { code: "duplicate", line: first } }
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
    totals: 0,
  }
  for (const { match } of plan) summary[match.status]++
  return summary
}

/* -------------------------------- Snapshots ------------------------------- */

export type ImportSnapshot = Pick<ContentMetric, MetricKey | "recorded_at" | "notes" | "source">

function normalizeMetric(key: MetricKey, value: number): number {
  if (metricKind(key) === "percent") return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10
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
