/**
 * Import presets: the post-level CSV exports creators actually download, recognised from the
 * header row and mapped automatically. Header names are compared after `normalizeHeader`
 * (case-, spacing- and punctuation-insensitive: "Watch time (hours)" = "watch time hours"); extra
 * columns are ignored and the manual mapping stays editable. Pure module.
 *
 * Sources (checked September 2026) — which header names are confirmed and which are not:
 *
 * YouTube Studio → Analytics → Advanced mode → Export current view → CSV downloads a zip with
 * "Table data.csv", "Chart data.csv" and "Totals.csv"; downloads are capped at 500 rows.
 *   - Confirmed: Content (the video ID), Video title, Video publish time ("Oct 5, 2021"),
 *     Duration (seconds), Views, Watch time (hours), Subscribers, Average view duration
 *     ("0:03:12"), Impressions, Impressions click-through rate (%); the first data row is "Total".
 *     https://www.freecodecamp.org/news/extract-youtube-analytics-data-and-analyze-in-python/
 *     https://support.google.com/youtube/answer/9717005 (Advanced mode export, 500-row limit)
 *   - Not confirmed (Advanced-mode metric names, kept as synonyms): Likes, Comments added, Shares,
 *     Subscribers gained, Average percentage viewed (%), Unique viewers.
 *
 * TikTok Studio → Analytics → download data (CSV or XLSX).
 *   - Second-hand: the content file's headers "Time; Video title; Video link; Post time;
 *     Total likes; Total comments; Total shares; Total views", as quoted from Conviva's TikTok
 *     import guide in search results (the page itself was unreachable):
 *     https://help.social.conviva.com/en/articles/4076984-importing-tiktok-data-into-conviva-social-insights
 *     CSV or .xlsx: https://www.graphed.com/blog/how-to-export-tiktok-analytics
 *   - Not confirmed (newer Studio names, kept as synonyms): Views, Likes, Comments, Shares,
 *     Total saves / Favorites, Total play time, New followers, Profile views; the "Post time" format.
 *
 * Meta Business Suite → Insights → Content → Export data (CSV) — one row per post for a Facebook
 * Page or an Instagram account.
 *   - Confirmed metric headers: Accounts reached, Post impressions, Profile visits, Follows, Saves,
 *     Shares, Comments, Likes, Plays / Reel plays; "Reactions" and "Reposts" vary by export.
 *     https://www.poststeady.com/resources/export-instagram-insights-to-csv
 *   - Renamed metrics: Views replaced Impressions (Facebook from Nov 2024; Instagram API v22 on
 *     Apr 21, 2025), and from late 2025 Viewers replaced Reach and Interactions replaced Engagement.
 *     https://www.socialmediatoday.com/news/facebook-switches-views-primary-metric/732979/
 *     https://help.metricool.com/en/article/instagram-replaces-impressions-with-views-what-you-need-to-know-ustr2f/
 *     https://storrito.com/resources/meta-retired-reach-impressions-engagement-users-confused/
 *   - Not confirmed by any public source (common Meta export names, unverified — kept as
 *     synonyms): Post ID, Page ID, Page name, Account ID, Account username, Account name, Title,
 *     Description, Duration (sec), Publish time, Permalink, Post type ("IG reel", "IG image"),
 *     Reactions, Link clicks, Seconds viewed, "Reactions, comments and shares"; the
 *     "MM/DD/YYYY HH:MM" publish-time format.
 */
import { METRIC_FIELDS } from "@/lib/constants"
import type { PlatformId } from "@/lib/types"
import type { ColumnMapping, ImportField } from "./analytics-import"
import { normalizeHeader, type DateOrder } from "./values"

export type ImportPresetId = "meta_facebook" | "meta_instagram" | "tiktok_studio" | "youtube_studio"

export interface ImportPreset {
  id: ImportPresetId
  /** The tool the file comes from. */
  app: string
  /** What the file holds. */
  label: string
  platform: PlatformId
  /** Normalised header names per field, most specific first — current and older names. */
  columns: Partial<Record<ImportField, string[]>>
  /** Header groups typical of this export; each group found scores one point. */
  signature: string[][]
  /** Points needed before the preset is suggested. */
  minScore: number
  /** Hosts of the post links in this export. */
  hosts: RegExp
  /** "Post type" values that confirm the export ("IG reel"). */
  typeHint?: RegExp
  /** Numeric dates whose parts are both ≤ 12. */
  dateOrder: DateOrder
  /** The link column holds an ID rather than a URL (YouTube's "Content" = video ID). */
  urlFromCell?: (value: string) => string
}

/** YouTube's "Content" column → a watch URL; anything else (a URL, "Total") unchanged. */
export function youtubeUrlFromCell(value: string): string {
  const v = value.trim()
  return /^[A-Za-z0-9_-]{11}$/.test(v) ? `https://www.youtube.com/watch?v=${v}` : v
}

