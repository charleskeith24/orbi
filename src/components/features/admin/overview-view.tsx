"use client"

import { Activity, ChartBarBig, ChartColumn, CircleCheck, Inbox, Table2, Users } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { seriesColor, SeriesLegend } from "@/components/charts"
import { EmptyState, PageHeader, StatTile } from "@/components/common"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { OnboardingFunnelStep } from "@/lib/admin/types"
import { formatNumber, formatPercent, ratio } from "@/lib/utils"
import { useAdmin } from "./admin-context"
import { AdminErrorPanel, AdminLoading } from "./admin-ui"
import { overviewMessages } from "./messages"
import { useAdminResource } from "./use-admin-resource"

type Messages = (typeof overviewMessages)["en"]

const STEP_LABELS: Record<string, keyof Messages> = {
  start: "step_start",
  about: "step_about",
  who: "step_who",
  pick: "step_pick",
}

const VIEWED = seriesColor("blue")
const COMPLETED = seriesColor("orange")

export function OverviewView() {
  const t = useScreenT(overviewMessages)
  const { api } = useAdmin()
  const overview = useAdminResource("overview", () => api.overview())
  const data = overview.data

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {overview.error ? <AdminErrorPanel error={overview.error} onRetry={overview.reload} /> : null}
      {!data && overview.loading ? <AdminLoading label={t("loading_label")} rows={5} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t("users")} value={formatNumber(data.users_total)} sublabel={t("users_sub")} icon={Users} />
            <StatTile
              label={t("active_7d")}
              value={formatNumber(data.active_7d)}
              sublabel={t("active_30d_sub", { count: formatNumber(data.active_30d) })}
              icon={Activity}
            />
            <StatTile
              label={t("finished_setup")}
              value={formatNumber(data.onboarding_completed)}
              sublabel={t("finished_setup_sub", { percent: formatPercent(ratio(data.onboarding_completed, data.users_total), 0) })}
              icon={CircleCheck}
            />
            <StatTile
              label={t("pending")}
              value={formatNumber(data.pending_requests)}
              sublabel={data.access_open ? t("requests_open") : t("requests_closed")}
              icon={Inbox}
              href="/admin/requests"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t.plural("feedback_7d", data.feedback_7d, { count: formatNumber(data.feedback_7d) })}
            {" · "}
            <Link href="/admin/feedback" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("read_feedback")}
            </Link>
          </p>
          <OnboardingFunnel steps={data.funnel} />
        </>
      ) : null}
    </>
  )
}

/** Viewed vs finished per setup step — horizontal bars on one scale, with a table view. */
function OnboardingFunnel({ steps }: { steps: OnboardingFunnelStep[] }) {
  const t = useScreenT(overviewMessages)
  const [view, setView] = useState<"chart" | "table">("chart")
  const titleId = useId()
  const ordered = [...steps].sort((a, b) => a.index - b.index)
  const max = Math.max(0, ...ordered.map((s) => Math.max(s.viewed, s.completed)))
  const label = (step: string) => (STEP_LABELS[step] ? t(STEP_LABELS[step]) : step)
  const width = (value: number) => (max > 0 ? `${(Math.max(0, value) / max) * 100}%` : "0%")

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={titleId} className="text-sm leading-5 font-medium">
            {t("funnel_title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("funnel_description")}</p>
        </div>
        {ordered.length ? (
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={view}
            onValueChange={(value) => {
              if (value === "chart" || value === "table") setView(value)
            }}
            aria-label={t("display_as")}
          >
            <ToggleGroupItem value="chart" aria-label={t("show_chart")} title={t("show_chart")}>
              <ChartColumn />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={t("show_table")} title={t("show_table")}>
              <Table2 />
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </header>

      {!ordered.length ? (
        <EmptyState compact icon={ChartBarBig} title={t("funnel_title")} description={t("funnel_empty")} />
      ) : view === "table" ? (
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 text-xs font-medium text-muted-foreground">{t("step")}</TableHead>
              <TableHead className="h-8 text-right text-xs font-medium text-muted-foreground">{t("viewed")}</TableHead>
              <TableHead className="h-8 text-right text-xs font-medium text-muted-foreground">{t("completed")}</TableHead>
              <TableHead className="h-8 text-right text-xs font-medium text-muted-foreground">{t("finish_rate")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((step) => (
              <TableRow key={step.step}>
                <TableCell className="py-1.5">{label(step.step)}</TableCell>
                <TableCell className="num py-1.5 text-right">{formatNumber(step.viewed)}</TableCell>
                <TableCell className="num py-1.5 text-right">{formatNumber(step.completed)}</TableCell>
                <TableCell className="num py-1.5 text-right">{formatPercent(ratio(step.completed, step.viewed), 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col gap-3">
          <SeriesLegend
            items={[
              { key: "viewed", label: t("viewed"), color: VIEWED },
              { key: "completed", label: t("completed"), color: COMPLETED },
            ]}
          />
          <ol aria-label={t("funnel_aria")} className="flex flex-col gap-3">
            {ordered.map((step) => (
              <li
                key={step.step}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(5.5rem,11rem)_minmax(0,1fr)_auto]"
              >
                <span className="col-span-2 truncate text-sm sm:col-span-1" title={label(step.step)} aria-hidden>
                  {label(step.step)}
                </span>
                <span className="sr-only">
                  {t("step_row", { step: label(step.step), viewed: formatNumber(step.viewed), completed: formatNumber(step.completed) })}
                </span>
                <div aria-hidden className="flex flex-col gap-1">
                  <div className="h-3 rounded-r-[4px]" style={{ width: width(step.viewed), minWidth: step.viewed > 0 ? 2 : 0, background: VIEWED }} />
                  <div
                    className="h-3 rounded-r-[4px]"
                    style={{ width: width(step.completed), minWidth: step.completed > 0 ? 2 : 0, background: COMPLETED }}
                  />
                </div>
                <div aria-hidden className="num grid text-right text-xs leading-4">
                  <span className="font-medium text-foreground">{formatNumber(step.viewed)}</span>
                  <span className="text-muted-foreground">{formatNumber(step.completed)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("funnel_note")}</p>
    </section>
  )
}
