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
  PillarBadge,
  PlatformLabel,
  TierBadge,
  useConfirm,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { engagementsOf, type TieredRow } from "@/lib/analytics"
import { HOOK_CATEGORIES, PIPELINE_STAGE_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { dataActions, useTable } from "@/lib/store"
import type { AppSettings, ContentItem, ContentMetric } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { formatWatchTime } from "./format"
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
      title: "Delete this snapshot?",
      description: `The numbers recorded on ${formatDate(snapshot.recorded_at)} will be removed. ${
        last ? "This post will have no analytics left." : "Analytics always use the latest remaining snapshot."
      }`,
      confirmLabel: "Delete snapshot",
    })
    if (!ok) return
    dataActions.remove("content_metrics", snapshot.id)
    toast.success("Snapshot deleted")
  }

  const published = row?.publishedAt ?? null
  const hookStyle = row?.hookCategory ?? item.hook_category

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item.title || "Untitled post"}
      description={
        published
          ? `Published ${formatDate(published, "EEE, MMM d, yyyy · h:mm a")}`
          : `Not published yet · ${PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage}`
      }
      actions={
        item.published_url ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label="View the live post">
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
              Open in Studio
            </Link>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus aria-hidden />
            Add snapshot
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
          {hookStyle ? <span className="text-xs text-muted-foreground">{HOOK_CATEGORIES[hookStyle]?.label} hook</span> : null}
          {row?.metric && row.ratio !== null ? <TierBadge tier={row.tier} /> : null}
        </div>
        {item.hook ? <p className="text-sm text-pretty text-muted-foreground">“{item.hook}”</p> : null}
      </div>

      {!row ? (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          This item isn&apos;t published yet. Adding a snapshot marks it as published.
        </p>
      ) : null}

      {latest ? (
        <Section title="Latest snapshot" description={`Recorded ${formatDate(latest.recorded_at)}`}>
          <MetricGrid metric={latest} />
        </Section>
      ) : null}

      {row?.metric ? (
        <>
          <Section title="Rates" description="Derived from the latest snapshot">
            <RateList row={row} />
          </Section>
          <Section title="Tier">
            <TierExplanation row={row} settings={settings} />
          </Section>
        </>
      ) : null}

      <Section title="Snapshot history" description="Log a new snapshot each time you check the numbers, e.g. after 48 hours and 7 days.">
        {snapshots.length ? (
          <SnapshotHistory snapshots={snapshots} onEdit={openEdit} onDelete={(s) => void remove(s)} />
        ) : (
          <EmptyState
            compact
            icon={ChartNoAxesColumn}
            title="No analytics yet"
            description="Copy the numbers from the platform's insights — winners, reports and recommendations learn from them."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus aria-hidden />
                Add snapshot
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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? <p className="text-xs text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MetricGrid({ metric }: { metric: ContentMetric }) {
  const watch = metric.watch_time_seconds
  const cells: { label: string; value: string; hint?: string }[] = [
    { label: "Views", value: formatNumber(metric.views) },
    { label: "Reach", value: formatNumber(metric.reach) },
    { label: "Engagements", value: formatNumber(engagementsOf(metric)) },
    { label: "Likes", value: formatNumber(metric.likes) },
    { label: "Comments", value: formatNumber(metric.comments) },
    { label: "Shares", value: formatNumber(metric.shares) },
    { label: "Saves", value: formatNumber(metric.saves) },
    { label: "Followers gained", value: formatNumber(metric.followers_gained) },
    { label: "Profile visits", value: formatNumber(metric.profile_visits) },
    { label: "Link clicks", value: formatNumber(metric.link_clicks) },
    { label: "Leads", value: formatNumber(metric.leads) },
    { label: "Sales", value: formatNumber(metric.sales) },
    {
      label: "Watch time",
      value: formatWatchTime(watch),
      hint: watch !== null && metric.views > 0 ? `${formatWatchTime(watch / metric.views)} per view` : undefined,
    },
    { label: "Avg. retention", value: formatPercent(metric.avg_retention) },
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
