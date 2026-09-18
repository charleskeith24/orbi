import { defineMessages } from "@/lib/i18n/core"

/**
 * Built-in text of the shared building blocks in `src/components/common`. Callers still pass their own
 * labels as props; these are only the defaults and the chrome. Shared words (Cancel, Delete, Clear…)
 * come from `commonMessages`. Option labels from `src/lib/constants.ts` stay English.
 */

export const dataTableMessages = defineMessages({
  en: {
    select_all_rows: "Select all rows",
    select_row: "Select {label}",
    row: "row",
    no_results: "No results.",
    showing: "Showing {shown} of {total}",
  },
  tl: {
    select_all_rows: "Piliin ang lahat ng rows",
    select_row: "Piliin ang {label}",
    row: "row",
    no_results: "Walang resulta.",
    showing: "Ipinapakita ang {shown} ng {total}",
  },
})

export const filterMessages = defineMessages({
  en: {
    search_placeholder: "Search…",
    clear_search: "Clear search",
    selected: "{count} selected",
    no_results: "No results.",
    clear_filter: "Clear filter",
    reset: "Reset",
    options_label: "Suggestions",
  },
  tl: {
    search_placeholder: "I-search…",
    clear_search: "I-clear ang search",
    selected: "{count} napili",
    no_results: "Walang resulta.",
    clear_filter: "I-clear ang filter",
    reset: "I-reset",
    options_label: "Mga option",
  },
})

export const multiSelectMessages = defineMessages({
  en: {
    search_placeholder: "Search…",
    selected: "{count} selected",
    selected_of_max: "{count} / {max} selected",
    options_label: "Suggestions",
  },
  tl: {
    search_placeholder: "I-search…",
    selected: "{count} napili",
    selected_of_max: "{count} / {max} napili",
    options_label: "Mga option",
  },
})

/** Form field chrome: the screen-reader marker after a required field's label. */
export const formMessages = defineMessages({
  en: {
    required: "(required)",
  },
  tl: {
    required: "(kailangan)",
  },
})

export const listEditorMessages = defineMessages({
  en: {
    max_reached: "Maximum of {max} items reached.",
    chips_placeholder: "Type and press Enter",
    add_more: "Add more…",
    remove_named: "Remove {item}",
    lines_placeholder: "Add an item",
    item: "Item",
    new_item: "New {label} item",
    move_up: "Move item {n} up",
    move_down: "Move item {n} down",
    remove_item: "Remove item {n}",
  },
  tl: {
    max_reached: "Naabot na ang maximum na {max} items.",
    chips_placeholder: "I-type at pindutin ang Enter",
    add_more: "Magdagdag pa…",
    remove_named: "Tanggalin ang {item}",
    lines_placeholder: "Magdagdag ng item",
    item: "Item",
    new_item: "Bagong item sa {label}",
    move_up: "Itaas ang item {n}",
    move_down: "Ibaba ang item {n}",
    remove_item: "Tanggalin ang item {n}",
  },
})

