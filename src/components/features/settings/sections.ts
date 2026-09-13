/**
 * Form values, defaults, validation and save patches for the settings sections (pure).
 * Integer columns (targets, windows, days) are rounded before saving; thresholds and the
 * pillar tolerance may be decimals.
 */
import { TABLE_DEFAULTS } from "@/lib/data/defaults"
import type { AppSettings, EngagementTaskConfig, FunnelTargets, MetaField, UpdateRow, WinnerMetric } from "@/lib/types"

type SettingsFields = Omit<AppSettings, MetaField>
export type FieldErrors<K extends string> = Partial<Record<K, string>>

const DEFAULTS: SettingsFields = TABLE_DEFAULTS.app_settings

export const LIMITS = {
  weeklyTarget: { min: 1, max: 100 },
  tolerance: { min: 1, max: 50 },
  window: { min: 3, max: 100 },
  threshold: { max: 20 },
  bufferDays: { max: 90 },
  taskTarget: { max: 500 },
  maxTasks: 12,
  ownerLength: 60,
  taskLabelLength: 60,
} as const

const isInt = (n: number | null): n is number => n !== null && Number.isInteger(n)
const round2 = (n: number) => Math.round(n * 100) / 100

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

/* --------------------------------- General -------------------------------- */

export interface GeneralValues {
  weekly_post_target: number | null
  week_starts_on: 0 | 1
  timezone: string
  default_owner: string
  pillar_tolerance: number | null
}

export function generalFromSettings(s: SettingsFields): GeneralValues {
  return {
    weekly_post_target: s.weekly_post_target,
    week_starts_on: s.week_starts_on,
    timezone: s.timezone,
    default_owner: s.default_owner,
    pillar_tolerance: s.pillar_tolerance,
  }
}

export const GENERAL_DEFAULTS = generalFromSettings(DEFAULTS)

export function validateGeneral(v: GeneralValues): FieldErrors<keyof GeneralValues> {
  const errors: FieldErrors<keyof GeneralValues> = {}
  const { min, max } = LIMITS.weeklyTarget
  if (!isInt(v.weekly_post_target) || v.weekly_post_target < min || v.weekly_post_target > max) {
    errors.weekly_post_target = `Enter a whole number of posts from ${min} to ${max}.`
  }
  if (!isValidTimeZone(v.timezone)) errors.timezone = "Choose a timezone from the list."
  if (v.default_owner.trim().length > LIMITS.ownerLength) errors.default_owner = `Keep it under ${LIMITS.ownerLength} characters.`
  if (v.pillar_tolerance === null || v.pillar_tolerance < LIMITS.tolerance.min || v.pillar_tolerance > LIMITS.tolerance.max) {
    errors.pillar_tolerance = `Enter ${LIMITS.tolerance.min} to ${LIMITS.tolerance.max} percentage points.`
  }
  return errors
}

export function generalPatch(v: GeneralValues): UpdateRow<"app_settings"> {
  return {
    weekly_post_target: Math.round(v.weekly_post_target ?? DEFAULTS.weekly_post_target),
    week_starts_on: v.week_starts_on,
    timezone: v.timezone.trim(),
    default_owner: v.default_owner.trim(),
    pillar_tolerance: round2(v.pillar_tolerance ?? DEFAULTS.pillar_tolerance),
  }
}

/* ------------------------------- Performance ------------------------------ */

export interface PerformanceValues {
  winner_metric: WinnerMetric
  winner_window: number | null
  winner_min_sample: number | null
  tier_good: number | null
  tier_winner: number | null
  tier_breakout: number | null
  buffer_healthy_days: number | null
  buffer_warning_days: number | null
}

export function performanceFromSettings(s: SettingsFields): PerformanceValues {
  return {
    winner_metric: s.winner_metric,
    winner_window: s.winner_window,
    winner_min_sample: s.winner_min_sample,
    tier_good: s.tier_good,
    tier_winner: s.tier_winner,
    tier_breakout: s.tier_breakout,
    buffer_healthy_days: s.buffer_healthy_days,
    buffer_warning_days: s.buffer_warning_days,
  }
}

export const PERFORMANCE_DEFAULTS = performanceFromSettings(DEFAULTS)

