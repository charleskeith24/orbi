"use client"

import { useMemo } from "react"
import { DataTable, PillarBadge, PlatformIcon, type DataTableColumn } from "@/components/common"
import { usageCount, type SourceUsage } from "@/components/features/stories/story-model"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ContentPillar, ID, ResearchItem, ResearchStatus } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { researchMessages } from "./messages"
import { useResearchActions } from "./research-actions"
import { ResearchActionsMenu } from "./research-actions-menu"
import { ResearchStatusBadge, ResearchTypeBadge } from "./research-badges"
import { researchTypeLabel } from "./research-model"

const STATUS_RANK: Record<ResearchStatus, number> = { saved: 0, analyzed: 1, adapted: 2, archived: 3 }

/** Table view of the Research Library; a row opens the reference. */
export function ResearchTable({
  items,
  usage,
  pillars,
  empty,
}: {
  items: ResearchItem[]
  usage: ReadonlyMap<ID, SourceUsage>
  pillars: ReadonlyMap<ID, ContentPillar>
  empty?: React.ReactNode
}) {
  const t = useT(researchMessages)
  const actions = useResearchActions()
  const columns = useMemo<DataTableColumn<ResearchItem>[]>(
    () => [
      {
        id: "title",
        header: t("col_reference"),
        sortValue: (r) => r.title.toLowerCase(),
        // One line per reference (Calm UI): creator and source are in the tooltip, the Cards view and the sheet.
        cell: (r) => (
          <div className="flex max-w-[22rem] min-w-48 items-center gap-2" title={[r.creator, r.source].filter(Boolean).join(" · ") || undefined}>
            {r.platform ? (
              <PlatformIcon platform={r.platform} label={PLATFORMS[r.platform].label} className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <span aria-hidden className="size-3.5 shrink-0" />
            )}
            <span className="truncate font-medium">{r.title || t("untitled")}</span>
          </div>
        ),
      },
      {
        id: "type",
        header: t("type"),
        sortValue: (r) => researchTypeLabel(r.type),
        cell: (r) => <ResearchTypeBadge type={r.type} />,
        hideBelow: "md",
      },
      {
        id: "topic",
        header: t("col_topic"),
        sortValue: (r) => r.topic.toLowerCase() || null,
        cell: (r) => <span className="block max-w-40 truncate text-muted-foreground">{r.topic || "—"}</span>,
        hideBelow: "lg",
      },
      {
        id: "status",
        header: t("status"),
        sortValue: (r) => STATUS_RANK[r.status],
        cell: (r) => <ResearchStatusBadge status={r.status} />,
      },
      {
        id: "pillar",
        header: t("pillar"),
        sortValue: (r) => (r.pillar_id ? (pillars.get(r.pillar_id)?.name ?? null) : null),
        cell: (r) => <PillarBadge pillar={r.pillar_id ? (pillars.get(r.pillar_id) ?? null) : null} variant="plain" />,
        hideBelow: "lg",
      },
      {
        id: "saved",
        header: t("col_saved"),
        sortValue: (r) => r.created_at,
        cell: (r) => <span className="whitespace-nowrap text-muted-foreground num">{formatDate(r.created_at, "MMM d")}</span>,
        hideBelow: "sm",
      },
      {
        id: "ideas",
        header: t("col_ideas"),
        align: "right",
        sortValue: (r) => usageCount(usage, r.id),
        cell: (r) => {
          const count = usageCount(usage, r.id)
          return count ? formatNumber(count) : <span className="text-muted-foreground">—</span>
        },
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("col_actions")}</span>,
        className: "w-10",
        cell: (r) => (
          <div className="flex justify-end">
            <ResearchActionsMenu item={r} />
          </div>
        ),
      },
    ],
    [pillars, usage, t]
  )

  return (
    <DataTable
      rows={items}
      columns={columns}
      getRowId={(r) => r.id}
      onRowClick={(r) => actions.open(r.id)}
      rowLabel={(r) => t("open_row", { title: r.title || t("reference_lower") })}
      empty={empty}
      aria-label={t("table_aria")}
    />
  )
}
