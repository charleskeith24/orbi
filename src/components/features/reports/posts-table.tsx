"use client"

import { Inbox } from "lucide-react"
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
  type IconComponent,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import type { TieredRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { uiActions } from "@/lib/store"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { formatRatio } from "./report-format"

function ContentCell({ row }: { row: TieredRow }) {
  const title = row.item.title.trim() || "Untitled content"
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="hidden shrink-0 sm:block">
        <ContentThumbnail item={row.item} size="sm" aspect="square" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/studio/${row.id}`}
          title={title}
          className="block truncate font-medium outline-none underline-offset-2 hover:underline focus-visible:underline"
        >
          {title}
        </Link>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted-foreground">
          <span className="inline-flex shrink-0 items-center gap-1">
            <PlatformIcon platform={row.platform} className="size-3.5" />
            <span className="hidden sm:inline">{PLATFORMS[row.platform]?.label ?? row.platform}</span>
          </span>
          <PillarBadge pillarId={row.pillarId} variant="plain" className="min-w-0 font-normal text-muted-foreground" />
          <span className="shrink-0 num">{formatShortDate(row.publishedAt)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Published posts of a report period: measured posts first (in the given rank order), then posts without
 * analytics, each with an "Add analytics" shortcut.
 */
export function ReportPostsTable({
  rows,
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
}: {
  rows: TieredRow[]
  title: string
  description?: string
  icon?: IconComponent
  emptyTitle: string
  emptyDescription: string
  /** Replaces the default "Log a published post" action. */
  emptyAction?: React.ReactNode
  className?: string
}) {
  const router = useRouter()
  const columns = useMemo<DataTableColumn<TieredRow>[]>(() => {
    const rank = new Map(rows.filter((r) => r.metric).map((row, i) => [row.id, i + 1]))
    return [
      {
        id: "rank",
        header: <span className="sr-only">Rank</span>,
        cell: (row) => <span className="text-xs text-muted-foreground num">{rank.get(row.id) ?? ""}</span>,
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
      {
        id: "views",
        header: "Views",
        align: "right",
        cell: (row) => (row.metric ? formatCompact(row.views) : "—"),
        sortValue: (row) => (row.metric ? row.views : null),
      },
      {
        id: "engagement",
        header: "Eng. rate",
        align: "right",
        cell: (row) => formatPercent(row.rates.engagement_rate),
        sortValue: (row) => row.rates.engagement_rate,
        hideBelow: "sm",
      },
      {
        id: "leads",
        header: "Leads",
        align: "right",
        cell: (row) => (row.metric ? formatNumber(row.leads) : "—"),
        sortValue: (row) => (row.metric ? row.leads : null),
        hideBelow: "md",
      },
      {
        id: "ratio",
        header: "vs baseline",
        align: "right",
        cell: (row) => formatRatio(row.ratio),
        sortValue: (row) => row.ratio,
        hideBelow: "lg",
      },
      {
        id: "tier",
        header: <span className="sr-only">Tier or action</span>,
        align: "right",
        cell: (row) =>
          row.metric ? (
            <TierBadge tier={row.tier} />
          ) : (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="print:hidden"
              onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: row.id })}
            >
              Add analytics
            </Button>
          ),
      },
    ]
  }, [rows])

  return (
    <SectionCard
      title={title}
      description={description}
      icon={icon}
      className={cn("print:break-inside-avoid", className)}
      contentClassName={rows.length ? "p-0 pt-2" : undefined}
    >
      {rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(`/studio/${row.id}`)}
          rowLabel={(row) => `Open ${row.item.title || "content"} in Content Studio`}
          bordered={false}
          dense
          aria-label={title}
        />
      ) : (
        <EmptyState
          compact
          icon={Inbox}
          title={emptyTitle}
          description={emptyDescription}
          action={
            emptyAction ?? (
              <Button size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
                Log a published post
              </Button>
            )
          }
        />
      )}
    </SectionCard>
  )
}
