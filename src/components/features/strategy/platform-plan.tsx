"use client"

import { ChartNoAxesColumn, CircleCheck, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { MixBar, platformColor, type MixSegment } from "@/components/charts"
import { EmptyState, PlatformLabel, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { platformsMessages } from "./platforms-messages"
import { paceVsPlan, planMessage, platformLabel, type PlatformPlan } from "./platforms-model"

const fmtFreq = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** Weekly plan across platforms vs the weekly posting target. */
function WeeklyPlanCard({ plan }: { plan: PlatformPlan }) {
  const t = useT(platformsMessages)
  const status = planMessage(plan, useUiLang())
  const StatusIcon = status.tone === "good" ? CircleCheck : TriangleAlert
  const segments: MixSegment[] = plan.rows
    .filter((r) => r.strategy?.is_active && r.strategy.posting_frequency > 0)
    .map((r) => ({
      id: r.platform,
      label: platformLabel(r.platform),
      value: r.strategy?.posting_frequency ?? 0,
      color: platformColor(r.platform),
    }))

  return (
    <SectionCard title={t("plan_title")} description={t("plan_description")} contentClassName="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-3xl leading-9 font-semibold tracking-tight num">{fmtFreq(plan.weeklyTotal)}</p>
          <p className="text-xs text-muted-foreground">{t("planned")}</p>
        </div>
        <div>
          <p className="text-3xl leading-9 font-semibold tracking-tight text-muted-foreground num">{plan.target}</p>
          <p className="text-xs text-muted-foreground">{t("weekly_target")}</p>
        </div>
      </div>
      <p className={cn("flex items-start gap-1.5 text-sm text-pretty", status.tone === "good" ? "text-good-fg" : "text-warning-fg")}>
        <StatusIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{status.text}</span>
      </p>
      <MixBar
        segments={segments}
        valueLabel={t("plan_posts_label")}
        valueFormatter={fmtFreq}
        emptyMessage={t("plan_empty")}
        aria-label={t("plan_chart_label")}
      />
      <p className="text-xs text-muted-foreground">
        {t("target_hint_1")}
        <Link href="/settings?tab=general" className="font-medium text-foreground underline-offset-2 hover:underline">
          Settings → General
        </Link>
        {t("target_hint_2")}
        <Link href="/calendar/schedule" className="font-medium text-foreground underline-offset-2 hover:underline">
          Posting Schedule
        </Link>
        {t("target_hint_3")}
      </p>
    </SectionCard>
  )
}

/** 30-day performance per platform (platformPerformance) against the planned pace. */
function PerformanceCard({ plan }: { plan: PlatformPlan }) {
  const rows = plan.rows.filter((r) => r.strategy?.is_active || r.perf)
  const anyPosts = rows.some((r) => r.perf)
  const t = useT(platformsMessages)
  return (
    <SectionCard
      title={t("perf_title")}
      description={t("perf_description")}
      contentClassName={anyPosts ? "px-0 pb-1" : undefined}
    >
      {anyPosts ? (
        <div className="overflow-x-auto scrollbar-thin">
          <Table className="min-w-[40rem] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Platform</TableHead>
                <TableHead className="text-right">Plan / wk</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Avg views</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead className="pr-4 text-right">Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const behind = paceVsPlan(row) === "behind"
                const perf = row.perf
                return (
                  <TableRow key={row.platform}>
                    <TableCell className="pl-4">
                      <Link href={`/strategy/platforms?open=${row.platform}`} className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                        <PlatformLabel platform={row.platform} />
                      </Link>
                      {!row.strategy?.is_active ? <span className="ml-1.5 text-xs text-muted-foreground">{t("paused")}</span> : null}
                    </TableCell>
                    <TableCell className="text-right num">{row.strategy?.is_active ? fmtFreq(row.strategy.posting_frequency) : "—"}</TableCell>
                    <TableCell className="text-right num">
                      <span className="inline-flex items-center justify-end gap-1">
                        {behind ? <TriangleAlert className="size-3.5 text-warning-fg" aria-label={t("behind_plan")} /> : null}
                        {formatNumber(perf?.posts ?? 0)}
                        {row.planned30 ? <span className="text-xs text-muted-foreground">/ ≈{Math.round(row.planned30)}</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num">{formatCompact(perf?.views ?? 0)}</TableCell>
                    <TableCell className="text-right num">{formatCompact(perf?.avgViews)}</TableCell>
                    <TableCell className="text-right num">{formatPercent(perf?.engagementRate)}</TableCell>
                    <TableCell className="text-right num">{perf ? `+${formatNumber(perf.followersGained)}` : "—"}</TableCell>
                    <TableCell className="pr-4 text-right num">{formatNumber(perf?.leads ?? 0)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          compact
          icon={ChartNoAxesColumn}
          title={t("perf_empty_title")}
          description={t("perf_empty_description")}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              {t("log_post")}
            </Button>
          }
        />
      )}
    </SectionCard>
  )
}

export function PlatformPlanSummary({ plan }: { plan: PlatformPlan }) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
      <WeeklyPlanCard plan={plan} />
      <PerformanceCard plan={plan} />
    </div>
  )
}
