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
import type { PlatformId } from "@/lib/types"
import { formatCompact, formatNumber, formatPercent, pluralize } from "@/lib/utils"

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
function groupSummary(g: GroupAggregate): string {
  return [
    pluralize(g.posts, "post"),
    g.engagementRate !== null ? `${formatPercent(g.engagementRate)} eng.` : null,
    g.leads ? pluralize(g.leads, "lead") : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function PlatformBreakdown({ groups, hrefFor }: { groups: PlatformAggregate[]; hrefFor: (platform: PlatformId) => string }) {
  return (
    <ChartFrame
      title="By platform"
      description="Total views of the posts published on each platform"
      table={{ columns: ["Platform", ...GROUP_COLUMNS], rows: groups.map((g) => groupRow(g.label, g)) }}
    >
      <BarList
        items={groups.map((g) => ({
          id: g.key,
          label: g.label,
          value: g.views,
          color: platformColor(g.platform),
          secondary: groupSummary(g),
          href: hrefFor(g.platform),
        }))}
        valueFormatter={formatCompact}
        emptyMessage="No posts published in this period."
        aria-label="Views by platform"
      />
    </ChartFrame>
  )
}

export function PillarBreakdown({ groups, hrefFor }: { groups: PillarAggregate[]; hrefFor: (pillarId: string) => string }) {
  return (
    <ChartFrame
      title="By content pillar"
      description="Average views per measured post"
      table={{ columns: ["Pillar", ...GROUP_COLUMNS], rows: groups.map((g) => groupRow(g.label, g)) }}
    >
      <BarList
        items={groups.map((g) => ({
          id: g.key,
          label: g.label,
          value: g.avgViews ?? 0,
          color: g.color ?? "other",
          secondary: groupSummary(g),
          href: hrefFor(g.pillar?.id ?? NO_KEY),
        }))}
        valueFormatter={formatCompact}
        emptyMessage="No pillars yet — add pillars in Brand HQ to see which themes perform."
        aria-label="Average views by content pillar"
      />
    </ChartFrame>
  )
}

export function FormatBreakdown({ groups, hrefFor }: { groups: FormatAggregate[]; hrefFor: (formatId: string) => string }) {
  return (
    <ChartFrame
      title="By format"
      description="Average views per measured post"
      table={{ columns: ["Format", ...GROUP_COLUMNS], rows: groups.map((g) => groupRow(g.label, g)) }}
    >
      <BarList
        items={groups.map((g) => ({
          id: g.key,
          label: g.label,
          value: g.avgViews ?? 0,
          secondary: groupSummary(g),
          href: g.format ? hrefFor(g.format.id) : undefined,
        }))}
        valueFormatter={formatCompact}
        limit={6}
        emptyMessage="No posts published in this period."
        aria-label="Average views by format"
      />
    </ChartFrame>
  )
}

export function FunnelBreakdown({ groups }: { groups: FunnelAggregate[] }) {
  const hasPosts = groups.some((g) => g.posts > 0)
  return (
    <ChartFrame
      title="By funnel stage"
      description="Share of views — TOFU builds reach, BOFU should convert"
      table={{
        columns: ["Stage", ...GROUP_COLUMNS, "Leads / post"],
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
                sublabel: [pluralize(g.posts, "post"), g.leads ? pluralize(g.leads, "lead") : null].filter(Boolean).join(" · "),
              }))
            : []
        }
        valueFormatter={formatCompact}
        emptyMessage="No posts published in this period."
        aria-label="Views by funnel stage"
      />
    </ChartFrame>
  )
}
