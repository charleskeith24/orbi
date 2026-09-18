"use client"

import { Columns3 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { catVar, ColorDot, DataTable, EmptyState, SectionCard, type DataTableColumn } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { PillarAggregate } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { CardLink } from "./card-link"
import { dashboardMessages } from "./messages"

const pillarHref = (row: PillarAggregate) => (row.pillar ? `/pillars?open=${row.pillar.id}` : "/pillars")

/** Pillar | Posts | Avg views | Engagement | Leads over the last 30 days. */
export function PillarPerformanceCard({ rows, className }: { rows: PillarAggregate[]; className?: string }) {
  const t = useT(dashboardMessages)
  const router = useRouter()
  const columns = useMemo<DataTableColumn<PillarAggregate>[]>(() => {
    const maxAvg = Math.max(0, ...rows.map((row) => row.avgViews ?? 0))
    return [
      {
        id: "pillar",
        header: "Pillar",
        cell: (row) =>
          row.pillar ? (
            <Link
              href={pillarHref(row)}
              className="inline-flex max-w-full items-center gap-2 font-medium outline-none underline-offset-2 hover:underline focus-visible:underline"
            >
              <ColorDot color={row.color} />
              <span className="truncate">{row.label}</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <ColorDot color={null} />
              {row.label}
            </span>
          ),
        sortValue: (row) => row.label,
        className: "w-full max-w-0",
        headerClassName: "w-full",
      },
      {
        id: "posts",
        header: "Posts",
        align: "right",
        cell: (row) => formatNumber(row.posts),
        sortValue: (row) => row.posts,
        hideBelow: "sm",
      },
      {
        id: "avgViews",
        header: "Avg views",
        align: "right",
        cell: (row) => (
          <span className="inline-flex items-center justify-end gap-2">
            {row.avgViews !== null && maxAvg > 0 ? (
              <span aria-hidden className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block dark:bg-input/60">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(row.avgViews / maxAvg) * 100}%`, backgroundColor: catVar(row.color) }}
                />
              </span>
            ) : null}
            {formatCompact(row.avgViews)}
          </span>
        ),
        sortValue: (row) => row.avgViews,
      },
      {
        id: "engagement",
        header: "Eng. rate",
        align: "right",
        cell: (row) => formatPercent(row.engagementRate),
        sortValue: (row) => row.engagementRate,
      },
      { id: "leads", header: "Leads", align: "right", cell: (row) => formatNumber(row.leads), sortValue: (row) => row.leads, hideBelow: "sm" },
    ]
  }, [rows])

  return (
    <SectionCard
      title={t("pillar_performance_title")}
      description={t("pillar_performance_description")}
      action={
        <CardLink href="/pillars">
          <span className="hidden sm:inline">Content Pillars</span>
          <span className="sm:hidden">Pillars</span>
        </CardLink>
      }
      className={className}
      contentClassName={rows.length ? "p-0 pt-2" : undefined}
    >
      {rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.key}
          onRowClick={(row) => router.push(pillarHref(row))}
          rowLabel={(row) => t("open_row", { name: row.label })}
          bordered={false}
          dense
          aria-label={t("pillar_performance_aria")}
        />
      ) : (
        <EmptyState
          compact
          icon={Columns3}
          title={t("no_pillars")}
          description={t("no_pillars_description")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/pillars">{t("set_up_pillars")}</Link>
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
