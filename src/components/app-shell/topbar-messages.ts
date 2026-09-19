import { defineMessages } from "@/lib/i18n/core"

/**
 * Top bar: where you are, search and the Content Strategist. Product terms (Content Strategist, Campaign) stay
 * in English in both languages (ARCHITECTURE §9). The New menu has its own messages (`new-menu-messages.ts`).
 */
export const m = defineMessages({
  en: {
    breadcrumb: "Breadcrumb",
    crumb_workspace: "Workspace",
    crumb_campaign: "Campaign",
    crumb_details: "Details",
    strategist: "Content Strategist",
    search_everything: "Search…",
    search: "Search",
    strategist_open: "Open Content Strategist",
  },
  tl: {
    breadcrumb: "Lokasyon sa app",
    crumb_workspace: "Workspace",
    crumb_campaign: "Campaign",
    crumb_details: "Detalye",
    strategist: "Content Strategist",
    search_everything: "I-search…",
    search: "I-search",
    strategist_open: "Buksan ang Content Strategist",
  },
})