export const selectMessages = defineMessages({
  en: {
    nothing_to_choose: "Nothing to choose from yet",
    untitled_pillar: "Untitled pillar",
    select_pillar: "Select pillar",
    no_pillar: "No pillar",
    empty_pillars: "No pillars yet — add them in Content Pillars.",
    untitled_persona: "Untitled persona",
    select_persona: "Select persona",
    no_persona: "No persona",
    empty_personas: "No personas yet — add them in Audience HQ.",
    untitled_problem: "Untitled problem",
    select_problem: "Select problem",
    no_problem: "No problem",
    empty_problems_persona: "No problems for this persona yet.",
    empty_problems: "The Problem Bank is empty.",
    untitled_goal: "Untitled goal",
    select_goal: "Select goal",
    no_goal: "No goal",
    empty_goals: "No goals yet — set them in Strategy → Goals.",
    untitled_format: "Untitled format",
    select_format: "Select format",
    no_format: "No format",
    empty_formats: "No formats in the library yet.",
    untitled_angle: "Untitled angle",
    select_angle: "Select angle",
    no_angle: "No angle",
    empty_angles: "The Angle Library is empty.",
    untitled_campaign: "Untitled campaign",
    select_campaign: "Select campaign",
    no_campaign: "No campaign",
    empty_campaigns: "No active campaigns.",
    untitled_series: "Untitled series",
    select_series: "Select series",
    no_series: "No series",
    empty_series: "No active series.",
    untitled_hook: "Untitled hook",
    select_hook: "Select hook",
    no_hook: "No hook",
    empty_hooks: "The Hook Library is empty.",
    select_platform: "Select platform",
    no_platform: "No platform",
    select_stage: "Select stage",
    priority: "Priority",
    funnel_stage: "Funnel stage",
    no_funnel_stage: "No funnel stage",
    hook_type: "Hook type",
    no_hook_type: "No hook type",
    status: "Status",
  },
  tl: {
    nothing_to_choose: "Wala pang mapagpipilian",
    untitled_pillar: "Pillar na walang pangalan",
    select_pillar: "Pumili ng pillar",
    no_pillar: "Walang pillar",
    empty_pillars: "Wala pang pillars — magdagdag sa Content Pillars.",
    untitled_persona: "Persona na walang pangalan",
    select_persona: "Pumili ng persona",
    no_persona: "Walang persona",
    empty_personas: "Wala pang personas — magdagdag sa Audience HQ.",
    untitled_problem: "Problem na walang detalye",
    select_problem: "Pumili ng problem",
    no_problem: "Walang problem",
    empty_problems_persona: "Wala pang problems para sa persona na 'to.",
    empty_problems: "Walang laman ang Problem Bank.",
    untitled_goal: "Goal na walang pangalan",
    select_goal: "Pumili ng goal",
    no_goal: "Walang goal",
    empty_goals: "Wala pang goals — i-set sa Strategy → Goals.",
    untitled_format: "Format na walang pangalan",
    select_format: "Pumili ng format",
    no_format: "Walang format",
    empty_formats: "Wala pang formats sa library.",
    untitled_angle: "Angle na walang pangalan",
    select_angle: "Pumili ng angle",
    no_angle: "Walang angle",
    empty_angles: "Walang laman ang Angle Library.",
    untitled_campaign: "Campaign na walang pangalan",
    select_campaign: "Pumili ng campaign",
    no_campaign: "Walang campaign",
    empty_campaigns: "Walang active na campaigns.",
    untitled_series: "Series na walang pangalan",
    select_series: "Pumili ng series",
    no_series: "Walang series",
    empty_series: "Walang active na series.",
    untitled_hook: "Hook na walang text",
    select_hook: "Pumili ng hook",
    no_hook: "Walang hook",
    empty_hooks: "Walang laman ang Hook Library.",
    select_platform: "Pumili ng platform",
    no_platform: "Walang platform",
    select_stage: "Pumili ng stage",
    priority: "Priority",
    funnel_stage: "Funnel stage",
    no_funnel_stage: "Walang funnel stage",
    hook_type: "Uri ng hook",
    no_hook_type: "Walang uri ng hook",
    status: "Status",
  },
})

export const datePickerMessages = defineMessages({
  en: {
    clear_date: "Clear date",
    pick_date: "Pick a date",
    pick_date_time: "Pick date & time",
  },
  tl: {
    clear_date: "I-clear ang petsa",
    pick_date: "Pumili ng petsa",
    pick_date_time: "Pumili ng petsa at oras",
  },
})

/** Tooltips and screen-reader text of the status badges. Stage / status / tier labels stay English. */
export const statusBadgeMessages = defineMessages({
  en: {
    priority_title: "{label} priority",
    not_enough_data: "Not enough data",
  },
  tl: {
    priority_title: "{label} priority",
    not_enough_data: "Hindi pa sapat ang data",
  },
})

/** Pipeline stage helper text (tooltip on `StageBadge`). English mirrors `PIPELINE_STAGES` descriptions. */
export const stageDescriptionMessages = defineMessages({
  en: {
    idea: "Raw ideas parked on the board",
    selected: "Chosen for production",
    brief: "Defining objective, audience and message",
    scripting: "Writing the script or copy",
    ready_for_production: "Script approved, ready to record or design",
    recording: "Being recorded / designed",
    editing: "In the edit",
    review: "Awaiting approval",
    revision: "Changes requested",
    ready_to_post: "Approved, not yet scheduled",
    scheduled: "Has a publish date and time",
    published: "Live on the platform",
    repurpose: "Published and queued for repurposing",
  },
  tl: {
    idea: "Mga raw idea na naka-park sa board",
    selected: "Napili para i-produce",
    brief: "Tinutukoy ang objective, audience at message",
    scripting: "Isinusulat ang script o copy",
    ready_for_production: "Approved ang script, ready para i-record o i-design",
    recording: "Nire-record / dine-design",
    editing: "Ine-edit",
    review: "Hinihintay ang approval",
    revision: "May hininging changes",
    ready_to_post: "Approved, hindi pa naka-schedule",
    scheduled: "May publish date at oras",
    published: "Live sa platform",
    repurpose: "Na-publish at naka-queue para i-repurpose",
  },
})

