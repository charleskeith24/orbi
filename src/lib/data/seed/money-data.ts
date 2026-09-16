/**
 * Demo Money data for "Raf Mendoza / Northbound Commerce": brand deals across every status, ~6 months of
 * income across every source, and rate cards. Brands are fictional; affiliate programs are the real
 * programs Filipino creators use. Day offsets are relative to today (negative = past).
 */
import type { DealSource, DealStatus, IncomeSource, IncomeStatus, PlatformId } from "@/lib/types"

export interface DealSeed {
  key: string
  brand: string
  contact: string
  email: string
  handle: string
  source: DealSource
  status: DealStatus
  fee: number | null
  currency?: string
  deliverables: string[]
  platforms: PlatformId[]
  /** Seed piece keys made for the deal ("key" or "key:index" for a platform version). */
  content?: string[]
  campaign?: string
  start?: number
  due?: number
  paid?: number
  /** When the deal was logged. */
  logged: number
  usage: string
  mediaKit?: boolean
  notes: string
}

export const DEALS: DealSeed[] = [
  {
    key: "paylakas",
    brand: "PayLakas",
    contact: "Joanna Reyes",
    email: "partnerships@paylakas.example",
    handle: "@paylakas.ph",
    source: "outbound",
    status: "paid",
    fee: 60000,
    deliverables: ["1 LinkedIn post", "1 Facebook post with link", "Pinned comment for 7 days"],
    platforms: ["linkedin", "facebook"],
    content: ["cod-vs-prepaid"],
    start: -115,
    due: -106,
    paid: -84,
    logged: -120,
    usage: "Organic reposting on PayLakas' LinkedIn and Facebook for 60 days. No paid ads without a separate whitelisting fee.",
    mediaKit: true,
    notes: "Pitched them after the COD vs prepaid thread got picked up by seller groups. Paid net-30 — they want first dibs on the Q4 campaign.",
  },
  {
    key: "bilis",
    brand: "Bilis Express",
    contact: "Marco Villanueva",
    email: "marco.v@bilisexpress.example",
    handle: "@bilisexpressph",
    source: "inbound",
    status: "paid",
    fee: 45000,
    deliverables: ["1 TikTok video (60–90s)", "3 Instagram stories with link sticker"],
    platforms: ["tiktok", "instagram"],
    content: ["viral-product-dies"],
    start: -108,
    due: -99,
    paid: -76,
    logged: -112,
    usage: "30 days organic usage on Bilis Express channels, credited to @rafmendoza.",
    mediaKit: true,
    notes: "Courier integration fit the 'viral product dies' angle naturally — fulfillment was the real villain. Easy client, one round of edits.",
  },
  {
    key: "tindahan",
    brand: "Tindahan Cloud",
    contact: "Bea Santos (Hilig Talent Co.)",
    email: "bea@hiligtalent.example",
    handle: "@tindahancloud",
    source: "agency",
    status: "paid",
    fee: 85000,
    deliverables: ["1 Instagram carousel", "1 YouTube integration (60–90s)", "Link in description for 90 days"],
    platforms: ["instagram", "youtube"],
    content: ["product-page-leaks", "price-agency"],
    start: -100,
    due: -69,
    paid: -45,
    logged: -104,
    usage: "90 days organic usage. Paid usage (whitelisting) quoted separately at ₱25,000/month — they passed.",
    mediaKit: true,
    notes: "Through Hilig Talent (15% agency commission, already deducted from the fee above). Store builder for small sellers — good audience match.",
  },
  {
    key: "kapihan",
    brand: "Kapihan Roasters",
    contact: "Paolo Lim",
    email: "hello@kapihanroasters.example",
    handle: "@kapihanroasters",
    source: "inbound",
    status: "paid",
    fee: 18000,
    deliverables: ["1 Instagram post", "2 Instagram stories"],
    platforms: ["instagram"],
    content: ["sunday-reset"],
    start: -90,
    due: -87,
    paid: -58,
    logged: -95,
    usage: "Brand may repost on Instagram with credit. No usage in ads.",
    notes: "Small lifestyle deal — coffee in the Sunday reset post. Keep these rare so the feed stays on-niche.",
  },
  {
    key: "sulat-ai",
    brand: "Sulat AI",
    contact: "Bea Santos (Hilig Talent Co.)",
    email: "bea@hiligtalent.example",
    handle: "@sulat.ai",
    source: "agency",
    status: "paid",
    fee: 75000,
    deliverables: ["1 TikTok video", "1 YouTube integration in a walkthrough", "Affiliate link in bio for 30 days"],
    platforms: ["tiktok", "youtube"],
    content: ["automate-reporting", "ai-reporting-walkthrough"],
    start: -82,
    due: -32,
    paid: -12,
    logged: -85,
    usage: "Clips of the integration may be used on Sulat AI's own pages for 60 days.",
    mediaKit: true,
    notes: "Only agreed because the team actually uses it for report drafts. Disclosed as a paid partnership on both videos.",
  },
  {
    key: "hapag",
    brand: "Hapag Workspace",
    contact: "Trisha Gomez",
    email: "trisha@hapagworkspace.example",
    handle: "@hapagworkspace",
    source: "inbound",
    status: "delivered",
    fee: 40000,
    deliverables: ["1 TikTok video featuring the desk setup"],
    platforms: ["tiktok"],
    content: ["leadership-11pm"],
    start: -44,
    due: -39,
    logged: -48,
    usage: "30 days organic usage on Hapag's TikTok and Facebook.",
    notes: "Posted on time. Invoice NB-0917 sent — their finance pays on the 15th and 30th.",
  },
  {
    key: "sulong",
    brand: "Sulong Bank SME",
    contact: "Carla Dizon",
    email: "carla.dizon@sulongbank.example",
    handle: "Viber: 0917 555 0142",
    source: "referral",
    status: "in_progress",
    fee: 120000,
    deliverables: ["2 TikTok videos", "1 Facebook Live Q&A (45 minutes)", "1 LinkedIn post", "Co-branded forecast template"],
    platforms: ["tiktok", "facebook", "linkedin"],
    content: ["sc-forecast-template", "rc-five-kpis"],
    campaign: "scale-sprint",
    start: -10,
    due: 20,
    logged: -18,
    usage: "Template may carry the Sulong logo for 6 months. Videos: 60 days organic usage, no edits without approval.",
    notes: "Referred by a client's CFO. 50% downpayment received; balance due 7 days after the Live. Legal reviewed the claims in the scripts.",
  },
  {
    key: "lakbay",
    brand: "Lakbay Luggage",
    contact: "Nina Castillo",
    email: "nina@lakbayluggage.example",
    handle: "@lakbayluggage",
    source: "inbound",
    status: "contracted",
    fee: 35000,
    deliverables: ["1 Instagram Reel", "1 TikTok video"],
    platforms: ["instagram", "tiktok"],
    start: 6,
    due: 18,
    logged: -6,
    usage: "30 days organic usage; whitelisting not included.",
    notes: "Contract signed. Product arrives next week — angle: packing for a client workshop in Cebu.",
  },
  {
    key: "adloop",
    brand: "AdLoop Analytics",
    contact: "Sam Whitfield",
    email: "creators@adloop.example",
    handle: "@adloophq",
    source: "inbound",
    status: "negotiating",
    fee: 1500,
    currency: "USD",
    deliverables: ["1 YouTube integration (60–90s)", "1 LinkedIn post", "Affiliate link for 12 months"],
    platforms: ["youtube", "linkedin"],
    due: 30,
    logged: -9,
    usage: "Asked for 6 months of paid usage — countered with 60 days organic only.",
    notes: "US attribution tool. They offered $1,000; countered at $1,500 plus 20% recurring affiliate. Waiting on their marketing lead.",
  },
  {
    key: "pera-padala",
    brand: "Pera Padala",
    contact: "Luis Mercado",
    email: "luis@perapadala.example",
    handle: "@perapadala",
    source: "outbound",
    status: "pitched",
    fee: 50000,
    deliverables: ["1 Facebook video", "1 TikTok video"],
    platforms: ["facebook", "tiktok"],
    logged: -4,
    usage: "",
    notes: "Sent the media kit and the two-video package. Follow up on Friday if no reply.",
  },
  {
    key: "tinda-academy",
    brand: "Tinda Academy",
    contact: "Kat (intro)",
    email: "",
    handle: "@tindaacademy",
    source: "referral",
    status: "lead",
    fee: null,
    deliverables: [],
    platforms: [],
    logged: -1,
    usage: "",
    notes: "Kat says they want a webinar partner for their seller bootcamp. Ask about audience size, budget and dates before quoting.",
  },
  {
    key: "ulap",
    brand: "Ulap Printing",
    contact: "Grace Tan",
    email: "grace@ulapprinting.example",
    handle: "@ulapprinting",
    source: "inbound",
    status: "lost",
    fee: 20000,
    deliverables: ["3 Instagram posts"],
    platforms: ["instagram"],
    logged: -40,
    usage: "",
    notes: "Wanted full script approval and unlimited revisions for ₱20k. Declined — not a fit for the audience either.",
  },
]

