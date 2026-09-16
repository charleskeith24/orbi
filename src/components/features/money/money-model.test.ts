import { describe, expect, it } from "vitest"
import { add, addPublished, makeDb, NOW } from "@/lib/analytics/test-fixtures"
import type { Database, InsertRow } from "@/lib/types"
import { buildMediaKit, MEDIA_KIT_DAYS, stripHandle, thirdPersonPositioning } from "./media-kit-model"
import {
  amountIn,
  chartCurrency,
  dealLinkUpdates,
  dealMoney,
  dealsDueSoon,
  deliverableProgress,
  EMPTY_INCOME_FILTERS,
  filterIncome,
  incomeBySourceMonthly,
  incomeCsv,
  moneySummary,
  monthChange,
  parseDeliverable,
  periodRange,
  planMarkPaid,
  statusPatch,
  toggleDeliverable,
  topEarningContent,
  totalsByCurrency,
} from "./money-model"

// NOW = Thu 10 Sep 2026, 12:00 local.
const TODAY = "2026-09-10"
const describeKind = (kind: "payment" | "balance") => (kind === "balance" ? "Balance" : "Payment")

function income(db: Database, values: InsertRow<"income_entries">) {
  return add(db, "income_entries", { currency: "PHP", status: "received", ...values })
}

describe("totalsByCurrency", () => {
  it("totals each currency separately and puts the primary currency first", () => {
    const rows = [
      { amount: 800, currency: "USD" },
      { amount: 12500, currency: "PHP" },
      { amount: 200, currency: "usd" },
      { amount: 0.1, currency: "PHP" },
      { amount: 0.2, currency: "PHP" },
    ]
    const totals = totalsByCurrency(rows, (r) => r.amount, (r) => r.currency, "PHP")
    expect(totals).toEqual([
      { currency: "PHP", amount: 12500.3 },
      { currency: "USD", amount: 1000 },
    ])
    expect(amountIn(totals, "usd")).toBe(1000)
    expect(amountIn(totals, "EUR")).toBe(0)
  })

  it("skips rows without an amount", () => {
    expect(totalsByCurrency([{ fee: null }, { fee: 5 }], (r) => r.fee, () => "PHP")).toEqual([{ currency: "PHP", amount: 5 }])
  })
})

describe("moneySummary", () => {
  it("splits received this month and last month per currency", () => {
    const db = makeDb()
    income(db, { date: "2026-09-02", amount: 10000 })
    income(db, { date: "2026-09-09", amount: 2500, source: "affiliate" })
    income(db, { date: "2026-09-05", amount: 300, currency: "USD" })
    income(db, { date: "2026-08-31", amount: 5000 })
    income(db, { date: "2026-09-20", amount: 999, status: "expected" })
    const s = moneySummary(db, NOW, "PHP")
    expect(s.receivedThisMonth).toEqual([
      { currency: "PHP", amount: 12500 },
      { currency: "USD", amount: 300 },
    ])
    expect(s.receivedLastMonth).toEqual([{ currency: "PHP", amount: 5000 }])
    expect(monthChange(12500, 5000)).toBe(150)
    expect(monthChange(100, 0)).toBeNull()
  })

  it("expects logged expected income plus the unlogged balance of booked deals, without double counting", () => {
    const db = makeDb()
    const sulong = add(db, "brand_deals", { brand_name: "Sulong", status: "in_progress", fee: 120000 })
    income(db, { brand_deal_id: sulong.id, amount: 60000, date: "2026-09-02" })
    income(db, { brand_deal_id: sulong.id, amount: 30000, status: "expected", date: "2026-10-05" })
    add(db, "brand_deals", { brand_name: "Lakbay", status: "contracted", fee: 35000 })
    add(db, "brand_deals", { brand_name: "AdLoop", status: "negotiating", fee: 1500, currency: "USD" })
    add(db, "brand_deals", { brand_name: "Old", status: "paid", fee: 9000 })
    income(db, { amount: 4000, status: "expected", date: "2026-09-18", source: "platform_payout" })

    const s = moneySummary(db, NOW, "PHP")
    expect(s.expectedIncome).toEqual([{ currency: "PHP", amount: 34000 }])
    // Sulong: 120k − 60k received − 30k expected = 30k unlogged; Lakbay: 35k.
    expect(s.expectedFromDeals).toEqual([{ currency: "PHP", amount: 65000 }])
    expect(s.expected).toEqual([{ currency: "PHP", amount: 99000 }])
    expect(s.inTalks).toEqual([{ currency: "USD", amount: 1500 }])
    expect(s.inTalksCount).toBe(1)
    expect(s.bookedCount).toBe(2)
  })
})

