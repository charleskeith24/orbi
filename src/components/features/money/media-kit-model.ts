/**
 * Media kit model — everything the one-pager shows, computed from the workspace (Brand HQ, platform
 * strategies, analytics, personas, rate cards, deals). Numbers are never invented: a metric without data is
 * null, and each gap is listed in `missing` so the page can prompt for it.
 */
import { aggregateRows, platformPerformance, scopedRows, trailingDays, type DateRange } from "@/lib/analytics"
import { PLATFORM_IDS } from "@/lib/constants"
import type { AudiencePersona, BrandDeal, ContentItem, Database, PlatformId, RateCard } from "@/lib/types"
import { COLLAB_DEAL_STATUSES } from "./money-model"

/** Analytics window for the platform and top-post numbers. */
export const MEDIA_KIT_DAYS = 90
export const MEDIA_KIT_TOP_POSTS = 3

export interface MediaKitPlatform {
  platform: PlatformId
  /** Without a leading "@". */
  handle: string
  followers: number | null
  /** Posts published in the window. */
  posts: number
  /** Posts with analytics — the denominator of the averages. */
  measured: number
  avgViews: number | null
  /** Σ engagements ÷ Σ reach (views when reach is missing) × 100. */
  engagementRate: number | null
}

export interface MediaKitPost {
  item: ContentItem
  views: number
  engagementRate: number | null
  publishedAt: Date
}

export type MediaKitGap =
  | "name"
  | "niche"
  | "bio"
  | "contact"
  | "platforms"
  | "handles"
  | "followers"
  | "analytics"
  | "persona"
  | "rate_cards"
  | "collabs"

export interface MediaKitTotals {
  /** Sum of the follower counts that are filled in. */
  followers: number | null
  /** Platforms with a follower count. */
  followersKnown: number
  posts: number
  measured: number
  avgViews: number | null
  engagementRate: number | null
}

export interface MediaKitData {
  period: DateRange
  totals: MediaKitTotals
  name: string
  brandName: string
  niche: string
  /** Third person, e.g. "Raf helps online sellers … through …". Empty without audience + result. */
  positioning: string
  bio: string
  /** The bio is Brand HQ's first-person "Who am I" because no media-kit bio is set. */
  bioIsFallback: boolean
  location: string
  email: string
  website: string
  platforms: MediaKitPlatform[]
  topPosts: MediaKitPost[]
  persona: AudiencePersona | null
  rateCards: RateCard[]
  collabs: BrandDeal[]
  missing: MediaKitGap[]
}

export const stripHandle = (handle: string) => handle.trim().replace(/^@+/, "")

/** "Raf Mendoza" + audience/result/method → "Raf helps … through …." (empty without audience and result). */
export function thirdPersonPositioning(name: string, audience: string, result: string, method: string): string {
  const who = name.trim().split(/\s+/)[0] ?? ""
  const a = audience.trim()
  const r = result.trim().replace(/^to\s+/i, "").replace(/[.\s]+$/, "")
  const m = method.trim().replace(/[.\s]+$/, "")
  if (!who || !a || !r) return ""
  return `${who} helps ${a} ${r}${m ? ` through ${m}` : ""}.`
}

/** Platforms to show: active platform strategies and Brand HQ's main platforms, main platforms first. */
function kitPlatforms(db: Database): PlatformId[] {
  const brand = db.brand_profiles[0]
  const main = brand?.main_platforms ?? []
  const active = db.content_platforms.filter((s) => s.is_active).map((s) => s.platform)
  const set = new Set<PlatformId>([...main, ...active])
  return [...set].sort((a, b) => {
    const ia = main.indexOf(a)
    const ib = main.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || PLATFORM_IDS.indexOf(a) - PLATFORM_IDS.indexOf(b)
  })
}

export function buildMediaKit(db: Database, now: Date): MediaKitData {
  const brand = db.brand_profiles[0]
  const period = trailingDays(now, MEDIA_KIT_DAYS)
  const performance = new Map(platformPerformance(db, now, { days: MEDIA_KIT_DAYS }).map((p) => [p.platform, p]))

  const platforms: MediaKitPlatform[] = kitPlatforms(db).map((platform) => {
    const strategy = db.content_platforms.find((s) => s.platform === platform)
    const perf = performance.get(platform)
    const measured = perf?.measured ?? 0
    return {
      platform,
      handle: stripHandle(strategy?.handle ?? ""),
      followers: strategy?.current_followers ?? null,
      posts: perf?.posts ?? 0,
      measured,
      avgViews: measured ? (perf?.avgViews ?? null) : null,
      engagementRate: measured ? (perf?.engagementRate ?? null) : null,
    }
  })

  const windowRows = scopedRows(db, now, { days: MEDIA_KIT_DAYS })
  const overall = aggregateRows(windowRows)
  const known = platforms.filter((p) => p.followers !== null)
  const totals: MediaKitTotals = {
    followers: known.length ? known.reduce((acc, p) => acc + (p.followers ?? 0), 0) : null,
    followersKnown: known.length,
    posts: overall.posts,
    measured: overall.measured,
    avgViews: overall.measured ? overall.avgViews : null,
    engagementRate: overall.measured ? overall.engagementRate : null,
  }

  const topPosts: MediaKitPost[] = windowRows
    .filter((r) => r.metric && r.views > 0)
    .sort((a, b) => b.views - a.views || b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, MEDIA_KIT_TOP_POSTS)
    .map((r) => ({ item: r.item, views: r.views, engagementRate: r.rates.engagement_rate, publishedAt: r.publishedAt }))

  const personas = db.audience_personas
  const persona = personas.find((p) => p.is_primary) ?? (personas.length === 1 ? personas[0] : null)

  const rateCards = db.rate_cards
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))

  const collabs = db.brand_deals
    .filter((d) => d.show_in_media_kit && COLLAB_DEAL_STATUSES.includes(d.status) && d.brand_name.trim())
    .sort((a, b) => (b.paid_at ?? b.due_date ?? b.created_at).localeCompare(a.paid_at ?? a.due_date ?? a.created_at))

  const name = brand?.name.trim() ?? ""
  const kitBio = brand?.media_kit_bio.trim() ?? ""
  const whoAmI = brand?.who_am_i.trim() ?? ""
  const bio = kitBio || whoAmI

  const missing: MediaKitGap[] = []
  if (!name && !brand?.brand_name.trim()) missing.push("name")
  if (!brand?.niche.trim()) missing.push("niche")
  if (!kitBio) missing.push("bio")
  if (!brand?.contact_email.trim()) missing.push("contact")
  if (!platforms.length) missing.push("platforms")
  if (platforms.some((p) => !p.handle)) missing.push("handles")
  if (platforms.some((p) => p.followers === null)) missing.push("followers")
  if (platforms.length && !platforms.some((p) => p.measured > 0)) missing.push("analytics")
  if (!persona) missing.push("persona")
  if (!rateCards.length) missing.push("rate_cards")
  if (!collabs.length) missing.push("collabs")

  return {
    period,
    totals,
    name,
    brandName: brand?.brand_name.trim() ?? "",
    niche: brand?.niche.trim() ?? "",
    positioning: brand
      ? thirdPersonPositioning(name || brand.brand_name, brand.positioning_audience, brand.positioning_result, brand.positioning_method)
      : "",
    bio,
    bioIsFallback: !kitBio && Boolean(whoAmI),
    location: brand?.location.trim() ?? "",
    email: brand?.contact_email.trim() ?? "",
    website: brand?.website.trim() ?? "",
    platforms,
    topPosts,
    persona,
    rateCards,
    collabs,
    missing,
  }
}
