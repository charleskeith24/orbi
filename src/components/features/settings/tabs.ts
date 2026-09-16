import { Bell, Database, Funnel, Gauge, MessagesSquare, Plug, Shapes, SlidersHorizontal, Sparkles, Tags, type LucideIcon } from "lucide-react"

export const SETTINGS_TAB_KEYS = [
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

export interface SettingsTabMeta {
  key: SettingsTabKey
  label: string
  icon: LucideIcon
  description: string
}

export const SETTINGS_TABS: SettingsTabMeta[] = [
  {
    key: "general",
    label: "General",
    icon: SlidersHorizontal,
    description: "App language, Simple mode, currency, posting target, week start, timezone, default owner and how strictly the content mix is checked.",
  },
  {
    key: "performance",
    label: "Performance",
    icon: Gauge,
    description: "How Winner detection compares posts, and when the Content Buffer counts as healthy.",
  },
  { key: "funnel", label: "Funnel", icon: Funnel, description: "The target mix of awareness, trust and conversion content." },
  {
    key: "formats",
    label: "Formats",
    icon: Shapes,
    description: "The formats you produce and the script structure Content Studio starts each one with.",
  },
  {
    key: "tags",
    label: "Tags",
    icon: Tags,
    description: "Tags shared by ideas, content, stories, hooks, research and campaigns.",
  },
  {
    key: "engagement",
    label: "Engagement",
    icon: MessagesSquare,
    description: "The daily engagement tasks and targets behind the Engagement Tracker on Today.",
  },
  {
    key: "reminders",
    label: "Reminders",
    icon: Bell,
    description: "Nudges to post, to show up for your posting slots and to review your week.",
  },
  {
    key: "ai",
    label: "AI",
    icon: Sparkles,
    description: "Which engine writes for you, what it knows about your brand, and a log of every generation.",
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: Plug,
    description: "Platform and tool connections, and the CSV analytics import that works without them.",
  },
  { key: "data", label: "Data", icon: Database, description: "Where your workspace lives, backups and restores, and resets." },
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
