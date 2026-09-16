"use client"

import { ArrowUpRight, Handshake } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import { OptionSelect, type SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { itemDealMessages } from "./deals-messages"
import { moneyMessages } from "./messages"
import { setItemDeal } from "./money-actions"
import { DealStatusIcon } from "./money-ui"

/**
 * Studio → "Linked": which brand deal a content item was made for. Setting it writes the item id into that
 * deal's `content_item_ids` and removes it from any other deal.
 */
export function ItemDealLink({ item }: { item: ContentItem }) {
  const t = useT(itemDealMessages)
  const m = useT(moneyMessages)
  const id = useId()
  const deals = useTable("brand_deals")
  const current = deals.find((d) => d.content_item_ids.includes(item.id)) ?? null
  const options = useMemo<SelectOption[]>(
    () =>
      [...deals]
        .filter((d) => d.status !== "lost" || d.id === current?.id)
        .sort((a, b) => a.brand_name.localeCompare(b.brand_name))
        .map((d) => ({ value: d.id, label: d.brand_name || m("untitled_deal"), icon: <DealStatusIcon status={d.status} /> })),
    [deals, current, m]
  )

  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
      <label htmlFor={`${id}-deal`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Handshake className="size-3.5 shrink-0" aria-hidden />
        {t("label")}
      </label>
      {deals.length ? (
        <div className="flex min-w-0 items-center gap-1">
          <OptionSelect
            id={`${id}-deal`}
            size="sm"
            options={options}
            value={current?.id ?? null}
            allowNone
            noneLabel={t("remove")}
            placeholder={t("none")}
            onChange={(next) => setItemDeal(item.id, next)}
            className="min-w-0 flex-1"
          />
          {current ? (
            <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
              <Link href={`/money/deals?open=${current.id}`} aria-label={t("open_deal", { brand: current.brand_name || m("untitled_deal") })}>
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("no_deals")}{" "}
          <Link href="/money/deals?new=1" className="font-medium text-foreground/80 underline-offset-2 hover:underline">
            {t("add_deal")}
          </Link>
        </p>
      )}
    </div>
  )
}