/** Idea status helper text (tooltip on `IdeaStatusBadge`). English mirrors `IDEA_STATUSES` descriptions. */
export const ideaStatusDescriptionMessages = defineMessages({
  en: {
    inbox: "Captured, not yet evaluated",
    researching: "Collecting examples, data or angles",
    validated: "Worth making — audience problem confirmed",
    selected: "Chosen for an upcoming slot",
    converted: "Turned into a content item",
    archived: "Parked or rejected",
  },
  tl: {
    inbox: "Na-capture, hindi pa sinusuri",
    researching: "Nangangalap ng examples, data o angles",
    validated: "Worth it na gawin — kumpirmado ang problem ng audience",
    selected: "Napili para sa paparating na slot",
    converted: "Ginawang content item",
    archived: "Naka-park o hindi tinuloy",
  },
})

/** Winner detection tier helper text (tooltip on `TierBadge`). English mirrors `PERFORMANCE_TIERS` descriptions. */
export const tierDescriptionMessages = defineMessages({
  en: {
    normal: "Performing around your usual level",
    good: "Clearly above your platform average",
    winner: "About double your platform average",
    breakout: "Three times or more your platform average",
  },
  tl: {
    normal: "Nasa karaniwang level mo",
    good: "Malinaw na mas mataas sa platform average mo",
    winner: "Mga doble ng platform average mo",
    breakout: "Tatlong beses o mas ng platform average mo",
  },
})

/** Funnel goal in the `FunnelBadge` tooltip. English mirrors `FUNNEL_STAGES` goals. */
export const funnelGoalMessages = defineMessages({
  en: {
    tofu: "Reach new audiences",
    mofu: "Build expertise and relationship",
    bofu: "Create an action",
  },
  tl: {
    tofu: "Maabot ang bagong audience",
    mofu: "Bumuo ng expertise at relationship",
    bofu: "Magpakilos ng action",
  },
})

export const entityBadgeMessages = defineMessages({
  en: {
    no_pillar: "No pillar",
    untitled_pillar: "Untitled pillar",
    no_persona: "No persona",
    untitled_persona: "Untitled persona",
    no_campaign: "No campaign",
    untitled_campaign: "Untitled campaign",
    remove_tag: "Remove tag {name}",
    and_more: "and {tags}",
    no_format: "No format",
  },
  tl: {
    no_pillar: "Walang pillar",
    untitled_pillar: "Pillar na walang pangalan",
    no_persona: "Walang persona",
    untitled_persona: "Persona na walang pangalan",
    no_campaign: "Walang campaign",
    untitled_campaign: "Campaign na walang pangalan",
    remove_tag: "Tanggalin ang tag {name}",
    and_more: "at {tags}",
    no_format: "Walang format",
  },
})

/** Content card: fallback title, owner and the date line (relative days come from `formatRelativeDay`). */
export const contentCardMessages = defineMessages({
  en: {
    untitled_content: "Untitled content",
    owner: "Owner: {owner}",
    published_at: "Published {date}",
    overdue_by_one: "Overdue by {count} day",
    overdue_by_other: "Overdue by {count} days",
    was_scheduled: "Was scheduled {date}",
    was_due: "Was due {date}",
    scheduled_at: "Scheduled {date}",
    due: "Due {when}",
    due_at: "Due {date}",
  },
  tl: {
    untitled_content: "Content na walang title",
    owner: "Owner: {owner}",
    published_at: "Na-publish {date}",
    overdue_by_one: "Overdue ng {count} araw",
    overdue_by_other: "Overdue ng {count} araw",
    was_scheduled: "Naka-schedule sana {date}",
    was_due: "Due noong {date}",
    scheduled_at: "Naka-schedule {date}",
    due: "Due {when}",
    due_at: "Due {date}",
  },
})

