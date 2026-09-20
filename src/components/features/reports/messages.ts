/**
 * Shared by the Weekly Report and the Monthly Review: period picker, post cards and table, content mix, review status
 * and history, AI error notice and the count phrases. Weekly-only text is in `weekly-messages.ts`, monthly-only text in
 * `monthly-messages.ts`. Metric names (Views, Leads, Eng. rate…), tier names, date labels and AI drafts stay English.
 */
import { defineMessages } from "@/lib/i18n/core"

export const reportMessages = defineMessages({
  en: {
    // Period picker and hints
    prev_week: "Previous week",
    choose_week: "Choose week",
    next_week: "Next week",
    prev_month: "Previous month",
    choose_month: "Choose month",
    next_month: "Next month",
    this_week: "This week",
    last_week: "Last week",
    this_month: "This month",
    last_month: "Last month",
    hint_reviewed: "Reviewed",
    hint_draft: "Draft",
    hint_planned: "Planned",

    // Header and shared actions
    print: "Print",
    highest_by: "Highest by {metric}",
    no_analytics_yet: "No analytics logged yet",
    add_analytics: "Add analytics",
    log_post: "Log a published post",
    published_show_here: "Published posts and their numbers show up here.",
    saved_reviews: "Saved reviews",
    no_saved_reviews: "No saved reviews yet",

    // Counts
    posts_one: "{count} post",
    posts_other: "{count} posts",
    sales_one: "{count} sale",
    sales_other: "{count} sales",
    leads_one: "{count} lead",
    leads_other: "{count} leads",

    // Post summary and table
    untitled_content: "Untitled content",
    views: "Views",
    eng_rate: "Eng. rate",
    leads: "Leads",
    vs_baseline: "vs baseline",
    hook: "Hook",
    rank: "Rank",
    content: "Content",
    tier_or_action: "Tier or action",
    open_in_studio: "Open {title} in Content Studio",
    content_lower: "content",

    // Content mix
    on_target: "on target",
    points: "{sign}{count} pts",
    col_segment: "Segment",
    col_posts: "Posts",
    col_actual: "Actual",
    col_target: "Target",
    col_vs_target: "vs target",
    row_pillar: "Pillar · {label}",
    row_funnel: "Funnel · {label}",
    pillars: "Pillars",
    without_pillar: "{count} without a pillar",
    no_pillar_posts: "No posts with a pillar in this period.",
    pillar_mix_aria: "Pillar mix vs targets",
    funnel: "Funnel",
    without_stage: "{count} without a stage",
    no_funnel_posts: "No posts with a funnel stage in this period.",
    funnel_mix_aria: "Funnel mix vs targets",
    mix_warnings: "Mix warnings",
    warning_sr: "Warning: ",
    mix_ok: "Pillar and funnel mix are within tolerance of your targets.",
    mix_min: "Mix warnings appear once at least {min} posts are counted.",

    // Review status
    status_final: "Final",
    status_final_title: "Saved as final",
    status_draft: "Draft",
    status_draft_title: "Saved as a draft",
    status_plan: "Plan only",
    status_plan_title: "Planned in the Weekly Planner — no review written yet",
    status_unsaved: "Not saved",
    status_unsaved_title: "No saved review for this period yet",

    // Review editors (weekly and monthly)
    replace: "Replace",
    saved_final: "Final review saved for {period}",
    saved_draft: "Draft review saved for {period}",
    unsaved_changes: "Unsaved changes.",
    not_saved_yet: "Not saved yet.",
    saved_as_draft: "Saved as a draft.",
    regenerate: "Regenerate",
    draft_with_ai: "Draft with AI",
    saved_at: "Saved {date}",
    save_as: "Save as",
    draft: "Draft",
    final: "Final",
    save_as_final: "Save as final",
    save_draft: "Save draft",

    // AI error notice
    ai_error_title: "Couldn't generate the draft.",
    retry: "Retry",
  },
  tl: {
    // Period picker and hints
    prev_week: "Nakaraang linggo",
    choose_week: "Pumili ng linggo",
    next_week: "Susunod na linggo",
    prev_month: "Nakaraang buwan",
    choose_month: "Pumili ng buwan",
    next_month: "Susunod na buwan",
    this_week: "Linggong 'to",
    last_week: "Nakaraang linggo",
    this_month: "Buwang 'to",
    last_month: "Nakaraang buwan",
    hint_reviewed: "Na-review",
    hint_draft: "Draft",
    hint_planned: "Naka-plan",

    // Header and shared actions
    print: "I-print",
    highest_by: "Pinakamataas sa {metric}",
    no_analytics_yet: "Wala pang naka-log na analytics",
    add_analytics: "Magdagdag ng analytics",
    log_post: "I-log ang na-publish na post",
    published_show_here: "Dito makikita ang published posts at ang numbers nito.",
    saved_reviews: "Mga naka-save na review",
    no_saved_reviews: "Wala pang naka-save na review",

    // Counts
    posts_one: "{count} post",
    posts_other: "{count} posts",
    sales_one: "{count} sale",
    sales_other: "{count} sales",
    leads_one: "{count} lead",
    leads_other: "{count} leads",

    // Post summary and table
    untitled_content: "Content na walang title",
    views: "Views",
    eng_rate: "Eng. rate",
    leads: "Leads",
    vs_baseline: "vs baseline",
    hook: "Hook",
    rank: "Rank",
    content: "Content",
    tier_or_action: "Tier o action",
    open_in_studio: "Buksan ang {title} sa Content Studio",
    content_lower: "content",

    // Content mix
    on_target: "on target",
    points: "{sign}{count} pts",
    col_segment: "Segment",
    col_posts: "Posts",
    col_actual: "Actual",
    col_target: "Target",
    col_vs_target: "vs target",
    row_pillar: "Pillar · {label}",
    row_funnel: "Funnel · {label}",
    pillars: "Pillars",
    without_pillar: "{count} walang pillar",
    no_pillar_posts: "Walang posts na may pillar sa period na 'to.",
    pillar_mix_aria: "Pillar mix vs targets",
    funnel: "Funnel",
    without_stage: "{count} walang stage",
    no_funnel_posts: "Walang posts na may funnel stage sa period na 'to.",
    funnel_mix_aria: "Funnel mix vs targets",
    mix_warnings: "Mga mix warning",
    warning_sr: "Warning: ",
    mix_ok: "Ang pillar at funnel mix ay nasa loob ng tolerance ng targets mo.",
    mix_min: "Lalabas ang mix warnings kapag at least {min} posts ang nabilang.",

    // Review status
    status_final: "Final",
    status_final_title: "Naka-save bilang final",
    status_draft: "Draft",
    status_draft_title: "Naka-save bilang draft",
    status_plan: "Plan lang",
    status_plan_title: "Naka-plan sa Weekly Planner — wala pang review",
    status_unsaved: "Hindi naka-save",
    status_unsaved_title: "Wala pang naka-save na review para sa period na 'to",

    // Review editors (weekly and monthly)
    replace: "I-replace",
    saved_final: "Na-save ang final review para sa {period}",
    saved_draft: "Na-save ang draft review para sa {period}",
    unsaved_changes: "May changes na hindi naka-save.",
    not_saved_yet: "Hindi pa naka-save.",
    saved_as_draft: "Naka-save bilang draft.",
    regenerate: "I-regenerate",
    draft_with_ai: "I-draft gamit ang AI",
    saved_at: "Na-save {date}",
    save_as: "I-save bilang",
    draft: "Draft",
    final: "Final",
    save_as_final: "I-save bilang final",
    save_draft: "I-save ang draft",

    // AI error notice
    ai_error_title: "Hindi nagawa ang draft.",
    retry: "Subukan ulit",
  },
})
