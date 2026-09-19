"use client"

import { BadgeCheck, Megaphone, Pencil, Receipt } from "lucide-react"
import Link from "next/link"
import { useId } from "react"
import { ColorDot, DefinitionList, DetailSheet, KeyValue, OptionSelect, PlatformIcon } from "@/components/common"
import { DealCollabs } from "@/components/features/collabs/collab-links"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PLATFORMS } from "@/lib/constants"
import { formatDate, formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { dealSourceMessages } from "@/lib/i18n/messages/money"
import { dataActions, uiActions, useRow, useTable } from "@/lib/store"
import type { BrandDeal } from "@/lib/types"
import { cn, formatMoney } from "@/lib/utils"
import { DealActionsMenu } from "./deal-actions-menu"
import { DealContentSection } from "./deal-content-section"
import { DealDeliverables } from "./deal-deliverables"
import { dealSheetMessages, dealsMessages } from "./deals-messages"
import { moneyMessages } from "./messages"
import { markDealPaid, setDealStatus } from "./money-actions"
import { compareIncome, dealIncome, dealMoney, deliverableProgress, isOpenDeal } from "./money-model"
import { IncomeStatusBadge, useDealStatusOptions } from "./money-ui"

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn("truncate text-sm font-semibold num", muted && "font-normal text-muted-foreground")}>{value}</span>
    </div>
  )
}

/** Deal detail (`/money/deals?open=<id>`): status, money, deliverables, content, contact, terms, media kit. */
export function DealDetailSheet({
  deal,
  open,
  onOpenChange,
  onEdit,
  onBeforeDelete,
}: {
  deal: BrandDeal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (deal: BrandDeal) => void
  onBeforeDelete: () => void
}) {
  const t = useT(dealSheetMessages)
  const d = useT(dealsMessages)
  const m = useT(moneyMessages)
  const sourceLabel = useT(dealSourceMessages)

  return (
    <DetailSheet
      open={open && Boolean(deal)}
      onOpenChange={onOpenChange}
      width="lg"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={deal ? deal.brand_name || d("untitled") : ""}
      description={
        deal ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{sourceLabel(deal.source)}</span>
            {deal.platforms.length ? (
              <span className="flex items-center gap-1">
                {deal.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} label={PLATFORMS[p].label} className="size-3.5" />
                ))}
              </span>
            ) : null}
          </span>
        ) : undefined
      }
      actions={
        deal ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(deal)}>
              <Pencil aria-hidden />
              {t("edit")}
            </Button>
            <DealActionsMenu deal={deal} onEdit={onEdit} onBeforeDelete={onBeforeDelete} />
          </>
        ) : null
      }
      footer={
        deal ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => uiActions.openDialog({ type: "log-income", dealId: deal.id })}>
              <Receipt aria-hidden />
              {t("log_payment")}
            </Button>
            {isOpenDeal(deal) ? (
              <Button type="button" size="sm" onClick={() => markDealPaid(deal.id)}>
                <BadgeCheck aria-hidden />
                {t("mark_paid")}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {deal ? <DealBody deal={deal} key={deal.id} /> : <p className="text-sm text-muted-foreground">{m("untitled_deal")}</p>}
    </DetailSheet>
  )
}

