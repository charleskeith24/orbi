"use client"

import { ArrowUpRight, Blend, Plus } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { PlatformIcon, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { collabForItem } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import type { Collab, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { compareCollabs, partnerLabel } from "./collab-model"
import { CollabStatusBadge, useCollabName } from "./collab-ui"
import { collabLinkMessages } from "./messages"

/** Studio header chip: "Collab with @handle" → the collab this item was made for. */
export function ItemCollabChip({ itemId, className }: { itemId: ID; className?: string }) {
  const t = useT(collabLinkMessages)
  const collabs = useTable("collabs")
  const collab = useMemo(() => collabForItem(collabs, itemId), [collabs, itemId])
  if (!collab) return null
  const partner = partnerLabel(collab)
  return (
    <Link
      href={`/collabs?open=${collab.id}`}
      className={cn(
        "inline-flex h-5 max-w-64 min-w-0 items-center gap-1 rounded-md border bg-card px-1.5 text-xs text-foreground/85 outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30",
        className
      )}
    >
      <Blend className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{partner ? t("studio_chip", { partner }) : t("studio_chip_plain")}</span>
    </Link>
  )
}

function CollabRow({ collab }: { collab: Collab }) {
  const name = useCollabName()
  const partner = partnerLabel(collab)
  const title = name(collab)
  return (
    <li className="flex min-w-0 items-center gap-2 px-4 py-2">
      {collab.partner_platform ? (
        <PlatformIcon platform={collab.partner_platform} label={PLATFORMS[collab.partner_platform].label} className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Blend className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/collabs?open=${collab.id}`} className="line-clamp-1 text-sm underline-offset-2 outline-none hover:underline focus-visible:underline">
          {title}
        </Link>
        {partner && partner !== title ? <p className="truncate text-xs text-muted-foreground">{partner}</p> : null}
      </div>
      {collab.collab_date ? <span className="shrink-0 text-xs text-muted-foreground num max-sm:hidden">{formatShortDate(collab.collab_date)}</span> : null}
      <CollabStatusBadge status={collab.status} />
    </li>
  )
}

/** Campaign detail → its collabs, with "Add collab" pre-linked to the campaign. */
export function CampaignCollabs({ campaignId, className }: { campaignId: ID; className?: string }) {
  const t = useT(collabLinkMessages)
  const collabs = useTable("collabs")
  const linked = useMemo(() => collabs.filter((c) => c.campaign_id === campaignId).sort(compareCollabs), [collabs, campaignId])
  return (
    <SectionCard
      className={className}
      title={t("campaign_title")}
      description={linked.length ? t.plural("campaign_count", linked.length) : t("campaign_empty")}
      action={
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href={`/collabs?new=1&campaign=${campaignId}`}>
            <Plus aria-hidden />
            {t("add_collab")}
          </Link>
        </Button>
      }
      contentClassName={linked.length ? "p-0 pt-2" : undefined}
    >
      {linked.length ? (
        <ul className="divide-y border-t">
          {linked.map((collab) => (
            <CollabRow key={collab.id} collab={collab} />
          ))}
        </ul>
      ) : null}
    </SectionCard>
  )
}

/** Brand deal sheet → the collabs in a group deal, with "Add collab partner" pre-linked to the deal. */
export function DealCollabs({ dealId }: { dealId: ID }) {
  const t = useT(collabLinkMessages)
  const collabs = useTable("collabs")
  const linked = useMemo(() => collabs.filter((c) => c.brand_deal_id === dealId).sort(compareCollabs), [collabs, dealId])
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {linked.length ? (
        <ul className="flex flex-col divide-y rounded-lg border [&>li]:px-3">
          {linked.map((collab) => (
            <CollabRow key={collab.id} collab={collab} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">{t("deal_empty")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/collabs?new=1&deal=${dealId}`}>
            <Plus aria-hidden />
            {t("add_partner")}
          </Link>
        </Button>
        {linked.length ? (
          <Button type="button" variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/collabs">
              Collabs
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
