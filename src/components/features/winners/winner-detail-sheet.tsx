"use client"

import { ArrowUpRight, Pin } from "lucide-react"
import Link from "next/link"
import {
  DefinitionList,
  DetailSheet,
  FormatLabel,
  FunnelBadge,
  KeyValue,
  ListEditor,
  PageSection,
  PillarBadge,
  PlatformLabel,
  StatusPill,
  TierBadge,
} from "@/components/common"
import { ContentTree } from "@/components/features/repurpose/content-tree"
import { Button } from "@/components/ui/button"
import { isWinnerTier, type TieredRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { dataActions, useRow, useSettings, useTable } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { togglePinnedWinner } from "./winner-actions"
import { WinnerReplication } from "./winner-replication"
import { WinnerRepurpose } from "./winner-repurpose"
import { WinnerWhy } from "./winner-why"
import { formatRatio, tierExplanation } from "./winners-model"

function PerformanceSummary({ row, pinned }: { row: TieredRow; pinned: boolean }) {
  const settings = useSettings()
  const stats = [
    { label: "Views", value: formatCompact(row.views) },
    { label: "Reach", value: formatCompact(row.reach) },
    { label: "Engagement rate", value: formatPercent(row.rates.engagement_rate) },
    { label: "Saves", value: formatNumber(row.saves) },
    { label: "Shares", value: formatNumber(row.shares) },
    { label: "Comments", value: formatNumber(row.comments) },
    { label: "Leads", value: formatNumber(row.leads) },
    { label: "Followers gained", value: formatNumber(row.followersGained) },
  ]

  return (
    <section aria-label="Performance" className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={row.tier} showNormal />
        {pinned ? <StatusPill icon={Pin}>Pinned</StatusPill> : null}
        {row.ratio !== null ? (
          <span className="text-sm">
            <span className="font-semibold num">{formatRatio(row.ratio)}</span>{" "}
            <span className="text-muted-foreground">your {PLATFORMS[row.platform].label} baseline</span>
          </span>
        ) : null}
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {tierExplanation(row, settings)}
        {pinned && !isWinnerTier(row.tier) ? " Pinned manually, so it stays in the library whatever its tier." : ""}
      </p>
      {row.metric ? (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-md border bg-card px-3 py-2">
                <dt className="truncate text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="text-base font-semibold num">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">Latest analytics snapshot · {formatDate(row.metric.recorded_at)}</p>
        </>
      ) : null}
    </section>
  )
}

function Properties({ item, row }: { item: ContentItem; row: TieredRow }) {
  const idea = useRow("content_ideas", item.idea_id)
  const angle = useRow("angles", item.angle_id)
  const briefs = useTable("content_briefs")
  const cta = briefs.find((b) => b.content_item_id === item.id)?.cta.trim() ?? ""

  return (
    <DefinitionList>
      <KeyValue label="Winning topic">{idea?.core_topic.trim() || item.title}</KeyValue>
      <KeyValue label="Hook">{item.hook ? <span className="text-pretty">“{item.hook}”</span> : null}</KeyValue>
      <KeyValue label="Angle">{angle?.name}</KeyValue>
      <KeyValue label="Format">
        <FormatLabel formatId={item.format_id} className="text-sm text-foreground" />
      </KeyValue>
      <KeyValue label="Platform">
        <PlatformLabel platform={item.platform} />
      </KeyValue>
      <KeyValue label="Content pillar">
        <PillarBadge pillarId={item.pillar_id} />
      </KeyValue>
      <KeyValue label="CTA">{cta ? <span className="text-pretty">{cta}</span> : null}</KeyValue>
      <KeyValue label="Funnel stage">{item.funnel_stage ? <FunnelBadge stage={item.funnel_stage} showName /> : null}</KeyValue>
      <KeyValue label="Published">{formatDate(row.publishedAt)}</KeyValue>
    </DefinitionList>
  )
}

/** `/winners?open=<itemId>` — why a winner worked and every way to get more from it. */
export function WinnerDetailSheet({
  row,
  open,
  now,
  onOpenChange,
}: {
  row: TieredRow | null
  open: boolean
  now: Date
  onOpenChange: (open: boolean) => void
}) {
  const live = useRow("content_items", row?.id)
  if (!row) return null
  const item = live ?? row.item
  const pinned = item.pinned_winner

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="xl"
      title={item.title || "Untitled content"}
      description={`${PLATFORMS[item.platform].label} · published ${formatDate(row.publishedAt)}`}
      onOpenAutoFocus={(event) => event.preventDefault()}
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin from the library" : "Pin to the library"}
            title={pinned ? "Pinned — click to unpin" : "Pin to keep it in the library"}
            onClick={() => togglePinnedWinner(item, row.tier)}
          >
            <Pin className={cn(pinned && "fill-current")} aria-hidden />
          </Button>
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={`/studio/${item.id}`} aria-label="Open in Content Studio" title="Open in Content Studio">
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        <PerformanceSummary row={row} pinned={pinned} />
        <Properties item={item} row={row} />
        <WinnerWhy key={`why-${item.id}`} item={item} />
        <PageSection
          id="winner-replication-ideas"
          title="Replication Ideas"
          description="How you'd repeat this without repeating yourself — saved on the post."
        >
          <ListEditor
            variant="lines"
            value={item.replication_ideas}
            onChange={(next) => dataActions.update("content_items", item.id, { replication_ideas: next })}
            placeholder="Add a way to replicate this…"
            addLabel="Add replication idea"
          />
        </PageSection>
        <WinnerReplication key={`replicate-${item.id}`} item={item} ratio={row.ratio} />
        <WinnerRepurpose item={item} now={now} />
        <PageSection
          id="winner-tree"
          title="Content Tree"
          description="The idea behind this post and everything it has become."
        >
          <ContentTree itemId={item.id} />
        </PageSection>
      </div>
    </DetailSheet>
  )
}
