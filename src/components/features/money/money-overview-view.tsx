"use client"

import { AlarmClock, CalendarClock, Handshake, Hourglass, MessagesSquare, Plus, Receipt, Wallet } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { EmptyState, OptionSelect, PageContainer, PageHeader, PlatformIcon, SectionCard, StatTile } from "@/components/common"
import { ChartFrame } from "@/components/charts"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { INCOME_SOURCE_IDS } from "@/lib/constants"
import { formatDate, formatShortDate, toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { incomeSourceMessages } from "@/lib/i18n/messages/money"
import { uiActions, useDb, useSettings } from "@/lib/store"
import type { BrandDeal } from "@/lib/types"
import { cn, formatMoney } from "@/lib/utils"
import { DealFormDialog } from "./deal-form-dialog"
import { IncomeSourceChart } from "./income-source-chart"
import { moneyMessages, moneyOverviewMessages } from "./messages"
import {
  amountIn,
  chartCurrency,
  dealsDueSoon,
  incomeBySourceMonthly,
  moneySummary,
  monthChange,
  normalizeCurrency,
  topEarningContent,
} from "./money-model"
import { DealStatusBadge, MoneyTotals, useSplitTotals } from "./money-ui"

const LIST_LIMIT = 5

/** `/money` — this month vs last, what's expected, income by source, top-earning content, deals due and money coming in. */
export function MoneyOverviewView() {
  const t = useT(moneyOverviewMessages)
  const m = useT(moneyMessages)
  const sourceLabel = useT(incomeSourceMessages)
  const router = useRouter()
  const now = useNow()
  const db = useDb()
  const primary = normalizeCurrency(useSettings().currency)
  const [dealForm, setDealForm] = useState(false)
  const [pickedCurrency, setPickedCurrency] = useState<string | null>(null)

  const summary = useMemo(() => moneySummary(db, now, primary), [db, now, primary])
  const chartCurrencies = useMemo(() => {
    const codes = new Set(db.income_entries.filter((e) => e.status === "received").map((e) => normalizeCurrency(e.currency)))
    return [...codes].sort((a, b) => Number(b === primary) - Number(a === primary) || a.localeCompare(b))
  }, [db.income_entries, primary])
  const currency = pickedCurrency && chartCurrencies.includes(pickedCurrency) ? pickedCurrency : chartCurrency(db.income_entries, now, primary)
  const monthly = useMemo(() => incomeBySourceMonthly(db.income_entries, now, currency), [db.income_entries, now, currency])
  const top = useMemo(() => topEarningContent(db, primary, LIST_LIMIT), [db, primary])
  const due = useMemo(() => dealsDueSoon(db.brand_deals, now).slice(0, LIST_LIMIT), [db.brand_deals, now])
  const coming = useMemo(
    () =>
      db.income_entries
        .filter((e) => e.status === "expected")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, LIST_LIMIT),
    [db.income_entries]
  )
  const items = useMemo(() => new Map(db.content_items.map((i) => [i.id, i])), [db.content_items])

  const thisMonth = useSplitTotals(summary.receivedThisMonth, primary)
  const expected = useSplitTotals(summary.expected, primary)
  const inTalks = useSplitTotals(summary.inTalks, primary)
  const leadCurrency = thisMonth.lead.currency
  const current = amountIn(summary.receivedThisMonth, leadCurrency)
  const previous = amountIn(summary.receivedLastMonth, leadCurrency)
  const change = monthChange(current, previous)
  const today = toISODate(now)
  const empty = !db.brand_deals.length && !db.income_entries.length

  const actions = (
    <>
      <Button size="sm" variant="outline" onClick={() => setDealForm(true)}>
        <Handshake aria-hidden />
        {t("add_deal")}
      </Button>
      <Button size="sm" onClick={() => uiActions.openDialog({ type: "log-income" })}>
        <Plus aria-hidden />
        {t("log_income")}
      </Button>
    </>
  )

  const table = {
    columns: [t("col_month"), ...INCOME_SOURCE_IDS.filter((s) => monthly.some((r) => r.bySource[s] > 0)).map((s) => sourceLabel(s)), t("total")],
    rows: monthly.map((r) => [
      formatDate(r.start, "MMM yyyy"),
      ...INCOME_SOURCE_IDS.filter((s) => monthly.some((row) => row.bySource[s] > 0)).map((s) => formatMoney(r.bySource[s], currency)),
      formatMoney(r.total, currency),
    ]),
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} icon={Wallet} description={t("description")} actions={actions} />
      {empty ? (
        <EmptyState
          icon={Wallet}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button onClick={() => uiActions.openDialog({ type: "log-income" })}>
              <Plus aria-hidden />
              {t("log_income")}
            </Button>
          }
          secondaryAction={
            <Button variant="outline" onClick={() => setDealForm(true)}>
              <Handshake aria-hidden />
              {t("add_deal")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={t("received_month")}
              value={thisMonth.value}
              icon={Receipt}
              href="/money/income"
              delta={change}
              deltaLabel={change !== null ? t("vs_last_month") : undefined}
              sublabel={
                thisMonth.others ??
                (previous > 0 ? t("last_month", { amount: formatMoney(previous, leadCurrency) }) : t("nothing_last_month"))
              }
            />
            <StatTile
              label={t("expected")}
              value={expected.value}
              icon={Hourglass}
              href="/money/income"
              sublabel={expected.others ?? (summary.expected.length ? t("expected_sub") : t("expected_none"))}
            />
            <StatTile
              label={t("booked")}
              value={String(summary.bookedCount)}
              icon={Handshake}
              href="/money/deals"
              sublabel={summary.awaitingPaymentCount ? t.plural("booked_sub", summary.awaitingPaymentCount) : t("booked_none")}
            />
            <StatTile
              label={t("in_talks")}
              value={summary.inTalks.length ? inTalks.value : String(summary.inTalksCount)}
              icon={MessagesSquare}
              href="/money/deals"
              sublabel={inTalks.others ?? t.plural("in_talks_sub", summary.inTalksCount)}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartFrame
              title={t("chart_title")}
              description={t("chart_description", { currency })}
              className="lg:col-span-2"
              table={table}
              actions={
                chartCurrencies.length > 1 ? (
                  <OptionSelect
                    options={chartCurrencies.map((c) => ({ value: c, label: c }))}
                    value={currency}
                    size="sm"
                    aria-label={m("currency")}
                    className="h-7 w-24"
                    onChange={(next) => next && setPickedCurrency(next)}
                  />
                ) : null
              }
            >
              {monthly.some((r) => r.total > 0) ? (
                <IncomeSourceChart rows={monthly} currency={currency} />
              ) : (
                <p className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">{t("chart_empty")}</p>
              )}
            </ChartFrame>

            <SectionCard
              title={t("due_title")}
              description={t("due_description")}
              icon={CalendarClock}
              contentClassName={due.length ? "p-0 pt-2" : undefined}
              action={
                <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
                  <Link href="/money/deals">{m("view_all")}</Link>
                </Button>
              }
            >
              {due.length ? (
                <ul className="divide-y">
                  {due.map(({ deal, daysLeft }) => (
                    <li key={deal.id}>
                      <DueRow deal={deal} daysLeft={daysLeft} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("due_empty")}</p>
              )}
            </SectionCard>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard
              title={t("top_title")}
              description={t("top_description")}
              className="lg:col-span-2"
              contentClassName={top.length ? "p-0 pt-2" : undefined}
            >
              {top.length ? (
                <ol className="divide-y">
                  {top.map((row, index) => {
                    const item = items.get(row.itemId)
                    if (!item) return null
                    return (
                      <li key={row.itemId}>
                        <Link
                          href={`/studio/${item.id}`}
                          className="flex min-w-0 items-center gap-3 px-4 py-2.5 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                        >
                          <span className="w-4 shrink-0 text-xs text-muted-foreground num">{index + 1}</span>
                          <PlatformIcon platform={item.platform} className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{item.title.trim() || m("untitled_content")}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[row.direct.length ? t("top_direct") : null, row.dealIds.length ? t.plural("top_via_deal", row.dealIds.length) : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <MoneyTotals totals={row.totals} className="shrink-0 text-right font-medium" />
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t("top_empty")}</p>
              )}
            </SectionCard>

            <SectionCard
              title={t("coming_title")}
              description={t("coming_description")}
              icon={Hourglass}
              contentClassName={coming.length ? "p-0 pt-2" : undefined}
              action={
                <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
                  <Link href="/money/income">{m("view_all")}</Link>
                </Button>
              }
            >
              {coming.length ? (
                <ul className="divide-y">
                  {coming.map((entry) => {
                    const late = entry.date < today
                    return (
                      <li key={entry.id}>
                        <Link
                          href={`/money/income?open=${entry.id}`}
                          className="flex w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate">{entry.description || sourceLabel(entry.source)}</span>
                            <span className={cn("inline-flex items-center gap-1 text-xs num", late ? "text-warning-fg" : "text-muted-foreground")}>
                              {late ? <AlarmClock className="size-3" aria-hidden /> : null}
                              {formatShortDate(entry.date)}
                              {late ? ` · ${t("coming_overdue")}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium num">{formatMoney(entry.amount, entry.currency)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("coming_empty")}</p>
              )}
            </SectionCard>
          </div>
        </>
      )}

      <DealFormDialog
        open={dealForm}
        onOpenChange={setDealForm}
        onSaved={(row) => router.push(`/money/deals?open=${row.id}`)}
      />
    </PageContainer>
  )
}

function DueRow({ deal, daysLeft }: { deal: BrandDeal; daysLeft: number }) {
  const t = useT(moneyOverviewMessages)
  const m = useT(moneyMessages)
  const label = daysLeft < 0 ? t.plural("overdue", -daysLeft) : daysLeft === 0 ? t("due_today") : t.plural("due_in", daysLeft)
  return (
    <Link
      href={`/money/deals?open=${deal.id}`}
      className="flex min-w-0 items-center gap-3 px-4 py-2.5 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{deal.brand_name || m("untitled_deal")}</span>
        <span className={cn("inline-flex items-center gap-1 text-xs", daysLeft < 0 ? "font-medium text-critical-fg" : "text-muted-foreground")}>
          {daysLeft < 0 ? <AlarmClock className="size-3" aria-hidden /> : null}
          {label}
        </span>
      </span>
      <DealStatusBadge status={deal.status} className="max-sm:hidden" />
    </Link>
  )
}
