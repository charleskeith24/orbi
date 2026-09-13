/**
 * Hook Library model: "___" blanks, matching text written from a template, per-hook usage and
 * performance, filters and sorting. Pure — no React, no store access.
 */
import { aggregateRows, hookPerformance, scopedRows, type GroupAggregate, type HookAggregate } from "@/lib/analytics"
import { HOOK_CATEGORIES } from "@/lib/constants"
import type { Database, Hook, HookCategory, HookSource, ID } from "@/lib/types"
import { formatCompact, formatPercent, matchesQuery } from "@/lib/utils"

/** Three or more underscores mark a blank. */
const BLANK_RE = /_{3,}/g

export type HookPart = { text: string; blank: false } | { text: string; blank: true; index: number }

/** "Most people are doing ___ wrong." → text / blank / text parts (for highlighting and filling in). */
export function splitBlanks(text: string): HookPart[] {
  const parts: HookPart[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(BLANK_RE)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start), blank: false })
    parts.push({ text: match[0], blank: true, index: index++ })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), blank: false })
  return parts
}

export function countBlanks(text: string): number {
  return text.match(BLANK_RE)?.length ?? 0
}

/** Replace the nth blank with `values[n]` (blanks without a value become "___"). */
export function fillBlanks(text: string, values: readonly string[]): string {
  let index = 0
  return text
    .replace(BLANK_RE, () => {
      const value = values[index++]?.replace(/\s+/g, " ").trim()
      return value || "___"
    })
    .replace(/\s+/g, " ")
    .trim()
}

/** Case, curly quotes, spacing and closing punctuation don't matter when comparing hooks. */
export function normalizeHookText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…]+$/, "")
    .trim()
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Pattern for text written from a template: literal parts in order, anything in the blanks.
 * null for plain hooks and for templates too generic to match reliably (under 12 literal characters).
 */
export function templatePattern(text: string): RegExp | null {
  const normalized = normalizeHookText(text)
  const parts = normalized.split(BLANK_RE)
  if (parts.length < 2) return null
  if (parts.join("").replace(/[^\p{L}\p{N}]/gu, "").length < 12) return null
  return new RegExp(`^${parts.map(escapeRegExp).join(".+?")}$`, "i")
}

/** Does `candidate` use this hook — the same text, or the template filled in? */
export function hookMatcher(hookText: string): (candidate: string) => boolean {
  const normalized = normalizeHookText(hookText)
  if (!normalized) return () => false
  const pattern = countBlanks(normalized) ? templatePattern(normalized) : null
  if (countBlanks(normalized) && !pattern) return () => false
  return (candidate) => {
    const text = normalizeHookText(candidate)
    if (!text) return false
    return pattern ? pattern.test(text) : text === normalized
  }
}

/* ---------------------------------- Stats --------------------------------- */

export interface HookStats {
  /** Content items linked to this hook (any stage). */
  itemIds: ID[]
  /** Ideas whose hook was written from it (the same text, or the template filled in). */
  ideaIds: ID[]
  uses: number
  /** Published posts with this hook, from `hookPerformance` (all time). */
  performance: HookAggregate | null
}

const NO_STATS: HookStats = { itemIds: [], ideaIds: [], uses: 0, performance: null }

export function emptyHookStats(): HookStats {
  return { ...NO_STATS, itemIds: [], ideaIds: [] }
}

/** Usage and performance for every hook. */
export function hookStats(db: Database, now: Date): Map<ID, HookStats> {
  const performance = new Map(hookPerformance(db, now).map((aggregate) => [aggregate.hook.id, aggregate]))
  const out = new Map<ID, HookStats>()
  for (const hook of db.hooks) out.set(hook.id, { itemIds: [], ideaIds: [], uses: 0, performance: performance.get(hook.id) ?? null })

  for (const item of db.content_items) {
    if (item.hook_id) out.get(item.hook_id)?.itemIds.push(item.id)
  }
  const ideas = db.content_ideas.filter((idea) => idea.hook.trim())
  if (ideas.length) {
    for (const hook of db.hooks) {
      const matches = hookMatcher(hook.text)
      const stats = out.get(hook.id)
      if (!stats) continue
      for (const idea of ideas) if (matches(idea.hook)) stats.ideaIds.push(idea.id)
    }
  }
  for (const stats of out.values()) stats.uses = stats.itemIds.length + stats.ideaIds.length
  return out
}

/** Every published post with analytics, all time — the baseline for "vs your average". */
export function overallPerformance(db: Database, now: Date): GroupAggregate {
  return aggregateRows(scopedRows(db, now))
}

/* --------------------------------- Metrics -------------------------------- */

export type HookMetric = "views" | "retention" | "engagement" | "leads"

