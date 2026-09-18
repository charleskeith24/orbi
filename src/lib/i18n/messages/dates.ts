/**
 * Relative day words for `formatRelativeDay(value, now, lang)` in `src/lib/dates.ts`. The English side is
 * exactly what the helper has always returned; dates past two weeks stay date-fns "MMM d" in both languages.
 */
import { defineMessages } from "@/lib/i18n/core"

export const relativeDayMessages = defineMessages({
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    in_days: "in {count} days",
    days_ago: "{count} days ago",
  },
  tl: {
    today: "Ngayon",
    tomorrow: "Bukas",
    yesterday: "Kahapon",
    in_days: "sa {count} araw",
    days_ago: "{count} araw ang nakalipas",
  },
})