export function validatePerformance(v: PerformanceValues): FieldErrors<keyof PerformanceValues> {
  const errors: FieldErrors<keyof PerformanceValues> = {}
  const { min, max } = LIMITS.window
  if (!isInt(v.winner_window) || v.winner_window < min || v.winner_window > max) {
    errors.winner_window = `Enter a whole number of posts from ${min} to ${max}.`
  }
  if (!isInt(v.winner_min_sample) || v.winner_min_sample < 1) errors.winner_min_sample = "Enter a whole number of at least 1."
  else if (isInt(v.winner_window) && v.winner_min_sample > v.winner_window) {
    errors.winner_min_sample = "Can't be larger than the comparison window."
  }

  if (v.tier_good === null || v.tier_good <= 1) errors.tier_good = "Good must be above 1× — the platform average."
  else if (v.tier_good > LIMITS.threshold.max) errors.tier_good = `Keep thresholds at or below ${LIMITS.threshold.max}×.`
  if (v.tier_winner === null) errors.tier_winner = "Enter a multiple, e.g. 2."
  else if (v.tier_good !== null && v.tier_winner <= v.tier_good) errors.tier_winner = "Winner must be higher than Good."
  if (v.tier_breakout === null) errors.tier_breakout = "Enter a multiple, e.g. 3."
  else if (v.tier_winner !== null && v.tier_breakout <= v.tier_winner) errors.tier_breakout = "Breakout must be higher than Winner."
  else if (v.tier_breakout > LIMITS.threshold.max) errors.tier_breakout = `Keep thresholds at or below ${LIMITS.threshold.max}×.`

  const days = LIMITS.bufferDays.max
  if (!isInt(v.buffer_healthy_days) || v.buffer_healthy_days < 1 || v.buffer_healthy_days > days) {
    errors.buffer_healthy_days = `Enter 1 to ${days} days.`
  }
  if (!isInt(v.buffer_warning_days) || v.buffer_warning_days < 0 || v.buffer_warning_days > days) {
    errors.buffer_warning_days = `Enter 0 to ${days} days.`
  } else if (isInt(v.buffer_healthy_days) && v.buffer_warning_days >= v.buffer_healthy_days) {
    errors.buffer_warning_days = "Must be lower than the healthy threshold."
  }
  return errors
}

export function performancePatch(v: PerformanceValues): UpdateRow<"app_settings"> {
  return {
    winner_metric: v.winner_metric,
    winner_window: Math.round(v.winner_window ?? DEFAULTS.winner_window),
    winner_min_sample: Math.round(v.winner_min_sample ?? DEFAULTS.winner_min_sample),
    tier_good: round2(v.tier_good ?? DEFAULTS.tier_good),
    tier_winner: round2(v.tier_winner ?? DEFAULTS.tier_winner),
    tier_breakout: round2(v.tier_breakout ?? DEFAULTS.tier_breakout),
    buffer_healthy_days: Math.round(v.buffer_healthy_days ?? DEFAULTS.buffer_healthy_days),
    buffer_warning_days: Math.round(v.buffer_warning_days ?? DEFAULTS.buffer_warning_days),
  }
}

/* --------------------------------- Funnel --------------------------------- */

export interface FunnelValues {
  tofu: number | null
  mofu: number | null
  bofu: number | null
}

export const FUNNEL_KEYS = ["tofu", "mofu", "bofu"] as const

export function funnelFromSettings(s: SettingsFields): FunnelValues {
  const t = s.funnel_targets ?? DEFAULTS.funnel_targets
  return { tofu: t.tofu, mofu: t.mofu, bofu: t.bofu }
}

export const FUNNEL_DEFAULTS = funnelFromSettings(DEFAULTS)

export function funnelTotal(v: FunnelValues): number {
  return FUNNEL_KEYS.reduce((acc, key) => acc + (v[key] ?? 0), 0)
}

