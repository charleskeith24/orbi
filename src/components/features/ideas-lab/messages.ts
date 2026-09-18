/**
 * Words shared by the Idea Generator, Hook Library and Angle Library: AI errors, the clipboard helper,
 * relative times, performance stats and metric labels. Screen-specific strings live in
 * `generator-messages.ts`, `hook-messages.ts` and `angle-messages.ts`.
 */
import { defineMessages } from "@/lib/i18n/core"

export const labMessages = defineMessages({
  en: {
    couldnt_generate: "Couldn't generate",
    retry: "Retry",
    dismiss: "Dismiss",
    undo: "Undo",
    copied_to_clipboard: "Copied to clipboard",
    couldnt_copy: "Couldn't copy",
    copy_manually: "Select the text and copy it manually.",
    untitled_idea: "Untitled idea",
    untitled_content: "Untitled content",

    // timeAgo
    just_now: "just now",
    minutes_ago: "{count} min ago",
    hours_ago: "{count} h ago",
    yesterday: "yesterday",
    days_ago: "{count} days ago",

    // Sorts
    sort_performance: "Best performing",
    sort_uses: "Most used",
    sort_newest: "Newest",
    sort_az: "A–Z",

    // Metrics
    metric_views: "Views",
    metric_views_description: "Average views per post",
    metric_retention: "Retention",
    metric_retention_description: "Average retention of video posts",
    metric_engagement: "Engagement",
    metric_engagement_description: "Engagements ÷ reach",
    metric_leads: "Leads",
    metric_leads_description: "Average leads per post",
    analytics_scope: "{description} · published posts with analytics, all time",

    // Performance stats (hook and angle sheets, charts)
    performance: "Performance",
    posts: "Posts",
    posts_count_one: "{count} post",
    posts_count_other: "{count} posts",
    with_analytics: "{count} with analytics",
    avg_views: "Avg views",
    vs_average: "{multiple} your average",
    engagement: "Engagement",
    average_rate: "Average {rate}",
    leads_per_post: "Leads / post",
    retention: "Retention",
    winners: "Winners",
    winner_or_breakout: "Winner or Breakout",
    used_in: "Used in",
    idea: "Idea",
    and_more: "and {count} more",
  },
  tl: {
    couldnt_generate: "Hindi na-generate",
    retry: "Subukan ulit",
    dismiss: "I-dismiss",
    undo: "I-undo",
    copied_to_clipboard: "Na-copy sa clipboard",
    couldnt_copy: "Hindi na-copy",
    copy_manually: "Piliin ang text at i-copy nang manual.",
    untitled_idea: "Idea na walang title",
    untitled_content: "Content na walang title",

    just_now: "ngayon",
    minutes_ago: "{count} min na nakaraan",
    hours_ago: "{count} oras na nakaraan",
    yesterday: "kahapon",
    days_ago: "{count} araw na nakaraan",

    sort_performance: "Pinaka-effective",
    sort_uses: "Pinakaginagamit",
    sort_newest: "Pinakabago",
    sort_az: "A–Z",

    metric_views: "Views",
    metric_views_description: "Average views bawat post",
    metric_retention: "Retention",
    metric_retention_description: "Average retention ng video posts",
    metric_engagement: "Engagement",
    metric_engagement_description: "Engagements ÷ reach",
    metric_leads: "Leads",
    metric_leads_description: "Average leads bawat post",
    analytics_scope: "{description} · published posts na may analytics, all time",

    performance: "Performance",
    posts: "Posts",
    posts_count_one: "{count} post",
    posts_count_other: "{count} posts",
    with_analytics: "{count} may analytics",
    avg_views: "Avg views",
    vs_average: "{multiple} ng average mo",
    engagement: "Engagement",
    average_rate: "Average {rate}",
    leads_per_post: "Leads / post",
    retention: "Retention",
    winners: "Winners",
    winner_or_breakout: "Winner o Breakout",
    used_in: "Ginamit sa",
    idea: "Idea",
    and_more: "at {count} pa",
  },
})
