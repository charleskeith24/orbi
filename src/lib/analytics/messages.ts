/**
 * User-facing sentences produced by the analytics engine, in English and Taglish (ARCHITECTURE §11).
 * Pure: imports the i18n core only, so lib, server and test code can use it.
 *
 * Functions that return user-facing text take an optional language — English is the default, so a call
 * without it returns exactly the English it always did. React callers pass `useUiLang()` from "@/lib/i18n";
 * AI inputs keep English.
 *
 *   health.ts           contentHealthScore(db, now, settings, lang)    component labels + details, band label
 *                       healthBand(score, lang) · healthComponentLabel(key, lang) (new)
 *   balance.ts          pillarMix(db, now, settings, { lang })          warnings[].message
 *                       funnelMix(db, now, settings, { lang })          warnings[].message
 *   pipeline.ts         contentBuffer(db, now, settings, lang)          label
 *                       bufferStatusLabel(status, lang) (new — BUFFER_STATUS_LABELS stays English)
 *   experiments.ts      experimentResults(db, experiment, lang)         reason
 *   aggregates.ts       groupByPillar(db, rows, lang)                   "No pillar" row label
 *                       groupByFormat(db, rows, lang)                   "No format"
 *                       groupByHookCategory(rows, lang)                 "No hook style"
 *                       groupByFunnel(rows, lang)                       "Unassigned"
 *                       pillarPerformance / formatPerformance / hookCategoryPerformance / funnelPerformance
 *                         (db, now, { lang })                           same labels, via AggregateOptions.lang
 *   reports.ts          bestGroup(groups, metric, lang)                 metricLabel
 *                       weeklyReport(db, weekStart, settings, now, lang) · monthlyReport(db, monthStart, settings, now, lang)
 *   recommendations.ts  recommendNextContent(db, now, settings, { lang })  reasons + signals
 *                       strategicInsights(db, now, settings, lang)      insight text
 *
 * Option labels from constants (platforms, hook styles, stages, statuses, funnel stages, weekdays) and user
 * data (pillar, format and angle names, titles) stay as they are in both languages.
 */
import { defineMessages } from "@/lib/i18n/core"

export const healthMessages = defineMessages({
  en: {
    label_consistency: "Posting consistency",
    label_balance: "Pillar balance",
    label_engagement: "Engagement trend",
    label_completion: "Content completion",
    label_repurposing: "Repurposing",
    label_backlog: "Content Buffer",
    band_good: "Healthy Content System",
    band_warning: "Stable — Needs Attention",
    band_serious: "At Risk",
    band_critical: "Critical",
    consistency_none: "No posts published yet — consistency starts with your first post",
    consistency_first_week: "First week of publishing — no completed week to judge yet",
    consistency_weeks_one: "{consistent} of the last {count} week reached 80% of your {target}-post target",
    consistency_weeks_other: "{consistent} of the last {count} weeks reached 80% of your {target}-post target",
    balance_no_pillars: "No active pillars yet — define pillars to track balance",
    balance_few_one: "Only {count} post with a pillar in the last 30 days — not enough to judge balance",
    balance_few_other: "Only {count} posts with a pillar in the last 30 days — not enough to judge balance",
    balance_more: "{message} (+{count} more)",
    balance_ok: "All {count} pillars within target range over the last 30 days",
    engagement_not_enough: "Not enough measured posts to compare (needs 2+ in the last 30 days and in the 90 days before)",
    engagement_detail: "Last 30 days: {current} engagement vs {previous} in the 90 days before ({multiple})",
    completion_none: "No production deadlines in the last 14 days",
    completion_late_one: "{count} of {total} items due in the last 14 days is overdue",
    completion_late_other: "{count} of {total} items due in the last 14 days are overdue",
    completion_ok_one: "All {count} item due in the last 14 days is on track",
    completion_ok_other: "All {count} items due in the last 14 days are on track",
    repurposing_none: "No winners in the last 60 days yet — nothing to repurpose",
    repurposing_detail_one: "{done} of {count} winner from the last 60 days repurposed",
    repurposing_detail_other: "{done} of {count} winners from the last 60 days repurposed",
    backlog_ready: "{days} days of ready content vs a {target}-day target ({ready} ready to publish)",
    backlog_empty: "Nothing is ready to post — target is {target} days of content",
  },
  tl: {
    label_consistency: "Consistency sa pag-post",
    label_balance: "Balance ng pillars",
    label_engagement: "Engagement trend",
    label_completion: "Pagtapos ng content",
    label_repurposing: "Repurposing",
    label_backlog: "Content Buffer",
    band_good: "Healthy na Content System",
    band_warning: "Stable — pero kailangan ng atensyon",
    band_serious: "Delikado",
    band_critical: "Critical",
    consistency_none: "Wala pang na-publish na post — nagsisimula ang consistency sa una mong post",
    consistency_first_week: "Unang linggo ng pag-publish — wala pang buong linggo para i-judge",
    consistency_weeks_one: "{consistent} sa huling {count} linggo ay umabot sa 80% ng {target}-post target mo",
    consistency_weeks_other: "{consistent} sa huling {count} linggo ay umabot sa 80% ng {target}-post target mo",
    balance_no_pillars: "Wala pang active na pillars — gumawa ng pillars para i-track ang balance",
    balance_few_one: "{count} post na lang na may pillar sa huling 30 araw — hindi pa enough para i-judge ang balance",
    balance_few_other: "{count} posts na lang na may pillar sa huling 30 araw — hindi pa enough para i-judge ang balance",
    balance_more: "{message} (+{count} pa)",
    balance_ok: "Nasa target range ang {count} pillars sa huling 30 araw",
    engagement_not_enough: "Hindi pa enough ang measured posts para ikumpara (kailangan 2+ sa huling 30 araw at sa 90 araw bago nito)",
    engagement_detail: "Huling 30 araw: {current} engagement vs {previous} sa 90 araw bago nito ({multiple})",
    completion_none: "Walang production deadline sa huling 14 araw",
    completion_late_one: "{count} sa {total} items na due sa huling 14 araw ay overdue",
    completion_late_other: "{count} sa {total} items na due sa huling 14 araw ay overdue",
    completion_ok_one: "On track ang {count} item na due sa huling 14 araw",
    completion_ok_other: "On track ang {count} items na due sa huling 14 araw",
    repurposing_none: "Wala pang winners sa huling 60 araw — walang ma-repurpose",
    repurposing_detail_one: "{done} sa {count} winner mula sa huling 60 araw ay na-repurpose",
    repurposing_detail_other: "{done} sa {count} winners mula sa huling 60 araw ay na-repurpose",
    backlog_ready: "{days} araw ng ready na content vs {target}-day target ({ready} ready na i-publish)",
    backlog_empty: "Walang ready na i-post — target ay {target} araw ng content",
  },
})

