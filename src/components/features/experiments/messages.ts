/**
 * Experiments: the page, cards, status pills and the pure model's labels (timing, transitions, validation).
 * The detail sheet, form, post picker, results, linked posts and conclusion live in `detail-messages.ts`.
 * Status labels (Running, Planned…), metric names, experiment templates and AI text stay English.
 */
import { defineMessages } from "@/lib/i18n/core"

export const experimentsMessages = defineMessages({
  en: {
    // Page
    description: "Test one variable at a time — hook length, video length, language, CTA — and turn every result into a rule you reuse.",
    new_experiment: "New experiment",
    duplicate_name: "{name} (again)",
    duplicated: "Experiment duplicated",
    duplicated_description: "Set new dates and link fresh posts to run it again.",
    next_ends: "Next ends {date}",
    no_end_dates: "No end dates set",
    nothing_running: "Nothing running",
    next_starts: "Next starts {date}",
    no_start_dates: "No start dates set",
    nothing_planned: "Nothing planned",
    with_winner: "{count} with a winner",
    inconclusive_count: " · {count} inconclusive",
    no_results_yet: "No results yet",
    lessons_learned: "Lessons learned",
    lessons_ideas: "{count} turned into ideas",
    lessons_hint: "Record a lesson when a test ends",
    count_one: "{count} experiment",
    count_other: "{count} experiments",
    shown_of: "{shown} of {total}",
    search_placeholder: "Search experiments…",
    nomatch_title: "No experiments match",
    nomatch_description: "Try a different word — search covers names, hypotheses, variants, results and lessons.",
    clear_search: "Clear search",
    empty_title: "No experiments yet",
    empty_description:
      "An experiment compares two versions of one variable — short vs long hooks, Taglish vs English — across real posts, so you stop guessing what works.",

    // Status groups
    group_running: "Collecting posts and analytics now",
    group_planned: "Designed and waiting to start",
    group_completed: "Decided — the lesson is the output",
    group_cancelled: "Stopped before a result",

    // Cards and pills
    untitled: "Untitled experiment",
    variant: "Variant {letter}",
    winner_sr: "(winner)",
    linked_no_data: "{count} linked · no data",
    no_posts_yet: "No posts yet",
    time_elapsed: "Time elapsed",
    lesson_prefix: "Lesson · ",
    inconclusive: "Inconclusive",
    variant_won: "Variant {letter} won",

    // Transitions
    start_experiment: "Start experiment",
    cancel_experiment: "Cancel experiment",
    mark_completed: "Mark completed",
    back_to_planned: "Back to planned",
    reopen: "Reopen",
    restore_planned: "Restore to planned",
    toast_running: "Experiment running",
    toast_planned: "Experiment moved to planned",
    toast_completed: "Experiment completed — record the result and lesson",
    toast_cancelled: "Experiment cancelled",

    // Dates and timing
    range_from: "From {date}",
    range_until: "Until {date}",
    no_dates: "No dates set",
    past_end: "Past its end date ({date})",
    day_of: "Day {day} of {total} · {rest}",
    ends_today: "ends today",
    days_left_one: "{count} day left",
    days_left_other: "{count} days left",
    started_no_end: "Started {date} · no end date",
    no_start_yet: "No start date yet",
    starts_in_one: "Starts in {count} day",
    starts_in_other: "Starts in {count} days",
    starts_today: "Starts today",
    was_due: "Was due to start {date}",
    ended: "Ended {date}",
    completed: "Completed",
    cancelled: "Cancelled",

    // Validation
    error_name: "Name the experiment.",
    error_variant_a: "Describe what variant A does.",
    error_variant_b: "Describe what variant B does.",
    error_same: "Variant B has to differ from A.",
    error_end: "The end date is before the start date.",

    // Lesson → idea (saved on the idea)
    inspiration: "Experiment · {name}",
    inspiration_winner: "Experiment · {name} — “{winner}” won",
  },
  tl: {
    // Page
    description: "Mag-test ng isang variable at a time — haba ng hook, haba ng video, language, CTA — at gawing rule ang bawat resulta para gamitin ulit.",
    new_experiment: "Bagong experiment",
    duplicate_name: "{name} (ulit)",
    duplicated: "Na-duplicate ang experiment",
    duplicated_description: "Mag-set ng bagong dates at mag-link ng bagong posts para patakbuhin ulit.",
    next_ends: "Unang tatapos: {date}",
    no_end_dates: "Walang end date",
    nothing_running: "Walang tumatakbo",
    next_starts: "Unang magsisimula: {date}",
    no_start_dates: "Walang start date",
    nothing_planned: "Walang naka-plan",
    with_winner: "{count} may winner",
    inconclusive_count: " · {count} inconclusive",
    no_results_yet: "Wala pang resulta",
    lessons_learned: "Mga lesson",
    lessons_ideas: "{count} ginawang ideas",
    lessons_hint: "Isulat ang lesson pag natapos ang test",
    count_one: "{count} experiment",
    count_other: "{count} experiments",
    shown_of: "{shown} ng {total}",
    search_placeholder: "I-search ang experiments…",
    nomatch_title: "Walang experiment na match",
    nomatch_description: "Subukan ang ibang salita — sakop ng search ang names, hypotheses, variants, results at lessons.",
    clear_search: "I-clear ang search",
    empty_title: "Wala pang experiments",
    empty_description:
      "Ang experiment ay nagko-compare ng dalawang version ng isang variable — short vs long hooks, Taglish vs English — sa mga totoong post, para hindi na manghula kung ano ang gumagana.",

    // Status groups
    group_running: "Nangongolekta ng posts at analytics ngayon",
    group_planned: "Naka-design at naghihintay na magsimula",
    group_completed: "Decided na — ang lesson ang output",
    group_cancelled: "Itinigil bago may resulta",

    // Cards and pills
    untitled: "Experiment na walang pangalan",
    variant: "Variant {letter}",
    winner_sr: "(winner)",
    linked_no_data: "{count} naka-link · walang data",
    no_posts_yet: "Wala pang posts",
    time_elapsed: "Lumipas na oras",
    lesson_prefix: "Lesson · ",
    inconclusive: "Inconclusive",
    variant_won: "Nanalo ang Variant {letter}",

    // Transitions
    start_experiment: "Simulan ang experiment",
    cancel_experiment: "I-cancel ang experiment",
    mark_completed: "Markahang completed",
    back_to_planned: "Ibalik sa planned",
    reopen: "Buksan ulit",
    restore_planned: "Ibalik sa planned",
    toast_running: "Tumatakbo ang experiment",
    toast_planned: "Inilipat sa planned ang experiment",
    toast_completed: "Completed ang experiment — isulat ang resulta at lesson",
    toast_cancelled: "Na-cancel ang experiment",

    // Dates and timing
    range_from: "Mula {date}",
    range_until: "Hanggang {date}",
    no_dates: "Walang petsa",
    past_end: "Lampas sa end date ({date})",
    day_of: "Day {day} ng {total} · {rest}",
    ends_today: "tatapos ngayon",
    days_left_one: "{count} araw na natitira",
    days_left_other: "{count} araw na natitira",
    started_no_end: "Sinimulan {date} · walang end date",
    no_start_yet: "Wala pang start date",
    starts_in_one: "Magsisimula sa {count} araw",
    starts_in_other: "Magsisimula sa {count} araw",
    starts_today: "Magsisimula ngayon",
    was_due: "Dapat nagsimula {date}",
    ended: "Natapos {date}",
    completed: "Completed",
    cancelled: "Cancelled",

    // Validation
    error_name: "Pangalanan ang experiment.",
    error_variant_a: "Ilarawan ang variant A.",
    error_variant_b: "Ilarawan ang variant B.",
    error_same: "Dapat naiiba ang Variant B sa A.",
    error_end: "Ang end date ay bago ang start date.",

    // Lesson → idea (saved on the idea)
    inspiration: "Experiment · {name}",
    inspiration_winner: "Experiment · {name} — nanalo ang “{winner}”",
  },
})
