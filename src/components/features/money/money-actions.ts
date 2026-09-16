/**
 * Money writes that touch more than one row (mark paid, status moves, content links). Views call these
 * so the board, table, sheet and Studio behave the same.
 */
import { toast } from "sonner"
import { translate } from "@/lib/i18n/core"
import { dealStatusMessages } from "@/lib/i18n/messages/money"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { toISODate } from "@/lib/dates"
import { createContentItem, dataActions, uiActions, useDataStore } from "@/lib/store"
import type { BrandDeal, ContentItem, DealStatus, ID, IncomeEntry, PlatformId } from "@/lib/types"
import { formatMoney } from "@/lib/utils"
import { dealsMessages, itemDealMessages } from "./deals-messages"
import { dealLinkUpdates, planMarkPaid, statusPatch } from "./money-model"

const db = () => useDataStore.getState().db
const t = (key: keyof (typeof dealsMessages)["en"], vars?: Record<string, string | number>) =>
  translate(dealsMessages, getUiLang(), key, vars)

/** Status → paid records the unpaid balance as received income (see `planMarkPaid`). */
export function markDealPaid(dealId: ID, now: Date = new Date()) {
  const deal = db().brand_deals.find((d) => d.id === dealId)
  if (!deal) return
  const brand = deal.brand_name || t("untitled")
  const plan = planMarkPaid(deal, db().income_entries, toISODate(now), (kind) =>
    t(kind === "balance" ? "balance_description" : "payment_description", { brand })
  )
  dataActions.update("brand_deals", deal.id, plan.dealPatch)
  if (plan.receive.length) dataActions.updateMany("income_entries", plan.receive)
  if (plan.create) dataActions.insert("income_entries", plan.create)

  if (deal.fee === null) {
    toast.success(t("marked_paid"), {
      description: t("no_fee_logged"),
      action: { label: t("log_payment"), onClick: () => uiActions.openDialog({ type: "log-income", dealId: deal.id }) },
    })
  } else {
    toast.success(t("marked_paid"), {
      description: plan.recorded > 0 ? t("recorded", { amount: formatMoney(plan.recorded, plan.currency) }) : t("nothing_to_record"),
    })
  }
}

/** Board drops, table and sheet status changes. */
export function setDealStatus(deal: BrandDeal, status: DealStatus, options: { announce?: boolean } = {}) {
  if (deal.status === status) return
  if (status === "paid") {
    markDealPaid(deal.id)
    return
  }
  dataActions.update("brand_deals", deal.id, statusPatch(deal, status))
  if (options.announce) toast.success(t("moved", { status: translate(dealStatusMessages, getUiLang(), status) }))
}

/** Puts a content item on one deal (or none), removing it from any other deal. */
export function setItemDeal(itemId: ID, dealId: ID | null, options: { silent?: boolean } = {}) {
  const deals = db().brand_deals
  const updates = dealLinkUpdates(deals, itemId, dealId)
  if (!updates.length) return
  dataActions.updateMany("brand_deals", updates)
  if (options.silent) return
  const lang = getUiLang()
  const to = dealId ? deals.find((d) => d.id === dealId) : undefined
  const from = deals.find((d) => d.id !== dealId && d.content_item_ids.includes(itemId))
  if (to) toast.success(translate(itemDealMessages, lang, "linked", { brand: to.brand_name || t("untitled") }))
  else if (from) toast.success(translate(itemDealMessages, lang, "removed", { brand: from.brand_name || t("untitled") }))
}

/** New content made for a deal: a brief-stage item on the deal's campaign and due date, linked to the deal. */
export function createContentForDeal(deal: BrandDeal, values: { title: string; platform: PlatformId }): ContentItem {
  const item = createContentItem({
    title: values.title.trim(),
    platform: values.platform,
    stage: "brief",
    campaign_id: deal.campaign_id,
    due_date: deal.due_date,
  })
  setItemDeal(item.id, deal.id, { silent: true })
  return item
}

export function deleteDeal(deal: BrandDeal) {
  dataActions.remove("brand_deals", deal.id)
  toast.success(t("deleted"), { description: deal.brand_name || t("untitled") })
}

export function markIncomeReceived(entry: IncomeEntry, now: Date = new Date()) {
  const today = toISODate(now)
  dataActions.update("income_entries", entry.id, { status: "received", date: entry.date > today ? today : entry.date })
}
