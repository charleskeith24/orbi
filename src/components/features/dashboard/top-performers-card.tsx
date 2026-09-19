"use client"

import { Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import {
  ContentThumbnail,
  DataTable,
  EmptyState,
  PillarBadge,
  PlatformIcon,
  SectionCard,
  TierBadge,
  type DataTableColumn,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import type { TieredRow } from "@/lib/analytics"
import { PLATFORMS, WINNER_METRIC_MAP } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import type { WinnerMetric } from "@/lib/types"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { CardLink } from "./card-link"
import { dashboardMessages } from "./messages"

function ContentCell({ row }: { row: TieredRow }) {
  const t = useT(dashboardMessages)
  const title = row.item.title.trim() || t("untitled_content")
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="hidden shrink-0 sm:block">
        <ContentThumbnail item={row.item} size="sm" aspect="square" />
      </span>
      <div className="min-w-0">
        <Link
          href={`/studio/${row.id}`}
          title={title}
          className="block truncate font-medium outline-none underline-offset-2 hover:underline focus-visible:underline"
        >
          {title}
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex shrink-0 items-center gap-1">
            <PlatformIcon platform={row.platform} className="size-3.5" />
            {PLATFORMS[row.platform]?.label ?? row.platform}
          </span>
          <PillarBadge pillarId={row.pillarId} variant="plain" className="min-w-0 font-normal text-muted-foreground" />
          <span className="hidden shrink-0 num sm:inline">{formatShortDate(row.publishedAt)}</span>
          <TierBadge tier={row.tier} className="sm:hidden" />
        </div>
      </div>
    </div>
  )
}

/** Last 30 days, top 5 by the winner metric, with tiers → Winning Content Library. */
export function TopPerformersCard({
  rows,
  winnerMetric,
  className,
}: {
  rows: TieredRow[]
  winnerMetric: WinnerMetric
  className?: string
}) {
  const t = useT(dashboardMessages)
  const router = useRouter()
  const columns = useMemo<DataTableColumn<TieredRow>[]>(() => {
    const rank = new Map(rows.map((row, i) => [row.id, i + 1]))
    return [
      {
        id: "rank",
        header: <span className="sr-only">{t("rank")}</span>,
        cell: (row) => <span className="text-xs text-muted-foreground num">{rank.get(row.id)}</span>,
        width: 28,
        className: "pr-0",
      },
      {
        id: "content",
        header: "Content",
        cell: (row) => <ContentCell row={row} />,
        className: "w-full max-w-0",
        headerClassName: "w-full",
      },
      { id: "views", header: "Views", align: "right", cell: (row) => formatCompact(row.views), sortValue: (row) => row.views },
      {
        id: "engagement",
        header: "Eng. rate",
        align: "right",
        cell: (row) => formatPercent(row.rates.engagement_rate),
        sortValue: (row) => row.rates.engagement_rate,
        hideBelow: "sm",
      },
      { id: "leads", header: "Leads", align: "right", cell: (row) => formatNumber(row.leads), sortValue: (row) => row.leads, hideBelow: "md" },
      {
        id: "tier",
        header: <span className="sr-only">{t("tier")}</span>,
        cell: (row) => <TierBadge tier={row.tier} />,
        hideBelow: "sm",
      },
    ]
  }, [rows, t])

  return (
    <SectionCard
      title={t("top_title")}
      info={t("top_description", { metric: (WINNER_METRIC_MAP[winnerMetric]?.label ?? "views").toLowerCase() })}
      action={
        <CardLink href="/winners">Winners</CardLink>
      }
      className={className}
      contentClassName={rows.length ? "p-0 pt-2" : undefined}
    >
      {rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(`/studio/${row.id}`)}
          rowLabel={(row) => t("open_row", { name: row.item.title })}
          bordered={false}
          dense
          aria-label={t("top_aria")}
        />
      ) : (
        <EmptyState
          compact
          icon={Trophy}
          title={t("no_measured")}
          description={t("no_measured_description")}
          action={
            <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "add-metrics" })}>
              {t("add_analytics")}
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
