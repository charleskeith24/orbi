/** Row builders for the analytics feature tests (not imported by app code). */
import { NO_TIER, toPerformanceRow, type TierInfo, type TieredRow } from "@/lib/analytics"
import { buildRow } from "@/lib/data/defaults"
import type { InsertRow, PlatformId } from "@/lib/types"

/** Friday, Sep 11 2026, 3 PM local. */
export const NOW = new Date(2026, 8, 11, 15, 0)

let seq = 0

export function makeRow(options: {
  publishedAt: Date
  platform?: PlatformId
  pillarId?: string | null
  title?: string
  /** null = no analytics logged. */
  metric?: InsertRow<"content_metrics"> | null
  tier?: Partial<TierInfo>
}): TieredRow {
  const id = `item-${++seq}`
  const item = buildRow(
    "content_items",
    {
      id,
      title: options.title ?? `Post ${id}`,
      platform: options.platform ?? "facebook",
      pillar_id: options.pillarId ?? null,
      stage: "published",
      published_at: options.publishedAt.toISOString(),
    },
    "user",
    NOW
  )
  const metric =
    options.metric === null
      ? null
      : buildRow("content_metrics", { content_item_id: id, platform: item.platform, recorded_at: "2026-09-11", ...options.metric }, "user", NOW)
  return { ...toPerformanceRow(item, metric, options.publishedAt, NOW), ...NO_TIER, ...options.tier }
}
