/**
 * Pure helpers for Content Pillars: ordering, target maths (whole numbers that add up to 100),
 * recommended presets and usage counts for delete confirmations.
 */
import { CATEGORICAL_COLORS, PILLAR_PRESETS } from "@/lib/constants"
import type { CategoricalColor, ContentPillar, Database, ID } from "@/lib/types"
import { pluralize } from "@/lib/utils"

export const TARGET_TOTAL = 100

type Orderable = Pick<ContentPillar, "sort_order" | "name">

/** sort_order, then name — the order every pillar list uses. */
export function sortPillars<T extends Orderable>(pillars: T[]): T[] {
  return [...pillars].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function sumValues(values: (number | null | undefined)[]): number {
  let total = 0
  for (const v of values) total += typeof v === "number" && Number.isFinite(v) ? v : 0
  return total
}

/** Sum of the active pillars' raw target_percentage. */
export function activeTargetTotal(pillars: Pick<ContentPillar, "is_active" | "target_percentage">[]): number {
  return sumValues(pillars.filter((p) => p.is_active).map((p) => p.target_percentage))
}

/**
 * Whole-number shares that add up to exactly 100 while keeping proportions (largest remainder;
 * ties go to the earlier row). All-zero input is split evenly.
 */
export function normalizeTo100(values: (number | null | undefined)[]): number[] {
  const n = values.length
  if (!n) return []
  const clean = values.map((v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0))
  const total = sumValues(clean)
  const raw = total > 0 ? clean.map((v) => (v / total) * TARGET_TOTAL) : clean.map(() => TARGET_TOTAL / n)
  const out = raw.map((v) => Math.floor(v + 1e-9))
  let remainder = TARGET_TOTAL - sumValues(out)
  const order = raw.map((v, i) => ({ i, frac: v - out[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (remainder <= 0) break
    out[i] += 1
    remainder -= 1
  }
  return out
}

/** Inline validation copy for a running total; null when it is exactly 100. */
export function targetTotalError(total: number): string | null {
  if (total === TARGET_TOTAL) return null
  return total > TARGET_TOTAL
    ? `Targets add up to ${total}% — remove ${total - TARGET_TOTAL} pts.`
    : `Targets add up to ${total}% — ${TARGET_TOTAL - total} pts left to assign.`
}

/** "+4 pts", "−3 pts" or "on target". */
export function formatPoints(deviation: number): string {
  const rounded = Math.round(deviation)
  if (rounded === 0) return "on target"
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} pts`
}

/** Recommended pillars (spec §6) whose name isn't used yet. */
export function missingPresets(pillars: Pick<ContentPillar, "name">[]): typeof PILLAR_PRESETS {
  const names = new Set(pillars.map((p) => p.name.trim().toLowerCase()))
  return PILLAR_PRESETS.filter((preset) => !names.has(preset.name.toLowerCase()))
}

/** First categorical colour no pillar uses yet (fixed order), else the next in sequence. */
export function nextPillarColor(pillars: Pick<ContentPillar, "color">[]): CategoricalColor {
  const used = new Set(pillars.map((p) => p.color))
  return CATEGORICAL_COLORS.find((c) => !used.has(c)) ?? CATEGORICAL_COLORS[pillars.length % CATEGORICAL_COLORS.length]
}

export function nextSortOrder(pillars: Pick<ContentPillar, "sort_order">[]): number {
  return pillars.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1
}

/**
 * sort_order patches after moving `id` one step within its group (active or paused).
 * Renumbers active pillars 0…k-1 and paused ones after them so duplicate orders can't stick.
 */
export function reorderPatches(
  pillars: ContentPillar[],
  id: ID,
  direction: -1 | 1
): { id: ID; patch: { sort_order: number } }[] {
  const moving = pillars.find((p) => p.id === id)
  if (!moving) return []
  const active = sortPillars(pillars.filter((p) => p.is_active))
  const paused = sortPillars(pillars.filter((p) => !p.is_active))
  const group = moving.is_active ? active : paused
  const index = group.findIndex((p) => p.id === id)
  const target = index + direction
  if (target < 0 || target >= group.length) return []
  ;[group[index], group[target]] = [group[target], group[index]]
  return [...active, ...paused].flatMap((p, i) => (p.sort_order === i ? [] : [{ id: p.id, patch: { sort_order: i } }]))
}

export interface PillarUsage {
  items: number
  ideas: number
  /** Problems, questions, hooks, posting slots, campaigns, series, stories and research. */
  other: number
  total: number
}

export function pillarUsage(db: Database, pillarId: ID): PillarUsage {
  const count = (rows: { pillar_id: ID | null }[]) => rows.reduce((n, r) => n + (r.pillar_id === pillarId ? 1 : 0), 0)
  const items = count(db.content_items)
  const ideas = count(db.content_ideas)
  const other =
    count(db.audience_problems) +
    count(db.audience_questions) +
    count(db.hooks) +
    count(db.content_calendar) +
    count(db.content_campaigns) +
    count(db.content_series) +
    count(db.stories) +
    count(db.research_items)
  return { items, ideas, other, total: items + ideas + other }
}

/** "12 content items, 8 ideas and 3 other records". */
export function describeUsage(usage: PillarUsage): string {
  const parts: string[] = []
  if (usage.items) parts.push(pluralize(usage.items, "content item"))
  if (usage.ideas) parts.push(pluralize(usage.ideas, "idea"))
  if (usage.other) parts.push(pluralize(usage.other, "other record"))
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}
