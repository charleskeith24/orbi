"use client"

import { ChartColumn, Trophy } from "lucide-react"
import Link from "next/link"
import {
  ContentThumbnail,
  DefinitionList,
  EmptyState,
  KeyValue,
  PageSection,
  PlatformIcon,
  SectionCard,
  StatTile,
  TierBadge,
} from "@/components/common"
import { BarList, ChartFrame, platformColor } from "@/components/charts"
import type { CampaignPerformance, TieredRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"

const RUNNERS_UP = 3

/** Best piece in detail, then the runners-up — ranked by views among pieces with analytics. */
function TopPiecesCard({ rows, avgViews }: { rows: TieredRow[]; avgViews: number | null }) {
  const ranked = rows.filter((r) => r.metric).sort((a, b) => b.views - a.views || b.engagements - a.engagements)
  const best = ranked[0]
  const rest = ranked.slice(1, 1 + RUNNERS_UP)

  return (
    <SectionCard title="Top pieces" description="Ranked by views among published campaign pieces" icon={Trophy}>
      {best ? (
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <ContentThumbnail item={best.item} size="sm" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/studio/${best.id}`}
                className="line-clamp-2 text-sm leading-snug font-medium outline-none hover:underline focus-visible:underline"
              >
                {best.item.title || "Untitled content"}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <PlatformIcon platform={best.platform} label className="size-3.5" />
                <span>{formatDate(best.publishedAt, "MMM d")}</span>
                <TierBadge tier={best.tier} />
              </div>
            </div>
          </div>
          <DefinitionList>
            <KeyValue label="Views">
              <span className="num">{formatNumber(best.views)}</span>
              {avgViews ? (
                <span className="text-xs text-muted-foreground num">{(best.views / avgViews).toFixed(1)}× campaign avg</span>
              ) : null}
            </KeyValue>
            <KeyValue label="Engagement rate">
              <span className="num">{formatPercent(best.rates.engagement_rate)}</span>
            </KeyValue>
            <KeyValue label="Leads">
              <span className="num">{formatNumber(best.leads)}</span>
            </KeyValue>
          </DefinitionList>
          {rest.length ? (
            <div className="border-t pt-2.5">
              <p className="text-xs text-muted-foreground">Runners-up</p>
              <ol className="mt-1 flex flex-col">
                {rest.map((row, index) => (
                  <li key={row.id} className="flex min-w-0 items-center gap-2 py-1">
                    <span className="w-3 shrink-0 text-xs text-muted-foreground num">{index + 2}</span>
                    <PlatformIcon platform={row.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/studio/${row.id}`}
                      title={row.item.title}
                      className="min-w-0 flex-1 truncate text-sm outline-none hover:underline focus-visible:underline"
                    >
                      {row.item.title || "Untitled content"}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground num">{formatCompact(row.views)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState compact title="No analytics yet" description="Log analytics for a published piece to see which one leads." />
      )}
    </SectionCard>
  )
}

/** Campaign results from `campaignPerformance`: totals, per-platform split and the top pieces. */
export function CampaignPerformanceSection({ perf }: { perf: CampaignPerformance }) {
  const { totals } = perf
  const unmeasured = perf.published - totals.measured

  if (!perf.published) {
    return (
      <PageSection title="Performance" description="Latest analytics snapshot for each published campaign piece.">
        <SectionCard>
          <EmptyState
            compact
            icon={ChartColumn}
            title="No published pieces yet"
            description="Views, reach, engagement and leads appear here as campaign pieces go live and their analytics are logged."
          />
        </SectionCard>
      </PageSection>
    )
  }

  const platformRows = perf.byPlatform
  const table = {
    columns: ["Platform", "Pieces", "Views", "Engagement rate", "Leads"],
    rows: platformRows.map((p) => [
      p.label,
      p.posts,
      formatNumber(p.views),
      formatPercent(p.engagementRate),
      formatNumber(p.leads),
    ]),
  }

  return (
    <PageSection
      title="Performance"
      description={`Latest analytics snapshot for ${pluralize(perf.published, "published piece")}${
        unmeasured > 0 ? ` · ${pluralize(unmeasured, "piece")} without analytics yet` : ""
      }.`}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Published"
          value={formatNumber(perf.published)}
          sublabel={perf.targetPosts ? `of ${formatNumber(perf.targetPosts)} target` : `${formatNumber(perf.planned)} planned`}
        />
        <StatTile
          label="Views"
          value={formatCompact(totals.views)}
          sublabel={totals.avgViews !== null ? `${formatCompact(totals.avgViews)} avg per piece` : undefined}
        />
        <StatTile
          label="Reach"
          value={formatCompact(totals.reach)}
          sublabel={`${pluralize(totals.followersGained, "follower")} gained`}
        />
        <StatTile
          label="Engagement rate"
          value={formatPercent(totals.engagementRate)}
          sublabel={`${formatCompact(totals.engagements)} engagements`}
        />
        <StatTile
          label="Leads"
          value={formatNumber(totals.leads)}
          sublabel={
            totals.sales
              ? pluralize(totals.sales, "sale")
              : totals.leadsPerPost !== null
                ? `${totals.leadsPerPost.toFixed(1)} per piece`
                : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          className="lg:col-span-2"
          title="Views by platform"
          description="Published campaign pieces, latest snapshot"
          table={table}
        >
          <BarList
            aria-label="Views by platform"
            valueFormatter={formatCompact}
            items={platformRows.map((p) => ({
              id: p.platform,
              label: PLATFORMS[p.platform]?.label ?? p.label,
              value: p.views,
              color: platformColor(p.platform),
              secondary: `${pluralize(p.posts, "piece")} · ${formatPercent(p.engagementRate)} eng. · ${pluralize(p.leads, "lead")}`,
            }))}
          />
        </ChartFrame>
        <TopPiecesCard rows={perf.rows} avgViews={totals.avgViews} />
      </div>
    </PageSection>
  )
}
