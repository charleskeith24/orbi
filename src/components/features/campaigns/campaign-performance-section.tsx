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
import { useT } from "@/lib/i18n"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { campaignDetailMessages } from "./messages"

const RUNNERS_UP = 3

/** Best piece in detail, then the runners-up — ranked by views among pieces with analytics. */
function TopPiecesCard({ rows, avgViews }: { rows: TieredRow[]; avgViews: number | null }) {
  const t = useT(campaignDetailMessages)
  const ranked = rows.filter((r) => r.metric).sort((a, b) => b.views - a.views || b.engagements - a.engagements)
  const best = ranked[0]
  const rest = ranked.slice(1, 1 + RUNNERS_UP)

  return (
    <SectionCard title={t("top_pieces")} description={t("top_pieces_description")} icon={Trophy}>
      {best ? (
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <ContentThumbnail item={best.item} size="sm" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/studio/${best.id}`}
                className="line-clamp-2 text-sm leading-snug font-medium outline-none hover:underline focus-visible:underline"
              >
                {best.item.title || t("untitled_content")}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <PlatformIcon platform={best.platform} label className="size-3.5" />
                <span>{formatDate(best.publishedAt, "MMM d")}</span>
                <TierBadge tier={best.tier} />
              </div>
            </div>
          </div>
          <DefinitionList>
            <KeyValue label={t("views")}>
              <span className="num">{formatNumber(best.views)}</span>
              {avgViews ? (
                <span className="text-xs text-muted-foreground num">{t("campaign_avg", { value: (best.views / avgViews).toFixed(1) })}</span>
              ) : null}
            </KeyValue>
            <KeyValue label={t("engagement_rate")}>
              <span className="num">{formatPercent(best.rates.engagement_rate)}</span>
            </KeyValue>
            <KeyValue label={t("leads")}>
              <span className="num">{formatNumber(best.leads)}</span>
            </KeyValue>
          </DefinitionList>
          {rest.length ? (
            <div className="border-t pt-2.5">
              <p className="text-xs text-muted-foreground">{t("runners_up")}</p>
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
                      {row.item.title || t("untitled_content")}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground num">{formatCompact(row.views)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState compact title={t("no_analytics")} description={t("no_analytics_description")} />
      )}
    </SectionCard>
  )
}

/** Campaign results from `campaignPerformance`: totals, per-platform split and the top pieces. */
export function CampaignPerformanceSection({ perf }: { perf: CampaignPerformance }) {
  const t = useT(campaignDetailMessages)
  const { totals } = perf
  const pieces = (count: number) => t.plural("pieces", count, { count: formatNumber(count) })
  const unmeasured = perf.published - totals.measured

  if (!perf.published) {
    return (
      <PageSection title={t("performance")} description={t("performance_empty_description")}>
        <SectionCard>
          <EmptyState
            compact
            icon={ChartColumn}
            title={t("no_published")}
            description={t("no_published_description")}
          />
        </SectionCard>
      </PageSection>
    )
  }

  const platformRows = perf.byPlatform
  const table = {
    columns: [t("col_platform"), t("col_pieces"), t("views"), t("engagement_rate"), t("leads")],
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
      title={t("performance")}
      description={t("performance_description", {
        published: t.plural("published_pieces", perf.published, { count: formatNumber(perf.published) }),
        unmeasured: unmeasured > 0 ? t("unmeasured_suffix", { pieces: pieces(unmeasured) }) : "",
      })}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label={t("published")}
          value={formatNumber(perf.published)}
          sublabel={
            perf.targetPosts ? t("of_target", { target: formatNumber(perf.targetPosts) }) : t("planned", { count: formatNumber(perf.planned) })
          }
        />
        <StatTile
          label={t("views")}
          value={formatCompact(totals.views)}
          sublabel={totals.avgViews !== null ? t("avg_per_piece", { value: formatCompact(totals.avgViews) }) : undefined}
        />
        <StatTile
          label={t("reach")}
          value={formatCompact(totals.reach)}
          sublabel={t.plural("followers_gained", totals.followersGained, { count: formatNumber(totals.followersGained) })}
        />
        <StatTile
          label={t("engagement_rate")}
          value={formatPercent(totals.engagementRate)}
          sublabel={t("engagements", { count: formatCompact(totals.engagements) })}
        />
        <StatTile
          label={t("leads")}
          value={formatNumber(totals.leads)}
          sublabel={
            totals.sales
              ? t.plural("sales", totals.sales, { count: formatNumber(totals.sales) })
              : totals.leadsPerPost !== null
                ? t("per_piece", { value: totals.leadsPerPost.toFixed(1) })
                : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          className="lg:col-span-2"
          title={t("views_by_platform")}
          description={t("views_by_platform_description")}
          table={table}
        >
          <BarList
            aria-label={t("views_by_platform")}
            valueFormatter={formatCompact}
            items={platformRows.map((p) => ({
              id: p.platform,
              label: PLATFORMS[p.platform]?.label ?? p.label,
              value: p.views,
              color: platformColor(p.platform),
              secondary: t("bar_secondary", {
                pieces: pieces(p.posts),
                rate: formatPercent(p.engagementRate),
                leads: t.plural("leads", p.leads, { count: formatNumber(p.leads) }),
              }),
            }))}
          />
        </ChartFrame>
        <TopPiecesCard rows={perf.rows} avgViews={totals.avgViews} />
      </div>
    </PageSection>
  )
}
