/**
 * Builds the demo Money rows (brand deals, income entries, rate cards) from ./money-data. Runs after every
 * other demo table so the content it links to exists and earlier ids are unaffected.
 */
import { addMinutes, format, subMonths } from "date-fns"
import { toISODate } from "@/lib/dates"
import type { BrandDeal, Database, ID, IncomeEntry, InsertRow, RateCard } from "@/lib/types"
import type { SeedContext } from "./context"
import { DEALS, INCOME, MONTHLY_INCOME, RATE_CARDS, type IncomeSeed } from "./money-data"

export interface MoneyRefs {
  /** Id of a demo content item by seed piece key ("key" or "key:index"); null when it isn't in the workspace. */
  item(ref: string): ID | null
  campaign(key: string): ID | null
  /** When the demo brand started using the app — older money was backfilled that day. */
  workspaceStart: Date
}

type MoneyTables = Pick<Database, "brand_deals" | "income_entries" | "rate_cards">

export function buildMoney(ctx: SeedContext, refs: MoneyRefs): MoneyTables {
  const past = (d: Date) => (d > ctx.now ? ctx.now : d)
  let backfilled = 0
  /** Logged on `offset` at `time`; anything older than the workspace was entered on day one. */
  const loggedAt = (offset: number, time: string): Date => {
    const at = ctx.date(offset, time)
    if (at < refs.workspaceStart) return addMinutes(refs.workspaceStart, 30 + backfilled++)
    return past(at)
  }
  const later = (a: Date, b: Date) => (b > a ? b : a)
  const dealId = (key: string) => ctx.id(`deal:${key}`)
  const items = (refsList: string[] | undefined) =>
    (refsList ?? []).map((r) => refs.item(r)).filter((id): id is ID => id !== null)

  /* --------------------------------- Deals --------------------------------- */

  const brand_deals: BrandDeal[] = DEALS.map((d) => {
    const created = loggedAt(d.logged, "10:15")
    const lastTouch = d.paid ?? (d.status === "delivered" ? d.due : undefined) ?? Math.min(d.logged + 2, 0)
    const values: InsertRow<"brand_deals"> = {
      id: dealId(d.key),
      brand_name: d.brand,
      contact_name: d.contact,
      contact_email: d.email,
      contact_handle: d.handle,
      source: d.source,
      status: d.status,
      fee: d.fee,
      currency: d.currency ?? "PHP",
      deliverables: d.deliverables,
      platforms: d.platforms,
      content_item_ids: items(d.content),
      campaign_id: d.campaign ? refs.campaign(d.campaign) : null,
      start_date: d.start === undefined ? null : ctx.day(d.start),
      due_date: d.due === undefined ? null : ctx.day(d.due),
      paid_at: d.paid === undefined ? null : ctx.day(d.paid),
      usage_rights: d.usage,
      show_in_media_kit: Boolean(d.mediaKit),
      notes: d.notes,
    }
    return ctx.build("brand_deals", values, created, later(created, past(ctx.date(lastTouch, "16:20"))))
  })

  /* --------------------------------- Income -------------------------------- */

  const income: { seed: IncomeSeed; date: string }[] = []
  // Paid deals: one payment entry for the full fee on the paid date.
  for (const d of DEALS) {
    if (d.status !== "paid" || d.paid === undefined || d.fee === null) continue
    income.push({
      seed: { day: d.paid, amount: d.fee, source: "brand_deal", deal: d.key, description: `${d.brand} — sponsorship` },
      date: ctx.day(d.paid),
    })
  }
  for (const seed of INCOME) income.push({ seed, date: ctx.day(seed.day) })
  // Monthly payouts: this month and the five before it, each covering the previous month.
  const today = toISODate(ctx.now)
  for (const m of MONTHLY_INCOME) {
    m.amounts.forEach((amount, monthsAgo) => {
      const payout = subMonths(new Date(ctx.today.getFullYear(), ctx.today.getMonth(), m.dayOfMonth), monthsAgo)
      const date = toISODate(payout)
      const covers = format(subMonths(payout, 1), "MMMM")
      income.push({
        seed: {
          day: 0,
          amount,
          source: m.source,
          affiliate: m.affiliate,
          platform: m.platform,
          status: date > today ? "expected" : "received",
          description: `${m.description} — ${covers}`,
        },
        date,
      })
    })
  }
  income.sort((a, b) => a.date.localeCompare(b.date) || a.seed.description.localeCompare(b.seed.description))

  const income_entries: IncomeEntry[] = income.map(({ seed, date }) => {
    const dayOffset = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000)
    const logged = seed.logged ?? Math.min(dayOffset, 0)
    const created = loggedAt(logged, logged === 0 ? "08:05" : "20:40")
    return ctx.build(
      "income_entries",
      {
        date,
        amount: seed.amount,
        currency: "PHP",
        source: seed.source,
        affiliate_program: seed.affiliate ?? "",
        platform: seed.platform ?? null,
        status: seed.status ?? "received",
        brand_deal_id: seed.deal ? dealId(seed.deal) : null,
        content_item_id: seed.content ? refs.item(seed.content) : null,
        description: seed.description,
      },
      created
    )
  })

  /* ------------------------------- Rate cards ------------------------------ */

  const rate_cards: RateCard[] = RATE_CARDS.map((r, i) =>
    ctx.build(
      "rate_cards",
      {
        name: r.name,
        description: r.description,
        platform: r.platform,
        deliverables: r.deliverables,
        price: r.price,
        currency: "PHP",
        is_active: r.active ?? true,
        sort_order: i,
      },
      loggedAt(-60 + i, "15:30")
    )
  )

  return { brand_deals, income_entries, rate_cards }
}