export const mixMessages = defineMessages({
  en: {
    warning_under: "{label} is at {actual}% vs a {target}% target — under-represented",
    warning_over: "{label} is at {actual}% vs a {target}% target — over-represented",
    buffer_healthy: "Healthy",
    buffer_ok: "OK",
    buffer_low: "Content Buffer Low",
  },
  tl: {
    warning_under: "{label} ay nasa {actual}% vs {target}% target — kulang sa mix",
    warning_over: "{label} ay nasa {actual}% vs {target}% target — sobra sa mix",
    buffer_healthy: "Healthy",
    buffer_ok: "OK",
    buffer_low: "Low ang Content Buffer",
  },
})

export const experimentMessages = defineMessages({
  en: {
    needs_posts: "Needs at least {min} measured posts per variant (A has {a}, B has {b})",
    zero_baseline: "Variant A averages 0 {metric}, so lift can't be computed",
    too_close: "B is within {min}% of A ({lift}%) — too close to call",
    b_wins: "B beat A by {lift}% on {metric}",
    a_wins: "A beat B — B averaged {lift}% lower {metric}",
  },
  tl: {
    needs_posts: "Kailangan ng at least {min} measured posts kada variant (A ay may {a}, B ay may {b})",
    zero_baseline: "Ang average ng Variant A ay 0 {metric}, so hindi ma-compute ang lift",
    too_close: "Ang B ay within {min}% ng A ({lift}%) — sobrang dikit, hindi pa malinaw",
    b_wins: "Nanalo ang B vs A ng {lift}% sa {metric}",
    a_wins: "Nanalo ang A vs B — {lift}% mas mababa ang {metric} ng B",
  },
})

export const aggregateMessages = defineMessages({
  en: {
    no_pillar: "No pillar",
    no_format: "No format",
    no_hook_style: "No hook style",
    unassigned: "Unassigned",
    metric_views: "avg. views",
    metric_engagement_rate: "engagement rate",
    metric_engagements: "avg. engagements",
    metric_leads: "leads per post",
    metric_baseline: "× platform baseline",
  },
  tl: {
    no_pillar: "Walang pillar",
    no_format: "Walang format",
    no_hook_style: "Walang hook style",
    unassigned: "Walang stage",
    metric_views: "avg. views",
    metric_engagement_rate: "engagement rate",
    metric_engagements: "avg. engagements",
    metric_leads: "leads kada post",
    metric_baseline: "× platform baseline",
  },
})

