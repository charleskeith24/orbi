import { defineMessages } from "@/lib/i18n/core"

/** Settings → Funnel. Stage names (TOFU / MOFU / BOFU, Awareness…) come from constants and stay English. */
export const funnelMessages = defineMessages({
  en: {
    saved: "Funnel targets saved",
    mix_title: "Target mix",
    mix_description:
      "What share of your content should serve each stage. Content Funnel, the dashboard and AI recommendations compare your recent mix with these targets.",
    total: "Total {total}%",
    must_total: "Targets must add up to 100%.",
    normalize: "Normalize to 100%",
    preview_title: "Last 30 days vs target",
    preview_saved: "Showing your saved targets until the edited ones add up to 100%.",
    preview_live: "Published and upcoming content with a funnel stage, against the targets above.",
    value_label: "Posts",
    preview_empty: "No content with a funnel stage in the last 30 days.",
    preview_aria: "Funnel mix in the last 30 days against targets",
    within_tolerance: "Within tolerance of every target",
    too_little: "Too little recent content to judge the mix yet.",
    unassigned_one: "{count} item in this window has no funnel stage —",
    unassigned_other: "{count} items in this window have no funnel stage —",
    assign_stages: "assign stages",
  },
  tl: {
    saved: "Na-save ang funnel targets",
    mix_title: "Target mix",
    mix_description:
      "Ilang bahagi ng content mo para sa bawat stage. Ikinukumpara ng Content Funnel, dashboard at AI recommendations ang recent mix mo sa mga target na ito.",
    total: "Total {total}%",
    must_total: "Dapat 100% ang total ng targets.",
    normalize: "I-normalize sa 100%",
    preview_title: "Huling 30 araw vs target",
    preview_saved: "Ipinapakita ang naka-save na targets hanggang 100% ang total ng mga binago.",
    preview_live: "Published at paparating na content na may funnel stage, laban sa targets sa itaas.",
    value_label: "Posts",
    preview_empty: "Walang content na may funnel stage sa huling 30 araw.",
    preview_aria: "Funnel mix sa huling 30 araw laban sa targets",
    within_tolerance: "Nasa tolerance ng bawat target",
    too_little: "Kulang pa ang recent content para i-check ang mix.",
    unassigned_one: "{count} item sa window na ito ay walang funnel stage —",
    unassigned_other: "{count} items sa window na ito ay walang funnel stage —",
    assign_stages: "i-assign ang stages",
  },
})
