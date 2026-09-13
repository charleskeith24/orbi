"use client"

import { Plus } from "lucide-react"
import { ContentThumbnail, FormatLabel, PillarBadge, PlatformLabel, TierBadge, type DataTableColumn } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { TieredRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { PerformanceTier } from "@/lib/types"
import { formatRatio, formatValue } from "./format"
import type { PostLookups } from "./post-csv"
import { POST_METRIC_FIELDS, type PostColumnId } from "./post-fields"

const TIER_RANK: Record<PerformanceTier, number> = { normal: 1, good: 2, winner: 3, breakout: 4 }

/** Tier facet key: a tier, "untiered" (no ratio yet) or "none" (no analytics). */
export function tierKey(row: TieredRow): string {
  if (!row.metric) return "none"
  return row.ratio === null ? "untiered" : row.tier
}

export function buildPostColumns({
  visible,
  lookups,
  onAddAnalytics,
}: {
  visible: ReadonlySet<PostColumnId>
  lookups: PostLookups
  onAddAnalytics: (row: TieredRow) => void
}): DataTableColumn<TieredRow>[] {
  const { pillars, formats } = lookups
  const pillarName = (r: TieredRow) => (r.pillarId ? (pillars.get(r.pillarId)?.name ?? "") : "")
  const formatName = (r: TieredRow) => (r.formatId ? (formats.get(r.formatId)?.name ?? "") : "")

  const columns: DataTableColumn<TieredRow>[] = [
    {
      id: "title",
      header: "Post",
      className: "min-w-[15rem] max-w-[22rem]",
      sortValue: (r) => r.item.title.toLowerCase(),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <ContentThumbnail item={r.item} size="sm" aspect="square" />
          <span className="line-clamp-2 min-w-0 text-sm leading-5 whitespace-normal">{r.item.title || "Untitled post"}</span>
        </div>
      ),
    },
  ]

  if (visible.has("platform")) {
    columns.push({
      id: "platform",
      header: "Platform",
      sortValue: (r) => PLATFORMS[r.platform].label,
      cell: (r) => <PlatformLabel platform={r.platform} className="text-xs whitespace-nowrap" />,
    })
  }
  if (visible.has("date")) {
    columns.push({
      id: "date",
      header: "Published",
      sortValue: (r) => r.publishedAt.getTime(),
      cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground">{formatDate(r.publishedAt, "MMM d, yyyy")}</span>,
    })
  }
  if (visible.has("pillar")) {
    columns.push({
      id: "pillar",
      header: "Pillar",
      sortValue: (r) => pillarName(r) || null,
      cell: (r) => <PillarBadge pillar={r.pillarId ? (pillars.get(r.pillarId) ?? null) : null} className="max-w-40" />,
    })
  }
  if (visible.has("format")) {
    columns.push({
      id: "format",
      header: "Format",
      sortValue: (r) => formatName(r) || null,
      cell: (r) => <FormatLabel format={r.formatId ? (formats.get(r.formatId) ?? null) : null} className="max-w-40" />,
    })
  }
  for (const field of POST_METRIC_FIELDS) {
    if (!visible.has(field.id)) continue
    columns.push({
      id: field.id,
      header: field.header,
      align: "right",
      className: "whitespace-nowrap",
      headerClassName: "whitespace-nowrap",
      sortValue: field.value,
      cell: (r) => formatValue(field.value(r), field.kind),
    })
  }
  if (visible.has("tier")) {
    columns.push({
      id: "tier",
      header: "Tier",
      className: "whitespace-nowrap",
      headerClassName: "whitespace-nowrap",
      sortValue: (r) => (r.metric ? TIER_RANK[r.tier] * 1000 + (r.ratio ?? 0) : null),
      cell: (r) => {
        if (!r.metric) {
          return (
            <Button
              variant="outline"
              size="xs"
              onClick={() => onAddAnalytics(r)}
              aria-label={`Add analytics for ${r.item.title || "untitled post"}`}
            >
              <Plus aria-hidden />
              Add
            </Button>
          )
        }
        if (r.ratio === null) return <span className="text-xs whitespace-nowrap text-muted-foreground">Not tiered</span>
        return r.tier === "normal" ? <span className="text-xs text-muted-foreground">Normal</span> : <TierBadge tier={r.tier} />
      },
    })
  }
  if (visible.has("ratio")) {
    columns.push({
      id: "ratio",
      header: "vs avg",
      align: "right",
      sortValue: (r) => r.ratio,
      cell: (r) => formatRatio(r.ratio),
    })
  }
  return columns
}