export const recommendationMessages = defineMessages({
  en: {
    today: "Today",
    pattern_hooks_platform: "Your last {count} winners used {hooks} on {platform}",
    pattern_hooks: "Your last {count} winners used {hooks}",
    pattern_platform: "Your last {count} winners were on {platform}",
    pattern_some_hooks: "{some} of your last {count} winners used {hooks}",
    hooks: "{style} hooks",
    status_idea: "{status} idea in your Idea Bank",
    status_item: "Already in {stage} — no date yet",
    pillar_empty: "No {pillar} posts in the last 30 days — target is {target}%",
    pillar_under: "{pillar} is {points} points under target over the last 30 days",
    slot_is: "{day}'s slot is {slot}",
    score_high: "{score} — high priority",
    asked: "Asked {count}× in your Question Bank",
    problem: "Solves a severity {severity}/5 audience problem: “{problem}”",
    trait_pillar: "pillar",
    trait_hook: "hook style",
    trait_topic: "topic",
    trait_join: " and ",
    same_traits: "Same {traits} as your winner “{title}”",
    platform_average: "{platform} posts average {multiple} your overall views",
    hook_suggestion: "Suggested hook: {style} hooks average {multiple} your views",
    when_today: "today",
    when_yesterday: "yesterday",
    when_days_ago: "{count} days ago",
    close_to: "Close to “{title}”, published {when}",
    multiple_suffix: " ({multiple} your overall views)",
    platform_slot: "{day}'s slot includes {platform}",
    platform_filtered: "Filtered to {platform}",
    platform_planned: "Planned for {platform}{suffix}",
    platform_performance: "{platform} averages {multiple} your overall views",
    platform_strategy: "{platform} is one of your active platforms",
    platform_default: "No platform set — defaulting to {platform}",
    this_format: "this format",
    format_slot: "{day}'s slot calls for {format}",
    format_best: "{format} is your best format on {platform} ({multiple} views)",
    format_planned: "Planned as {format}",
    format_best_average: "{format} posts average {multiple} your {platform} views",
    format_none: "No format set yet",
    angle_uses: "Uses the “{angle}” angle",
    angle_uses_average: "Uses the “{angle}” angle — averages {multiple} your views",
    angle_best: "“{angle}” posts average {multiple} your views",
    angle_none: "No angle set yet",
  },
  tl: {
    today: "Ngayon",
    pattern_hooks_platform: "Ang huling {count} winners mo ay gumamit ng {hooks} sa {platform}",
    pattern_hooks: "Ang huling {count} winners mo ay gumamit ng {hooks}",
    pattern_platform: "Ang huling {count} winners mo ay nasa {platform}",
    pattern_some_hooks: "{some} sa huling {count} winners mo ay gumamit ng {hooks}",
    hooks: "{style} hooks",
    status_idea: "{status} na idea sa Idea Bank mo",
    status_item: "Nasa {stage} na — wala pang date",
    pillar_empty: "Walang {pillar} posts sa huling 30 araw — target ay {target}%",
    pillar_under: "Kulang ng {points} points ang {pillar} vs target sa huling 30 araw",
    slot_is: "Slot ng {day}: {slot}",
    score_high: "{score} — dapat unahin",
    asked: "Itinanong {count}× sa Question Bank mo",
    problem: "Sinasagot ang severity {severity}/5 na audience problem: “{problem}”",
    trait_pillar: "pillar",
    trait_hook: "hook style",
    trait_topic: "topic",
    trait_join: " at ",
    same_traits: "Parehong {traits} ng winner mo na “{title}”",
    platform_average: "Ang {platform} posts ay average {multiple} ng overall views mo",
    hook_suggestion: "Suggested hook: ang {style} hooks ay average {multiple} ng views mo",
    when_today: "ngayon",
    when_yesterday: "kahapon",
    when_days_ago: "{count} araw ang nakalipas",
    close_to: "Kahawig ng “{title}”, na-publish {when}",
    multiple_suffix: " ({multiple} ng overall views mo)",
    platform_slot: "Kasama ang {platform} sa slot ng {day}",
    platform_filtered: "Naka-filter sa {platform}",
    platform_planned: "Naka-plan para {platform}{suffix}",
    platform_performance: "Ang {platform} ay average {multiple} ng overall views mo",
    platform_strategy: "Ang {platform} ay isa sa active platforms mo",
    platform_default: "Walang platform — default sa {platform}",
    this_format: "format na 'to",
    format_slot: "Ang slot ng {day} ay para sa {format}",
    format_best: "{format} ang best format mo sa {platform} ({multiple} views)",
    format_planned: "Naka-plan bilang {format}",
    format_best_average: "Ang {format} posts ay average {multiple} ng {platform} views mo",
    format_none: "Wala pang format",
    angle_uses: "Gumagamit ng “{angle}” angle",
    angle_uses_average: "Gumagamit ng “{angle}” angle — average {multiple} ng views mo",
    angle_best: "Ang “{angle}” posts ay average {multiple} ng views mo",
    angle_none: "Wala pang angle",
  },
})

