/**
 * Content mix vs targets — pillars (spec §6) and funnel stages (spec §8).
 * The window covers what the audience saw (published) plus what is already
 * committed for the coming days (scheduled).
 */
import { addDays } from "date-fns"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES } from "@/lib/constants"
import type { AppSettings, ContentItem, ContentPillar, Database, FunnelStage } from "@/lib/types"
import {
  inRange,
  isPublishedItem,
  publishedAtOf,
  resolveRange,
  roundTo,
  timeOf,
  toISORange,
  trailingDays,
  type DateRange,
  type ISORange,
  type RangeOptions,
} from "./shared"

/** Mix warnings are only raised once at least this many items are in the window. */
export const MIN_MIX_SAMPLE = 5

export interface MixOptions extends RangeOptions {
  /** Also count unpublished items scheduled up to this many days ahead (default 7; 0 when `start` is given). */
  upcomingDays?: number
}

export type MixStatus = "under" | "over" | "on_target"

export interface MixRow {
  key: string
  label: string
  count: number
  /** Share of counted items, 0–100 (1 decimal). */
  actualPct: number
  /** Target share normalised so all targets sum to 100 (1 decimal). */
  targetPct: number
  /** actualPct − targetPct, in percentage points. */
  deviation: number
  status: MixStatus
}

export interface PillarMixRow extends MixRow {
  pillar: ContentPillar
}

export interface FunnelMixRow extends MixRow {
  stage: FunnelStage
}

export interface MixWarning {
  key: string
  label: string
  direction: "under" | "over"
  deviation: number
  /** e.g. "Business is at 2% vs a 5% target — under-represented". */
  message: string
}

export interface MixResult<R extends MixRow> {
  rows: R[]
  /** Items counted (those with an active pillar / a funnel stage). */
  total: number
  /** Items in the window without an active pillar / a funnel stage. */
  unassigned: number
  /** Sorted by |deviation| desc; empty until `enoughData`. */
  warnings: MixWarning[]
  /** Sum of the raw targets (they are normalised to 100 for comparison). */
  targetTotal: number
  /** total ≥ MIN_MIX_SAMPLE. */
  enoughData: boolean
  window: ISORange
}

export type PillarMix = MixResult<PillarMixRow>
export type FunnelMix = MixResult<FunnelMixRow>

/** Items in the mix window: published inside it, plus unpublished items scheduled from now to `upcomingDays` ahead. */
export function mixWindowItems(db: Database, now: Date, options: MixOptions = {}): { items: ContentItem[]; range: DateRange } {
  const range = resolveRange(now, options, 30) ?? trailingDays(now, 30)
  const upcoming = Math.max(0, options.upcomingDays ?? (options.start ? 0 : 7))
  const upcomingEnd = addDays(now, upcoming)
  const nowMs = now.getTime()
  const upcomingEndMs = upcomingEnd.getTime()
  const items = db.content_items.filter((item) => {
    if (isPublishedItem(item)) return inRange(publishedAtOf(item), range)
    if (!upcoming) return false
    const at = timeOf(item, "scheduled_at")
    return at >= nowMs && at <= upcomingEndMs
  })
  return { items, range: upcoming && upcomingEnd > range.end ? { start: range.start, end: upcomingEnd } : range }
}

interface MixInput {
  key: string
  label: string
  count: number
  target: number
}

/**
 * Under-represented when deviation < −min(tolerance, target ÷ 2) — the target-relative bound keeps
 * small pillars (e.g. a 5% Business pillar) from never being flagged; over-represented when deviation > tolerance.
 */
function evaluateMix(inputs: MixInput[], unassigned: number, tolerance: number, range: DateRange): MixResult<MixRow> {
  const total = inputs.reduce((acc, i) => acc + i.count, 0)
  const targetTotal = inputs.reduce((acc, i) => acc + Math.max(0, i.target), 0)
  const rows: MixRow[] = inputs.map((i) => {
    const actualPct = total ? roundTo((i.count / total) * 100) : 0
    const targetPct = targetTotal ? roundTo((Math.max(0, i.target) / targetTotal) * 100) : 0
    const deviation = roundTo(actualPct - targetPct)
    const status: MixStatus =
      deviation < -Math.min(tolerance, targetPct / 2) ? "under" : deviation > tolerance ? "over" : "on_target"
    return { key: i.key, label: i.label, count: i.count, actualPct, targetPct, deviation, status }
  })
  const enoughData = total >= MIN_MIX_SAMPLE
  const warnings: MixWarning[] = enoughData
    ? rows
        .filter((r) => r.status !== "on_target")
        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
        .map((r) => {
          const direction = r.status === "under" ? "under" : "over"
          return {
            key: r.key,
            label: r.label,
            direction,
            deviation: r.deviation,
            message: `${r.label} is at ${Math.round(r.actualPct)}% vs a ${Math.round(r.targetPct)}% target — ${direction}-represented`,
          }
        })
    : []
  return { rows, total, unassigned, warnings, targetTotal, enoughData, window: toISORange(range) }
}

/** Per active pillar: share of items published (last `days`, default 30) or scheduled ahead vs target_percentage. */
export function pillarMix(db: Database, now: Date, settings: AppSettings, options: MixOptions = {}): PillarMix {
  const { items, range } = mixWindowItems(db, now, options)
  const pillars = db.content_pillars
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const counts = new Map(pillars.map((p) => [p.id, 0]))
  let unassigned = 0
  for (const item of items) {
    const count = item.pillar_id ? counts.get(item.pillar_id) : undefined
    if (count === undefined || !item.pillar_id) unassigned++
    else counts.set(item.pillar_id, count + 1)
  }
  const result = evaluateMix(
    pillars.map((p) => ({ key: p.id, label: p.name, count: counts.get(p.id) ?? 0, target: p.target_percentage })),
    unassigned,
    settings.pillar_tolerance,
    range
  )
  return { ...result, rows: result.rows.map((row, i) => ({ ...row, pillar: pillars[i] })) }
}

/** TOFU / MOFU / BOFU share of items in the window vs settings.funnel_targets. */
export function funnelMix(db: Database, now: Date, settings: AppSettings, options: MixOptions = {}): FunnelMix {
  const { items, range } = mixWindowItems(db, now, options)
  const counts: Record<FunnelStage, number> = { tofu: 0, mofu: 0, bofu: 0 }
  let unassigned = 0
  for (const item of items) {
    if (item.funnel_stage && item.funnel_stage in counts) counts[item.funnel_stage]++
    else unassigned++
  }
  const result = evaluateMix(
    FUNNEL_STAGE_IDS.map((stage) => ({
      key: stage,
      label: FUNNEL_STAGES[stage].label,
      count: counts[stage],
      target: settings.funnel_targets?.[stage] ?? 0,
    })),
    unassigned,
    settings.pillar_tolerance,
    range
  )
  return { ...result, rows: result.rows.map((row, i) => ({ ...row, stage: FUNNEL_STAGE_IDS[i] })) }
}

/** True when a mix has at least one warning. */
export function isMixUnbalanced(mix: { warnings: readonly MixWarning[] }): boolean {
  return mix.warnings.length > 0
}
