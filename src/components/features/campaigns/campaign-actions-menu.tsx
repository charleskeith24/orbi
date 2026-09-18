"use client"

import { ArrowUpRight, CircleDot, Ellipsis, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CAMPAIGN_STATUSES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { dataActions, useDataStore } from "@/lib/store"
import type { CampaignStatus, ContentCampaign } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { setCampaignStatus } from "./campaign-status"
import { campaignMessages } from "./messages"

/** Row / header overflow menu: open, edit, status, delete (confirmed). */
export function CampaignActionsMenu({
  campaign,
  onEdit,
  onBeforeDelete,
  showOpen = false,
  showEdit = true,
  showStatus = true,
  children,
}: {
  campaign: ContentCampaign
  onEdit?: () => void
  /** Runs after confirmation, right before the row is removed (e.g. navigate away). */
  onBeforeDelete?: () => void
  showOpen?: boolean
  showEdit?: boolean
  showStatus?: boolean
  /** Extra items rendered first. */
  children?: React.ReactNode
}) {
  const t = useT(campaignMessages)
  const [confirm, confirmDialog] = useConfirm()
  const name = campaign.name || t("untitled_campaign")

  async function handleDelete() {
    const db = useDataStore.getState().db
    const pieces = db.content_items.filter((i) => i.campaign_id === campaign.id).length
    const ideas = db.content_ideas.filter((i) => i.campaign_id === campaign.id).length
    const parts = [
      pieces ? t.plural("content_pieces", pieces, { count: formatNumber(pieces) }) : "",
      ideas ? t.plural("ideas", ideas, { count: formatNumber(ideas) }) : "",
    ].filter(Boolean)
    const linked = parts.length === 2 ? t("linked_and", { first: parts[0], second: parts[1] }) : (parts[0] ?? "")
    const ok = await confirm({
      title: t("delete_title", { name }),
      description: linked ? t("delete_linked", { linked }) : t("delete_plain"),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    onBeforeDelete?.()
    dataActions.remove("content_campaigns", campaign.id)
    toast.success(t("deleted"), { description: name })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions_for", { name })}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {children}
          {showOpen ? (
            <DropdownMenuItem asChild>
              <Link href={`/campaigns/${campaign.id}`}>
                <ArrowUpRight aria-hidden />
                {t("open_campaign")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {showEdit && onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden />
              {t("edit_campaign")}
            </DropdownMenuItem>
          ) : null}
          {showStatus ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CircleDot aria-hidden />
                {t("status")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={campaign.status}
                  onValueChange={(value) => setCampaignStatus(campaign, value as CampaignStatus)}
                >
                  {CAMPAIGN_STATUSES.map((status) => (
                    <DropdownMenuRadioItem key={status.id} value={status.id}>
                      {status.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void handleDelete()}>
            <Trash2 aria-hidden />
            {t("delete_campaign_menu")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