export interface IncomeSeed {
  /** Day offset of the payment (or expected payment). */
  day: number
  amount: number
  source: IncomeSource
  description: string
  status?: IncomeStatus
  affiliate?: string
  platform?: PlatformId
  deal?: string
  /** Seed piece key the money came from. */
  content?: string
  /** When it was logged, if not on the day itself. */
  logged?: number
}

/** One-off entries. Paid deals also get their payment entry from DEALS (amount = fee on `paid`). */
export const INCOME: IncomeSeed[] = [
  { day: -8, amount: 60000, source: "brand_deal", deal: "sulong", description: "Sulong Bank SME — 50% downpayment" },
  { day: 25, amount: 60000, source: "brand_deal", deal: "sulong", status: "expected", logged: -8, description: "Sulong Bank SME — balance, 7 days after the Live" },
  { day: 4, amount: 40000, source: "brand_deal", deal: "hapag", status: "expected", logged: -38, description: "Hapag Workspace — invoice NB-0917" },
  { day: -20, amount: 6420, source: "affiliate", affiliate: "TikTok Shop", platform: "tiktok", content: "offer-part-2", description: "TikTok Shop — ring light and mic kit from the offer video" },
  { day: -48, amount: 2300, source: "affiliate", affiliate: "Lazada", platform: "instagram", description: "Lazada — desk setup links" },
  { day: -118, amount: 1850, source: "affiliate", affiliate: "Lazada", platform: "instagram", description: "Lazada — desk setup links" },
  { day: -27, amount: 4500, source: "affiliate", affiliate: "Involve Asia", platform: "youtube", description: "Involve Asia — web hosting sign-ups from YouTube descriptions" },
  { day: -36, amount: 54000, source: "product", content: "workshop-new-sellers", description: "New Sellers Workshop — 36 seats × ₱1,500" },
  { day: -60, amount: 23453, source: "product", description: "Monday Scorecard template — 47 sales × ₱499" },
  { day: -140, amount: 18239, source: "product", description: "Ad account audit checklist (PDF) — 61 sales × ₱299" },
  { day: -52, amount: 15000, source: "service", description: "Paid strategy call — 2 hours with a skincare founder" },
  { day: -28, amount: 40000, source: "service", description: "Speaking fee — e-commerce summit, Pasay" },
  { day: -150, amount: 60000, source: "service", description: "Half-day ads workshop for a client's in-house team" },
  { day: -35, amount: 1240, source: "tip", platform: "facebook", description: "Facebook Stars from AMA #2" },
  { day: -95, amount: 620, source: "tip", platform: "facebook", description: "Facebook Stars" },
  { day: -19, amount: 860, source: "tip", platform: "tiktok", description: "TikTok LIVE gifts" },
  { day: -70, amount: 3000, source: "other", description: "Podcast guest honorarium" },
  { day: -14, amount: 5000, source: "other", description: "Judge fee — university pitch competition" },
]

