/**
 * Money model — pure functions over brand deals and income entries (no React, no store). Amounts are
 * always totalled per currency: ₱ and $ are never added together. Callers pass `now` / `today`.
 */
import { addDays, addMonths, startOfMonth } from "date-fns"
import { INCOME_SOURCE_IDS } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import { toCsv } from "@/lib/integrations/csv"
import type {
  BrandDeal,
  Database,
  DealStatus,
  ID,
  IncomeEntry,
  IncomeSource,
  IncomeStatus,
  InsertRow,
  ISODate,
  PlatformId,
  UpdateRow,
} from "@/lib/types"
import { matchesQuery } from "@/lib/utils"

/* -------------------------------- Currency -------------------------------- */

export interface CurrencyTotal {
  currency: string
  amount: number
}

/** "php " → "PHP"; empty → "PHP". */
export function normalizeCurrency(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase() || "PHP"
}

/** Rounds to centavos so sums of fractional amounts don't drift. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Largest first, but the primary currency always leads. */
function orderTotals(totals: CurrencyTotal[], primary?: string): CurrencyTotal[] {
  const p = primary ? normalizeCurrency(primary) : null
  return totals.sort(
    (a, b) =>
      Number(b.currency === p) - Number(a.currency === p) || b.amount - a.amount || a.currency.localeCompare(b.currency)
  )
}

/** Sums rows per currency (never across currencies). Rows without an amount are skipped. */
export function totalsByCurrency<T>(
  rows: readonly T[],
  amountOf: (row: T) => number | null | undefined,
  currencyOf: (row: T) => string,
  primary?: string
): CurrencyTotal[] {
  const sums = new Map<string, number>()
  for (const row of rows) {
    const amount = amountOf(row)
    if (amount === null || amount === undefined || !Number.isFinite(amount)) continue
    const code = normalizeCurrency(currencyOf(row))
    sums.set(code, (sums.get(code) ?? 0) + amount)
  }
  return orderTotals(
    [...sums].map(([currency, amount]) => ({ currency, amount: roundMoney(amount) })),
    primary
  )
}

export function entryTotals(entries: readonly IncomeEntry[], primary?: string): CurrencyTotal[] {
  return totalsByCurrency(entries, (e) => e.amount, (e) => e.currency, primary)
}

/** Adds several total lists together, still per currency. */
export function mergeTotals(lists: CurrencyTotal[][], primary?: string): CurrencyTotal[] {
  return totalsByCurrency(lists.flat(), (t) => t.amount, (t) => t.currency, primary)
}

/** The amount in one currency (0 when there is none). */
export function amountIn(totals: readonly CurrencyTotal[], currency: string): number {
  const code = normalizeCurrency(currency)
  return totals.find((t) => t.currency === code)?.amount ?? 0
}

/** Every currency used by deals and income, the primary one first. */
export function currenciesInUse(db: Pick<Database, "brand_deals" | "income_entries">, primary: string): string[] {
  const codes = new Set<string>([normalizeCurrency(primary)])
  for (const e of db.income_entries) codes.add(normalizeCurrency(e.currency))
  for (const d of db.brand_deals) if (d.fee !== null) codes.add(normalizeCurrency(d.currency))
  const p = normalizeCurrency(primary)
  return [...codes].sort((a, b) => Number(b === p) - Number(a === p) || a.localeCompare(b))
}

/* ---------------------------------- Deals --------------------------------- */

/** Talking, not agreed yet. */
export const TALKS_DEAL_STATUSES: readonly DealStatus[] = ["lead", "pitched", "negotiating"]
/** Work is agreed: the unpaid fee is money you can expect. */
export const BOOKED_DEAL_STATUSES: readonly DealStatus[] = ["contracted", "in_progress", "delivered"]
/** Real collaborations — the only deals the media kit may list. */
export const COLLAB_DEAL_STATUSES: readonly DealStatus[] = ["contracted", "in_progress", "delivered", "paid"]

export const isBookedDeal = (deal: Pick<BrandDeal, "status">) => BOOKED_DEAL_STATUSES.includes(deal.status)
export const isOpenDeal = (deal: Pick<BrandDeal, "status">) => deal.status !== "paid" && deal.status !== "lost"

