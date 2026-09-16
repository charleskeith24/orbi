/**
 * Bootstrap analytics history from an export: rows that match no post in the workspace can become
 * published content items with their first metrics snapshot. Pure planning — the UI writes through
 * the domain operations (`logPublishedPost`, then `logMetrics`). Off by default and chosen per row.
 * A row never creates a post that already exists (same link, or same title on the same platform)
 * or one that an earlier row of the same file already creates.
 */
import { toISODate } from "@/lib/dates"
import type { ID, InsertRow, ISODate, PlatformId } from "@/lib/types"
import {
  looksLikeUrl,
  normalizeTitle,
  normalizeUrl,
  platformFromUrl,
  type ImportCandidate,
  type ImportRow,
  type PlannedImportRow,
} from "./analytics-import"

export type BootstrapProblem = "no_key" | "no_values" | "no_platform" | "exists" | "in_file"

export interface BootstrapRow {
  row: ImportRow
  /** Title for the new post ("" → the UI names it from platform and date). */
  title: string
  platform: PlatformId | null
  /** Post link with a scheme ("" when the file has none). */
  url: string
  /** Publish time from the file; null → the recorded-on day is used. */
  publishedAt: Date | null
  /** Why this row can't create a post; null = it can. */
  problem: BootstrapProblem | null
  /** The post that already exists (problem "exists"). */
  existingId: ID | null
  /** The earlier row that creates the same post (problem "in_file"). */
  firstLine: number | null
}

export interface BootstrapOptions {
  /** "Posts are from" — used when neither the row nor its link names the platform. */
  platform: PlatformId | null
}

function withScheme(url: string): string {
  const s = url.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`
}

/** Every row that matched no post, with whether it could become a new published post. */
export function planBootstrap(
  plan: readonly PlannedImportRow[],
  candidates: readonly ImportCandidate[],
  options: BootstrapOptions
): BootstrapRow[] {
  const byUrl = new Map<string, ID>()
  const byTitle = new Map<string, ID>()
  for (const candidate of candidates) {
    if (candidate.normUrl) byUrl.set(candidate.normUrl, candidate.id)
    if (candidate.normTitle) byTitle.set(`${candidate.platform}|${candidate.normTitle}`, candidate.id)
  }

  const seen = new Map<string, number>()
  const result: BootstrapRow[] = []
  for (const { row, match } of plan) {
    if (match.status !== "unmatched") continue
    const url = row.url && looksLikeUrl(row.url) ? withScheme(row.url) : ""
    const platform = row.platform ?? platformFromUrl(url) ?? options.platform
    const normUrl = url ? normalizeUrl(url) : ""
    const normTitle = normalizeTitle(row.title)
    let problem: BootstrapProblem | null = null
    let existingId: ID | null = null
    let firstLine: number | null = null

    if (!url && !normTitle) problem = "no_key"
    else if (!Object.keys(row.metrics).length) problem = "no_values"
    else if (!platform) problem = "no_platform"
    else {
      existingId = (normUrl ? byUrl.get(normUrl) : undefined) ?? (normTitle ? byTitle.get(`${platform}|${normTitle}`) : undefined) ?? null
      if (existingId) problem = "exists"
      else {
        const key = normUrl ? `url:${normUrl}` : `title:${platform}|${normTitle}|${row.published ? toISODate(row.published) : ""}`
        const first = seen.get(key)
        if (first !== undefined) {
          problem = "in_file"
          firstLine = first
        } else seen.set(key, row.line)
      }
    }
    result.push({ row, title: row.title, platform, url, publishedAt: row.published, problem, existingId, firstLine })
  }
  return result
}

/**
 * The content item to create for one bootstrap row: published, on the row's platform, at the
 * file's publish time (or noon on `fallbackDate`), keeping the post link so a re-import matches it.
 */
export function bootstrapItemValues(
  entry: BootstrapRow,
  options: { fallbackTitle: string; fallbackDate: ISODate; notes: string }
): InsertRow<"content_items"> {
  if (!entry.platform || entry.problem) throw new Error("This row can't create a post")
  const published = entry.publishedAt ?? new Date(`${options.fallbackDate}T12:00:00`)
  return {
    title: (entry.title || options.fallbackTitle).slice(0, 200),
    platform: entry.platform,
    stage: "published",
    published_at: published.toISOString(),
    published_url: entry.url,
    notes: options.notes,
  }
}
