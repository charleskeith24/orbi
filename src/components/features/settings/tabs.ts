import { Bell, CircleUserRound, Database, Funnel, Gauge, MessagesSquare, Plug, Shapes, SlidersHorizontal, Sparkles, Tags, type LucideIcon } from "lucide-react"

export const SETTINGS_TAB_KEYS = [
  "profile",
  "general",
  "performance",
  "funnel",
  "formats",
  "tags",
  "engagement",
  "reminders",
  "ai",
  "integrations",
  "data",
] as const

export type SettingsTabKey = (typeof SETTINGS_TAB_KEYS)[number]

/** Labels and descriptions live in `settingsMessages` (`tab_<key>_label`, `tab_<key>_description`). */
export interface SettingsTabMeta {
  key: SettingsTabKey
  icon: LucideIcon
}

export const SETTINGS_TABS: SettingsTabMeta[] = [
  { key: "profile", icon: CircleUserRound },
  { key: "general", icon: SlidersHorizontal },
  { key: "performance", icon: Gauge },
  { key: "funnel", icon: Funnel },
  { key: "formats", icon: Shapes },
  { key: "tags", icon: Tags },
  { key: "engagement", icon: MessagesSquare },
  { key: "reminders", icon: Bell },
  { key: "ai", icon: Sparkles },
  { key: "integrations", icon: Plug },
  { key: "data", icon: Database },
]

export const SETTINGS_TAB_MAP = Object.fromEntries(SETTINGS_TABS.map((t) => [t.key, t])) as Record<SettingsTabKey, SettingsTabMeta>

export function parseSettingsTab(value: string | null): SettingsTabKey {
  return (SETTINGS_TAB_KEYS as readonly string[]).includes(value ?? "") ? (value as SettingsTabKey) : "general"
}

/** `/settings?tab=<tab>` plus optional extra params (e.g. `open`). */
export function settingsHref(tab: SettingsTabKey, params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ tab, ...params })
  return `/settings?${query.toString()}`
}

/**
 * Change the tab / open dialog in the URL in place. `history.replaceState` is synced with
 * `useSearchParams` by the Next router, so the view updates instantly without a server round trip.
 */
export function replaceSettingsUrl(tab: SettingsTabKey, params: Record<string, string> = {}): void {
  window.history.replaceState(null, "", settingsHref(tab, params))
}