export interface DealMoney {
  currency: string
  fee: number | null
  /** Received income linked to the deal, in the deal's currency. */
  received: number
  /** Expected income linked to the deal, in the deal's currency. */
  expected: number
  /** Fee minus received (never below 0); null without a fee. */
  balance: number | null
  /** Balance not logged as expected income yet (never below 0); null without a fee. */
  unlogged: number | null
  /** Linked entries in another currency — not counted against the fee. */
  otherCurrencyEntries: number
}

export function dealIncome(deal: Pick<BrandDeal, "id">, income: readonly IncomeEntry[]): IncomeEntry[] {
  return income.filter((e) => e.brand_deal_id === deal.id)
}

export function dealMoney(deal: BrandDeal, income: readonly IncomeEntry[]): DealMoney {
  const currency = normalizeCurrency(deal.currency)
  let received = 0
  let expected = 0
  let otherCurrencyEntries = 0
  for (const e of dealIncome(deal, income)) {
    if (normalizeCurrency(e.currency) !== currency) {
      otherCurrencyEntries++
      continue
    }
    if (e.status === "received") received += e.amount
    else expected += e.amount
  }
  received = roundMoney(received)
  expected = roundMoney(expected)
  const balance = deal.fee === null ? null : roundMoney(Math.max(0, deal.fee - received))
  const unlogged = balance === null ? null : roundMoney(Math.max(0, balance - expected))
  return { currency, fee: deal.fee, received, expected, balance, unlogged, otherCurrencyEntries }
}

export interface MarkPaidPlan {
  dealPatch: UpdateRow<"brand_deals">
  /** Expected entries linked to the deal that are now received (dated today). */
  receive: { id: ID; patch: UpdateRow<"income_entries"> }[]
  /** A new received entry for the part of the balance that wasn't logged yet. */
  create: InsertRow<"income_entries"> | null
  /** The unpaid balance recorded as received by this plan (deal currency). */
  recorded: number
  currency: string
}

/**
 * "Mark paid": records only the unpaid balance (fee minus income already received for the deal). Expected
 * entries logged for the deal are marked received first (oldest first, while they fit the balance); whatever
 * is left becomes one new `brand_deal` entry. A deal without a fee is only marked paid.
 */
export function planMarkPaid(
  deal: BrandDeal,
  income: readonly IncomeEntry[],
  today: ISODate,
  describe: (kind: "payment" | "balance") => string
): MarkPaidPlan {
  const money = dealMoney(deal, income)
  const dealPatch: UpdateRow<"brand_deals"> = { status: "paid", paid_at: deal.paid_at ?? today }
  if (money.balance === null || money.balance <= 0) {
    return { dealPatch, receive: [], create: null, recorded: 0, currency: money.currency }
  }
  const pending = dealIncome(deal, income)
    .filter((e) => e.status === "expected" && normalizeCurrency(e.currency) === money.currency && e.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  const receive: MarkPaidPlan["receive"] = []
  let covered = 0
  for (const entry of pending) {
    if (covered + entry.amount > money.balance + 0.005) continue
    covered = roundMoney(covered + entry.amount)
    receive.push({ id: entry.id, patch: { status: "received", date: today } })
  }
  const remainder = roundMoney(money.balance - covered)
  const create: InsertRow<"income_entries"> | null =
    remainder > 0
      ? {
          date: today,
          amount: remainder,
          currency: money.currency,
          source: "brand_deal",
          status: "received",
          brand_deal_id: deal.id,
          platform: deal.platforms.length === 1 ? deal.platforms[0] : null,
          description: describe(money.received > 0 || covered > 0 ? "balance" : "payment"),
        }
      : null
  return { dealPatch, receive, create, recorded: money.balance, currency: money.currency }
}

/** Status change from the board, table or sheet. Paid goes through `planMarkPaid`; leaving Paid clears `paid_at`. */
export function statusPatch(deal: BrandDeal, status: DealStatus): UpdateRow<"brand_deals"> {
  return status === "paid" ? { status } : { status, paid_at: null }
}

export const DUE_SOON_DAYS = 30

export interface DueDeal {
  deal: BrandDeal
  /** Calendar days until the due date (negative = overdue). */
  daysLeft: number
}

/** Deals still being worked on whose deliverables are due within `days` (overdue included), soonest first. */
export function dealsDueSoon(deals: readonly BrandDeal[], now: Date, days = DUE_SOON_DAYS): DueDeal[] {
  const today = parseDate(toISODate(now))!
  const limit = toISODate(addDays(today, days))
  return deals
    .filter((d) => d.due_date && d.due_date <= limit && isOpenDeal(d) && d.status !== "delivered")
    .map((deal) => ({ deal, daysLeft: Math.round((parseDate(deal.due_date)!.getTime() - today.getTime()) / 86_400_000) }))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.deal.brand_name.localeCompare(b.deal.brand_name))
}

