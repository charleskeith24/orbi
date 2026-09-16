"use client"

import { CircleCheck, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { DefinitionList, DetailSheet, KeyValue, PlatformLabel, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { incomeSourceMessages } from "@/lib/i18n/messages/money"
import { dataActions, useRow } from "@/lib/store"
import type { IncomeEntry } from "@/lib/types"
import { formatMoney } from "@/lib/utils"
import { toast } from "sonner"
import { incomeMessages, moneyMessages } from "./messages"
import { markIncomeReceived } from "./money-actions"
import { IncomeStatusBadge } from "./money-ui"

/** Income entry detail (`/money/income?open=<id>`) with edit, mark received and delete. */
export function IncomeDetailSheet({
  entry,
  open,
  onOpenChange,
  onEdit,
  onBeforeDelete,
}: {
  entry: IncomeEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (entry: IncomeEntry) => void
  onBeforeDelete: () => void
}) {
  const t = useT(incomeMessages)
  const m = useT(moneyMessages)
  const c = useT(commonMessages)
  const sourceLabel = useT(incomeSourceMessages)
  const [confirm, confirmDialog] = useConfirm()
  const deal = useRow("brand_deals", entry?.brand_deal_id)
  const item = useRow("content_items", entry?.content_item_id)

  async function remove(target: IncomeEntry) {
    const name = target.description || m("untitled_entry")
    const ok = await confirm({
      title: t("delete_title"),
      description: t("delete_description", { amount: formatMoney(target.amount, target.currency), name }),
      confirmLabel: t("delete"),
      cancelLabel: c("cancel"),
    })
    if (!ok) return
    onBeforeDelete()
    dataActions.remove("income_entries", target.id)
    toast.success(t("deleted"), { description: name })
  }

  return (
    <>
      <DetailSheet
        open={open && Boolean(entry)}
        onOpenChange={onOpenChange}
        width="md"
        onOpenAutoFocus={(event) => event.preventDefault()}
        title={entry ? entry.description || m("untitled_entry") : ""}
        description={entry ? `${formatDate(entry.date)} · ${sourceLabel(entry.source)}` : undefined}
        actions={
          entry ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(entry)}>
              <Pencil aria-hidden />
              {t("edit")}
            </Button>
          ) : null
        }
        footer={
          entry ? (
            <>
              <Button type="button" variant="ghost" size="sm" className="mr-auto text-destructive" onClick={() => void remove(entry)}>
                <Trash2 aria-hidden />
                {t("delete")}
              </Button>
              {entry.status === "expected" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    markIncomeReceived(entry)
                    toast.success(t("marked_received"), { description: formatMoney(entry.amount, entry.currency) })
                  }}
                >
                  <CircleCheck aria-hidden />
                  {t("mark_received")}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {entry ? (
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight num">{formatMoney(entry.amount, entry.currency)}</p>
              <IncomeStatusBadge status={entry.status} />
            </div>
            <DefinitionList>
              <KeyValue label={t("date")}>{formatDate(entry.date)}</KeyValue>
              <KeyValue label={t("source")}>{sourceLabel(entry.source)}</KeyValue>
              {entry.affiliate_program ? <KeyValue label={t("program")}>{entry.affiliate_program}</KeyValue> : null}
              <KeyValue label={t("platform")}>{entry.platform ? <PlatformLabel platform={entry.platform} /> : null}</KeyValue>
              <KeyValue label={t("deal")}>
                {deal ? (
                  <Link href={`/money/deals?open=${deal.id}`} className="underline-offset-2 hover:underline">
                    {deal.brand_name || m("untitled_deal")}
                  </Link>
                ) : null}
              </KeyValue>
              <KeyValue label={t("content")}>
                {item ? (
                  <Link href={`/studio/${item.id}`} className="underline-offset-2 hover:underline">
                    {item.title.trim() || m("untitled_content")}
                  </Link>
                ) : null}
              </KeyValue>
            </DefinitionList>
            <p className="text-xs text-muted-foreground">{t("logged_on", { date: formatDate(entry.created_at) })}</p>
          </div>
        ) : null}
      </DetailSheet>
      {confirmDialog}
    </>
  )
}