export interface MonthlySeed {
  /** Payout day of the month. */
  dayOfMonth: number
  /** This month first, then 1…5 months ago. */
  amounts: [number, number, number, number, number, number]
  source: IncomeSource
  /** Prefix; the builder appends the month the payout covers. */
  description: string
  affiliate?: string
  platform: PlatformId
}

/** Monthly payouts for the last six months (this month's stays "expected" until its payout day). */
export const MONTHLY_INCOME: MonthlySeed[] = [
  { dayOfMonth: 10, amounts: [18640, 21300, 15640, 9870, 12300, 8450], source: "affiliate", affiliate: "TikTok Shop", platform: "tiktok", description: "TikTok Shop commissions" },
  { dayOfMonth: 15, amounts: [6120, 5400, 2980, 4150, 3200, 2760], source: "affiliate", affiliate: "Shopee", platform: "facebook", description: "Shopee affiliate commissions" },
  { dayOfMonth: 18, amounts: [9900, 6400, 7800, 5300, 4100, 3650], source: "platform_payout", platform: "tiktok", description: "TikTok Creator Rewards" },
  { dayOfMonth: 21, amounts: [11300, 8100, 9200, 7450, 6800, 5900], source: "platform_payout", platform: "facebook", description: "Facebook content monetization" },
  { dayOfMonth: 22, amounts: [4450, 3900, 3100, 2600, 2150, 1880], source: "platform_payout", platform: "youtube", description: "YouTube AdSense" },
]

