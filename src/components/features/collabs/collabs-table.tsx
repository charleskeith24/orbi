"use client"

import { AlarmClock } from "lucide-react"
import { useMemo } from "react"
import { DataTable, PlatformIcon, type DataTableColumn } from "@/components/common"
import { collabResults } from "@/lib/analytics"
import { COLLAB_STATUS_IDS, PLATFORMS } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { collabTypeMessages } from "@/lib/i18n/messages/collabs"
import { useTable } from "@/lib/store"
import type { Collab, ID } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { CollabActionsMenu } from "./collab-actions-menu"
import { awaitsFollowUp, isFollowUpDue, partnerLabel } from "./collab-model"
import { CollabStatusBadge, CollabTypeBadge, RatingStars, useCollabName } from "./collab-ui"
import { collabsMessages } from "./messages"

export function CollabsTable({
  collabs,
  now,
  openId,
  empty,
  onOpen,
  onEdit,
  onBeforeDelete,
}: {
  collabs: Collab[]
  now: Date
  openId: ID | null
  empty: React.ReactNode
  onOpen: (id: ID) => void
  onEdit: (collab: Collab) => void
  onBeforeDelete: (collab: Collab) => void
}) {
  const t = useT(collabsMessages)
  const typeLabel = useT(collabTypeMessages)
  const name = useCollabName()
  const items = useTable("content_items")
  const metrics = useTable("content_metrics")
  const followers = useMemo(() => {
    const db = { content_items: items, content_metrics: metrics }
    return new Map(collabs.map((c) => [c.id, collabResults(c, db)]))
  }, [collabs, items, metrics])

  const columns = useMemo<DataTableColumn<Collab>[]>(
    () => [
      {
        id: "collab",
        header: t("col_collab"),
        cell: (c) => (
          <span className="flex max-w-44 min-w-0 flex-col sm:max-w-72">
            <span className="truncate font-medium">{name(c)}</span>
            {partnerLabel(c) ? (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                {c.partner_platform ? <PlatformIcon platform={c.partner_platform} label={PLATFORMS[c.partner_platform].label} className="size-3 shrink-0" /> : null}
                <span className="truncate">{partnerLabel(c)}</span>
              </span>
            ) : null}
          </span>
        ),
        sortValue: (c) => name(c).toLowerCase(),
      },
      {
        id: "status",
        header: t("col_status"),
        cell: (c) => <CollabStatusBadge status={c.status} />,
        sortValue: (c) => COLLAB_STATUS_IDS.indexOf(c.status),
      },
      {
        id: "type",
        header: t("col_type"),
        cell: (c) => <CollabTypeBadge type={c.type} />,
        sortValue: (c) => typeLabel(c.type),
        hideBelow: "md",
      },
      {
        id: "date",
        header: t("col_date"),
        cell: (c) => <span className="whitespace-nowrap num">{c.collab_date ? formatShortDate(c.collab_date) : "—"}</span>,
        sortValue: (c) => c.collab_date,
        hideBelow: "sm",
      },
      {
        id: "follow_up",
        header: t("col_follow_up"),
        cell: (c) => {
          if (!awaitsFollowUp(c.status) || !c.follow_up_on) return <span className="text-muted-foreground">—</span>
          const due = isFollowUpDue(c, now)
          return (
            <span className={cn("inline-flex items-center gap-1 whitespace-nowrap num", due && "font-medium text-critical-fg")}>
              {due ? <AlarmClock className="size-3.5" aria-hidden /> : null}
              {formatShortDate(c.follow_up_on)}
            </span>
          )
        },
        sortValue: (c) => (awaitsFollowUp(c.status) ? c.follow_up_on : null),
        hideBelow: "lg",
      },
      {
        id: "posts",
        header: t("col_posts"),
        align: "right",
        cell: (c) => c.content_item_ids.length || "—",
        sortValue: (c) => c.content_item_ids.length,
        hideBelow: "lg",
      },
      {
        id: "followers",
        header: t("col_followers"),
        align: "right",
        cell: (c) => {
          const r = followers.get(c.id)
          return r?.measured ? <span className="whitespace-nowrap">+{formatNumber(r.followersGained)}</span> : <span className="text-muted-foreground">—</span>
        },
        sortValue: (c) => (followers.get(c.id)?.measured ? followers.get(c.id)!.followersGained : null),
        hideBelow: "md",
      },
      {
        id: "rating",
        header: t("col_rating"),
        cell: (c) => (c.rating !== null ? <RatingStars rating={c.rating} /> : <span className="text-muted-foreground">—</span>),
        sortValue: (c) => c.rating,
        hideBelow: "lg",
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("edit")}</span>,
        align: "right",
        width: 44,
        cell: (c) => <CollabActionsMenu collab={c} onEdit={onEdit} onBeforeDelete={() => onBeforeDelete(c)} />,
      },
    ],
    [t, typeLabel, name, now, followers, onEdit, onBeforeDelete]
  )

  return (
    <DataTable
      rows={collabs}
      columns={columns}
      getRowId={(c) => c.id}
      onRowClick={(c) => onOpen(c.id)}
      rowLabel={(c) => t("open_collab", { title: name(c) })}
      rowClassName={(c) => (c.id === openId ? "bg-muted/50" : undefined)}
      empty={empty}
      aria-label={t("title")}
    />
  )
}
