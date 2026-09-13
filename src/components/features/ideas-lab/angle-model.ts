/**
 * Angle Library model: usage and performance per angle, filters, sorting, untried angles and
 * name validation. Pure — no React, no store access.
 */
import { anglePerformance, type AngleAggregate } from "@/lib/analytics"
import type { ContentAngle, Database, ID } from "@/lib/types"
import { matchesQuery } from "@/lib/utils"
import { nameKey } from "./generator-model"

/** Angle names travel into the AI's Brand Context (40 characters max there). */
export const ANGLE_NAME_MAX = 40

export const DEFAULT_ANGLE_NOTE =
  "Default angles can be edited but not deleted — they're the shared vocabulary the Idea Generator, its offline templates and your angle analytics are built on. Custom angles can be deleted anytime."

export interface AngleStats {
  ideaIds: ID[]
  itemIds: ID[]
  uses: number
  /** Published posts with this angle, from `anglePerformance` (all time). */
  performance: AngleAggregate | null
}

export function emptyAngleStats(): AngleStats {
  return { ideaIds: [], itemIds: [], uses: 0, performance: null }
}

/** Ideas and content items with each angle, plus the performance of its published posts. */
export function angleStats(db: Database, now: Date): Map<ID, AngleStats> {
  const performance = new Map(anglePerformance(db, now).map((aggregate) => [aggregate.angle.id, aggregate]))
  const out = new Map<ID, AngleStats>()
  for (const angle of db.angles) out.set(angle.id, { ideaIds: [], itemIds: [], uses: 0, performance: performance.get(angle.id) ?? null })
  for (const idea of db.content_ideas) if (idea.angle_id) out.get(idea.angle_id)?.ideaIds.push(idea.id)
  for (const item of db.content_items) if (item.angle_id) out.get(item.angle_id)?.itemIds.push(item.id)
  for (const stats of out.values()) stats.uses = stats.ideaIds.length + stats.itemIds.length
  return out
}

export type AngleKind = "all" | "default" | "custom"
export type AngleSort = "performance" | "uses" | "az"

export const ANGLE_SORTS: { id: AngleSort; label: string }[] = [
  { id: "performance", label: "Best performing" },
  { id: "uses", label: "Most used" },
  { id: "az", label: "A–Z" },
]

export function filterAngles(angles: readonly ContentAngle[], filters: { q: string; kind: AngleKind }): ContentAngle[] {
  return angles.filter(
    (angle) =>
      (filters.kind === "all" || (filters.kind === "default") === angle.is_default) &&
      matchesQuery(filters.q, angle.name, angle.description, angle.example)
  )
}

export function sortAngles(angles: readonly ContentAngle[], sort: AngleSort, stats: Map<ID, AngleStats>): ContentAngle[] {
  const views = (angle: ContentAngle) => stats.get(angle.id)?.performance?.avgViews ?? null
  const uses = (angle: ContentAngle) => stats.get(angle.id)?.uses ?? 0
  const byName = (a: ContentAngle, b: ContentAngle) => a.name.localeCompare(b.name)
  return [...angles].sort((a, b) => {
    if (sort === "az") return byName(a, b)
    if (sort === "uses") return uses(b) - uses(a) || byName(a, b)
    const va = views(a)
    const vb = views(b)
    if (va !== vb) {
      if (va === null) return 1
      if (vb === null) return -1
      return vb - va
    }
    return uses(b) - uses(a) || byName(a, b)
  })
}

/** Angles never used in an idea or content item — defaults first. */
export function untriedAngles(angles: readonly ContentAngle[], stats: Map<ID, AngleStats>): ContentAngle[] {
  return angles
    .filter((angle) => (stats.get(angle.id)?.uses ?? 0) === 0)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name))
}

/** Required, at most 40 characters, unique (ignoring case and punctuation). */
export function validateAngleName(name: string, angles: readonly ContentAngle[], selfId?: ID): string | null {
  const clean = name.replace(/\s+/g, " ").trim()
  if (!clean) return "Give the angle a name."
  if (clean.length > ANGLE_NAME_MAX) return `Keep the name under ${ANGLE_NAME_MAX} characters.`
  const key = nameKey(clean)
  if (angles.some((angle) => angle.id !== selfId && nameKey(angle.name) === key)) return "An angle with this name already exists."
  return null
}

/** The Idea Generator, prefilled with this angle and started. */
export function generatorHref(angleId: ID): string {
  return `/ideas/generator?angle=${encodeURIComponent(angleId)}&run=1`
}