/** Board/table order: status, then due date (undated last), then brand. */
export function compareDeals(order: readonly DealStatus[]) {
  return (a: BrandDeal, b: BrandDeal) =>
    order.indexOf(a.status) - order.indexOf(b.status) ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    a.brand_name.localeCompare(b.brand_name)
}

/** Adds or removes a content item on deals so it belongs to `dealId` only (null = to none). */
export function dealLinkUpdates(
  deals: readonly BrandDeal[],
  itemId: ID,
  dealId: ID | null
): { id: ID; patch: { content_item_ids: ID[] } }[] {
  const updates: { id: ID; patch: { content_item_ids: ID[] } }[] = []
  for (const deal of deals) {
    const has = deal.content_item_ids.includes(itemId)
    const want = deal.id === dealId
    if (has && !want) updates.push({ id: deal.id, patch: { content_item_ids: deal.content_item_ids.filter((id) => id !== itemId) } })
    if (!has && want) updates.push({ id: deal.id, patch: { content_item_ids: [...deal.content_item_ids, itemId] } })
  }
  return updates
}

/* ------------------------------- Deliverables ------------------------------ */

const DONE_MARK = /^\[(x|X| )\]\s*/

/**
 * Deliverables are stored as text; a checked one starts with "[x] " (Markdown task-list style), so the
 * checklist survives exports and needs no extra column.
 */
export function parseDeliverable(text: string): { label: string; done: boolean } {
  const match = DONE_MARK.exec(text)
  return match ? { label: text.slice(match[0].length).trim(), done: match[1].toLowerCase() === "x" } : { label: text.trim(), done: false }
}

export function formatDeliverable(label: string, done: boolean): string {
  return done ? `[x] ${label.trim()}` : label.trim()
}

export function toggleDeliverable(list: readonly string[], index: number): string[] {
  return list.map((text, i) => {
    if (i !== index) return text
    const { label, done } = parseDeliverable(text)
    return formatDeliverable(label, !done)
  })
}

export function deliverableProgress(list: readonly string[]): { done: number; total: number } {
  return { done: list.filter((t) => parseDeliverable(t).done).length, total: list.length }
}

/* --------------------------------- Summary -------------------------------- */

/** "2026-09" for a date or an ISO day. */
export function monthKeyOf(value: Date | ISODate): string {
  return (typeof value === "string" ? value : toISODate(value)).slice(0, 7)
}

export interface MoneySummary {
  receivedThisMonth: CurrencyTotal[]
  receivedLastMonth: CurrencyTotal[]
  /** Expected income entries + the unlogged balance of booked deals. */
  expected: CurrencyTotal[]
  expectedIncome: CurrencyTotal[]
  expectedFromDeals: CurrencyTotal[]
  /** Quoted fees of deals still in talks. */
  inTalks: CurrencyTotal[]
  inTalksCount: number
  bookedCount: number
  /** Delivered, waiting for payment. */
  awaitingPaymentCount: number
}

export function moneySummary(db: Pick<Database, "brand_deals" | "income_entries">, now: Date, primary: string): MoneySummary {
  const month = monthKeyOf(now)
  const lastMonth = monthKeyOf(addMonths(startOfMonth(now), -1))
  const received = db.income_entries.filter((e) => e.status === "received")
  const booked = db.brand_deals.filter(isBookedDeal)
  const talks = db.brand_deals.filter((d) => TALKS_DEAL_STATUSES.includes(d.status))
  const expectedIncome = entryTotals(
    db.income_entries.filter((e) => e.status === "expected"),
    primary
  )
  const expectedFromDeals = totalsByCurrency(
    booked,
    (d) => dealMoney(d, db.income_entries).unlogged,
    (d) => d.currency,
    primary
  ).filter((t) => t.amount > 0)
  return {
    receivedThisMonth: entryTotals(received.filter((e) => monthKeyOf(e.date) === month), primary),
    receivedLastMonth: entryTotals(received.filter((e) => monthKeyOf(e.date) === lastMonth), primary),
    expected: mergeTotals([expectedIncome, expectedFromDeals], primary),
    expectedIncome,
    expectedFromDeals,
    inTalks: totalsByCurrency(talks, (d) => d.fee, (d) => d.currency, primary),
    inTalksCount: talks.length,
    bookedCount: booked.length,
    awaitingPaymentCount: booked.filter((d) => d.status === "delivered").length,
  }
}

