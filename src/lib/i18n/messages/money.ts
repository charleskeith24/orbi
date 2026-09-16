/**
 * Labels for the Money option lists, keyed by the stored value so a component can write
 * `const s = useT(dealStatusMessages)` → `s(deal.status)`. `src/lib/constants.ts` builds DEAL_STATUSES,
 * DEAL_SOURCES, INCOME_SOURCES and INCOME_STATUSES from the English side, so the two never drift.
 */
import { defineMessages } from "../core"

export const dealStatusMessages = defineMessages({
  en: {
    lead: "Lead",
    pitched: "Pitched",
    negotiating: "Negotiating",
    contracted: "Contracted",
    in_progress: "In progress",
    delivered: "Delivered",
    paid: "Paid",
    lost: "Lost",
  },
  tl: {
    lead: "Lead",
    pitched: "Na-pitch",
    negotiating: "Nego",
    contracted: "May kontrata",
    in_progress: "Ginagawa",
    delivered: "Na-deliver",
    paid: "Bayad na",
    lost: "Hindi natuloy",
  },
})

export const dealStatusDescriptionMessages = defineMessages({
  en: {
    lead: "A brand reached out or you spotted a fit — nothing sent yet.",
    pitched: "You sent a pitch, rate card or media kit and are waiting to hear back.",
    negotiating: "Talking fee, deliverables, timeline and usage rights.",
    contracted: "Terms agreed in writing — the work is booked.",
    in_progress: "Creating the deliverables.",
    delivered: "Everything is posted or handed over; waiting for payment.",
    paid: "Payment received.",
    lost: "Didn't happen — keep it for the history and the lesson.",
  },
  tl: {
    lead: "May brand na nag-reach out o may nakita kang fit — wala pang na-send.",
    pitched: "Na-send mo na ang pitch, rate card o media kit — hinihintay ang reply.",
    negotiating: "Pinag-uusapan pa ang fee, deliverables, timeline at usage rights.",
    contracted: "May written na agreement na — booked na ang work.",
    in_progress: "Ginagawa na ang deliverables.",
    delivered: "Naka-post o na-hand over na lahat — hinihintay na lang ang bayad.",
    paid: "Nabayaran na.",
    lost: "Hindi natuloy — i-keep para sa history at sa lesson.",
  },
})

export const dealSourceMessages = defineMessages({
  en: { inbound: "Inbound", outbound: "Outbound pitch", agency: "Agency", referral: "Referral" },
  tl: { inbound: "Inbound", outbound: "Ikaw ang nag-pitch", agency: "Agency", referral: "Referral" },
})

export const incomeSourceMessages = defineMessages({
  en: {
    brand_deal: "Brand deal",
    affiliate: "Affiliate",
    platform_payout: "Platform payout",
    product: "Product sales",
    service: "Services",
    tip: "Tips & gifts",
    other: "Other",
  },
  tl: {
    brand_deal: "Brand deal",
    affiliate: "Affiliate",
    platform_payout: "Payout ng platform",
    product: "Benta ng product",
    service: "Services",
    tip: "Tips at gifts",
    other: "Iba pa",
  },
})

export const incomeStatusMessages = defineMessages({
  en: { expected: "Expected", received: "Received" },
  tl: { expected: "Hinihintay pa", received: "Natanggap na" },
})
