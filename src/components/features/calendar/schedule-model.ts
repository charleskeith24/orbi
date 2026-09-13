/**
 * Posting Schedule helpers (spec §19, §49): weekly capacity vs the post target, per-platform load vs the
 * platform strategy, the slots' pillar mix vs pillar targets, ordering, and the recommended weekly strategy.
 * Pure — no React, no store access.
 */
import { POSTING_SLOTS } from "@/lib/data/seed/starter-data"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import type { AppSettings, BrandProfile, CategoricalColor, ContentFormat, ContentPillar, ID, InsertRow, PlatformId, PlatformStrategy, PostingSlot } from "@/lib/types"
import { compareSlots } from "./calendar-model"

/** Posts a slot produces per week: one per platform (one when it names none). */
export const slotPosts = (slot: Pick<PostingSlot, "platforms">) => Math.max(1, slot.platforms.length)

const round1 = (n: number) => Math.round(n * 10) / 10

/* -------------------------------- Capacity -------------------------------- */

export type CapacityStatus = "match" | "under" | "over" | "empty"

export interface CapacitySummary {
  activeSlots: number
  pausedSlots: number
  postsPerWeek: number
  target: number
  /** postsPerWeek − target. */
  gap: number
  status: CapacityStatus
}

export function capacitySummary(slots: PostingSlot[], settings: Pick<AppSettings, "weekly_post_target">): CapacitySummary {
  const active = slots.filter((s) => s.is_active)
  const postsPerWeek = active.reduce((n, s) => n + slotPosts(s), 0)
  const target = Math.max(0, Math.round(settings.weekly_post_target))
  const gap = postsPerWeek - target
  return {
    activeSlots: active.length,
    pausedSlots: slots.length - active.length,
    postsPerWeek,
    target,
    gap,
    status: !active.length ? "empty" : gap === 0 ? "match" : gap < 0 ? "under" : "over",
  }
}

/* -------------------------------- Platforms ------------------------------- */

export interface PlatformLoad {
  platform: PlatformId
  label: string
  /** Posts per week the active slots put on this platform. */
  posts: number
  /** Weekly posting frequency from the platform strategy (active strategies only). */
  target: number | null
  strategyActive: boolean
}

/** Platforms that have slots or an active strategy, in canonical order. */
export function platformLoad(slots: PostingSlot[], strategies: PlatformStrategy[]): PlatformLoad[] {
  const posts = new Map<PlatformId, number>()
  for (const slot of slots) {
    if (!slot.is_active) continue
    for (const p of slot.platforms) posts.set(p, (posts.get(p) ?? 0) + 1)
  }
  return PLATFORM_IDS.map((platform) => {
    const strategy = strategies.find((s) => s.platform === platform)
    const active = Boolean(strategy?.is_active)
    return {
      platform,
      label: PLATFORMS[platform].label,
      posts: posts.get(platform) ?? 0,
      target: active && strategy ? Math.round(strategy.posting_frequency) : null,
      strategyActive: active,
    }
  }).filter((row) => row.posts > 0 || row.strategyActive)
}

/** Posts from active slots that name no platform ("any platform"). */
export function anyPlatformPosts(slots: PostingSlot[]): number {
  return slots.filter((s) => s.is_active && !s.platforms.length).length
}

/* -------------------------------- Pillar mix ------------------------------- */

export interface SlotMixRow {
  pillarId: ID
  label: string
  color: CategoricalColor
  posts: number
  /** Share of pillar-assigned slot posts, 0–100. */
  actualPct: number
  /** Pillar target normalised over active pillars, 0–100. */
  targetPct: number
  deviation: number
  status: "under" | "over" | "on_target"
}

export interface SlotMix {
  rows: SlotMixRow[]
  /** Slot posts with an active pillar. */
  total: number
  /** Slot posts without a pillar (or with an inactive one). */
  unassigned: number
  warnings: { pillarId: ID; direction: "under" | "over"; message: string }[]
}

/**
 * Slot posts per active pillar vs `target_percentage` (normalised). Under-represented when the deviation is
 * below −min(tolerance, target ÷ 2), over when above the tolerance — the same rule the analytics mix uses.
 */