/** % change from `previous` to `current`; null when there is nothing to compare against. */
export function monthChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null
}

/* ----------------------------- Income by source ---------------------------- */

export interface MonthSourceRow {
  /** "2026-09" */
  month: string
  start: Date
  bySource: Record<IncomeSource, number>
  total: number
}

const emptyBySource = () => Object.fromEntries(INCOME_SOURCE_IDS.map((s) => [s, 0])) as Record<IncomeSource, number>

/** Received income in `currency` per calendar month, oldest first, for the `months` months ending with `now`'s month. */
export function incomeBySourceMonthly(income: readonly IncomeEntry[], now: Date, currency: string, months = 6): MonthSourceRow[] {
  const code = normalizeCurrency(currency)
  const first = addMonths(startOfMonth(now), -(months - 1))
  const rows: MonthSourceRow[] = Array.from({ length: months }, (_, i) => {
    const start = addMonths(first, i)
    return { month: monthKeyOf(start), start, bySource: emptyBySource(), total: 0 }
  })
  const byMonth = new Map(rows.map((r) => [r.month, r]))
  for (const e of income) {
    if (e.status !== "received" || normalizeCurrency(e.currency) !== code) continue
    const row = byMonth.get(monthKeyOf(e.date))
    if (!row) continue
    row.bySource[e.source] = roundMoney(row.bySource[e.source] + e.amount)
    row.total = roundMoney(row.total + e.amount)
  }
  return rows
}