const META_SHARED = [["post id"], ["permalink"], ["publish time"], ["post type"]]
const META_PUBLISHED = ["publish time", "published", "publish date", "posted", "created time", "date published"]

export const IMPORT_PRESETS: readonly ImportPreset[] = [
  {
    id: "meta_facebook",
    app: "Meta Business Suite",
    label: "Facebook posts",
    platform: "facebook",
    columns: {
      url: ["permalink", "post link", "link to post"],
      title: ["title", "post title"],
      caption: ["description", "post message", "message", "post text", "caption"],
      published: META_PUBLISHED,
      views: ["views", "impressions", "post impressions", "total impressions", "3 second video views", "video views", "plays"],
      reach: ["reach", "post reach", "viewers", "people reached", "accounts reached"],
      likes: ["reactions", "total reactions", "likes"],
      comments: ["comments", "total comments"],
      shares: ["shares", "total shares"],
      saves: ["saves"],
      link_clicks: ["link clicks", "total link clicks"],
      followers_gained: ["follows", "new follows", "page follows", "new followers"],
      watch_time_seconds: ["seconds viewed", "minutes viewed", "total seconds viewed", "watch time", "total watch time"],
    },
    signature: [
      ...META_SHARED,
      ["page id", "page name"],
      ["reactions"],
      ["reactions comments and shares"],
      ["link clicks", "total clicks", "other clicks"],
      ["seconds viewed", "average seconds viewed", "minutes viewed", "average minutes viewed"],
      ["is crosspost", "is share"],
    ],
    minScore: 3,
    hosts: /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/,
    dateOrder: "mdy",
  },
  {
    id: "meta_instagram",
    app: "Meta Business Suite",
    label: "Instagram posts",
    platform: "instagram",
    columns: {
      url: ["permalink", "post link"],
      title: ["title"],
      caption: ["description", "caption", "post text"],
      published: META_PUBLISHED,
      views: ["views", "impressions", "post impressions", "plays", "reel plays", "video views"],
      reach: ["reach", "accounts reached", "viewers", "post reach"],
      likes: ["likes", "like count"],
      comments: ["comments"],
      shares: ["shares", "sends"],
      saves: ["saves", "saved"],
      followers_gained: ["follows", "new followers", "follows from post"],
      profile_visits: ["profile visits", "profile activity", "profile views"],
      link_clicks: ["link clicks", "external link taps", "website clicks", "website taps"],
      watch_time_seconds: ["watch time", "total watch time", "view time", "total view time"],
    },
    signature: [
      ...META_SHARED,
      ["account id", "account username", "account name"],
      ["accounts reached"],
      ["plays", "reel plays"],
      ["profile visits"],
      ["follows"],
      ["saves"],
      ["likes"],
    ],
    minScore: 3,
    hosts: /(^|\.)instagram\.com$/,
    typeHint: /^ig\b/i,
    dateOrder: "mdy",
  },
  {
    id: "tiktok_studio",
    app: "TikTok Studio",
    label: "Video posts",
    platform: "tiktok",
    columns: {
      url: ["video link", "link", "video url", "post link", "share url"],
      title: ["video title", "title", "video description", "description", "caption"],
      published: ["post time", "posted", "posted on", "post date", "date posted", "create time", "created", "publish time"],
      views: ["total views", "video views", "views", "total video views", "total plays", "plays"],
      reach: ["reach", "total reach", "unique viewers", "total viewers", "viewers"],
      likes: ["total likes", "likes"],
      comments: ["total comments", "comments"],
      shares: ["total shares", "shares"],
      saves: ["total saves", "saves", "total favorites", "favorites", "add to favorites"],
      followers_gained: ["new followers", "total new followers", "followers gained"],
      profile_visits: ["profile views", "profile visits"],
      watch_time_seconds: ["total play time", "total time watched", "total watch time", "watch time"],
    },
    signature: [
      ["video link"],
      ["post time"],
      ["total likes"],
      ["total comments"],
      ["total shares"],
      ["total views", "video views"],
      ["video title"],
      ["total play time", "total time watched"],
      ["total favorites", "total saves"],
    ],
    minScore: 3,
    hosts: /(^|\.)tiktok\.com$/,
    dateOrder: "mdy",
  },
  {
    id: "youtube_studio",
    app: "YouTube Studio",
    label: "Table data.csv",
    platform: "youtube",
    columns: {
      url: ["content", "video", "video id", "video url", "video link"],
      title: ["video title", "title"],
      published: ["video publish time", "publish time", "video publish date", "published", "publish date"],
      views: ["views"],
      reach: ["unique viewers"],
      likes: ["likes"],
      comments: ["comments added", "comments"],
      shares: ["shares"],
      followers_gained: ["subscribers", "subscribers gained", "net subscribers"],
      watch_time_seconds: ["watch time hours", "watch time minutes", "watch time"],
      avg_retention: ["average percentage viewed", "avg percentage viewed"],
    },
    signature: [
      ["content"],
      ["video title"],
      ["video publish time"],
      ["watch time hours"],
      ["average view duration"],
      ["impressions click through rate"],
      ["average percentage viewed"],
      ["subscribers", "subscribers gained"],
      ["duration"],
    ],
    minScore: 3,
    hosts: /(^|\.)(youtube\.com|youtu\.be)$/,
    dateOrder: "mdy",
    urlFromCell: youtubeUrlFromCell,
  },
]