export const tagPickerMessages = defineMessages({
  en: {
    add_tag: "Add tag",
    edit_tags: "Edit tags",
    tag: "Tag",
    search_or_create: "Search or create…",
    no_matching: "No matching tags",
    no_tags_yet: "No tags yet — type to create one",
    tags: "Tags",
    create: "Create {tag}",
    options_label: "Suggestions",
  },
  tl: {
    add_tag: "Magdagdag ng tag",
    edit_tags: "I-edit ang tags",
    tag: "Tag",
    search_or_create: "I-search o gumawa…",
    no_matching: "Walang tag na tugma",
    no_tags_yet: "Wala pang tags — mag-type para gumawa",
    tags: "Tags",
    create: "Gumawa ng {tag}",
    options_label: "Mga option",
  },
})

export const inlineEditMessages = defineMessages({
  en: {
    untitled: "Untitled",
    text: "Text",
    click_to_edit: "Click to edit",
    edit_suffix: " (edit)",
  },
  tl: {
    untitled: "Walang title",
    text: "Text",
    click_to_edit: "I-click para i-edit",
    edit_suffix: " (i-edit)",
  },
})

export const copyButtonMessages = defineMessages({
  en: {
    copied_to_clipboard: "Copied to clipboard",
    copy_failed: "Couldn't copy",
    copy_failed_description: "Select the text and copy it manually.",
    copied: "Copied",
    copy_to_clipboard: "Copy to clipboard",
    copy: "Copy",
  },
  tl: {
    copied_to_clipboard: "Na-copy sa clipboard",
    copy_failed: "Hindi na-copy",
    copy_failed_description: "Piliin ang text at i-copy manually.",
    copied: "Na-copy",
    copy_to_clipboard: "I-copy sa clipboard",
    copy: "I-copy",
  },
})

/** AI affordances. Engine names (Claude, OpenAI) and "Offline templates" stay as product names. */
export const aiMessages = defineMessages({
  en: {
    generating: "Generating…",
    explain_anthropic: "Generated by Claude{model} through the server-side AI gateway, with your Brand HQ, audience, pillars and winners as context.",
    explain_openai: "Generated by OpenAI{model} through the server-side AI gateway.",
    explain_offline:
      "Offline templates: assembled locally from your Brand HQ, audience, pillars and winners — no AI model is involved. Set ANTHROPIC_API_KEY on the server to enable Claude.",
    explain_manual: "Written or edited by you.",
    offline_templates: "Offline templates",
    written_manually: "Written manually",
    notice: "AI output is a first draft — edit it until it sounds like you.",
  },
  tl: {
    generating: "Ginagawa…",
    explain_anthropic:
      "Ginawa ng Claude{model} gamit ang server-side AI gateway, na may Brand HQ, audience, pillars at winners mo bilang context.",
    explain_openai: "Ginawa ng OpenAI{model} gamit ang server-side AI gateway.",
    explain_offline:
      "Offline templates: pinagsama-sama dito sa device mula sa Brand HQ, audience, pillars at winners mo — walang AI model. I-set ang ANTHROPIC_API_KEY sa server para gamitin ang Claude.",
    explain_manual: "Sinulat o in-edit mo.",
    offline_templates: "Offline templates",
    written_manually: "Isinulat manually",
    notice: "First draft ang AI output — i-edit hanggang tunog ikaw.",
  },
})

export const statTileMessages = defineMessages({
  en: {
    up: "Up",
    down: "Down",
    no_change: "No change",
    status: "Status: {tone}",
    tone_good: "good",
    tone_warning: "needs attention",
    tone_serious: "at risk",
    tone_critical: "critical",
  },
  tl: {
    up: "Tumaas",
    down: "Bumaba",
    no_change: "Walang pagbabago",
    status: "Status: {tone}",
    tone_good: "okay",
    tone_warning: "kailangan ng pansin",
    tone_serious: "at risk",
    tone_critical: "critical",
  },
})

export const meterMessages = defineMessages({
  en: {
    score: "Score",
    not_scored: "Not scored",
    out_of_100: "{score} out of 100",
  },
  tl: {
    score: "Score",
    not_scored: "Walang score",
    out_of_100: "{score} sa 100",
  },
})