export const HOOK_METRICS: { id: HookMetric; label: string; description: string }[] = [
  { id: "views", label: "Views", description: "Average views per post" },
  { id: "retention", label: "Retention", description: "Average retention of video posts" },
  { id: "engagement", label: "Engagement", description: "Engagements ÷ reach" },
  { id: "leads", label: "Leads", description: "Average leads per post" },
]

export function hookMetricValue(aggregate: GroupAggregate, metric: HookMetric): number | null {
  switch (metric) {
    case "views":
      return aggregate.avgViews
    case "retention":
      return aggregate.avgRetention
    case "engagement":
      return aggregate.engagementRate
    case "leads":
      return aggregate.leadsPerPost
  }
}

export function formatHookMetric(value: number | null, metric: HookMetric): string {
  if (value === null || !Number.isFinite(value)) return "—"
  if (metric === "views") return formatCompact(value)
  if (metric === "leads") return value >= 10 ? formatCompact(value) : value.toFixed(1)
  return formatPercent(value)
}

/* -------------------------------- Filtering ------------------------------- */

export const HOOK_SOURCES: Record<HookSource, { label: string; description: string }> = {
  library: { label: "Starter library", description: "Proven templates that ship with the app" },
  user: { label: "Written by you", description: "Hooks you added" },
  ai: { label: "AI", description: "Saved from AI suggestions" },
  content: { label: "From your content", description: "Opening lines of content you've made" },
}
export const HOOK_SOURCE_IDS = Object.keys(HOOK_SOURCES) as HookSource[]

export type HookSort = "performance" | "uses" | "newest" | "az"
export const HOOK_SORTS: { id: HookSort; label: string }[] = [
  { id: "performance", label: "Best performing" },
  { id: "uses", label: "Most used" },
  { id: "newest", label: "Newest" },
  { id: "az", label: "A–Z" },
]

export interface HookFilters {
  q: string
  categories: HookCategory[]
  sources: HookSource[]
  favorites: boolean
}

export const EMPTY_HOOK_FILTERS: HookFilters = { q: "", categories: [], sources: [], favorites: false }

export function hasHookFilters(filters: HookFilters): boolean {
  return Boolean(filters.q.trim()) || filters.categories.length > 0 || filters.sources.length > 0 || filters.favorites
}

type FacetKey = "categories" | "sources"

export function filterHooks(hooks: readonly Hook[], filters: HookFilters, ignore?: FacetKey): Hook[] {
  return hooks.filter(
    (hook) =>
      (ignore === "categories" || !filters.categories.length || filters.categories.includes(hook.category)) &&
      (ignore === "sources" || !filters.sources.length || filters.sources.includes(hook.source)) &&
      (!filters.favorites || hook.is_favorite) &&
      matchesQuery(filters.q, hook.text, hook.notes, HOOK_CATEGORIES[hook.category]?.label)
  )
}

/** Option counts for one facet: every other filter applies, this one doesn't. */
export function hookFacetCounts(hooks: readonly Hook[], filters: HookFilters, key: FacetKey): Map<string, number> {
  const counts = new Map<string, number>()
  for (const hook of filterHooks(hooks, filters, key)) {
    const value = key === "categories" ? hook.category : hook.source
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

export function sortHooks(hooks: readonly Hook[], sort: HookSort, stats: Map<ID, HookStats>): Hook[] {
  const views = (hook: Hook) => stats.get(hook.id)?.performance?.avgViews ?? null
  const uses = (hook: Hook) => stats.get(hook.id)?.uses ?? 0
  const byText = (a: Hook, b: Hook) => a.text.localeCompare(b.text)
  return [...hooks].sort((a, b) => {
    if (sort === "az") return byText(a, b)
    if (sort === "newest") return b.created_at.localeCompare(a.created_at) || byText(a, b)
    if (sort === "uses") return uses(b) - uses(a) || (views(b) ?? -1) - (views(a) ?? -1) || byText(a, b)
    const va = views(a)
    const vb = views(b)
    if (va !== vb) {
      if (va === null) return 1
      if (vb === null) return -1
      return vb - va
    }
    return uses(b) - uses(a) || Number(b.is_favorite) - Number(a.is_favorite) || byText(a, b)
  })
}

/** Values for a new hook: templates are detected from "___"; the text is tidied to one line. */
export function newHookValues(values: { text: string; category: HookCategory; source: HookSource; pillar_id?: ID | null; notes?: string }) {
  const text = values.text.replace(/\s+/g, " ").trim()
  return {
    text,
    category: values.category,
    source: values.source,
    pillar_id: values.pillar_id ?? null,
    notes: values.notes?.trim() ?? "",
    is_template: countBlanks(text) > 0,
  }
}