export const insightMessages = defineMessages({
  en: {
    buffer_low: "Buffer is {days} days — below your {target}-day target",
    buffer_empty: "Nothing is ready to post — your {target}-day buffer is empty",
    pace_one: "{published} of {target} posts out this week{scheduled} — {gap} more needed with {count} day left",
    pace_other: "{published} of {target} posts out this week{scheduled} — {gap} more needed with {count} days left",
    pace_scheduled: " (+{count} scheduled)",
    overdue_one: "{count} item is overdue — reschedule or cut it",
    overdue_other: "{count} items are overdue — reschedule or cut them",
    review_queue: "{count} items are waiting for review — approve them to refill the buffer",
    engagement_down: "Engagement rate is down {change}% over the last 30 days vs the 90 days before ({current} vs {previous})",
    engagement_up: "Engagement rate is up {change}% over the last 30 days vs the 90 days before — keep this mix going",
    pillar_double_down: "{best} posts average {multiple} the views of {worst} — make more of them",
    repurpose_one: "{count} winner hasn't been repurposed yet",
    repurpose_other: "{count} winners haven't been repurposed yet",
    recent_winner: "“{title}” hit {multiple} your {platform} average — make a follow-up",
    hook_style: "{style} hooks average {multiple} your overall views — use them more",
    format: "{format} posts average {multiple} your overall views",
    platform: "{platform} engagement rate is {multiple} your average ({rate}) — prioritise it",
    questions_one: "{count} audience question asked 3+ times has no content yet",
    questions_other: "{count} audience questions asked 3+ times have no content yet",
    ideas_few_one: "Only {count} validated idea left — run the Idea Generator",
    ideas_few_other: "Only {count} validated ideas left — run the Idea Generator",
    ideas_none: "No validated ideas in the Idea Bank — run the Idea Generator",
  },
  tl: {
    buffer_low: "{days} araw ang buffer — mas mababa sa {target}-day target mo",
    buffer_empty: "Walang ready na i-post — empty ang {target}-day buffer mo",
    pace_one: "{published} sa {target} posts na-publish this week{scheduled} — {gap} pa ang kailangan, {count} araw na natitira",
    pace_other: "{published} sa {target} posts na-publish this week{scheduled} — {gap} pa ang kailangan, {count} araw na natitira",
    pace_scheduled: " (+{count} naka-schedule)",
    overdue_one: "{count} item ay overdue — i-reschedule o i-cut",
    overdue_other: "{count} items ay overdue — i-reschedule o i-cut",
    review_queue: "{count} items ay naghihintay ng review — i-approve para mapunan ang buffer",
    engagement_down: "Down {change}% ang engagement rate sa huling 30 araw vs 90 araw bago nito ({current} vs {previous})",
    engagement_up: "Up {change}% ang engagement rate sa huling 30 araw vs 90 araw bago nito — ipagpatuloy ang mix na 'to",
    pillar_double_down: "Ang {best} posts ay average {multiple} ng views ng {worst} — gumawa ng mas marami",
    repurpose_one: "{count} winner ay hindi pa na-repurpose",
    repurpose_other: "{count} winners ay hindi pa na-repurpose",
    recent_winner: "“{title}” ay umabot ng {multiple} ng {platform} average mo — gumawa ng follow-up",
    hook_style: "Ang {style} hooks ay average {multiple} ng overall views mo — gamitin nang mas madalas",
    format: "Ang {format} posts ay average {multiple} ng overall views mo",
    platform: "Ang engagement rate sa {platform} ay {multiple} ng average mo ({rate}) — i-prioritize",
    questions_one: "{count} audience question na itinanong 3+ beses ay wala pang content",
    questions_other: "{count} audience questions na itinanong 3+ beses ay wala pang content",
    ideas_few_one: "{count} validated idea na lang — i-run ang Idea Generator",
    ideas_few_other: "{count} validated ideas na lang — i-run ang Idea Generator",
    ideas_none: "Walang validated ideas sa Idea Bank — i-run ang Idea Generator",
  },
})
