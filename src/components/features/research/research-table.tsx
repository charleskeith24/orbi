"use client"

import { useMemo } from "react"
import { DataTable, PillarBadge, PlatformIcon, type DataTableColumn } from "@/components/common"
import { usageCount, type SourceUsage } from "@/components/features/stories/story-model"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { ContentPillar, ID, ResearchItem, ResearchStatus } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
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
  const actions = useResearchActions()
  const columns = useMemo<DataTableColumn<ResearchItem>[]>(
    () => [
      {
        id: "title",
        header: "Reference",
        sortValue: (r) => r.title.toLowerCase(),
        cell: (r) => (
          <div className="flex max-w-[20rem] min-w-48 flex-col">
            <span className="truncate font-medium">{r.title || "Untitled reference"}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {r.platform ? <PlatformIcon platform={r.platform} label={PLATFORMS[r.platform].label} className="size-3 shrink-0" /> : null}
              <span className="truncate">{[r.creator, r.source].filter(Boolean).join(" · ") || "—"}</span>
            </span>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        sortValue: (r) => researchTypeLabel(r.type),
        cell: (r) => <ResearchTypeBadge type={r.type} />,
        hideBelow: "md",
      },
      {
        id: "topic",
        header: "Topic",
        sortValue: (r) => r.topic.toLowerCase() || null,
        cell: (r) => <span className="block max-w-40 truncate text-muted-foreground">{r.topic || "—"}</span>,
        hideBelow: "lg",
      },
      {
        id: "status",
        header: "Status",
        sortValue: (r) => STATUS_RANK[r.status],
        cell: (r) => <ResearchStatusBadge status={r.status} />,
      },
      {
        id: "pillar",
        header: "Pillar",
        sortValue: (r) => (r.pillar_id ? (pillars.get(r.pillar_id)?.name ?? null) : null),
        cell: (r) => <PillarBadge pillar={r.pillar_id ? (pillars.get(r.pillar_id) ?? null) : null} variant="plain" />,
        hideBelow: "lg",
      },
      {
        id: "saved",
        header: "Saved",
        sortValue: (r) => r.created_at,
        cell: (r) => <span className="whitespace-nowrap text-muted-foreground num">{formatDate(r.created_at, "MMM d")}</span>,
        hideBelow: "sm",
      },
      {
        id: "ideas",
        header: "Ideas",
        align: "right",
        sortValue: (r) => usageCount(usage, r.id),
        cell: (r) => {
          const count = usageCount(usage, r.id)
          return count ? formatNumber(count) : <span className="text-muted-foreground">—</span>
        },
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-10",
        cell: (r) => (
          <div className="flex justify-end">
            <ResearchActionsMenu item={r} />
          </div>
        ),
      },
    ],
    [pillars, usage]
  )

  return (
    <DataTable
      rows={items}
      columns={columns}
      getRowId={(r) => r.id}
      onRowClick={(r) => actions.open(r.id)}
      rowLabel={(r) => `Open ${r.title || "reference"}`}
      empty={empty}
      aria-label="Research references"
    />
  )
}