describe("incomeBySourceMonthly", () => {
  it("returns the last six months of received income by source in one currency", () => {
    const db = makeDb()
    income(db, { date: "2026-09-01", amount: 1000, source: "affiliate" })
    income(db, { date: "2026-09-03", amount: 500, source: "affiliate" })
    income(db, { date: "2026-09-04", amount: 2000, source: "brand_deal" })
    income(db, { date: "2026-04-30", amount: 700, source: "tip" })
    income(db, { date: "2026-03-31", amount: 9999, source: "tip" }) // outside the window
    income(db, { date: "2026-09-05", amount: 50, source: "tip", currency: "USD" }) // other currency
    income(db, { date: "2026-09-06", amount: 400, source: "tip", status: "expected" }) // not received

    const rows = incomeBySourceMonthly(db.income_entries, NOW, "PHP")
    expect(rows.map((r) => r.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"])
    expect(rows[0].bySource.tip).toBe(700)
    expect(rows[5].bySource).toMatchObject({ affiliate: 1500, brand_deal: 2000, tip: 0 })
    expect(rows[5].total).toBe(3500)
    expect(rows.slice(1, 5).every((r) => r.total === 0)).toBe(true)
  })

  it("charts the primary currency when it has income, otherwise the busiest one", () => {
    const db = makeDb()
    income(db, { date: "2026-09-01", amount: 5, currency: "USD" })
    income(db, { date: "2026-08-01", amount: 6, currency: "USD" })
    income(db, { date: "2026-08-01", amount: 7, currency: "SGD" })
    expect(chartCurrency(db.income_entries, NOW, "PHP")).toBe("USD")
    income(db, { date: "2026-07-01", amount: 1 })
    expect(chartCurrency(db.income_entries, NOW, "PHP")).toBe("PHP")
  })
})

describe("planMarkPaid", () => {
  it("records only the unpaid balance after a 50% downpayment, using the logged expected entry", () => {
    const db = makeDb()
    const deal = add(db, "brand_deals", { brand_name: "Sulong", status: "in_progress", fee: 120000, platforms: ["tiktok", "facebook"] })
    income(db, { brand_deal_id: deal.id, amount: 60000, date: "2026-09-02" })
    const balance = income(db, { brand_deal_id: deal.id, amount: 60000, status: "expected", date: "2026-10-05" })

    const plan = planMarkPaid(deal, db.income_entries, TODAY, describeKind)
    expect(plan.dealPatch).toEqual({ status: "paid", paid_at: TODAY })
    expect(plan.receive).toEqual([{ id: balance.id, patch: { status: "received", date: TODAY } }])
    expect(plan.create).toBeNull()
    expect(plan.recorded).toBe(60000)
  })

  it("creates one received entry for the balance when nothing else was logged", () => {
    const db = makeDb()
    const deal = add(db, "brand_deals", { brand_name: "Sulong", status: "delivered", fee: 120000, platforms: ["tiktok"] })
    income(db, { brand_deal_id: deal.id, amount: 60000, date: "2026-09-02" })
    income(db, { brand_deal_id: deal.id, amount: 500, currency: "USD", date: "2026-09-02" }) // other currency: ignored
    const plan = planMarkPaid(deal, db.income_entries, TODAY, describeKind)
    expect(plan.receive).toEqual([])
    expect(plan.create).toEqual({
      date: TODAY,
      amount: 60000,
      currency: "PHP",
      source: "brand_deal",
      status: "received",
      brand_deal_id: deal.id,
      platform: "tiktok",
      description: "Balance",
    })
    expect(dealMoney(deal, db.income_entries)).toMatchObject({ received: 60000, balance: 60000, otherCurrencyEntries: 1 })
  })

  it("records the full fee when nothing was received, and tops up expected entries that don't cover it", () => {
    const db = makeDb()
    const deal = add(db, "brand_deals", { brand_name: "Lakbay", status: "delivered", fee: 35000, currency: "PHP" })
    expect(planMarkPaid(deal, db.income_entries, TODAY, describeKind).create).toMatchObject({ amount: 35000, description: "Payment" })

    const part = income(db, { brand_deal_id: deal.id, amount: 20000, status: "expected", date: "2026-09-30" })
    income(db, { brand_deal_id: deal.id, amount: 50000, status: "expected", date: "2026-09-01" }) // larger than the balance: left alone
    const plan = planMarkPaid(deal, db.income_entries, TODAY, describeKind)
    expect(plan.receive.map((r) => r.id)).toEqual([part.id])
    expect(plan.create).toMatchObject({ amount: 15000, description: "Balance" })
    expect(plan.recorded).toBe(35000)
  })

  it("only marks the deal paid when there is no fee or nothing is owed, and keeps an existing paid date", () => {
    const db = makeDb()
    const noFee = add(db, "brand_deals", { status: "delivered", fee: null })
    expect(planMarkPaid(noFee, db.income_entries, TODAY, describeKind)).toMatchObject({ receive: [], create: null, recorded: 0 })
    const settled = add(db, "brand_deals", { status: "delivered", fee: 1000, paid_at: "2026-09-01" })
    income(db, { brand_deal_id: settled.id, amount: 1000, date: "2026-09-01" })
    const plan = planMarkPaid(settled, db.income_entries, TODAY, describeKind)
    expect(plan).toMatchObject({ receive: [], create: null, recorded: 0 })
    expect(plan.dealPatch).toEqual({ status: "paid", paid_at: "2026-09-01" })
  })

  it("clears the paid date when a deal leaves Paid", () => {
    const deal = add(makeDb(), "brand_deals", { status: "paid", paid_at: "2026-09-01" })
    expect(statusPatch(deal, "delivered")).toEqual({ status: "delivered", paid_at: null })
    expect(statusPatch(deal, "paid")).toEqual({ status: "paid" })
  })
})

describe("topEarningContent", () => {
  it("credits linked income directly and splits deal income across the deal's content", () => {
    const db = makeDb()
    const video = add(db, "content_items", { title: "Video" })
    const post = add(db, "content_items", { title: "Post" })
    const workshop = add(db, "content_items", { title: "Workshop" })
    const deal = add(db, "brand_deals", { brand_name: "Sulong", content_item_ids: [video.id, post.id, "deleted-item"] })
    income(db, { brand_deal_id: deal.id, amount: 60000 })
    income(db, { brand_deal_id: deal.id, amount: 1000, status: "expected" }) // not received
    income(db, { brand_deal_id: deal.id, content_item_id: post.id, amount: 5000 }) // direct wins over the split
    income(db, { content_item_id: workshop.id, amount: 54000 })
    income(db, { content_item_id: video.id, amount: 100, currency: "USD" })

    const rows = topEarningContent(db, "PHP")
    expect(rows.map((r) => r.itemId)).toEqual([workshop.id, post.id, video.id])
    const byId = new Map(rows.map((r) => [r.itemId, r]))
    expect(byId.get(post.id)?.totals).toEqual([{ currency: "PHP", amount: 35000 }])
    expect(byId.get(post.id)?.direct).toEqual([{ currency: "PHP", amount: 5000 }])
    expect(byId.get(video.id)?.totals).toEqual([
      { currency: "PHP", amount: 30000 },
      { currency: "USD", amount: 100 },
    ])
    expect(byId.get(video.id)?.dealIds).toEqual([deal.id])
    expect(topEarningContent(db, "PHP", 1)).toHaveLength(1)
  })
})

describe("deals", () => {
  it("lists deals due within the window (overdue first), skipping delivered, paid and lost", () => {
    const db = makeDb()
    const overdue = add(db, "brand_deals", { brand_name: "A", status: "in_progress", due_date: "2026-09-08" })
    const soon = add(db, "brand_deals", { brand_name: "B", status: "contracted", due_date: "2026-09-24" })
    add(db, "brand_deals", { brand_name: "C", status: "contracted", due_date: "2026-09-25" })
    add(db, "brand_deals", { brand_name: "D", status: "delivered", due_date: "2026-09-11" })
    add(db, "brand_deals", { brand_name: "E", status: "paid", due_date: "2026-09-11" })
    add(db, "brand_deals", { brand_name: "F", status: "lead", due_date: null })
    expect(dealsDueSoon(db.brand_deals, NOW, 14).map((d) => [d.deal.id, d.daysLeft])).toEqual([
      [overdue.id, -2],
      [soon.id, 14],
    ])
  })

  it("keeps deliverable check state in the text", () => {
    expect(parseDeliverable("[x] 2 TikTok videos")).toEqual({ label: "2 TikTok videos", done: true })
    expect(parseDeliverable("[ ] 1 Live")).toEqual({ label: "1 Live", done: false })
    expect(parseDeliverable("1 LinkedIn post")).toEqual({ label: "1 LinkedIn post", done: false })
    const list = toggleDeliverable(["A", "[x] B"], 0)
    expect(list).toEqual(["[x] A", "[x] B"])
    expect(toggleDeliverable(list, 1)).toEqual(["[x] A", "B"])
    expect(deliverableProgress(list)).toEqual({ done: 2, total: 2 })
  })

  it("moves a content item to exactly one deal", () => {
    const db = makeDb()
    const a = add(db, "brand_deals", { content_item_ids: ["item", "other"] })
    const b = add(db, "brand_deals", { content_item_ids: [] })
    expect(dealLinkUpdates(db.brand_deals, "item", b.id)).toEqual([
      { id: a.id, patch: { content_item_ids: ["other"] } },
      { id: b.id, patch: { content_item_ids: ["item"] } },
    ])
    expect(dealLinkUpdates(db.brand_deals, "item", a.id)).toEqual([])
    expect(dealLinkUpdates(db.brand_deals, "item", null)).toEqual([{ id: a.id, patch: { content_item_ids: ["other"] } }])
  })
})

describe("income table", () => {
  it("filters by period, source, status, platform, currency and search", () => {
    const db = makeDb()
    const deal = add(db, "brand_deals", { brand_name: "Sulong Bank" })
    const a = income(db, { date: "2026-09-02", amount: 1, source: "brand_deal", brand_deal_id: deal.id })
    const b = income(db, { date: "2026-08-15", amount: 2, source: "affiliate", affiliate_program: "TikTok Shop", platform: "tiktok" })
    const c = income(db, { date: "2026-01-15", amount: 3, source: "tip", status: "expected", currency: "USD" })
    const names = { deal: (id: string) => (id === deal.id ? deal.brand_name : undefined), item: () => undefined }
    const run = (f: Partial<typeof EMPTY_INCOME_FILTERS>) =>
      filterIncome(db.income_entries, { ...EMPTY_INCOME_FILTERS, ...f }, NOW, names).map((e) => e.id)

    expect(run({})).toEqual([a.id, b.id, c.id])
    expect(run({ period: "this_month" })).toEqual([a.id])
    expect(run({ period: "last_month" })).toEqual([b.id])
    expect(run({ period: "last_90" })).toEqual([a.id, b.id])
    expect(run({ sources: ["tip"], statuses: ["expected"] })).toEqual([c.id])
    expect(run({ platforms: ["none"] })).toEqual([a.id, c.id])
    expect(run({ currencies: ["USD"] })).toEqual([c.id])
    expect(run({ query: "sulong" })).toEqual([a.id])
    expect(run({ query: "tiktok shop" })).toEqual([b.id])
    expect(periodRange("this_year", NOW)).toEqual({ start: "2026-01-01", end: "2026-12-31" })
  })

  it("exports CSV with the currency in its own column", () => {
    const db = makeDb()
    const e = income(db, { date: "2026-09-02", amount: 1250.5, description: "Commissions, August", source: "affiliate", platform: "tiktok" })
    const csv = incomeCsv([e], {
      headers: ["Date", "Description", "Source", "Program", "Platform", "Status", "Amount", "Currency", "Deal", "Content"],
      source: (s) => s,
      status: (s) => s,
      platform: (p) => p,
      deal: () => undefined,
      item: () => undefined,
    })
    expect(csv.split("\r\n")).toEqual([
      "Date,Description,Source,Program,Platform,Status,Amount,Currency,Deal,Content",
      '2026-09-02,"Commissions, August",affiliate,,tiktok,received,1250.5,PHP,,',
    ])
  })
})

describe("buildMediaKit", () => {
  it("averages views and engagement rate over the last 90 days only, and never invents missing numbers", () => {
    const db = makeDb()
    db.brand_profiles[0] = { ...db.brand_profiles[0], name: "Raf Mendoza", main_platforms: ["tiktok", "linkedin"] }
    add(db, "content_platforms", { platform: "tiktok", is_active: true, handle: "@rafmendoza", current_followers: 48000 })
    add(db, "content_platforms", { platform: "linkedin", is_active: true, handle: "", current_followers: null })
    // Inside the window: views 1,000 + 3,000, engagements 100 + 200 over reach 2,000 + 4,000.
    addPublished(db, 10, { platform: "tiktok", title: "Recent" }, { views: 1000, reach: 2000, likes: 80, comments: 20 })
    addPublished(db, MEDIA_KIT_DAYS - 1, { platform: "tiktok", title: "Edge" }, { views: 3000, reach: 4000, likes: 150, shares: 50 })
    // Outside the window, and a published post without analytics.
    addPublished(db, MEDIA_KIT_DAYS + 5, { platform: "tiktok", title: "Old" }, { views: 900000, reach: 900000, likes: 1 })
    addPublished(db, 3, { platform: "linkedin", title: "No numbers" })

    const kit = buildMediaKit(db, NOW)
    expect(kit.platforms.map((p) => p.platform)).toEqual(["tiktok", "linkedin"])
    const [tiktok, linkedin] = kit.platforms
    expect(tiktok).toMatchObject({ handle: "rafmendoza", followers: 48000, posts: 2, measured: 2, avgViews: 2000, engagementRate: 5 })
    expect(linkedin).toMatchObject({ handle: "", followers: null, posts: 1, measured: 0, avgViews: null, engagementRate: null })
    expect(kit.topPosts.map((p) => p.item.title)).toEqual(["Edge", "Recent"])
    // 3 posts in the window (one unmeasured): 4,000 views ÷ 2 measured; 300 engagements ÷ 6,000 reach.
    expect(kit.totals).toEqual({ followers: 48000, followersKnown: 1, posts: 3, measured: 2, avgViews: 2000, engagementRate: 5 })
    expect(kit.missing).toEqual(expect.arrayContaining(["bio", "contact", "handles", "followers", "persona", "rate_cards", "collabs"]))
    expect(kit.missing).not.toContain("analytics")
  })

  it("uses the media-kit bio, lists only real collaborations and active rate cards", () => {
    const db = makeDb()
    db.brand_profiles[0] = { ...db.brand_profiles[0], who_am_i: "I run ads.", media_kit_bio: "", contact_email: "raf@example.com" }
    add(db, "brand_deals", { brand_name: "PayLakas", status: "paid", show_in_media_kit: true })
    add(db, "brand_deals", { brand_name: "Lead Co", status: "lead", show_in_media_kit: true })
    add(db, "brand_deals", { brand_name: "Hidden", status: "paid", show_in_media_kit: false })
    add(db, "rate_cards", { name: "Second", sort_order: 1 })
    add(db, "rate_cards", { name: "First", sort_order: 0, price: null })
    add(db, "rate_cards", { name: "Off", is_active: false })
    add(db, "audience_personas", { name: "Seller", is_primary: true })

    const kit = buildMediaKit(db, NOW)
    expect(kit.bio).toBe("I run ads.")
    expect(kit.bioIsFallback).toBe(true)
    expect(kit.collabs.map((d) => d.brand_name)).toEqual(["PayLakas"])
    expect(kit.rateCards.map((r) => r.name)).toEqual(["First", "Second"])
    expect(kit.persona?.name).toBe("Seller")
    expect(kit.missing).toEqual(expect.arrayContaining(["bio", "platforms"]))
    expect(kit.missing).not.toContain("contact")
    expect(kit.missing).not.toContain("collabs")
  })

  it("writes positioning in the third person", () => {
    expect(thirdPersonPositioning("Raf Mendoza", "online sellers", "to scale past ₱1M a month", "simple ad systems.")).toBe(
      "Raf helps online sellers scale past ₱1M a month through simple ad systems."
    )
    expect(thirdPersonPositioning("Raf", "", "grow", "")).toBe("")
    expect(stripHandle(" @@raf ")).toBe("raf")
  })
})
