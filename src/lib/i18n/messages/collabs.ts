/**
 * Labels for the Collab option lists, keyed by the stored value (`useT(collabStatusMessages)(collab.status)`).
 * `src/lib/constants.ts` builds COLLAB_STATUSES and COLLAB_TYPES from the English side, so the two never drift.
 */
import { defineMessages } from "../core"

export const collabStatusMessages = defineMessages({
  en: {
    idea: "Idea",
    reached_out: "Reached out",
    agreed: "Agreed",
    scheduled: "Scheduled",
    published: "Published",
    reviewed: "Reviewed",
    declined: "Declined",
  },
  tl: {
    idea: "Idea",
    reached_out: "Na-message na",
    agreed: "Pumayag",
    scheduled: "Naka-schedule",
    published: "Na-publish",
    reviewed: "Na-review",
    declined: "Hindi natuloy",
  },
})

export const collabStatusDescriptionMessages = defineMessages({
  en: {
    idea: "A collab you'd like to do — nobody contacted yet.",
    reached_out: "You sent a message and are waiting for a reply.",
    agreed: "They said yes — agree on the format and the date.",
    scheduled: "The date is set — prepare your part.",
    published: "It's live — log analytics on your posts, then rate it.",
    reviewed: "Results checked and rated.",
    declined: "Didn't happen — kept for the history.",
  },
  tl: {
    idea: "Collab na gusto mong gawin — wala pang kinokontak.",
    reached_out: "Na-message mo na at hinihintay ang reply.",
    agreed: "Pumayag sila — pag-usapan na ang format at ang date.",
    scheduled: "May date na — ihanda ang part mo.",
    published: "Live na — i-log ang analytics ng posts mo, tapos i-rate.",
    reviewed: "Na-check at na-rate na ang results.",
    declined: "Hindi natuloy — naka-keep para sa history.",
  },
})

export const collabTypeMessages = defineMessages({
  en: {
    duet_stitch: "Duet / Stitch",
    guesting: "Guesting",
    joint_live: "Joint Live",
    shoutout_swap: "Shoutout swap",
    giveaway: "Giveaway",
    co_created: "Co-created post",
    group_brand_deal: "Group brand deal",
    other: "Other",
  },
  tl: {
    duet_stitch: "Duet / Stitch",
    guesting: "Guesting",
    joint_live: "Joint Live",
    shoutout_swap: "Shoutout swap",
    giveaway: "Giveaway",
    co_created: "Co-created post",
    group_brand_deal: "Group brand deal",
    other: "Iba pa",
  },
})

export const collabTypeDescriptionMessages = defineMessages({
  en: {
    duet_stitch: "React to or build on each other's videos — TikTok duets and stitches, Reels remixes.",
    guesting: "Be a guest on their podcast, show or series — or have them on yours.",
    joint_live: "Go live together on Facebook, Instagram, TikTok or YouTube.",
    shoutout_swap: "Recommend each other to your audiences.",
    giveaway: "Run one giveaway together so both audiences join.",
    co_created: "Make one post, carousel or video together and both publish it.",
    group_brand_deal: "A brand hires you with other creators for one campaign.",
    other: "Any other way of working together.",
  },
  tl: {
    duet_stitch: "Mag-react o mag-build sa video ng isa't isa — TikTok duet at stitch, Reels remix.",
    guesting: "Mag-guest sa podcast, show o series nila — o i-guest mo sila sa iyo.",
    joint_live: "Mag-Live nang sabay sa Facebook, Instagram, TikTok o YouTube.",
    shoutout_swap: "I-recommend ang isa't isa sa audience ninyo.",
    giveaway: "Isang giveaway nang magkasama para sumali ang parehong audience.",
    co_created: "Gumawa ng isang post, carousel o video nang magkasama at pareho ninyong i-publish.",
    group_brand_deal: "Kinuha kayo ng isang brand kasama ang ibang creators para sa isang campaign.",
    other: "Ibang paraan ng pag-collab.",
  },
})
