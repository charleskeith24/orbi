/**
 * Demo collabs for "Raf Mendoza / Northbound Commerce": every status, reviewed collabs linked to real demo
 * posts (so collab lift has data), follow-ups due on Today, a group brand deal and AI-style ideas.
 * Partners, names and handles are fictional. Day offsets are relative to today (negative = past).
 */
import type { CollabStatus, CollabType, GoalCategory, PlatformId } from "@/lib/types"
import type { PillarKey } from "./brand-data"
import type { CampaignKey } from "./piece-types"

export interface CollabSeed {
  key: string
  title: string
  type: CollabType
  status: CollabStatus
  partner: { name?: string; handle?: string; platform?: PlatformId; link?: string; niche: string; followers?: number }
  /** Seed piece keys of Raf's posts made for the collab ("key" or "key:index"). */
  content?: string[]
  campaign?: CampaignKey
  /** Money seed deal key (group brand deals). */
  deal?: string
  pillar?: PillarKey
  goal?: GoalCategory
  /** collab_date offset. */
  date?: number
  /** follow_up_on offset. */
  followUp?: number
  /** When the collab was logged. */
  logged: number
  /** When the status last changed. */
  moved: number
  outreach?: string
  notes?: string
  rating?: number
  repeat?: boolean
}

export const COLLABS: CollabSeed[] = [
  {
    key: "stitch-380k",
    title: "Stitch chain: the ₱380k ad mistake",
    type: "duet_stitch",
    status: "reviewed",
    partner: { name: "Nico Salazar", handle: "@nico.sells.daily", platform: "tiktok", link: "tiktok.com/@nico.sells.daily", niche: "Online selling for beginners", followers: 84000 },
    content: ["burned-380k"],
    pillar: "journey",
    goal: "awareness",
    date: -44,
    logged: -52,
    moved: -30,
    rating: 5,
    repeat: true,
    notes: "He stitched the ₱380k story with his own first-ad mistake, then I stitched his back. Two more seller creators joined the chain — best follower week this quarter.",
  },
  {
    key: "cod-live",
    title: "Joint Live AMA: pricing, COD and saying no",
    type: "joint_live",
    status: "reviewed",
    partner: { name: "Tina Ramos", handle: "@tina.benta.lab", platform: "facebook", link: "facebook.com/tina.benta.lab", niche: "Seller logistics and couriers", followers: 52000 },
    content: ["ama-2"],
    pillar: "education",
    goal: "community",
    date: -28,
    logged: -40,
    moved: -20,
    rating: 4,
    repeat: true,
    outreach:
      "Hi Tina! Si Raf 'to ng Northbound Commerce. Pareho tayo ng audience — sellers na nalilito sa pricing at COD — pero ikaw sa courier side, ako sa ads side. Joint Live AMA kaya sa Facebook? 45 minutes, sagutin natin ang tanong nila, naka-save ang replay sa parehong page. Pwede next Thursday? Magse-send ako ng short outline bukas.",
    notes: "She handled the RTS and courier questions, I took pricing and margins. 60+ questions — turn the best ones into posts.",
  },
  {
    key: "creative-carousel",
    title: "Co-created carousel: the creative testing framework",
    type: "co_created",
    status: "reviewed",
    partner: { name: "Lia Manalo", handle: "@studio.liwanag.ph", platform: "instagram", niche: "Product photography", followers: 23000 },
    content: ["creative-framework"],
    pillar: "education",
    goal: "authority",
    date: -16,
    logged: -30,
    moved: -9,
    rating: 4,
    repeat: false,
    notes: "Lots of saves, but most of her followers are other photographers, not sellers. Next time check her comments before pitching.",
  },
  {
    key: "bookkeeping-swap",
    title: "Shoutout swap: the numbers to check before scaling",
    type: "shoutout_swap",
    status: "published",
    partner: { name: "Joanna Cruz", handle: "@pesoplan.jo", platform: "tiktok", niche: "Bookkeeping for online sellers", followers: 61000 },
    content: ["three-numbers"],
    goal: "awareness",
    date: -23,
    logged: -33,
    moved: -23,
  },
  {
    key: "live-today",
    title: "TikTok Live: 11.11 checkout teardown",
    type: "joint_live",
    status: "scheduled",
    partner: { name: "Rhea Gomez", handle: "@rhea.shopwise", platform: "tiktok", niche: "Shopee and TikTok Shop selling", followers: 140000 },
    campaign: "scale-sprint",
    pillar: "education",
    goal: "leads",
    date: 0,
    logged: -9,
    moved: -4,
    notes: "Live at 8 p.m. She shares her checkout screen, I cover the ads side. End with the scaling audit CTA.",
  },
  {
    key: "podcast-guest",
    title: "Guest episode: scaling past ₱1M a month",
    type: "guesting",
    status: "scheduled",
    partner: { name: "Paolo Dizon", handle: "@negosyo.notes.pod", platform: "youtube", niche: "Small business podcast", followers: 31000 },
    pillar: "authority",
    goal: "authority",
    date: 5,
    logged: -12,
    moved: -3,
    notes: "Recording at their studio in Makati. Send five talking points by Friday.",
  },
  {
    key: "freight-live",
    title: "Joint Live on shipping costs",
    type: "joint_live",
    status: "reached_out",
    partner: { handle: "@kuya.freight", platform: "facebook", niche: "Courier and fulfillment tips", followers: 18000 },
    campaign: "scale-sprint",
    followUp: -1,
    logged: -6,
    moved: -4,
    outreach:
      "Hi! Si Raf 'to ng Northbound Commerce — nagpo-post ako tungkol sa ads at scaling para sa e-commerce founders. Pareho tayo ng audience pero magkaiba ang tinuturo natin: ikaw sa shipping, ako sa ads. Joint Live kaya sa Facebook tungkol sa shipping costs bago mag-11.11? Pwede ba akong mag-send ng 3-line outline this week?",
  },
  {
    key: "ai-guest-swap",
    title: "Guest swap with an AI tools creator",
    type: "guesting",
    status: "reached_out",
    partner: { name: "Marco Lim", handle: "@marco.automates", platform: "youtube", niche: "Automation and AI tools", followers: 45000 },
    pillar: "authority",
    followUp: 0,
    logged: -3,
    moved: -3,
  },
  {
    key: "sulong-group",
    title: "Sulong Bank SME Live: two-creator forecast session",
    type: "group_brand_deal",
    status: "agreed",
    partner: { name: "Bea Villareal", handle: "@bea.cashflow", platform: "facebook", niche: "Business cash flow", followers: 39000 },
    deal: "sulong",
    campaign: "scale-sprint",
    pillar: "business",
    goal: "leads",
    date: 14,
    logged: -10,
    moved: -5,
    notes: "Sulong wants a finance creator for the cash-flow half. Split: she covers cash flow, I cover the ad-budget forecast.",
  },
  {
    key: "giveaway-idea",
    title: "Joint giveaway: a scaling starter kit plus a product-photo session",
    type: "giveaway",
    status: "idea",
    partner: { platform: "instagram", niche: "Product photography" },
    pillar: "business",
    logged: -2,
    moved: -2,
    notes:
      "Partner to look for: A product-photography creator who shoots for small online sellers.\n\nWhy it fits: Sellers who follow me for ads also need better product photos — same people, different problem.",
  },
  {
    key: "creator-stitch-idea",
    title: "Stitch series: seller questions from creator-growth coaches",
    type: "duet_stitch",
    status: "idea",
    partner: { platform: "tiktok", niche: "Creator growth" },
    logged: -1,
    moved: -1,
  },
  {
    key: "declined-podcast",
    title: "Podcast swap",
    type: "guesting",
    status: "declined",
    partner: { name: "Kim Arceo", handle: "@marketing.kape", platform: "youtube", niche: "Marketing for cafés", followers: 12000 },
    logged: -60,
    moved: -50,
    notes: "They only do paid guest spots now. Revisit next year.",
  },
]