export interface RateCardSeed {
  name: string
  description: string
  platform: PlatformId | null
  deliverables: string[]
  price: number | null
  active?: boolean
}

export const RATE_CARDS: RateCardSeed[] = [
  {
    name: "TikTok video",
    description: "A native TikTok in Raf's voice — the product shown inside a real lesson, not a read-out ad.",
    platform: "tiktok",
    deliverables: ["1 video, 60–90 seconds", "1 round of script feedback", "Link in bio for 7 days"],
    price: 35000,
  },
  {
    name: "Facebook video + post",
    description: "For brands selling to Filipino founders and sellers, where most of the audience comments.",
    platform: "facebook",
    deliverables: ["1 native video up to 3 minutes", "1 follow-up post with link", "Pinned comment"],
    price: 30000,
  },
  {
    name: "YouTube integration",
    description: "A 60–90 second segment inside a long-form breakdown or walkthrough.",
    platform: "youtube",
    deliverables: ["60–90 second integration", "Link in description", "Chapter marker"],
    price: 45000,
  },
  {
    name: "LinkedIn thought-leadership post",
    description: "Written by Raf for marketing leads and founders — best for B2B tools and services.",
    platform: "linkedin",
    deliverables: ["1 post", "Replies to comments for 24 hours"],
    price: 25000,
  },
  {
    name: "Launch bundle",
    description: "One story told across the channels that matter for a launch.",
    platform: null,
    deliverables: ["1 TikTok video", "1 Facebook video", "1 LinkedIn post", "3 Instagram stories", "30 days organic usage"],
    price: 95000,
  },
  {
    name: "Workshop or talk",
    description: "Half-day workshop or keynote for sellers, marketing teams or events.",
    platform: null,
    deliverables: ["Up to 4 hours live", "Custom slides", "Q&A"],
    price: null,
  },
  {
    name: "Instagram carousel",
    description: "Retired — carousels now come with the Launch bundle.",
    platform: "instagram",
    deliverables: ["1 carousel, up to 10 slides"],
    price: 18000,
    active: false,
  },
]
