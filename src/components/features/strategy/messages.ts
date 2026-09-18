/**
 * Strategy — shared bits: the page tabs and the inline AI error. Page and module
 * names (Brand HQ, Goals, Platforms, Flywheel & System) stay English.
 */
import { defineMessages } from "@/lib/i18n/core"

export const strategyMessages = defineMessages({
  en: {
    tabs_label: "Strategy pages",
    tab_brand: "Brand HQ",
    tab_goals: "Goals",
    tab_platforms: "Platforms",
    tab_system: "Flywheel & System",
    ai_error_title: "Couldn't generate suggestions",
    retry: "Retry",
  },
  tl: {
    tabs_label: "Mga page ng Strategy",
    tab_brand: "Brand HQ",
    tab_goals: "Goals",
    tab_platforms: "Platforms",
    tab_system: "Flywheel & System",
    ai_error_title: "Hindi naka-generate ng suggestions",
    retry: "Subukan ulit",
  },
})
