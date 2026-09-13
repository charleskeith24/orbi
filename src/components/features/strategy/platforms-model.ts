/**
 * Platform Strategy model: the weekly plan across platforms vs the weekly posting target,
 * 30-day performance per platform and the per-platform form. Pure — no React, no store.
 */
import { platformPerformance, type PlatformAggregate } from "@/lib/analytics"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import type { AppSettings, Database, ID, PlatformId, PlatformStrategy, UpdateRow } from "@/lib/types"

export interface PlatformPlanRow {
  platform: PlatformId
  /** null when the workspace has no strategy row for this platform yet. */
  strategy: PlatformStrategy | null
  /** Last 30 days; null without published posts. */
  perf: PlatformAggregate | null
  /** posting_frequency × 30 ÷ 7 for active platforms — what a 30-day window holds at the planned pace. */
  planned30: number
}

export interface PlatformPlan {
  /** In canonical platform order. */
  rows: PlatformPlanRow[]
  /** Σ posting_frequency of active platforms (1 decimal). */
  weeklyTotal: number
  target: number
  /** weeklyTotal − target (1 decimal). */
  delta: number
  activeCount: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function platformPlan(db: Database, now: Date, settings: AppSettings): PlatformPlan {
  const perf = new Map(platformPerformance(db, now, { days: 30, settings }).map((p) => [p.platform, p]))
  const strategies = new Map<PlatformId, PlatformStrategy>()
  for (const s of db.content_platforms) if (!strategies.has(s.platform)) strategies.set(s.platform, s)

  const rows = PLATFORM_IDS.map((platform): PlatformPlanRow => {
    const strategy = strategies.get(platform) ?? null
    return {
      platform,
      strategy,
      perf: perf.get(platform) ?? null,
      planned30: strategy?.is_active ? round1((strategy.posting_frequency * 30) / 7) : 0,
    }
  })
  const active = rows.filter((r) => r.strategy?.is_active)
  const weeklyTotal = round1(active.reduce((acc, r) => acc + (r.strategy?.posting_frequency ?? 0), 0))
  const target = Math.max(0, Math.round(settings.weekly_post_target))
  return { rows, weeklyTotal, target, delta: round1(weeklyTotal - target), activeCount: active.length }
}

/** Plan vs weekly target: matches within half a post, otherwise a warning with the gap. */
export function planMessage(plan: Pick<PlatformPlan, "weeklyTotal" | "target" | "delta" | "activeCount">): {
  tone: "good" | "warning"
  text: string
} {
  if (!plan.activeCount) return { tone: "warning", text: "No active platforms — switch one on to build your weekly plan." }
  const posts = (n: number) => `${n} ${n === 1 ? "post" : "posts"}`
  if (Math.abs(plan.delta) < 0.5) return { tone: "good", text: `Matches your weekly target of ${posts(plan.target)}.` }
  return plan.delta > 0
    ? { tone: "warning", text: `${posts(plan.delta)} a week more than your weekly target of ${plan.target} — raise the target or trim a platform.` }
    : { tone: "warning", text: `${posts(Math.abs(plan.delta))} a week short of your weekly target of ${plan.target} — add frequency or lower the target.` }
}

/** Published posts vs the planned pace; "behind" below 70% of plan. */
export function paceVsPlan(row: PlatformPlanRow): "behind" | "on_plan" | "no_plan" {
  if (!row.planned30) return "no_plan"
  return (row.perf?.posts ?? 0) < row.planned30 * 0.7 ? "behind" : "on_plan"
}

export function platformLabel(platform: PlatformId): string {
  return PLATFORMS[platform]?.label ?? platform
}

/* ---------------------------------- Form ---------------------------------- */

export interface PlatformFormValues {
  handle: string
  primary_goal_id: ID | null
  posting_frequency: number | null
  preferred_format_ids: ID[]
  preferred_pillar_ids: ID[]
  audience: string
  cta_style: string
  current_followers: number | null
  notes: string
}

export type PlatformFormErrors = Partial<Record<"posting_frequency" | "current_followers", string>>

export function platformFormValues(s: PlatformStrategy): PlatformFormValues {
  return {
    handle: s.handle,
    primary_goal_id: s.primary_goal_id,
    posting_frequency: s.posting_frequency,
    preferred_format_ids: s.preferred_format_ids,
    preferred_pillar_ids: s.preferred_pillar_ids,
    audience: s.audience,
    cta_style: s.cta_style,
    current_followers: s.current_followers,
    notes: s.notes,
  }
}

export function validatePlatform(values: PlatformFormValues): PlatformFormErrors {
  const errors: PlatformFormErrors = {}
  const f = values.posting_frequency
  if (f === null || !Number.isFinite(f)) errors.posting_frequency = "Enter posts per week (0 or more)."
  else if (f < 0 || f > 50) errors.posting_frequency = "Between 0 and 50 posts a week."
  const followers = values.current_followers
  if (followers !== null && (!Number.isFinite(followers) || followers < 0)) errors.current_followers = "Followers can't be negative."
  return errors
}

/** Row patch; `current_followers` is an integer column, frequency may be fractional (e.g. 0.5 = every other week). */
export function platformPatch(values: PlatformFormValues): UpdateRow<"content_platforms"> {
  return {
    handle: values.handle.trim().replace(/^@+/, "").replace(/\s+/g, ""),
    primary_goal_id: values.primary_goal_id,
    posting_frequency: Math.min(50, Math.max(0, round1(values.posting_frequency ?? 0))),
    preferred_format_ids: values.preferred_format_ids,
    preferred_pillar_ids: values.preferred_pillar_ids,
    audience: values.audience.trim(),
    cta_style: values.cta_style.trim(),
    current_followers: values.current_followers === null ? null : Math.max(0, Math.round(values.current_followers)),
    notes: values.notes.trim(),
  }
}

export function samePlatformValues(a: PlatformFormValues, b: PlatformFormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
