import { defineMessages } from "@/lib/i18n/core"

/**
 * Top bar: breadcrumbs, search and the quick actions. Product terms (Quick Capture, Content
 * Strategist, Campaign) stay in English in both languages (ARCHITECTURE §9).
 */
export const m = defineMessages({
  en: {
    breadcrumb: "Breadcrumb",
    crumb_workspace: "Workspace",
    crumb_campaign: "Campaign",
    crumb_details: "Details",
    strategist: "Content Strategist",
    search_everything: "Search everything…",
    search: "Search",
    capture: "Capture",
    capture_tooltip: "Quick-capture an idea",
    new_content: "New content",
    strategist_open: "Open Content Strategist",
  },
  tl: {
    breadcrumb: "Lokasyon sa app",
    crumb_workspace: "Workspace",
    crumb_campaign: "Campaign",
    crumb_details: "Detalye",
    strategist: "Content Strategist",
    search_everything: "I-search lahat…",
    search: "I-search",
    capture: "I-capture",
    capture_tooltip: "I-capture agad ang idea",
    new_content: "Bagong content",
    strategist_open: "Buksan ang Content Strategist",
  },
})
