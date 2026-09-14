"use client"

import { Briefcase } from "lucide-react"
import Link from "next/link"
import { BarList, ChartFrame, EmptyChart, platformColor, type BarListItem, type ChartTable } from "@/components/charts"
import { EmptyState, PlatformIcon, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { MonthlyReport } from "@/lib/analytics"
import { uiActions } from "@/lib/store"
import type { PlatformId } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { countLabel } from "./report-format"

function SubList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
      {children}
    </div>
  )
}

/** Leads (and sales) by pillar and by platform. */
export function LeadGenerationCard({ report, className }: { report: MonthlyReport; className?: string }) {
  const lg = report.leadGeneration
  const pillarColors = new Map(report.pillarPerformance.map((p) => [p.key, p.color]))
  const byPillar: BarListItem[] = lg.byPillar.map((l) => ({
    id: l.key,
    label: l.label,
    value: l.leads,
    color: pillarColors.get(l.key) ?? "other",
    secondary: l.sales ? countLabel(l.sales, "sale") : undefined,
  }))
  const byPlatform: BarListItem[] = lg.byPlatform.map((l) => ({
    id: l.key,
    label: l.label,
    value: l.leads,
    color: platformColor(l.key as PlatformId),
    secondary: l.sales ? countLabel(l.sales, "sale") : undefined,
  }))
  const table: ChartTable = {
    columns: ["Source", "Leads", "Sales"],
    rows: [
      ...lg.byPillar.map((l) => [`Pillar · ${l.label}`, l.leads, l.sales]),
      ...lg.byPlatform.map((l) => [`Platform · ${l.label}`, l.leads, l.sales]),
    ],
  }
  return (
    <ChartFrame
      title="Lead Generation"
      description={`${countLabel(lg.total, "lead")} · ${countLabel(report.totals.sales, "sale")} this month`}
      table={table}
      className={cn("print:break-inside-avoid", className)}
    >
      {byPillar.length || byPlatform.length ? (
        <div className="flex flex-col gap-4">
          <SubList label="By pillar">
            <BarList items={byPillar} valueFormatter={formatNumber} emptyMessage="No leads by pillar." aria-label="Leads by pillar" />
          </SubList>
          <SubList label="By platform">
            <BarList items={byPlatform} valueFormatter={formatNumber} emptyMessage="No leads by platform." aria-label="Leads by platform" />
          </SubList>
        </div>
      ) : (
        <EmptyChart message="No leads logged for this month's posts." height={160} />
      )}
    </ChartFrame>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg leading-7 font-semibold num">{formatNumber(value)}</dd>
    </div>
  )
}

/** Conversion (BOFU) content: what it produced and the posts that brought leads. */
export function BusinessOpportunitiesCard({ report, className }: { report: MonthlyReport; className?: string }) {
  const b = report.businessOpportunities
  return (
    <SectionCard
      title="Business Opportunities"
      description="Conversion (BOFU) content and what it produced"
      icon={Briefcase}
      className={cn("print:break-inside-avoid", className)}
    >
      {b.posts ? (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="BOFU posts" value={b.posts} />
            <MiniStat label="Leads" value={b.leads} />
            <MiniStat label="Sales" value={b.sales} />
            <MiniStat label="Link clicks" value={b.linkClicks} />
          </dl>
          {b.topPosts.length ? (
            <ol aria-label="Top conversion posts by leads" className="flex flex-col divide-y border-t">
              {b.topPosts.map((row) => {
                const title = row.item.title.trim() || "Untitled content"
                return (
                  <li key={row.id} className="flex min-w-0 items-center gap-2 py-2 last:pb-0">
                    <PlatformIcon platform={row.platform} className="size-3.5 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/studio/${row.id}`}
                      title={title}
                      className="min-w-0 truncate text-sm outline-none underline-offset-2 hover:underline focus-visible:underline"
                    >
                      {title}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground num">{countLabel(row.leads, "lead")}</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="border-t pt-3 text-xs text-muted-foreground">No analytics logged on this month&apos;s BOFU posts yet.</p>
          )}
        </div>
      ) : (
        <EmptyState
          compact
          icon={Briefcase}
          title="No conversion content this month"
          description="BOFU posts — offers, services, lead magnets — turn attention into business."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => uiActions.openDialog({ type: "new-content", defaults: { funnel_stage: "bofu" } })}
            >
              Plan a BOFU post
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
