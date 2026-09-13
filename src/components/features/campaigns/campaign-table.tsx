"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { ColorDot, DataTable, Meter, PillarBadge, PlatformIcon, type DataTableColumn } from "@/components/common"
import { useLookup } from "@/lib/store"
import type { ContentCampaign } from "@/lib/types"
import { formatCompact, formatNumber } from "@/lib/utils"
import { CampaignActionsMenu } from "./campaign-actions-menu"
import { CampaignStatusPill } from "./campaign-status"
import { CAMPAIGN_STATUS_ORDER, dateRangeLabel, timeLabel, type CampaignSummary } from "./campaign-utils"

/* DataTable only knows sm/md/lg; these columns need xl. */
const XL_ONLY = "hidden xl:table-cell"

function PiecesCell({ summary }: { summary: CampaignSummary }) {
  const { perf, campaign } = summary
  const target = perf.targetPosts
  return (
    <div className="flex w-24 flex-col gap-1 sm:w-28">
      <span className="text-xs font-medium text-foreground num">
        {perf.published}
        <span className="font-normal text-muted-foreground"> / {target ?? "no target"}</span>
      </span>
      {target ? (
        <Meter
          value={perf.published}
          max={target}
          color={campaign.color}
          size="sm"
          aria-label="Pieces published vs target"
          valueText={`${perf.published} of ${target} published`}
        />
      ) : null}
      <span className="text-xs text-muted-foreground num">{perf.planned} planned</span>
    </div>
  )
}

export function CampaignTable({
  rows,
  onEdit,
  empty,
}: {
  rows: CampaignSummary[]
  onEdit: (campaign: ContentCampaign) => void
  empty?: React.ReactNode
}) {
  const router = useRouter()
  const goals = useLookup("content_goals")
  const pillars = useLookup("content_pillars")

  const columns = useMemo<DataTableColumn<CampaignSummary>[]>(
    () => [
      {
        id: "name",
        header: "Campaign",
        sortValue: (r) => r.campaign.name.toLowerCase(),
        className: "w-full max-w-0 min-w-36",
        cell: (r) => (
          <div className="flex min-w-0 items-start gap-2.5">
            <ColorDot color={r.campaign.color} shape="square" className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/campaigns/${r.campaign.id}`}
                className="line-clamp-2 font-medium break-words whitespace-normal outline-none hover:underline focus-visible:underline"
              >
                {r.campaign.name || "Untitled campaign"}
              </Link>
              <p className="text-xs text-pretty whitespace-normal text-muted-foreground xl:hidden">
                {dateRangeLabel(r.campaign)} · {timeLabel(r.window)}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground xl:block" title={r.campaign.objective || undefined}>
                {r.campaign.objective || r.campaign.message || "No objective yet"}
              </p>
              <CampaignStatusPill status={r.campaign.status} className="mt-1.5 sm:hidden" />
            </div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        hideBelow: "sm",
        sortValue: (r) => CAMPAIGN_STATUS_ORDER[r.campaign.status],
        cell: (r) => <CampaignStatusPill status={r.campaign.status} />,
      },
      {
        id: "dates",
        header: "Dates",
        className: XL_ONLY,
        headerClassName: XL_ONLY,
        sortValue: (r) => r.campaign.start_date,
        cell: (r) => (
          <div className="flex w-40 flex-col gap-1">
            <span className="truncate text-xs">{dateRangeLabel(r.campaign)}</span>
            <Meter
              value={r.window.elapsedPct ?? 0}
              tone="neutral"
              size="sm"
              aria-label="Campaign time elapsed"
              valueText={timeLabel(r.window)}
            />
            <span className="truncate text-xs text-muted-foreground">{timeLabel(r.window)}</span>
          </div>
        ),
      },
      {
        id: "focus",
        header: "Pillar & goal",
        className: XL_ONLY,
        headerClassName: XL_ONLY,
        sortValue: (r) => (r.campaign.pillar_id ? pillars.get(r.campaign.pillar_id)?.name : null),
        cell: (r) => {
          const goal = r.campaign.goal_id ? goals.get(r.campaign.goal_id) : undefined
          return (
            <div className="flex w-36 flex-col items-start gap-1">
              <PillarBadge pillarId={r.campaign.pillar_id} variant="plain" className="max-w-full" />
              <span className="max-w-full truncate text-xs text-muted-foreground" title={goal?.name}>
                {goal?.name ?? "No goal"}
              </span>
            </div>
          )
        },
      },
      {
        id: "platforms",
        header: "Platforms",
        hideBelow: "lg",
        cell: (r) =>
          r.campaign.platforms.length ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.campaign.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} label className="size-3.5" />
              ))}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "pieces",
        header: "Pieces",
        sortValue: (r) => r.perf.progressPct ?? r.perf.published,
        cell: (r) => <PiecesCell summary={r} />,
      },
      {
        id: "views",
        header: "Views",
        align: "right",
        hideBelow: "sm",
        sortValue: (r) => r.perf.totals.views,
        cell: (r) => (r.perf.totals.measured ? formatCompact(r.perf.totals.views) : <span className="text-muted-foreground">—</span>),
      },
      {
        id: "leads",
        header: "Leads",
        align: "right",
        hideBelow: "sm",
        sortValue: (r) => r.perf.totals.leads,
        cell: (r) => (r.perf.totals.measured ? formatNumber(r.perf.totals.leads) : <span className="text-muted-foreground">—</span>),
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-10 pl-0",
        headerClassName: "w-10",
        cell: (r) => <CampaignActionsMenu campaign={r.campaign} onEdit={() => onEdit(r.campaign)} showOpen />,
      },
    ],
    [goals, pillars, onEdit]
  )

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(r) => r.campaign.id}
      onRowClick={(r) => router.push(`/campaigns/${r.campaign.id}`)}
      rowLabel={(r) => `Open ${r.campaign.name || "campaign"}`}
      empty={empty}
      aria-label="Campaigns"
    />
  )
}
