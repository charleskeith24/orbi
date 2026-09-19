/**
 * Collabs — per-collab results and collab lift. Computed from the workspace only: the latest analytics
 * snapshot of each post (spec §25), never estimated. Pure functions of (db, now).
 *
 * Collab lift compares the creator's collab posts with their solo posts: same platform, last 90 days,
 * medians per post. Each collab post is matched with the median solo post on its own platform, so a
 * TikTok collab is never measured against LinkedIn numbers. Below the minimum sample the result says
 * so (`enough: false`) and how many more posts are needed.
 */
import type { Collab, ContentItem, ContentMetric, Database, ID, PlatformId } from "@/lib/types"
import { median } from "@/lib/utils"
import { engagementsOf, rateBase, sharedLatestMetrics } from "./metrics"
import { finiteOr0, inRange, isPublishedItem, publishedAtOf, trailingDays } from "./shared"

export const COLLAB_LIFT_WINDOW_DAYS = 90
/** Collab posts with analytics needed before a lift is shown. */
export const COLLAB_LIFT_MIN_COLLAB_POSTS = 3
/** Solo posts with analytics, on the same platforms as those collab posts, needed before a lift is shown. */
export const COLLAB_LIFT_MIN_SOLO_POSTS = 5
/** A platform's solo median is only a baseline with at least this many solo posts on it (one post is too noisy). */
export const COLLAB_LIFT_MIN_SOLO_PER_PLATFORM = 3

/** Posts made for collabs that happened (every status except Declined — a declined collab's post is a solo post). */
export function collabItemIds(collabs: readonly Collab[]): Set<ID> {
  const ids = new Set<ID>()
  for (const collab of collabs) {
    if (collab.status === "declined") continue
    for (const id of collab.content_item_ids) ids.add(id)
  }
  return ids
}

/** The first collab (not declined) a content item was made for, or null. */
export function collabForItem(collabs: readonly Collab[], itemId: ID): Collab | null {
  return collabs.find((c) => c.status !== "declined" && c.content_item_ids.includes(itemId)) ?? null
}

/* ------------------------------ Per collab ------------------------------ */

export interface CollabResults {
  /** Linked posts that still exist. */
  posts: number
  /** Linked posts with an analytics snapshot. */
  measured: number
  views: number
  /** Likes + comments + shares + saves. */
  engagements: number
  /** Engagements ÷ Σ reach (or views), in %; null without a denominator. */
  engagementRate: number | null
  followersGained: number
}

/** Totals over the latest snapshot of each linked post. */
export function collabResults(collab: Pick<Collab, "content_item_ids">, db: Pick<Database, "content_items" | "content_metrics">): CollabResults {
  const latest = sharedLatestMetrics(db)
  const existing = new Set(db.content_items.map((i) => i.id))
  const linked = [...new Set(collab.content_item_ids)].filter((id) => existing.has(id))
  let measured = 0
  let views = 0
  let engagements = 0
  let base = 0
  let followersGained = 0
  for (const id of linked) {
    const m = latest.get(id)
    if (!m) continue
    measured++
    views += finiteOr0(m.views)
    engagements += engagementsOf(m)
    base += rateBase(m)
    followersGained += finiteOr0(m.followers_gained)
  }
  return {
    posts: linked.length,
    measured,
    views,
    engagements,
    engagementRate: base > 0 ? (engagements / base) * 100 : null,
    followersGained,
  }
}

/* -------------------------------- Lift -------------------------------- */

export interface CollabLiftMeasure {
  /** Median collab post ÷ median matched solo post; null when the solo median is 0. */
  lift: number | null
  /** Median value of a collab post. */
  collab: number
  /** Median of each collab post's same-platform solo median. */
  solo: number
}

export interface CollabLift {
  windowDays: number
  /** Enough posts to show a lift. */
  enough: boolean
  /** Collab posts in the window with analytics, on a platform that also has solo posts. */
  collabPosts: number
  /** Collab posts in the window with analytics on a platform with fewer than 3 solo posts to compare with. */
  unmatchedCollabPosts: number
  /** Solo posts in the window with analytics, on the platforms of those collab posts. */
  soloPosts: number
  /** How many more of each are needed (0 when there are enough). */
  needCollab: number
  needSolo: number
  platforms: PlatformId[]
  /** Null until there is enough data. */
  followers: CollabLiftMeasure | null
  views: CollabLiftMeasure | null
}

type LiftKey = "followers_gained" | "views"

function measure(collab: ContentItem[], soloByPlatform: Map<PlatformId, ContentMetric[]>, latest: Map<ID, ContentMetric>, key: LiftKey): CollabLiftMeasure {
  const value = (m: ContentMetric | undefined) => finiteOr0(m?.[key])
  const baselines = new Map<PlatformId, number>()
  for (const [platform, metrics] of soloByPlatform) baselines.set(platform, median(metrics.map(value)) ?? 0)
  const collabMedian = median(collab.map((i) => value(latest.get(i.id)))) ?? 0
  const soloMedian = median(collab.map((i) => baselines.get(i.platform) ?? 0)) ?? 0
  return { lift: soloMedian > 0 ? collabMedian / soloMedian : null, collab: collabMedian, solo: soloMedian }
}

/**
 * Collab posts vs solo posts over the last 90 days (published date), latest snapshot per post. Needs
 * ≥ 3 collab posts with analytics and ≥ 5 solo posts with analytics on the same platforms.
 */
export function collabLift(db: Pick<Database, "collabs" | "content_items" | "content_metrics">, now: Date): CollabLift {
  const range = trailingDays(now, COLLAB_LIFT_WINDOW_DAYS)
  const latest = sharedLatestMetrics(db)
  const collabIds = collabItemIds(db.collabs)
  const collab: ContentItem[] = []
  const solo: ContentItem[] = []
  for (const item of db.content_items) {
    if (!isPublishedItem(item) || !latest.has(item.id) || !inRange(publishedAtOf(item), range)) continue
    ;(collabIds.has(item.id) ? collab : solo).push(item)
  }

  const soloByPlatform = new Map<PlatformId, ContentMetric[]>()
  for (const item of solo) {
    const list = soloByPlatform.get(item.platform)
    if (list) list.push(latest.get(item.id)!)
    else soloByPlatform.set(item.platform, [latest.get(item.id)!])
  }
  for (const [platform, metrics] of soloByPlatform) if (metrics.length < COLLAB_LIFT_MIN_SOLO_PER_PLATFORM) soloByPlatform.delete(platform)
  const matched = collab.filter((i) => soloByPlatform.has(i.platform))
  const platforms = [...new Set(matched.map((i) => i.platform))]
  // Until there's a collab post to match, any solo post counts toward the minimum.
  const soloPosts = matched.length ? platforms.reduce((n, p) => n + (soloByPlatform.get(p)?.length ?? 0), 0) : solo.length
  const matchedSolo = new Map(platforms.map((p) => [p, soloByPlatform.get(p)!]))

  const needCollab = Math.max(0, COLLAB_LIFT_MIN_COLLAB_POSTS - matched.length)
  const needSolo = Math.max(0, COLLAB_LIFT_MIN_SOLO_POSTS - soloPosts)
  const enough = needCollab === 0 && needSolo === 0
  return {
    windowDays: COLLAB_LIFT_WINDOW_DAYS,
    enough,
    collabPosts: matched.length,
    unmatchedCollabPosts: collab.length - matched.length,
    soloPosts,
    needCollab,
    needSolo,
    platforms,
    followers: enough ? measure(matched, matchedSolo, latest, "followers_gained") : null,
    views: enough ? measure(matched, matchedSolo, latest, "views") : null,
  }
}
