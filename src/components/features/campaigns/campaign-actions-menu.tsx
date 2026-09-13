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
import { dataActions, useDataStore } from "@/lib/store"
import type { CampaignStatus, ContentCampaign } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { setCampaignStatus } from "./campaign-status"

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
  const [confirm, confirmDialog] = useConfirm()
  const name = campaign.name || "Untitled campaign"

  async function handleDelete() {
    const db = useDataStore.getState().db
    const pieces = db.content_items.filter((i) => i.campaign_id === campaign.id).length
    const ideas = db.content_ideas.filter((i) => i.campaign_id === campaign.id).length
    const linked = [pieces ? pluralize(pieces, "content piece") : "", ideas ? pluralize(ideas, "idea") : ""].filter(Boolean).join(" and ")
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: linked
        ? `The campaign is removed. Its ${linked} stay in your workspace, no longer linked to a campaign.`
        : "The campaign is removed. This can’t be undone.",
      confirmLabel: "Delete campaign",
    })
    if (!ok) return
    onBeforeDelete?.()
    dataActions.remove("content_campaigns", campaign.id)
    toast.success("Campaign deleted", { description: name })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {children}
          {showOpen ? (
            <DropdownMenuItem asChild>
              <Link href={`/campaigns/${campaign.id}`}>
                <ArrowUpRight aria-hidden />
                Open campaign
              </Link>
            </DropdownMenuItem>
          ) : null}
          {showEdit && onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden />
              Edit campaign…
            </DropdownMenuItem>
          ) : null}
          {showStatus ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CircleDot aria-hidden />
                Status
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
            Delete campaign…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
