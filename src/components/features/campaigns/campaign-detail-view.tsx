"use client"

import { ArrowLeft, ListPlus, Megaphone, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ColorDot, EmptyState, PageContainer, PageHeader, SectionCard } from "@/components/common"
import { CampaignCollabs } from "@/components/features/collabs/collab-links"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { uiActions, useDb, useRow, useSettings } from "@/lib/store"
import type { ContentCampaign, ID, InsertRow, PerformanceTier } from "@/lib/types"
import { AddItemsDialog } from "./add-items-dialog"
import { CampaignActionsMenu } from "./campaign-actions-menu"
import { CampaignFormDialog } from "./campaign-form-dialog"
import { CampaignAboutCard, CampaignProgressCard } from "./campaign-overview"
import { CampaignPerformanceSection } from "./campaign-performance-section"
import { CampaignPieces } from "./campaign-pieces"
import { CampaignStatusSelect, setCampaignStatus } from "./campaign-status"
import { CampaignTimeline } from "./campaign-timeline"
import { dateRangeLabel, summarizeCampaign, timeLabel } from "./campaign-utils"
import { LinkedIdeas } from "./linked-ideas"
import { campaignDetailMessages } from "./messages"

/** `/campaigns/<id>` — resolves the campaign and shows a proper empty state for unknown ids. */
export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const campaign = useRow("content_campaigns", campaignId)
  const [leaving, setLeaving] = useState(false)
  if (!campaign) return leaving ? null : <CampaignNotFound />
  return <CampaignDetail campaign={campaign} onDeleting={() => setLeaving(true)} />
}

function CampaignNotFound() {
  const t = useT(campaignDetailMessages)
  return (
    <PageContainer>
      <EmptyState
        icon={Megaphone}
        title={t("not_found_title")}
        description={t("not_found_description")}
        action={
          <Button size="sm" asChild>
            <Link href="/campaigns">
              <ArrowLeft aria-hidden />
              {t("back_to_campaigns")}
            </Link>
          </Button>
        }
      />
    </PageContainer>
  )
}

function CampaignDetail({ campaign, onDeleting }: { campaign: ContentCampaign; onDeleting: () => void }) {
  const router = useRouter()
  const t = useT(campaignDetailMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const summary = useMemo(() => summarizeCampaign(db, campaign, now, settings, lang), [db, campaign, now, settings, lang])
  const tiers = useMemo(() => new Map<ID, PerformanceTier>(summary?.perf.rows.map((r) => [r.id, r.tier]) ?? []), [summary])
  const views = useMemo(
    () => new Map<ID, number>(summary?.perf.rows.filter((r) => r.metric).map((r) => [r.id, r.views]) ?? []),
    [summary]
  )
  if (!summary) return null

  function newContent() {
    const defaults: InsertRow<"content_items"> = {
      campaign_id: campaign.id,
      pillar_id: campaign.pillar_id,
      persona_id: campaign.persona_id,
      goal_id: campaign.goal_id,
      ...(campaign.platforms[0] ? { platform: campaign.platforms[0] } : {}),
    }
    uiActions.openDialog({ type: "new-content", defaults })
  }

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <ColorDot color={campaign.color} shape="square" className="size-2.5" />
            <span className="min-w-0">{campaign.name || t("untitled_campaign")}</span>
          </span>
        }
        description={`${dateRangeLabel(campaign, lang)} · ${timeLabel(summary.window, lang)}`}
        actions={
          <>
            <CampaignStatusSelect
              value={campaign.status}
              onChange={(status) => setCampaignStatus(campaign, status)}
              className="w-36"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              {c("edit")}
            </Button>
            <CampaignActionsMenu
              campaign={campaign}
              showEdit={false}
              showStatus={false}
              onBeforeDelete={() => {
                onDeleting()
                router.replace("/campaigns")
              }}
            >
              <DropdownMenuItem onSelect={() => setAddOpen(true)}>
                <ListPlus aria-hidden />
                {t("add_existing_menu")}
              </DropdownMenuItem>
            </CampaignActionsMenu>
            <Button type="button" size="sm" onClick={newContent}>
              <Plus aria-hidden />
              {t("new_content")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <CampaignProgressCard summary={summary} />
        <CampaignAboutCard campaign={campaign} onEdit={() => setEditOpen(true)} className="lg:col-span-2" />
      </div>

      <CampaignPerformanceSection perf={summary.perf} />

      <SectionCard
        title={t("timeline_title")}
        description={t("timeline_description")}
        contentClassName="px-0 pb-4"
      >
        <CampaignTimeline campaign={campaign} items={summary.perf.items} now={now} />
      </SectionCard>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <CampaignPieces
          className="xl:col-span-2"
          campaign={campaign}
          items={summary.perf.items}
          tiers={tiers}
          views={views}
          now={now}
          onAddExisting={() => setAddOpen(true)}
          onNewContent={newContent}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <LinkedIdeas campaign={campaign} />
          <CampaignCollabs campaignId={campaign.id} />
        </div>
      </div>

      <CampaignFormDialog open={editOpen} onOpenChange={setEditOpen} campaign={campaign} />
      <AddItemsDialog open={addOpen} onOpenChange={setAddOpen} campaign={campaign} />
    </PageContainer>
  )
}
