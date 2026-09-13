"use client"

import { ChartNoAxesColumn, ExternalLink, Plus, Send } from "lucide-react"
import Link from "next/link"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, StatTile } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { computeRates, engagementsOf, tieredRows } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { dataActions, moveItemToStage, uiActions, useDb, useSettings, useTable } from "@/lib/store"
import type { ContentItem, ContentMetric } from "@/lib/types"
import { formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { LatestSnapshot, RatesCard, SnapshotHistory, TierCard } from "./performance-cards"
import { publishedToast } from "./workspace-chips"

/** Newest first — the same rule analytics use for "latest snapshot". */
function newestFirst(a: ContentMetric, b: ContentMetric): number {
  if (a.recorded_at !== b.recorded_at) return a.recorded_at < b.recorded_at ? 1 : -1
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
}

function growth(current: number, previous: number | undefined): number | undefined {
  if (previous === undefined) return undefined
  return previous > 0 ? ((current - previous) / previous) * 100 : undefined
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** Performance of the piece: latest numbers, rates, tier vs the platform baseline and every snapshot. */
export function PerformanceTab({ item, now, live }: { item: ContentItem; now: Date; live: boolean }) {
  return live ? <LivePerformance item={item} now={now} /> : <NotLiveYet item={item} />
}

function NotLiveYet({ item }: { item: ContentItem }) {
  const platform = PLATFORMS[item.platform].label
  const when = item.scheduled_at ? `It's scheduled for ${formatDate(item.scheduled_at, "EEE, MMM d · h:mm a")}. ` : ""
  return (
    <EmptyState
      icon={ChartNoAxesColumn}
      title="Performance shows up once this is live"
      description={`${when}After it goes live, mark it published and log views, reach and engagement from ${platform}'s insights — this tab then shows the rates, how it compares with your ${platform} average and every snapshot you log.`}
      action={
        <Button
          type="button"
          size="sm"
          onClick={() => {
            moveItemToStage(item.id, "published")
            publishedToast(item.id)
          }}
        >
          <Send aria-hidden />
          Mark published
        </Button>
      }
      secondaryAction={
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/analytics">Open Analytics</Link>
        </Button>
      }
    />
  )
}

function LivePerformance({ item, now }: { item: ContentItem; now: Date }) {
  const db = useDb()
  const settings = useSettings()
  const metrics = useTable("content_metrics")
  const snapshots = useMemo(() => metrics.filter((m) => m.content_item_id === item.id).sort(newestFirst), [metrics, item.id])
  const row = useMemo(() => tieredRows(db, settings, now).find((r) => r.id === item.id) ?? null, [db, settings, now, item.id])
  const latest = snapshots[0] ?? null
  const addAnalytics = () => uiActions.openDialog({ type: "add-metrics", itemId: item.id })

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PublishedBar item={item} />
      {!latest ? (
        <EmptyState
          icon={ChartNoAxesColumn}
          title="No analytics logged yet"
          description="Copy the numbers from the platform's insights after 48 hours and again after 7 days — winner detection, reports and recommendations learn from them."
          action={
            <Button type="button" size="sm" onClick={addAnalytics}>
              <Plus aria-hidden />
              Add analytics
            </Button>
          }
        />
      ) : (
        <>
          <KpiTiles latest={latest} previous={snapshots[1] ?? null} />
          {row?.metric ? (
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
              <TierCard row={row} settings={settings} />
              <RatesCard row={row} />
            </div>
          ) : null}
          <LatestSnapshot metric={latest} />
          <SnapshotHistory snapshots={snapshots} itemId={item.id} onAdd={addAnalytics} />
        </>
      )}
    </div>
  )
}

/* ------------------------------ Published bar ----------------------------- */

function PublishedBar({ item }: { item: ContentItem }) {
  const inputId = useId()
  const [draft, setDraft] = useState(item.published_url)
  const [source, setSource] = useState(item.published_url)
  if (source !== item.published_url) {
    setSource(item.published_url)
    setDraft(item.published_url)
  }
  const clean = draft.trim()
  const valid = !clean || isHttpUrl(clean)

  function save() {
    if (!valid || clean === item.published_url) return
    dataActions.update("content_items", item.id, { published_url: clean })
    toast.success(clean ? "Published link saved" : "Published link removed")
  }

  return (
    <div className="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-3 rounded-lg border bg-card p-4">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Published</p>
        <p className="mt-1 text-sm font-medium">{item.published_at ? formatDate(item.published_at, "EEE, MMM d, yyyy · h:mm a") : "—"}</p>
      </div>
      <form
        className="flex min-w-0 flex-1 basis-72 flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <label htmlFor={inputId} className="text-xs text-muted-foreground">
          Published link
        </label>
        <div className="flex min-w-0 gap-2">
          <Input
            id={inputId}
            type="url"
            inputMode="url"
            value={draft}
            placeholder="https://…"
            aria-invalid={!valid || undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
          />
          {item.published_url && isHttpUrl(item.published_url) ? (
            <Button asChild variant="outline" size="icon" aria-label="Open the live post">
              <a href={item.published_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
        {!valid ? <p className="text-xs text-destructive">Enter the full link, starting with https://</p> : null}
      </form>
    </div>
  )
}

/* ---------------------------------- KPIs ---------------------------------- */

function KpiTiles({ latest, previous }: { latest: ContentMetric; previous: ContentMetric | null }) {
  const rates = computeRates(latest)
  const prevRates = previous ? computeRates(previous) : null
  const since = previous ? `since ${formatDate(previous.recorded_at, "MMM d")}` : undefined
  const engagements = engagementsOf(latest)
  const er = rates.engagement_rate
  const prevEr = prevRates?.engagement_rate ?? null
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Views"
        value={formatNumber(latest.views)}
        delta={growth(latest.views, previous?.views)}
        deltaLabel={since}
        sublabel={previous ? undefined : `Recorded ${formatDate(latest.recorded_at, "MMM d")}`}
      />
      <StatTile label="Reach" value={formatNumber(latest.reach)} delta={growth(latest.reach, previous?.reach)} deltaLabel={since} />
      <StatTile
        label="Engagement rate"
        value={formatPercent(er)}
        delta={er !== null && prevEr !== null ? er - prevEr : undefined}
        deltaSuffix=" pts"
        sublabel={pluralize(engagements, "engagement")}
      />
      <StatTile
        label="Leads"
        value={formatNumber(latest.leads)}
        delta={growth(latest.leads, previous?.leads)}
        deltaLabel={since}
        sublabel={rates.lead_conversion_rate !== null ? `${formatPercent(rates.lead_conversion_rate)} conversion` : undefined}
      />
    </div>
  )
}