export function validateFunnel(v: FunnelValues): FieldErrors<keyof FunnelValues | "total"> {
  const errors: FieldErrors<keyof FunnelValues | "total"> = {}
  for (const key of FUNNEL_KEYS) {
    const value = v[key]
    if (!isInt(value) || value < 0 || value > 100) errors[key] = "Enter a whole percentage from 0 to 100."
  }
  const total = funnelTotal(v)
  if (!errors.tofu && !errors.mofu && !errors.bofu && total !== 100) {
    errors.total = `Targets add up to ${total}% — they must total 100%.`
  }
  return errors
}

/** Scale targets to exactly 100 (largest-remainder rounding). All zero → the defaults. */
export function normalizeFunnel(v: FunnelValues): FunnelValues {
  const raw = FUNNEL_KEYS.map((key) => Math.max(0, v[key] ?? 0))
  const total = raw.reduce((a, b) => a + b, 0)
  if (total <= 0) return { ...FUNNEL_DEFAULTS }
  const exact = raw.map((n) => (n / total) * 100)
  const floors = exact.map(Math.floor)
  let remainder = 100 - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((n, i) => ({ i, frac: n - Math.floor(n) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (remainder <= 0) break
    floors[i]++
    remainder--
  }
  return { tofu: floors[0], mofu: floors[1], bofu: floors[2] }
}

export function funnelPatch(v: FunnelValues): UpdateRow<"app_settings"> {
  const funnel_targets: FunnelTargets = {
    tofu: Math.round(v.tofu ?? 0),
    mofu: Math.round(v.mofu ?? 0),
    bofu: Math.round(v.bofu ?? 0),
  }
  return { funnel_targets }
}

/* ------------------------------- Engagement ------------------------------- */

export interface EngagementTaskDraft {
  /** Stable React key: the task key for saved tasks, a temporary id for new rows. */
  rid: string
  /** Saved key ("" for new tasks — assigned from the label on save). History is stored by key. */
  key: string
  label: string
  target: number | null
}

export interface EngagementValues {
  tasks: EngagementTaskDraft[]
}

function draftTasks(tasks: EngagementTaskConfig[]): EngagementTaskDraft[] {
  return tasks.map((t) => ({ rid: t.key, key: t.key, label: t.label, target: t.target }))
}

export function engagementFromSettings(s: SettingsFields): EngagementValues {
  return { tasks: draftTasks(s.engagement_tasks ?? []) }
}

export const ENGAGEMENT_DEFAULTS: EngagementValues = { tasks: draftTasks(DEFAULTS.engagement_tasks) }

export interface EngagementErrors {
  rows: Record<string, { label?: string; target?: string }>
  list?: string
}

export function validateEngagement(v: EngagementValues): EngagementErrors {
  const rows: EngagementErrors["rows"] = {}
  const seen = new Set<string>()
  for (const task of v.tasks) {
    const row: { label?: string; target?: string } = {}
    const label = task.label.trim()
    if (!label) row.label = "Name the task."
    else if (label.length > LIMITS.taskLabelLength) row.label = `Keep it under ${LIMITS.taskLabelLength} characters.`
    else if (seen.has(label.toLowerCase())) row.label = "Another task already has this name."
    seen.add(label.toLowerCase())
    if (!isInt(task.target) || task.target < 0 || task.target > LIMITS.taskTarget.max) {
      row.target = `Whole number, 0–${LIMITS.taskTarget.max}.`
    }
    if (row.label || row.target) rows[task.rid] = row
  }
  const list = v.tasks.length > LIMITS.maxTasks ? `Keep it to ${LIMITS.maxTasks} tasks or fewer — a daily list should fit on one screen.` : undefined
  return { rows, list }
}

export function engagementValid(errors: EngagementErrors): boolean {
  return !errors.list && Object.keys(errors.rows).length === 0
}

/** "Reply to comments" → "reply_to_comments", unique among `taken`. */
export function taskKey(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "task"
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`
  return key
}

export function engagementPatch(v: EngagementValues): UpdateRow<"app_settings"> {
  const taken = new Set(v.tasks.map((t) => t.key).filter(Boolean))
  const engagement_tasks: EngagementTaskConfig[] = v.tasks.map((t) => {
    const key = t.key || taskKey(t.label, taken)
    taken.add(key)
    return { key, label: t.label.trim(), target: Math.round(t.target ?? 0) }
  })
  return { engagement_tasks }
}
