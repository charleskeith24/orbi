"use client"

import { Grid3x3, Lightbulb, Pause, Pencil, Sparkles } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { DetailSheet, Meter, PlatformIcon, StageBadge, StatusPill, TierBadge, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { scopedRows } from "@/lib/analytics"
import { PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate, formatShortDate } from "@/lib/dates"
import { uiActions, useDb, useSettings } from "@/lib/store"
import type { ContentPillar } from "@/lib/types"
import { formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { MixStatusPill } from "./mix-status"
import { PillarActionsMenu } from "./pillar-actions-menu"
import { PillarIconTile } from "./pillar-icons"
import type { PillarStats } from "./use-pillar-overview"

/** `?open=<pillarId>` detail: mix vs target, performance, best posts, work in progress and next steps. */
export function PillarDetailSheet({
  stats,
  open,
  onOpenChange,
  enoughData,
  windowLabel,
  mixTotal,
  now,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  stats: PillarStats | null
  open: boolean
  onOpenChange: (open: boolean) => void
  enoughData: boolean
  windowLabel: string
  /** Items counted in the whole mix window. */
  mixTotal: number
  now: Date
  onEdit: (pillar: ContentPillar) => void
  onToggleActive: (pillar: ContentPillar) => void
  onDelete: (pillar: ContentPillar) => void
}) {
  const pillar = stats?.pillar ?? null
  const actual = stats?.mix?.actualPct ?? 0
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="md"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={
        pillar ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <PillarIconTile name={pillar.icon} color={pillar.color} size="sm" />
            <span className="min-w-0 truncate">{pillar.name || "Untitled pillar"}</span>
          </span>
        ) : (
          "Pillar"
        )
      }
      description={pillar?.description || undefined}
      actions={
        pillar ? (
          <>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit pillar" onClick={() => onEdit(pillar)}>
              <Pencil aria-hidden />
            </Button>
            <PillarActionsMenu pillar={pillar} onToggleActive={() => onToggleActive(pillar)} onDelete={() => onDelete(pillar)} />
          </>
        ) : null
      }
      footer={
        pillar ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                uiActions.askStrategist(
                  `How should I grow my ${pillar.name} pillar? It's ${Math.round(actual)}% of my recent content vs a ${pillar.target_percentage}% target.`
                )
              }
            >
              <Sparkles className="text-brand" aria-hidden />
              Ask Strategist
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/pillars/matrix?pillar=${pillar.id}`}>
                <Grid3x3 aria-hidden />
                Plan in matrix
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/ideas/generator?pillar=${pillar.id}`}>
                <Lightbulb aria-hidden />
                Generate ideas
              </Link>
            </Button>
          </>
        ) : null
      }
    >
      {stats ? <PillarDetailBody stats={stats} enoughData={enoughData} windowLabel={windowLabel} mixTotal={mixTotal} now={now} /> : null}
    </DetailSheet>
  )
}

function PillarDetailBody({
  stats,
  enoughData,
  windowLabel,
  mixTotal,
  now,
}: {
  stats: PillarStats
  enoughData: boolean
  windowLabel: string
  mixTotal: number
  now: Date
}) {
  const db = useDb()
  const settings = useSettings()
  const { pillar, mix, perf } = stats
  const actual = mix?.actualPct ?? 0

  const detail = useMemo(() => {
    const best = scopedRows(db, now, { settings })
      .filter((r) => r.pillarId === pillar.id && r.metric)
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
    const upcoming = db.content_items
      .filter((i) => i.pillar_id === pillar.id && !PUBLISHED_STAGES.includes(i.stage))
      .map((item) => ({ item, date: contentItemDate(item) }))
      .sort((a, b) => (a.date?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.date?.getTime() ?? Number.MAX_SAFE_INTEGER))
    const ideas = db.content_ideas.filter(
      (i) => i.pillar_id === pillar.id && i.status !== "archived" && i.status !== "converted"
    ).length
    return { best, upcoming: upcoming.slice(0, 4), inProduction: upcoming.length, ideas }
  }, [db, now, settings, pillar.id])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {pillar.is_active ? (
          <MixStatusPill status={mix?.status} deviation={mix?.deviation ?? 0} enoughData={enoughData} />
        ) : (
          <StatusPill tone="neutral" icon={Pause}>
            Paused
          </StatusPill>
        )}
        <span className="text-xs text-muted-foreground">Target: {pillar.target_percentage}% of your content</span>
      </div>

      {pillar.is_active ? (
        <Section title={`Mix · ${windowLabel}`}>
          <p className="flex items-baseline gap-2">
            <span className="num text-2xl leading-8 font-semibold tracking-tight">{Math.round(actual)}%</span>
            <span className="text-sm text-muted-foreground">of content vs a {pillar.target_percentage}% target</span>
          </p>
          <Meter
            value={actual}
            target={pillar.target_percentage}
            color={pillar.color}
            aria-label={`${pillar.name} share of content`}
            valueText={`${Math.round(actual)}% actual, target ${pillar.target_percentage}%`}
          />
          <p className="text-xs text-muted-foreground">
            {mix?.count
              ? `${pluralize(mix.count, "item")} of ${formatNumber(mixTotal)} published or scheduled`
              : "Nothing published or scheduled for this pillar in the window."}
          </p>
        </Section>
      ) : null}

      <Section title={`Performance · ${windowLabel}`}>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Posts" value={formatNumber(perf?.posts ?? 0)} />
          <Stat label="Avg views" value={formatCompact(perf?.avgViews ?? null)} />
          <Stat label="Engagement" value={formatPercent(perf?.engagementRate ?? null)} />
          <Stat label="Leads" value={formatNumber(perf?.leads ?? 0)} />
        </dl>
        {perf?.winners ? (
          <p className="text-xs text-muted-foreground">{pluralize(perf.winners, "Winner or Breakout post", "Winner or Breakout posts")} in this window</p>
        ) : null}
      </Section>

      {pillar.examples.length ? (
        <Section title="Examples">
          <div className="flex flex-wrap gap-1">
            {pillar.examples.map((example, i) => (
              <Token key={`${example}-${i}`} className="font-normal text-foreground/85">
                {example}
              </Token>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Best posts · all time">
        {detail.best.length ? (
          <ul className="-mx-2 flex flex-col">
            {detail.best.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/studio/${row.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <PlatformIcon platform={row.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{row.item.title || "Untitled content"}</span>
                  <TierBadge tier={row.tier} />
                  <span className="num shrink-0 text-xs text-muted-foreground">{formatCompact(row.views)} views</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No published posts with analytics for this pillar yet.</p>
        )}
      </Section>

      <Section title="In the works">
        <p className="text-xs text-muted-foreground">
          {pluralize(detail.inProduction, "piece")} in production · {pluralize(detail.ideas, "active idea")}
        </p>
        {detail.upcoming.length ? (
          <ul className="-mx-2 flex flex-col">
            {detail.upcoming.map(({ item, date }) => (
              <li key={item.id}>
                <Link
                  href={`/studio/${item.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{item.title || "Untitled content"}</span>
                  <StageBadge stage={item.stage} />
                  <span className="num w-12 shrink-0 text-right text-xs text-muted-foreground">{date ? formatShortDate(date) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border px-2.5 py-2">
      <dt className="truncate text-[11px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="num truncate text-sm font-semibold">{value}</dd>
    </div>
  )
}
