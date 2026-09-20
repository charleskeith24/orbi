"use client"

import { ChartNoAxesColumn, ExternalLink, Info, Plus, SquarePen } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DetailSheet,
  EmptyState,
  FormatLabel,
  FunnelBadge,
  InfoHint,
  PillarBadge,
  PlatformLabel,
  TierBadge,
  useConfirm,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { engagementsOf, type TieredRow } from "@/lib/analytics"
import { HOOK_CATEGORIES, PIPELINE_STAGE_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { dataActions, useTable } from "@/lib/store"
import type { AppSettings, ContentItem, ContentMetric } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { formatWatchTime } from "./format"
import { postMessages } from "./post-messages"
import { RateList } from "./rate-list"
import { SnapshotDialog } from "./snapshot-dialog"
import { newestFirst, SnapshotHistory } from "./snapshot-history"
import { TierExplanation } from "./tier-explanation"

/** Detail of one post: latest numbers, rate formulas, tier explanation and editable snapshot history. */
export function PostDetailSheet({
  item,
  row,
  open,
  onOpenChange,
  settings,
  now,
  autoAdd = false,
}: {
  item: ContentItem
  /** Performance row; null when the item isn't published (yet). */
  row: TieredRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: AppSettings
  now: Date
  /** Open the Add snapshot dialog right away. */
  autoAdd?: boolean
}) {
  const t = useT(postMessages)
  const metrics = useTable("content_metrics")
  const snapshots = useMemo(() => metrics.filter((m) => m.content_item_id === item.id).sort(newestFirst), [metrics, item.id])
  const latest = snapshots[0] ?? null
  const [dialogOpen, setDialogOpen] = useState(autoAdd)
  const [editing, setEditing] = useState<ContentMetric | null>(null)
  const [confirm, confirmDialog] = useConfirm()

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (snapshot: ContentMetric) => {
    setEditing(snapshot)
    setDialogOpen(true)
  }
  async function remove(snapshot: ContentMetric) {
    const last = snapshots.length === 1
    const ok = await confirm({
      title: t("delete_title"),
      description: t(last ? "delete_description_last" : "delete_description", { date: formatDate(snapshot.recorded_at) }),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    dataActions.remove("content_metrics", snapshot.id)
    toast.success(t("deleted"))
  }

  const published = row?.publishedAt ?? null
  const hookStyle = row?.hookCategory ?? item.hook_category

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item.title || t("untitled_post")}
      description={
        published
          ? t("published_on", { date: formatDate(published, "EEE, MMM d, yyyy · h:mm a") })
          : t("not_published", { stage: PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage })
      }
      actions={
        item.published_url ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("view_live")}>
            <a href={item.published_url} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden />
            </a>
          </Button>
        ) : null
      }
      footer={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={`/studio/${item.id}`}>
              <SquarePen aria-hidden />
              {t("open_studio")}
            </Link>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus aria-hidden />
            {t("add_snapshot")}
          </Button>
        </>
      }
      bodyClassName="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <PlatformLabel platform={item.platform} className="text-xs" />
          <PillarBadge pillarId={item.pillar_id} />
          <FormatLabel formatId={item.format_id} />
          <FunnelBadge stage={item.funnel_stage} />
          {hookStyle ? <span className="text-xs text-muted-foreground">{t("hook_style", { style: HOOK_CATEGORIES[hookStyle]?.label ?? "" })}</span> : null}
          {row?.metric && row.ratio !== null ? <TierBadge tier={row.tier} /> : null}
        </div>
        {item.hook ? <p className="text-sm text-pretty text-muted-foreground">“{item.hook}”</p> : null}
      </div>

      {!row ? (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("not_published_note")}
        </p>
      ) : null}

      {latest ? (
        <Section title={t("latest_snapshot")} description={t("recorded_on_date", { date: formatDate(latest.recorded_at) })}>
          <MetricGrid metric={latest} />
        </Section>
      ) : null}

      {row?.metric ? (
        <>
          <Section title={t("rates")} info={t("rates_info")}>
            <RateList row={row} />
          </Section>
          <Section title={t("tier")}>
            <TierExplanation row={row} settings={settings} />
          </Section>
        </>
      ) : null}

      <Section title={t("history")} info={t("history_info")}>
        {snapshots.length ? (
          <SnapshotHistory snapshots={snapshots} onEdit={openEdit} onDelete={(s) => void remove(s)} />
        ) : (
          <EmptyState
            compact
            icon={ChartNoAxesColumn}
            title={t("no_analytics")}
            description={t("no_analytics_description")}
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus aria-hidden />
                {t("add_snapshot")}
              </Button>
            }
            className="rounded-lg border border-dashed"
          />
        )}
      </Section>

      <SnapshotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={item}
        snapshot={editing}
        previous={latest}
        now={now}
      />
      {confirmDialog}
    </DetailSheet>
  )
}

function Section({
  title,
  description,
  info,
  children,
}: {
  title: string
  /** Data line under the title (a date) — explanations go in `info` (Calm UI). */
  description?: string
  info?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="min-w-0 text-sm font-medium">{title}</h3>
          {info ? <InfoHint title={title}>{info}</InfoHint> : null}
        </div>
        {description ? <p className="text-xs text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MetricGrid({ metric }: { metric: ContentMetric }) {
  const t = useT(postMessages)
  const watch = metric.watch_time_seconds
  const cells: { label: string; value: string; hint?: string }[] = [
    { label: "Views", value: formatNumber(metric.views) },
    { label: "Reach", value: formatNumber(metric.reach) },
    { label: "Engagements", value: formatNumber(engagementsOf(metric)) },
    { label: "Likes", value: formatNumber(metric.likes) },
    { label: "Comments", value: formatNumber(metric.comments) },
    { label: "Shares", value: formatNumber(metric.shares) },
    { label: "Saves", value: formatNumber(metric.saves) },
    { label: t("followers_gained"), value: formatNumber(metric.followers_gained) },
    { label: t("profile_visits"), value: formatNumber(metric.profile_visits) },
    { label: t("link_clicks"), value: formatNumber(metric.link_clicks) },
    { label: "Leads", value: formatNumber(metric.leads) },
    { label: "Sales", value: formatNumber(metric.sales) },
    {
      label: t("watch_time"),
      value: formatWatchTime(watch),
      hint: watch !== null && metric.views > 0 ? t("per_view", { time: formatWatchTime(watch / metric.views) }) : undefined,
    },
    { label: t("avg_retention"), value: formatPercent(metric.avg_retention) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3 sm:grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{cell.label}</dt>
          <dd className="num text-sm font-medium">
            {cell.value}
            {cell.hint ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{cell.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
