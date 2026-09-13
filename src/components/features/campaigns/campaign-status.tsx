"use client"

import { CircleCheck, CircleDashed, CirclePause, CirclePlay, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { OptionSelect, StatusPill, type ControlSize, type SelectOption, type StatusTone } from "@/components/common"
import { CAMPAIGN_STATUS_MAP, CAMPAIGN_STATUSES } from "@/lib/constants"
import { dataActions } from "@/lib/store"
import type { CampaignStatus, ContentCampaign } from "@/lib/types"

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { tone: StatusTone; icon: LucideIcon }> = {
  planning: { tone: "neutral", icon: CircleDashed },
  active: { tone: "good", icon: CirclePlay },
  paused: { tone: "warning", icon: CirclePause },
  completed: { tone: "neutral", icon: CircleCheck },
}

export function CampaignStatusPill({ status, className }: { status: CampaignStatus; className?: string }) {
  const meta = CAMPAIGN_STATUS_META[status]
  return (
    <StatusPill tone={meta.tone} icon={meta.icon} className={className}>
      {CAMPAIGN_STATUS_MAP[status]?.label ?? status}
    </StatusPill>
  )
}

const STATUS_OPTIONS: SelectOption<CampaignStatus>[] = CAMPAIGN_STATUSES.map((status) => {
  const Icon = CAMPAIGN_STATUS_META[status.id].icon
  return { value: status.id, label: status.label, icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden /> }
})

export function CampaignStatusSelect({
  value,
  onChange,
  size = "sm",
  id,
  className,
}: {
  value: CampaignStatus
  onChange: (status: CampaignStatus) => void
  size?: ControlSize
  id?: string
  className?: string
}) {
  return (
    <OptionSelect
      id={id}
      options={STATUS_OPTIONS}
      value={value}
      onChange={(next) => {
        if (next) onChange(next)
      }}
      size={size}
      className={className}
      aria-label="Campaign status"
    />
  )
}

/** Persist a status change with feedback. */
export function setCampaignStatus(campaign: ContentCampaign, status: CampaignStatus) {
  if (campaign.status === status) return
  dataActions.update("content_campaigns", campaign.id, { status })
  toast.success(`Campaign marked ${CAMPAIGN_STATUS_MAP[status]?.label.toLowerCase() ?? status}`, {
    description: campaign.name || undefined,
  })
}
