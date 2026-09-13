/**
 * Column catalogue of the Post Performance table (and its CSV export).
 * Metric accessors return null for posts without analytics so they sort last and read "—".
 */
import type { TieredRow } from "@/lib/analytics"
import type { ValueKind } from "./format"

export type PostMetricId =
  | "views"
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "followers"
  | "profile_visits"
  | "link_clicks"
  | "leads"
  | "sales"
  | "watch_time"
  | "retention"
  | "engagement_rate"
  | "share_rate"
  | "save_rate"
  | "lead_conversion"
  | "follower_conversion"

export interface PostMetricField {
  id: PostMetricId
  label: string
  /** Short table header. */
  header: string
  kind: Exclude<ValueKind, "multiple">
  group: "counts" | "rates"
  value: (row: TieredRow) => number | null
  defaultVisible: boolean
}

const counted = (pick: (row: TieredRow) => number) => (row: TieredRow) => (row.metric ? pick(row) : null)

export const POST_METRIC_FIELDS: PostMetricField[] = [
  { id: "views", label: "Views", header: "Views", kind: "count", group: "counts", value: counted((r) => r.views), defaultVisible: true },
  { id: "reach", label: "Reach", header: "Reach", kind: "count", group: "counts", value: counted((r) => r.reach), defaultVisible: false },
  { id: "engagement_rate", label: "Engagement rate", header: "Eng. rate", kind: "percent", group: "rates", value: (r) => r.rates.engagement_rate, defaultVisible: true },
  { id: "likes", label: "Likes", header: "Likes", kind: "count", group: "counts", value: counted((r) => r.likes), defaultVisible: false },
  { id: "comments", label: "Comments", header: "Comments", kind: "count", group: "counts", value: counted((r) => r.comments), defaultVisible: false },
  { id: "shares", label: "Shares", header: "Shares", kind: "count", group: "counts", value: counted((r) => r.shares), defaultVisible: false },
  { id: "saves", label: "Saves", header: "Saves", kind: "count", group: "counts", value: counted((r) => r.saves), defaultVisible: true },
  { id: "followers", label: "Followers gained", header: "Followers", kind: "count", group: "counts", value: counted((r) => r.followersGained), defaultVisible: true },
  { id: "profile_visits", label: "Profile visits", header: "Profile visits", kind: "count", group: "counts", value: counted((r) => r.profileVisits), defaultVisible: false },
  { id: "link_clicks", label: "Link clicks", header: "Link clicks", kind: "count", group: "counts", value: counted((r) => r.linkClicks), defaultVisible: false },
  { id: "leads", label: "Leads", header: "Leads", kind: "count", group: "counts", value: counted((r) => r.leads), defaultVisible: true },
  { id: "sales", label: "Sales", header: "Sales", kind: "count", group: "counts", value: counted((r) => r.sales), defaultVisible: false },
  { id: "watch_time", label: "Watch time", header: "Watch time", kind: "duration", group: "counts", value: (r) => r.watchTimeSeconds, defaultVisible: false },
  { id: "retention", label: "Avg. retention", header: "Retention", kind: "percent", group: "counts", value: (r) => r.retention, defaultVisible: false },
  { id: "share_rate", label: "Share rate", header: "Share rate", kind: "percent", group: "rates", value: (r) => r.rates.share_rate, defaultVisible: false },
  { id: "save_rate", label: "Save rate", header: "Save rate", kind: "percent", group: "rates", value: (r) => r.rates.save_rate, defaultVisible: false },
  { id: "lead_conversion", label: "Lead conversion", header: "Lead conv.", kind: "percent", group: "rates", value: (r) => r.rates.lead_conversion_rate, defaultVisible: false },
  { id: "follower_conversion", label: "Follower conversion", header: "Follower conv.", kind: "percent", group: "rates", value: (r) => r.rates.follower_conversion_rate, defaultVisible: false },
]

export type PostDetailColumnId = "platform" | "date" | "pillar" | "format" | "tier" | "ratio"
export type PostColumnId = PostDetailColumnId | PostMetricId

export const POST_DETAIL_COLUMNS: { id: PostDetailColumnId; label: string; defaultVisible: boolean }[] = [
  { id: "platform", label: "Platform", defaultVisible: true },
  { id: "date", label: "Published", defaultVisible: true },
  { id: "pillar", label: "Pillar", defaultVisible: true },
  { id: "format", label: "Format", defaultVisible: false },
  { id: "tier", label: "Tier", defaultVisible: true },
  { id: "ratio", label: "vs platform average", defaultVisible: false },
]

export const ALL_POST_COLUMN_IDS: PostColumnId[] = [...POST_DETAIL_COLUMNS.map((c) => c.id), ...POST_METRIC_FIELDS.map((f) => f.id)]

export const DEFAULT_POST_COLUMNS: PostColumnId[] = [
  ...POST_DETAIL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id),
  ...POST_METRIC_FIELDS.filter((f) => f.defaultVisible).map((f) => f.id),
]

/** Stored visibility → known column ids (null when the value is unusable). */
export function sanitizeColumns(value: unknown): PostColumnId[] | null {
  if (!Array.isArray(value)) return null
  const known = new Set<string>(ALL_POST_COLUMN_IDS)
  return value.filter((v): v is PostColumnId => typeof v === "string" && known.has(v))
}
