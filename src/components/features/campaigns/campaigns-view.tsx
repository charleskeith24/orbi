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
import { useT, useUiLang } from "@/lib/i18n"
import { useDb, useSettings, useTable } from "@/lib/store"
import type { ContentCampaign } from "@/lib/types"
import { formatCompact, formatNumber, matchesQuery, ratio } from "@/lib/utils"
import { CampaignFormDialog } from "./campaign-form-dialog"
import { CampaignTable } from "./campaign-table"
import { compareCampaigns, summarizeCampaign, type CampaignSummary } from "./campaign-utils"
import { campaignMessages } from "./messages"

function sharePct(part: number, whole: number): number | null {
  const pct = ratio(part, whole)
  return pct === null ? null : Math.round(pct)
}

export function CampaignsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useT(campaignMessages)
  const lang = useUiLang()
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
        .map((c) => summarizeCampaign(db, c, now, settings, lang))
        .filter((s): s is CampaignSummary => s !== null),
    [campaigns, db, now, settings, lang]
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
    stats.planning ? t("stat_planning", { count: stats.planning }) : "",
    stats.paused ? t("stat_paused", { count: stats.paused }) : "",
    stats.completed ? t("stat_completed", { count: stats.completed }) : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const viewsShare = sharePct(stats.views, stats.allViews)
  const leadsShare = sharePct(stats.leads, stats.allLeads)

  return (
    <PageContainer>
      <PageHeader
        title="Campaigns"
        info={t("description")}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            {t("new_campaign")}
          </Button>
        }
      />

      {campaigns.length ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile size="sm" label={t("stat_active")} value={formatNumber(stats.active)} sublabel={statusBreakdown || undefined} />
            <StatTile
              size="sm"
              label={t("stat_published")}
              value={formatNumber(stats.published)}
              sublabel={t("stat_more_planned", { count: formatNumber(stats.planned) })}
            />
            <StatTile
              size="sm"
              label={t("stat_views")}
              value={formatCompact(stats.views)}
              sublabel={viewsShare === null ? undefined : t("share_views", { pct: viewsShare })}
            />
            <StatTile
              size="sm"
              label={t("stat_leads")}
              value={formatNumber(stats.leads)}
              sublabel={leadsShare === null ? undefined : t("share_leads", { pct: leadsShare })}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === summaries.length
                    ? t("count_campaigns", { count: summaries.length })
                    : t("count_of", { shown: filtered.length, total: summaries.length })}
                </span>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder={t("search_placeholder")} />
              <FacetFilter title={t("facet_status")} options={statusOptions} value={statuses} onChange={setStatuses} />
              <ResetFiltersButton show={filtering} onClick={resetFilters} />
            </FilterBar>
            <CampaignTable
              rows={filtered}
              onEdit={openEdit}
              empty={
                <EmptyState
                  compact
                  icon={Megaphone}
                  title={t("no_matches_title")}
                  description={t("no_matches_description")}
                  action={
                    <Button size="sm" variant="outline" onClick={resetFilters}>
                      {t("reset_filters")}
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
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden />
              {t("new_campaign")}
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
