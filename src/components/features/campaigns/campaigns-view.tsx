"use client"

import { Megaphone, Plus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  EmptyState,
  FacetFilter,
  FilterBar,
  PageContainer,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  StatTile,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { itemPerformanceRows } from "@/lib/analytics"
import { CAMPAIGN_STATUSES } from "@/lib/constants"
import { useDb, useSettings, useTable } from "@/lib/store"
import type { ContentCampaign } from "@/lib/types"
import { formatCompact, formatNumber, matchesQuery, ratio } from "@/lib/utils"
import { CampaignFormDialog } from "./campaign-form-dialog"
import { CampaignTable } from "./campaign-table"
import { compareCampaigns, summarizeCampaign, type CampaignSummary } from "./campaign-utils"

function shareLabel(part: number, whole: number, noun: string): string | undefined {
  const pct = ratio(part, whole)
  return pct === null ? undefined : `${Math.round(pct)}% of all ${noun}`
}

export function CampaignsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaigns = useTable("content_campaigns")
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())

  const [query, setQuery] = useState("")
  const [statuses, setStatuses] = useState<string[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; campaign: ContentCampaign | null }>({ open: false, campaign: null })

  // `?open=<id>` — a campaign's detail lives on its own page.
  const openId = searchParams.get("open")
  useEffect(() => {
    if (openId) router.replace(`/campaigns/${openId}`)
  }, [openId, router])

  const summaries = useMemo(
    () =>
      [...campaigns]
        .sort(compareCampaigns)
        .map((c) => summarizeCampaign(db, c, now, settings))
        .filter((s): s is CampaignSummary => s !== null),
    [campaigns, db, now, settings]
  )

  const stats = useMemo(() => {
    const all = itemPerformanceRows(db, now)
    const allViews = all.reduce((acc, r) => acc + r.views, 0)
    const allLeads = all.reduce((acc, r) => acc + r.leads, 0)
    const count = (status: string) => summaries.filter((s) => s.campaign.status === status).length
    return {
      active: count("active"),
      planning: count("planning"),
      paused: count("paused"),
      completed: count("completed"),
      published: summaries.reduce((acc, s) => acc + s.perf.published, 0),
      planned: summaries.reduce((acc, s) => acc + s.perf.planned, 0),
      views: summaries.reduce((acc, s) => acc + s.perf.totals.views, 0),
      leads: summaries.reduce((acc, s) => acc + s.perf.totals.leads, 0),
      allViews,
      allLeads,
    }
  }, [db, now, summaries])

  const filtered = useMemo(
    () =>
      summaries.filter(
        (s) =>
          (!statuses.length || statuses.includes(s.campaign.status)) &&
          matchesQuery(query, s.campaign.name, s.campaign.objective, s.campaign.message, s.campaign.description)
      ),
    [summaries, statuses, query]
  )

  const statusOptions = CAMPAIGN_STATUSES.map((s) => ({
    value: s.id,
    label: s.label,
    count: summaries.filter((x) => x.campaign.status === s.id).length,
  }))
  const filtering = Boolean(query || statuses.length)
  const resetFilters = () => {
    setQuery("")
    setStatuses([])
  }

  const openCreate = () => setDialog({ open: true, campaign: null })
  const openEdit = useCallback((campaign: ContentCampaign) => setDialog({ open: true, campaign }), [])

  const statusBreakdown = [
    stats.planning ? `${stats.planning} planning` : "",
    stats.paused ? `${stats.paused} paused` : "",
    stats.completed ? `${stats.completed} completed` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PageContainer>
      <PageHeader
        title="Campaigns"
        description="Focused content pushes with one message, a date window and a target — tracked from plan to leads."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            New campaign
          </Button>
        }
      />

      {campaigns.length ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Active campaigns" value={formatNumber(stats.active)} sublabel={statusBreakdown || undefined} />
            <StatTile
              label="Campaign pieces published"
              value={formatNumber(stats.published)}
              sublabel={`${formatNumber(stats.planned)} more planned`}
            />
            <StatTile
              label="Views from campaigns"
              value={formatCompact(stats.views)}
              sublabel={shareLabel(stats.views, stats.allViews, "views")}
            />
            <StatTile
              label="Leads from campaigns"
              value={formatNumber(stats.leads)}
              sublabel={shareLabel(stats.leads, stats.allLeads, "leads")}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === summaries.length ? `${summaries.length} campaigns` : `${filtered.length} of ${summaries.length}`}
                </span>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder="Search campaigns…" />
              <FacetFilter title="Status" options={statusOptions} value={statuses} onChange={setStatuses} />
              <ResetFiltersButton show={filtering} onClick={resetFilters} />
            </FilterBar>
            <CampaignTable
              rows={filtered}
              onEdit={openEdit}
              empty={
                <EmptyState
                  compact
                  icon={Megaphone}
                  title="No campaigns match"
                  description="Try a different search or status."
                  action={
                    <Button size="sm" variant="outline" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  }
                />
              }
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="A campaign groups content into one focused push — a message, a date window and a target — so you can see whether the push paid off."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden />
              New campaign
            </Button>
          }
        />
      )}

      <CampaignFormDialog
        open={dialog.open}
        campaign={dialog.campaign}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={(row, created) => {
          if (created) router.push(`/campaigns/${row.id}`)
        }}
      />
    </PageContainer>
  )
}