export function slotPillarMix(slots: PostingSlot[], pillars: ContentPillar[], tolerance: number): SlotMix {
  const active = pillars.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const counts = new Map(active.map((p) => [p.id, 0]))
  let unassigned = 0
  for (const slot of slots) {
    if (!slot.is_active) continue
    const n = slotPosts(slot)
    const count = slot.pillar_id ? counts.get(slot.pillar_id) : undefined
    if (count === undefined || !slot.pillar_id) unassigned += n
    else counts.set(slot.pillar_id, count + n)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const targetTotal = active.reduce((n, p) => n + Math.max(0, p.target_percentage), 0)
  const rows = active.map((p): SlotMixRow => {
    const posts = counts.get(p.id) ?? 0
    const actualPct = total ? round1((posts / total) * 100) : 0
    const targetPct = targetTotal ? round1((Math.max(0, p.target_percentage) / targetTotal) * 100) : 0
    const deviation = round1(actualPct - targetPct)
    const status = deviation < -Math.min(tolerance, targetPct / 2) ? "under" : deviation > tolerance ? "over" : "on_target"
    return { pillarId: p.id, label: p.name || "Untitled pillar", color: p.color, posts, actualPct, targetPct, deviation, status }
  })
  const warnings = total
    ? rows
        .filter((r) => r.status !== "on_target")
        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
        .map((r) => ({
          pillarId: r.pillarId,
          direction: r.status === "under" ? ("under" as const) : ("over" as const),
          message: r.posts
            ? `${r.label} gets ${Math.round(r.actualPct)}% of your slot posts vs a ${Math.round(r.targetPct)}% target`
            : `No slot for ${r.label} — its target is ${Math.round(r.targetPct)}%`,
        }))
    : []
  return { rows, total, unassigned, warnings }
}

/* --------------------------------- Ordering -------------------------------- */

/** One day's slots in schedule order. */
export function daySlots(slots: PostingSlot[], day: number): PostingSlot[] {
  return slots.filter((s) => s.day_of_week === day).sort(compareSlots)
}

/** 0…n-1 for `ordered`, returning only rows whose sort_order changes. */
function renumber(ordered: PostingSlot[]): { id: ID; patch: { sort_order: number } }[] {
  return ordered.flatMap((slot, index) => (slot.sort_order === index ? [] : [{ id: slot.id, patch: { sort_order: index } }]))
}

/** Swap a slot with its neighbour within its day. Null when it can't move that way. */
export function moveSlotUpdates(slots: PostingSlot[], id: ID, direction: -1 | 1): { id: ID; patch: { sort_order: number } }[] | null {
  const slot = slots.find((s) => s.id === id)
  if (!slot) return null
  const ordered = daySlots(slots, slot.day_of_week)
  const index = ordered.findIndex((s) => s.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ordered.length) return null
  const next = [...ordered]
  ;[next[index], next[target]] = [next[target], next[index]]
  return renumber(next)
}

/**
 * Position for a new slot on `day`: in time order among that day's slots (untimed slots go last).
 * Returns the new slot's sort_order and the existing slots that shift down.
 */
export function insertionPlan(slots: PostingSlot[], day: number, time: string | null): { sortOrder: number; updates: { id: ID; patch: { sort_order: number } }[] } {
  const ordered = daySlots(slots, day)
  let index = ordered.length
  if (time) {
    const at = ordered.findIndex((s) => !s.time || s.time > time)
    if (at >= 0) index = at
  }
  const updates = ordered.flatMap((slot, i) => {
    const order = i < index ? i : i + 1
    return slot.sort_order === order ? [] : [{ id: slot.id, patch: { sort_order: order } }]
  })
  return { sortOrder: index, updates }
}

/* ------------------------- Recommended weekly strategy ------------------------- */

/** Pillar keywords per §49 theme, most specific first. */
const THEME_KEYWORDS: Record<string, string[]> = {
  "Educational / Authority": ["educat", "authorit"],
  "Story / Journey": ["journey", "story"],
  "Tutorial / Framework": ["educat", "tutorial", "framework"],
  "Opinion / Leadership": ["leader", "opinion", "authorit"],
  "Behind the Scenes": ["journey", "behind"],
  "Personal / Lifestyle": ["personal", "lifestyle"],
  "Reflection / Community": ["personal", "reflect", "communit"],
}

/** Best active pillar for a slot theme: by name first, then by description / examples. */
export function pillarForTheme(label: string, pillars: ContentPillar[]): ContentPillar | null {
  const active = pillars.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const keywords = THEME_KEYWORDS[label] ?? label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4)
  for (const keyword of keywords) {
    const hit = active.find((p) => p.name.toLowerCase().includes(keyword))
    if (hit) return hit
  }
  for (const keyword of keywords) {
    const hit = active.find((p) => `${p.description} ${p.examples.join(" ")}`.toLowerCase().includes(keyword))
    if (hit) return hit
  }
  return null
}

/** The §49 themes, Monday first. */
export const RECOMMENDED_THEMES = POSTING_SLOTS.map((s) => s.label)

/**
 * The recommended weekly strategy (spec §49) mapped onto this workspace: Monday Educational / Authority,
 * Tuesday Story / Journey, Wednesday Tutorial / Framework, Thursday Opinion / Leadership, Friday Behind the Scenes,
 * Saturday Personal / Lifestyle, Sunday Reflection / Community — pillars and formats matched by name,
 * platforms narrowed to the ones you're active on.
 */
export function recommendedSlots(input: {
  pillars: ContentPillar[]
  formats: ContentFormat[]
  strategies: PlatformStrategy[]
  brand: Pick<BrandProfile, "main_platforms">
}): InsertRow<"content_calendar">[] {
  const activePlatforms = PLATFORM_IDS.filter(
    (p) => input.strategies.some((s) => s.platform === p && s.is_active) || input.brand.main_platforms.includes(p)
  )
  return POSTING_SLOTS.map((s) => {
    let platforms: PlatformId[] = activePlatforms.length ? s.platforms.filter((p) => activePlatforms.includes(p)) : [...s.platforms]
    if (!platforms.length && activePlatforms.length) platforms = [activePlatforms[0]]
    const format = input.formats.find((f) => f.name.toLowerCase() === s.format.toLowerCase())
    return {
      day_of_week: s.day,
      label: s.label,
      pillar_id: pillarForTheme(s.label, input.pillars)?.id ?? null,
      format_id: format?.id ?? null,
      platforms,
      time: s.time,
      sort_order: 0,
      is_active: true,
    }
  })
}