/** The chart currency: the primary one when it has received income in the window, else the busiest one. */
export function chartCurrency(income: readonly IncomeEntry[], now: Date, primary: string, months = 6): string {
  const from = monthKeyOf(addMonths(startOfMonth(now), -(months - 1)))
  const to = monthKeyOf(now)
  const counts = new Map<string, number>()
  for (const e of income) {
    const month = monthKeyOf(e.date)
    if (e.status !== "received" || month < from || month > to) continue
    const code = normalizeCurrency(e.currency)
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  const p = normalizeCurrency(primary)
  if (counts.has(p) || !counts.size) return p
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
}

/* -------------------------- Top-earning content ---------------------------- */

export interface ContentEarning {
  itemId: ID
  totals: CurrencyTotal[]
  /** Income logged against the item itself. */
  direct: CurrencyTotal[]
  /** Its share of deal income (a deal's received money split evenly across the content made for it). */
  viaDeals: CurrencyTotal[]
  dealIds: ID[]
}

/**
 * Received income per content item: entries linked to an item count fully; deal income without an item is
 * split evenly across the deal's content. Ranked by the primary currency, then by the largest other total.
 */
export function topEarningContent(
  db: Pick<Database, "brand_deals" | "income_entries" | "content_items">,
  primary: string,
  limit = 5
): ContentEarning[] {
  const itemIds = new Set(db.content_items.map((i) => i.id))
  const deals = new Map(db.brand_deals.map((d) => [d.id, d]))
  const direct = new Map<ID, CurrencyTotal[]>()
  const via = new Map<ID, CurrencyTotal[]>()
  const dealIds = new Map<ID, Set<ID>>()
  const push = (map: Map<ID, CurrencyTotal[]>, id: ID, amount: number, currency: string) => {
    const list = map.get(id)
    const row = { amount, currency: normalizeCurrency(currency) }
    if (list) list.push(row)
    else map.set(id, [row])
  }

  for (const e of db.income_entries) {
    if (e.status !== "received" || !(e.amount > 0)) continue
    if (e.content_item_id && itemIds.has(e.content_item_id)) {
      push(direct, e.content_item_id, e.amount, e.currency)
      continue
    }
    const deal = e.brand_deal_id ? deals.get(e.brand_deal_id) : undefined
    const linked = deal ? deal.content_item_ids.filter((id) => itemIds.has(id)) : []
    if (!deal || !linked.length) continue
    for (const id of linked) {
      push(via, id, e.amount / linked.length, e.currency)
      const set = dealIds.get(id) ?? new Set<ID>()
      set.add(deal.id)
      dealIds.set(id, set)
    }
  }

  const p = normalizeCurrency(primary)
  const ids = new Set([...direct.keys(), ...via.keys()])
  const rows: ContentEarning[] = [...ids].map((itemId) => {
    const d = mergeTotals([direct.get(itemId) ?? []], p)
    const v = mergeTotals([via.get(itemId) ?? []], p)
    return { itemId, direct: d, viaDeals: v, totals: mergeTotals([d, v], p), dealIds: [...(dealIds.get(itemId) ?? [])] }
  })
  const topOther = (r: ContentEarning) => Math.max(0, ...r.totals.filter((t) => t.currency !== p).map((t) => t.amount))
  return rows
    .sort((a, b) => amountIn(b.totals, p) - amountIn(a.totals, p) || topOther(b) - topOther(a) || a.itemId.localeCompare(b.itemId))
    .slice(0, Math.max(0, limit))
}

/* ------------------------------ Income table ------------------------------- */

export type IncomePeriod = "all" | "this_month" | "last_month" | "last_90" | "this_year"
export const INCOME_PERIODS: IncomePeriod[] = ["all", "this_month", "last_month", "last_90", "this_year"]

/** Inclusive ISO day range for a period; null = all time. */
export function periodRange(period: IncomePeriod, now: Date): { start: ISODate; end: ISODate } | null {
  const monthStart = startOfMonth(now)
  switch (period) {
    case "this_month":
      return { start: toISODate(monthStart), end: toISODate(addDays(addMonths(monthStart, 1), -1)) }
    case "last_month":
      return { start: toISODate(addMonths(monthStart, -1)), end: toISODate(addDays(monthStart, -1)) }
    case "last_90":
      return { start: toISODate(addDays(now, -89)), end: toISODate(now) }
    case "this_year":
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
    default:
      return null
  }
}

export const NO_PLATFORM = "none"

export interface IncomeFilters {
  query: string
  sources: IncomeSource[]
  statuses: IncomeStatus[]
  /** Platform ids, or NO_PLATFORM. */
  platforms: string[]
  currencies: string[]
  period: IncomePeriod
}

export const EMPTY_INCOME_FILTERS: IncomeFilters = { query: "", sources: [], statuses: [], platforms: [], currencies: [], period: "all" }

export function isFiltering(filters: IncomeFilters): boolean {
  return Boolean(
    filters.query.trim() ||
      filters.sources.length ||
      filters.statuses.length ||
      filters.platforms.length ||
      filters.currencies.length ||
      filters.period !== "all"
  )
}

export function filterIncome(
  entries: readonly IncomeEntry[],
  filters: IncomeFilters,
  now: Date,
  names: { deal: (id: ID) => string | undefined; item: (id: ID) => string | undefined }
): IncomeEntry[] {
  const range = periodRange(filters.period, now)
  return entries.filter(
    (e) =>
      (!range || (e.date >= range.start && e.date <= range.end)) &&
      (!filters.sources.length || filters.sources.includes(e.source)) &&
      (!filters.statuses.length || filters.statuses.includes(e.status)) &&
      (!filters.platforms.length || filters.platforms.includes(e.platform ?? NO_PLATFORM)) &&
      (!filters.currencies.length || filters.currencies.includes(normalizeCurrency(e.currency))) &&
      matchesQuery(
        filters.query,
        e.description,
        e.affiliate_program,
        e.brand_deal_id ? names.deal(e.brand_deal_id) : undefined,
        e.content_item_id ? names.item(e.content_item_id) : undefined
      )
  )
}

/** Newest first. */
export function compareIncome(a: IncomeEntry, b: IncomeEntry): number {
  return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
}

export interface IncomeCsvLabels {
  headers: [string, string, string, string, string, string, string, string, string, string]
  source: (source: IncomeSource) => string
  status: (status: IncomeStatus) => string
  platform: (platform: PlatformId) => string
  deal: (id: ID) => string | undefined
  item: (id: ID) => string | undefined
}

/** Date, description, source, affiliate program, platform, status, amount, currency, brand deal, content. */
export function incomeCsv(entries: readonly IncomeEntry[], labels: IncomeCsvLabels): string {
  return toCsv([
    labels.headers,
    ...entries.map((e) => [
      e.date,
      e.description,
      labels.source(e.source),
      e.affiliate_program,
      e.platform ? labels.platform(e.platform) : "",
      labels.status(e.status),
      e.amount,
      normalizeCurrency(e.currency),
      e.brand_deal_id ? (labels.deal(e.brand_deal_id) ?? "") : "",
      e.content_item_id ? (labels.item(e.content_item_id) ?? "") : "",
    ]),
  ])
}
