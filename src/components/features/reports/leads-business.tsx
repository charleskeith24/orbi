"use client"

import { Briefcase } from "lucide-react"
import Link from "next/link"
import { BarList, ChartFrame, EmptyChart, platformColor, type BarListItem, type ChartTable } from "@/components/charts"
import { EmptyState, PlatformIcon, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { MonthlyReport } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import type { PlatformId } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { reportMessages } from "./messages"
import { monthlyReviewMessages } from "./monthly-messages"

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
  const t = useT(monthlyReviewMessages)
  const r = useT(reportMessages)
  const sales = (count: number) => r.plural("sales", count, { count: formatNumber(count) })
  const lg = report.leadGeneration
  const pillarColors = new Map(report.pillarPerformance.map((p) => [p.key, p.color]))
  const byPillar: BarListItem[] = lg.byPillar.map((l) => ({
    id: l.key,
    label: l.label,
    value: l.leads,
    color: pillarColors.get(l.key) ?? "other",
    secondary: l.sales ? sales(l.sales) : undefined,
  }))
  const byPlatform: BarListItem[] = lg.byPlatform.map((l) => ({
    id: l.key,
    label: l.label,
    value: l.leads,
    color: platformColor(l.key as PlatformId),
    secondary: l.sales ? sales(l.sales) : undefined,
  }))
  const table: ChartTable = {
    columns: [t("col_source"), t("col_leads"), t("col_sales")],
    rows: [
      ...lg.byPillar.map((l) => [t("row_pillar", { label: l.label }), l.leads, l.sales]),
      ...lg.byPlatform.map((l) => [t("row_platform", { label: l.label }), l.leads, l.sales]),
    ],
  }
  return (
    <ChartFrame
      title={t("lead_generation")}
      description={t("this_month_suffix", {
        leads: r.plural("leads", lg.total, { count: formatNumber(lg.total) }),
        sales: sales(report.totals.sales),
      })}
      table={table}
      className={cn("print:break-inside-avoid", className)}
    >
      {byPillar.length || byPlatform.length ? (
        <div className="flex flex-col gap-4">
          <SubList label={t("by_pillar")}>
            <BarList items={byPillar} valueFormatter={formatNumber} emptyMessage={t("no_leads_pillar")} aria-label={t("leads_by_pillar")} />
          </SubList>
          <SubList label={t("by_platform")}>
            <BarList items={byPlatform} valueFormatter={formatNumber} emptyMessage={t("no_leads_platform")} aria-label={t("leads_by_platform")} />
          </SubList>
        </div>
      ) : (
        <EmptyChart message={t("no_leads")} height={160} />
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
  const t = useT(monthlyReviewMessages)
  const r = useT(reportMessages)
  const b = report.businessOpportunities
  return (
    <SectionCard
      title={t("business")}
      info={t("business_info")}
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
            <ol aria-label={t("top_conversion_aria")} className="flex flex-col divide-y border-t">
              {b.topPosts.map((row) => {
                const title = row.item.title.trim() || r("untitled_content")
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
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground num">{r.plural("leads", row.leads, { count: formatNumber(row.leads) })}</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="border-t pt-3 text-xs text-muted-foreground">{t("no_bofu_analytics")}</p>
          )}
        </div>
      ) : (
        <EmptyState
          compact
          icon={Briefcase}
          title={t("no_conversion")}
          description={t("no_conversion_description")}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => uiActions.openDialog({ type: "new-content", defaults: { funnel_stage: "bofu" } })}
            >
              {t("plan_bofu")}
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}
