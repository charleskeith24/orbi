import { defineMessages } from "@/lib/i18n/core"

/**
 * Reminder text — push notifications (sent by the cron job in the workspace's UI language) and the
 * calendar file's events. Pure: used by server code, so it never imports React.
 */
export const reminderMessages = defineMessages({
  en: {
    // Daily digest
    daily_title: "Today in Orbi",
    daily_scheduled_one: "{count} post scheduled",
    daily_scheduled_other: "{count} posts scheduled",
    daily_due_one: "{count} due",
    daily_due_other: "{count} due",
    daily_overdue_one: "{count} overdue",
    daily_overdue_other: "{count} overdue",
    daily_slot: "Slot: {label}",
    daily_empty: "Nothing planned today. Capture one idea or plan your next post.",

    // Posting slot
    slot_title_lead: "Posting slot in {minutes} min",
    slot_title_now: "Time to post",
    slot_unnamed: "Posting slot",
    slot_ready: "Ready: {title}",
    slot_nothing_ready: "Nothing scheduled for it yet. Open Today to pick a post.",

    // Weekly review
    review_title: "Weekly review time",
    review_body_one: "{count} of {target} posts published this week. See what worked in the Weekly Report.",
    review_body_other: "{count} of {target} posts published this week. See what worked in the Weekly Report.",

    // Test notification
    test_title: "Orbi reminders are on",
    test_body: "This device will get your reminders.",

    // Calendar file (.ics)
    ics_calendar_name: "Orbi reminders",
    ics_daily_summary: "Orbi: plan today's content",
    ics_daily_description: "Open Today in Orbi to see what to post, record and review.",
    ics_slot_summary: "Post: {label}",
    ics_slot_description: "Posting slot from your Posting Schedule. Platforms: {platforms}.",
    ics_slot_description_no_platforms: "Posting slot from your Posting Schedule.",
    ics_review_summary: "Orbi: weekly review",
    ics_review_description: "Look back at this week in the Weekly Report: what worked, what to repeat.",
  },
  tl: {
    daily_title: "Today sa Orbi",
    daily_scheduled_one: "{count} post naka-schedule",
    daily_scheduled_other: "{count} posts naka-schedule",
    daily_due_one: "{count} due",
    daily_due_other: "{count} due",
    daily_overdue_one: "{count} overdue",
    daily_overdue_other: "{count} overdue",
    daily_slot: "Slot: {label}",
    daily_empty: "Walang naka-plan ngayon. Mag-capture ng idea o i-plan ang susunod mong post.",

    slot_title_lead: "Posting slot in {minutes} min",
    slot_title_now: "Oras nang mag-post",
    slot_unnamed: "Posting slot",
    slot_ready: "Ready: {title}",
    slot_nothing_ready: "Walang naka-schedule pa. Buksan ang Today para pumili ng post.",

    review_title: "Oras para sa weekly review",
    review_body_one: "{count} of {target} posts na-publish this week. Tingnan ang what worked sa Weekly Report.",
    review_body_other: "{count} of {target} posts na-publish this week. Tingnan ang what worked sa Weekly Report.",

    test_title: "Naka-on ang Orbi reminders",
    test_body: "Dito sa device na ito ay makakatanggap ka ng reminders.",

    ics_calendar_name: "Orbi reminders",
    ics_daily_summary: "Orbi: i-plan ang content ngayon",
    ics_daily_description: "Buksan ang Today sa Orbi para makita ang dapat i-post, i-record at i-review.",
    ics_slot_summary: "Post: {label}",
    ics_slot_description: "Posting slot mula sa Posting Schedule mo. Platforms: {platforms}.",
    ics_slot_description_no_platforms: "Posting slot mula sa Posting Schedule mo.",
    ics_review_summary: "Orbi: weekly review",
    ics_review_description: "Balikan ang linggo sa Weekly Report: ano ang worked, ano ang dapat i-repeat.",
  },
})