/** How many presets list each signature header — headers only one export has are the telling ones. */
const SIGNATURE_USE = new Map<string, number>()
for (const preset of IMPORT_PRESETS) {
  for (const name of new Set(preset.signature.flat())) SIGNATURE_USE.set(name, (SIGNATURE_USE.get(name) ?? 0) + 1)
}

export function getImportPreset(id: ImportPresetId | string | null | undefined): ImportPreset | null {
  return IMPORT_PRESETS.find((preset) => preset.id === id) ?? null
}

/** The preset's own columns only (the generic matcher fills the rest — see `autoMapColumns`). */
export function presetMapping(preset: ImportPreset, headers: readonly string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const used = new Set<number>()
  const mapping: ColumnMapping = {}
  for (const [field, names] of Object.entries(preset.columns) as [ImportField, string[]][]) {
    for (const name of names) {
      const index = normalized.findIndex((h, i) => !used.has(i) && h === name)
      if (index >= 0) {
        mapping[field] = index
        used.add(index)
        break
      }
    }
  }
  return mapping
}

export interface PresetDetection {
  preset: ImportPreset
  /** Header names, as written in the file, that identified the export. */
  headers: string[]
  /** Post-link host in the rows that confirmed it ("instagram.com"). */
  host: string | null
  /** A "Post type" value that confirmed it ("IG reel"). */
  postType: string | null
  score: number
}

function hostOf(raw: string): string {
  const s = raw.trim()
  if (!s || !/[./]/.test(s) || /\s/.test(s)) return ""
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase()
    return host.includes(".") ? host.replace(/^(www|m|mobile|web)\./, "") : ""
  } catch {
    return ""
  }
}

/**
 * Which export this is, from the header row (and, when present, the post links and "Post type"
 * values in the first rows). Null when no preset scores enough or two tie — then the columns are
 * matched by name only.
 */
export function detectPreset(headers: readonly string[], rows: readonly (readonly string[])[] = []): PresetDetection | null {
  const normalized = headers.map(normalizeHeader)
  const sample = rows.slice(0, 30)
  const typeIndex = normalized.indexOf("post type")

  const scored = IMPORT_PRESETS.map((preset): PresetDetection => {
    const found: { header: string; use: number }[] = []
    for (const group of preset.signature) {
      const index = normalized.findIndex((h) => group.includes(h))
      if (index >= 0) found.push({ header: headers[index], use: Math.min(...group.map((name) => SIGNATURE_USE.get(name) ?? 1)) })
    }
    // Headers only this export has come first: they are the convincing part of "why".
    const evidence = found.sort((a, b) => a.use - b.use).map((f) => f.header)
    const result: PresetDetection = { preset, headers: evidence, host: null, postType: null, score: evidence.length }
    const mapping = presetMapping(preset, headers)
    const hasKey = mapping.url !== undefined || mapping.title !== undefined || mapping.caption !== undefined
    const hasMetric = METRIC_FIELDS.some((f) => mapping[f.key] !== undefined)
    if (!hasKey || !hasMetric) return { ...result, score: 0 }

    const urlIndex = mapping.url
    if (urlIndex !== undefined && sample.length) {
      const hosts = sample
        .map((cells) => hostOf(preset.urlFromCell ? preset.urlFromCell(cells[urlIndex] ?? "") : (cells[urlIndex] ?? "")))
        .filter(Boolean)
      if (hosts.length) {
        const own = hosts.filter((h) => preset.hosts.test(h))
        if (own.length * 2 >= hosts.length) {
          result.score += 2
          result.host = own[0]
        } else if (!own.length) result.score -= 5
      }
    }
    if (preset.typeHint && typeIndex >= 0 && sample.length) {
      const types = sample.map((cells) => (cells[typeIndex] ?? "").trim()).filter(Boolean)
      const hits = types.filter((t) => preset.typeHint?.test(t))
      if (types.length && hits.length * 2 >= types.length) {
        result.score += 2
        result.postType = hits[0]
      }
    }
    return result
  }).sort((a, b) => b.score - a.score)

  const [best, second] = scored
  if (!best || best.score < best.preset.minScore) return null
  if (second && second.score === best.score) return null
  return best
}
