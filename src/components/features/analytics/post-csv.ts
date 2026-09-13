/**
 * CSV export of the Post Performance table: every column, raw numbers, rates rounded to 2 decimals.
 */
import type { TieredRow } from "@/lib/analytics"
import { FUNNEL_STAGES, HOOK_CATEGORIES, PERFORMANCE_TIERS, PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { ContentFormat, ContentPillar, ID } from "@/lib/types"
import { toCsv, type CsvColumn } from "./csv"
import { roundOrNull } from "./format"
import { POST_METRIC_FIELDS } from "./post-fields"

export interface PostLookups {
  pillars: Map<ID, ContentPillar>
  formats: Map<ID, ContentFormat>
}

export function tierLabel(row: TieredRow): string {
  if (!row.metric) return "No analytics"
  if (row.ratio === null) return "Not tiered yet"
  return PERFORMANCE_TIERS[row.tier].label
}

export function postsCsv(rows: TieredRow[], { pillars, formats }: PostLookups): string {
  const columns: CsvColumn<TieredRow>[] = [
    { header: "Title", value: (r) => r.item.title },
    { header: "Platform", value: (r) => PLATFORMS[r.platform]?.label ?? r.platform },
    { header: "Published", value: (r) => formatDate(r.publishedAt, "yyyy-MM-dd HH:mm") },
    { header: "Pillar", value: (r) => (r.pillarId ? (pillars.get(r.pillarId)?.name ?? "") : "") },
    { header: "Format", value: (r) => (r.formatId ? (formats.get(r.formatId)?.name ?? "") : "") },
    { header: "Funnel stage", value: (r) => (r.funnelStage ? FUNNEL_STAGES[r.funnelStage].label : "") },
    { header: "Hook style", value: (r) => (r.hookCategory ? HOOK_CATEGORIES[r.hookCategory].label : "") },
    ...POST_METRIC_FIELDS.map<CsvColumn<TieredRow>>((field) => ({
      header: field.kind === "percent" ? `${field.label} (%)` : field.kind === "duration" ? `${field.label} (sec)` : field.label,
      value: (r) => (field.kind === "count" ? field.value(r) : roundOrNull(field.value(r))),
    })),
    { header: "Engagements", value: (r) => (r.metric ? r.engagements : null) },
    { header: "Tier", value: tierLabel },
    { header: "vs platform average (x)", value: (r) => roundOrNull(r.ratio) },
    { header: "Snapshot date", value: (r) => r.metric?.recorded_at ?? "" },
    { header: "URL", value: (r) => r.item.published_url },
    { header: "Content ID", value: (r) => r.id },
  ]
  return toCsv(rows, columns)
}
