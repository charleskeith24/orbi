import { defineMessages } from "@/lib/i18n/core"

/** Sidebar chrome. Module, page and group names (src/lib/navigation.ts) are product terms and stay English. */
export const sidebarMessages = defineMessages({
  en: {
    brand_fallback: "Your brand",
    show_all_one: "Show all modules ({count} hidden)",
    show_all_other: "Show all modules ({count} hidden)",
    back_to_simple: "Back to Simple mode",
    workspace_local: "Local workspace · this browser",
    workspace_synced: "Synced · Supabase",
    workspace_local_tooltip: "Local workspace",
    workspace_synced_tooltip: "Synced workspace",
  },
  tl: {
    brand_fallback: "Brand mo",
    show_all_one: "Ipakita lahat ng modules ({count} nakatago)",
    show_all_other: "Ipakita lahat ng modules ({count} nakatago)",
    back_to_simple: "Balik sa Simple mode",
    workspace_local: "Local workspace · sa browser na 'to",
    workspace_synced: "Synced · Supabase",
    workspace_local_tooltip: "Local workspace",
    workspace_synced_tooltip: "Synced workspace",
  },
})