function DealBody({ deal }: { deal: BrandDeal }) {
  const t = useT(dealSheetMessages)
  const m = useT(moneyMessages)
  const id = useId()
  const income = useTable("income_entries")
  const campaign = useRow("content_campaigns", deal.campaign_id)
  const statusOptions = useDealStatusOptions()
  const money = dealMoney(deal, income)
  const entries = dealIncome(deal, income).sort(compareIncome)
  const progress = deliverableProgress(deal.deliverables)
  const fmt = (amount: number) => formatMoney(amount, money.currency)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
        <OptionSelect
          options={statusOptions}
          value={deal.status}
          size="sm"
          aria-label={t("status")}
          onChange={(next) => next && setDealStatus(deal, next)}
        />
        {isOpenDeal(deal) && money.balance ? (
          <p className="text-xs text-muted-foreground">{t("mark_paid_help", { amount: fmt(money.balance) })}</p>
        ) : null}
      </div>

      <Section title={t("money")}>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label={t("fee")} value={deal.fee === null ? "—" : fmt(deal.fee)} muted={deal.fee === null} />
          <Figure label={t("received")} value={fmt(money.received)} />
          <Figure label={t("expected")} value={fmt(money.expected)} />
          <Figure label={t("unpaid")} value={money.balance === null ? "—" : fmt(money.balance)} muted={money.balance === null} />
        </div>
        {isOpenDeal(deal) && money.unlogged ? <p className="text-xs text-muted-foreground">{t("not_logged", { amount: fmt(money.unlogged) })}</p> : null}
        {money.otherCurrencyEntries ? (
          <p className="text-xs text-muted-foreground">{t.plural("other_currency", money.otherCurrencyEntries, { currency: money.currency })}</p>
        ) : null}
        {entries.length ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/money/income?open=${entry.id}`}
                  className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <span className="w-14 shrink-0 text-xs text-muted-foreground num">{formatShortDate(entry.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.description || m("untitled_entry")}</span>
                  <IncomeStatusBadge status={entry.status} className="max-sm:hidden" />
                  <span className="shrink-0 font-medium num">{formatMoney(entry.amount, entry.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("income_empty")}</p>
        )}
      </Section>

      <Section
        title={t("deliverables")}
        action={progress.total ? <span className="text-xs text-muted-foreground num">{`${progress.done}/${progress.total}`}</span> : undefined}
      >
        <DealDeliverables deal={deal} />
      </Section>

      <Section title={t("linked_content")}>
        <DealContentSection deal={deal} />
      </Section>

      <Section title={t("collabs")}>
        <DealCollabs dealId={deal.id} />
      </Section>

      <Section title={t("contact")}>
        {deal.contact_name || deal.contact_email || deal.contact_handle ? (
          <div className="flex min-w-0 flex-col gap-0.5 text-sm">
            {deal.contact_name ? <span className="font-medium">{deal.contact_name}</span> : null}
            {deal.contact_email ? (
              <a href={`mailto:${deal.contact_email}`} className="w-fit truncate underline-offset-2 hover:underline">
                {deal.contact_email}
              </a>
            ) : null}
            {deal.contact_handle ? <span className="text-muted-foreground">{deal.contact_handle}</span> : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("no_contact")}</p>
        )}
      </Section>

      <Section title={t("dates")}>
        <DefinitionList>
          <KeyValue label={t("start_date")}>{deal.start_date ? formatDate(deal.start_date) : null}</KeyValue>
          <KeyValue label={t("due_date")}>{deal.due_date ? formatDate(deal.due_date) : null}</KeyValue>
          <KeyValue label={t("paid_at")}>{deal.paid_at ? formatDate(deal.paid_at) : null}</KeyValue>
          {campaign ? (
            <KeyValue label={t("campaign")}>
              <Link href={`/campaigns/${campaign.id}`} className="inline-flex min-w-0 items-center gap-1.5 underline-offset-2 hover:underline">
                <Megaphone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <ColorDot color={campaign.color} shape="square" />
                <span className="truncate">{campaign.name}</span>
              </Link>
            </KeyValue>
          ) : null}
        </DefinitionList>
      </Section>

      {deal.usage_rights ? (
        <Section title={t("usage_rights")}>
          <p className="text-sm text-pretty whitespace-pre-line">{deal.usage_rights}</p>
        </Section>
      ) : null}

      {deal.notes ? (
        <Section title={t("notes")}>
          <p className="text-sm text-pretty whitespace-pre-line">{deal.notes}</p>
        </Section>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div className="min-w-0">
          <Label htmlFor={`${id}-kit`} className="text-sm">
            {t("show_in_media_kit")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("show_in_media_kit_help")}</p>
        </div>
        <Switch
          id={`${id}-kit`}
          checked={deal.show_in_media_kit}
          onCheckedChange={(next) => dataActions.update("brand_deals", deal.id, { show_in_media_kit: next })}
        />
      </div>
    </div>
  )
}
