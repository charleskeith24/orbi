"use client"

import { useMemo } from "react"
import { Delta, SectionCard } from "@/components/common"
import { moneyMessages, moneyOverviewMessages } from "@/components/features/money/messages"
import { amountIn, moneySummary, monthChange, normalizeCurrency } from "@/components/features/money/money-model"
import { useNow } from "@/components/features/today/use-now"
import { useT } from "@/lib/i18n"
import { useSettings, useTable } from "@/lib/store"
import { formatMoney } from "@/lib/utils"
import { CardLink } from "./card-link"

/** Home: money received this month (per currency) vs last month, what's expected and booked deals. Hidden until there is income or a deal. */
export function IncomeCard({ className }: { className?: string }) {
  const t = useT(moneyOverviewMessages)
  const m = useT(moneyMessages)
  const now = useNow()
  const primary = normalizeCurrency(useSettings().currency)
  const brand_deals = useTable("brand_deals")
  const income_entries = useTable("income_entries")
  const summary = useMemo(() => moneySummary({ brand_deals, income_entries }, now, primary), [brand_deals, income_entries, now, primary])

  if (!brand_deals.length && !income_entries.length) return null

  const lead = summary.receivedThisMonth[0] ?? { currency: primary, amount: 0 }
  const others = summary.receivedThisMonth.slice(1)
  const previous = amountIn(summary.receivedLastMonth, lead.currency)
  const change = monthChange(lead.amount, previous)
  const expected = summary.expected.map((x) => formatMoney(x.amount, x.currency)).join(" + ")

  return (
    <SectionCard title={t("card_title")} className={className} action={<CardLink href="/money">{t("card_link")}</CardLink>}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-2xl leading-8 font-semibold tracking-tight num">{formatMoney(lead.amount, lead.currency)}</span>
          {others.length ? (
            <span className="text-xs text-muted-foreground num">{m("also", { amounts: others.map((x) => formatMoney(x.amount, x.currency)).join(" + ") })}</span>
          ) : null}
        </div>
        {summary.receivedThisMonth.length ? (
          change !== null ? (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Delta value={change} />
              {t("vs_last_month")}
            </span>
          ) : null
        ) : (
          <p className="text-xs text-muted-foreground">{t("card_nothing")}</p>
        )}
        <p className="flex min-w-0 flex-wrap gap-x-2 text-xs text-muted-foreground">
          {expected ? <span className="num">{t("card_expected", { amount: expected })}</span> : null}
          {summary.bookedCount ? <span>{t.plural("card_deals", summary.bookedCount)}</span> : null}
        </p>
      </div>
    </SectionCard>
  )
}
