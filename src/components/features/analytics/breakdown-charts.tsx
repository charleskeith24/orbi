"use client"

import { BarList, ChartFrame, FunnelBars, platformColor } from "@/components/charts"
import {
  NO_KEY,
  type FormatAggregate,
  type FunnelAggregate,
  type GroupAggregate,
  type PillarAggregate,
  type PlatformAggregate,
} from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { useT, type Translator } from "@/lib/i18n"
import type { PlatformId } from "@/lib/types"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { analyticsMessages } from "./messages"

type T = Translator<typeof analyticsMessages.en>

const GROUP_COLUMNS = ["Posts", "Views", "Avg views", "Reach", "Eng. rate", "Leads", "Followers"]

function groupRow(label: string, g: GroupAggregate): (string | number)[] {
  return [
    label,
    g.posts,
    formatNumber(g.views),
    formatNumber(g.avgViews),
    formatNumber(g.reach),
    formatPercent(g.engagementRate),
    formatNumber(g.leads),
    formatNumber(g.followersGained),
  ]
}

/** "12 posts · 4.2% eng. · 3 leads" */
function groupSummary(t: T, g: GroupAggregate): string {
  return [
    t.plural("posts", g.posts, { count: formatNumber(g.posts) }),
    g.engagementRate !== null ? t("eng_short", { rate: formatPercent(g.engagementRate) }) : null,
    g.leads ? t.plural("leads", g.leads, { count: formatNumber(g.leads) }) : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function PlatformBreakdown({ groups, hrefFor }: { groups: PlatformAggregate[]; hrefFor: (platform: PlatformId) => string }) {
  const t = useT(analyticsMessages)
  return (
    <ChartFrame
      title={t("by_platform")}
      info={t("by_platform_info")}
      table={{ columns: [t("platform"), ...GROUP_COLUMNS], rows: groups.map((g) => groupRow(g.label, g)) }}
    >
      <BarList
        items={groups.map((g) => ({
          id: g.key,
          label: g.label,
          value: g.views,
          color: platformColor(g.platform),
          secondary: groupSummary(t, g),
          href: hrefFor(g.platform),
        }))}
        valueFormatter={formatCompact}
        emptyMessage={t("no_posts_period")}
        aria-label={t("views_by_platform")}
      />
    </ChartFrame>
  )
}

export function PillarBreakdown({ groups, hrefFor }: { groups: PillarAggregate[]; hrefFor: (pillarId: string) => string }) {
  const t = useT(analyticsMessages)
  return (
    <ChartFrame
      title={t("by_pillar")}
      info={t("avg_per_measured")}
      table={{ columns: [t("pillar"), ...GROUP_COLUMNS], rows: groups.map((g) => groupRow(g.label, g)) }}
    >
      <BarList
        items={groups.map((g) => ({
          id: g.key,
          label: g.label,
          value: g.avgViews ?? 0,
          color: g.color ?? "other",
          secondary: groupSummary(t, g),
          href: hrefFor(g.pillar?.id ?? NO_KEY),
        }))}
        valueFormatter={formatCompact}
        emptyMessage={t("no_pillars_chart")}
        aria-label={t("views_by_pillar")}
      />
    </ChartFrame>
  )
}

export function FormatBreakdown({ groups, hrefFor }: { groups: FormatAggregate[]; hrefFor: (formatId: string) => string }) {
  const t = useT(analyticsMessages)
  return (
    <ChartFrame
      title={t("by_format")}
      info={t("avg_per_measured")}
      table={{ columns: ["Format", ...GROUP_COLUMNS], rows: groups.map((g) => groupRow(g.label, g)) }}
    >
      <BarList
        items={groups.map((g) => ({
          id: g.key,
          label: g.label,
          value: g.avgViews ?? 0,
          secondary: groupSummary(t, g),
          href: g.format ? hrefFor(g.format.id) : undefined,
        }))}
        valueFormatter={formatCompact}
        limit={6}
        emptyMessage={t("no_posts_period")}
        aria-label={t("views_by_format")}
      />
    </ChartFrame>
  )
}

export function FunnelBreakdown({ groups }: { groups: FunnelAggregate[] }) {
  const t = useT(analyticsMessages)
  const hasPosts = groups.some((g) => g.posts > 0)
  return (
    <ChartFrame
      title={t("by_funnel")}
      info={t("by_funnel_info")}
      table={{
        columns: [t("col_stage"), ...GROUP_COLUMNS, "Leads / post"],
        rows: groups.map((g) => [
          ...groupRow(g.stage ? `${g.label} · ${FUNNEL_STAGES[g.stage].name}` : g.label, g),
          g.leadsPerPost === null ? "—" : g.leadsPerPost.toFixed(1),
        ]),
      }}
    >
      <FunnelBars
        stages={
          hasPosts
            ? groups.map((g) => ({
                id: g.key,
                label: g.stage ? `${g.label} · ${FUNNEL_STAGES[g.stage].name}` : g.label,
                value: g.views,
                sublabel: [
                  t.plural("posts", g.posts, { count: formatNumber(g.posts) }),
                  g.leads ? t.plural("leads", g.leads, { count: formatNumber(g.leads) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              }))
            : []
        }
        valueFormatter={formatCompact}
        emptyMessage={t("no_posts_period")}
        aria-label={t("views_by_funnel")}
      />
    </ChartFrame>
  )
}
