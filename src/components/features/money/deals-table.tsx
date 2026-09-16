"use client"

import { useMemo } from "react"
import { DataTable, PlatformIcon, type DataTableColumn } from "@/components/common"
import { DEAL_STATUS_IDS, PLATFORMS } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { dealSourceMessages } from "@/lib/i18n/messages/money"
import { useTable } from "@/lib/store"
import type { BrandDeal, ID } from "@/lib/types"
import { formatMoney } from "@/lib/utils"
import { DealActionsMenu } from "./deal-actions-menu"
import { dealsMessages } from "./deals-messages"
import { dealMoney, isOpenDeal } from "./money-model"
import { DealStatusBadge } from "./money-ui"

export function DealsTable({
  deals,
  openId,
  empty,
  onOpen,
  onEdit,
  onBeforeDelete,
}: {
  deals: BrandDeal[]
  openId: ID | null
  empty: React.ReactNode
  onOpen: (id: ID) => void
  onEdit: (deal: BrandDeal) => void
  onBeforeDelete: (deal: BrandDeal) => void
}) {
  const t = useT(dealsMessages)
  const sourceLabel = useT(dealSourceMessages)
  const income = useTable("income_entries")
  const balances = useMemo(() => new Map(deals.map((d) => [d.id, dealMoney(d, income).balance])), [deals, income])

  const columns = useMemo<DataTableColumn<BrandDeal>[]>(
    () => [
      {
        id: "brand",
        header: t("col_brand"),
        cell: (d) => <span className="block max-w-64 truncate font-medium">{d.brand_name || t("untitled")}</span>,
        sortValue: (d) => d.brand_name.toLowerCase(),
      },
      {
        id: "status",
        header: t("col_status"),
        cell: (d) => <DealStatusBadge status={d.status} />,
        sortValue: (d) => DEAL_STATUS_IDS.indexOf(d.status),
      },
      {
        id: "source",
        header: t("col_source"),
        cell: (d) => <span className="whitespace-nowrap text-muted-foreground">{sourceLabel(d.source)}</span>,
        sortValue: (d) => d.source,
        hideBelow: "lg",
      },
      {
        id: "fee",
        header: t("col_fee"),
        align: "right",
        cell: (d) => <span className="whitespace-nowrap">{d.fee === null ? <span className="text-muted-foreground">{t("no_fee")}</span> : formatMoney(d.fee, d.currency)}</span>,
        sortValue: (d) => d.fee,
      },
      {
        id: "balance",
        header: t("col_balance"),
        align: "right",
        cell: (d) => {
          const balance = balances.get(d.id)
          return <span className="whitespace-nowrap text-muted-foreground">{isOpenDeal(d) && balance ? formatMoney(balance, d.currency) : "—"}</span>
        },
        sortValue: (d) => (isOpenDeal(d) ? (balances.get(d.id) ?? null) : null),
        hideBelow: "md",
      },
      {
        id: "due",
        header: t("col_due"),
        cell: (d) => <span className="whitespace-nowrap num">{d.due_date ? formatShortDate(d.due_date) : "—"}</span>,
        sortValue: (d) => d.due_date,
        hideBelow: "sm",
      },
      {
        id: "platforms",
        header: t("col_platforms"),
        cell: (d) => (
          <span className="flex items-center gap-1 text-muted-foreground">
            {d.platforms.map((p) => (
              <PlatformIcon key={p} platform={p} label={PLATFORMS[p].label} className="size-3.5" />
            ))}
          </span>
        ),
        hideBelow: "md",
      },
      {
        id: "content",
        header: t("col_content"),
        align: "right",
        cell: (d) => d.content_item_ids.length || "—",
        sortValue: (d) => d.content_item_ids.length,
        hideBelow: "lg",
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("edit")}</span>,
        align: "right",
        width: 44,
        cell: (d) => <DealActionsMenu deal={d} onEdit={onEdit} onBeforeDelete={() => onBeforeDelete(d)} />,
      },
    ],
    [t, sourceLabel, balances, onEdit, onBeforeDelete]
  )

  return (
    <DataTable
      rows={deals}
      columns={columns}
      getRowId={(d) => d.id}
      onRowClick={(d) => onOpen(d.id)}
      rowLabel={(d) => t("open_deal", { brand: d.brand_name || t("untitled") })}
      rowClassName={(d) => (d.id === openId ? "bg-muted/50" : undefined)}
      empty={empty}
      aria-label={t("title")}
    />
  )
}
