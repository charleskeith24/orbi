/**
 * Goals page model: per-goal progress and linked content, the strategic focus (primary / secondary goal)
 * and the goal form. Pure — no React, no store.
 */
import { goalProgress, inRange, isPublishedItem, publishedAtOf, trailingDays, type GoalProgress } from "@/lib/analytics"
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS, GOAL_METRIC_MAP, GOAL_PERIODS } from "@/lib/constants"
import { translator, type UiLang } from "@/lib/i18n/core"
import type {
  AppSettings,
  BrandProfile,
  CategoricalColor,
  ContentGoal,
  Database,
  GoalCategory,
  GoalMetric,
  GoalPeriod,
  ID,
  UpdateRow,
} from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { cleanList } from "./brand-model"
import { goalFormMessages } from "./goals-messages"

export type GoalRole = "primary" | "secondary"

/** Identity colour per goal category (fixed categorical order — colour follows the category). */
export const CATEGORY_COLORS: Record<GoalCategory, CategoricalColor> = {
  awareness: "blue",
  authority: "orange",
  community: "aqua",
  leads: "yellow",
  business: "magenta",
}

export interface GoalRow {
  goal: ContentGoal
  progress: GoalProgress
  role: GoalRole | null
  /** Posts published in the last 30 days that carry this goal. */
  published30: number
  /** published30 ÷ all posts published in the last 30 days × 100; null when nothing was published. */
  share30: number | null
  /** Unpublished content items carrying this goal. */
  inProduction: number
  /** Open ideas (not converted or archived) carrying this goal. */
  ideas: number
}

export interface GoalsSummary {
  /** Primary first, then secondary, active goals in category order, inactive last. */
  rows: GoalRow[]
  /** Posts published in the last 30 days. */
  posts30: number
  /** …of which carried no goal. */
  unassigned30: number
  /** Last-30-day posts per goal category. */
  byCategory: Record<GoalCategory, number>
}

function bump(map: Map<ID, number>, key: ID) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

export function goalsSummary(db: Database, now: Date, settings: AppSettings): GoalsSummary {
  const brand = db.brand_profiles[0]
  const range = trailingDays(now, 30)
  const goals = new Map(db.content_goals.map((g) => [g.id, g]))
  const published = new Map<ID, number>()
  const production = new Map<ID, number>()
  const ideas = new Map<ID, number>()
  const byCategory = Object.fromEntries(GOAL_CATEGORY_IDS.map((c) => [c, 0])) as Record<GoalCategory, number>
  let posts30 = 0
  let unassigned30 = 0

  for (const item of db.content_items) {
    const goal = item.goal_id ? goals.get(item.goal_id) : undefined
    if (isPublishedItem(item)) {
      if (!inRange(publishedAtOf(item), range)) continue
      posts30++
      if (goal) {
        bump(published, goal.id)
        byCategory[goal.category]++
      } else {
        unassigned30++
      }
    } else if (goal) {
      bump(production, goal.id)
    }
  }
  for (const idea of db.content_ideas) {
    if (idea.goal_id && goals.has(idea.goal_id) && idea.status !== "archived" && idea.status !== "converted") bump(ideas, idea.goal_id)
  }

  const rank = (row: GoalRow) => (row.role === "primary" ? 0 : row.role === "secondary" ? 1 : row.goal.is_active ? 2 : 3)
  const rows = db.content_goals
    .map((goal): GoalRow => {
      const count = published.get(goal.id) ?? 0
      return {
        goal,
        progress: goalProgress(db, goal, now, settings),
        role: goal.id === brand?.primary_goal_id ? "primary" : goal.id === brand?.secondary_goal_id ? "secondary" : null,
        published30: count,
        share30: posts30 ? Math.round((count / posts30) * 100) : null,
        inProduction: production.get(goal.id) ?? 0,
        ideas: ideas.get(goal.id) ?? 0,
      }
    })
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        GOAL_CATEGORY_IDS.indexOf(a.goal.category) - GOAL_CATEGORY_IDS.indexOf(b.goal.category) ||
        a.goal.name.localeCompare(b.goal.name)
    )
  return { rows, posts30, unassigned30, byCategory }
}

/* --------------------------------- Labels -------------------------------- */

export function metricLabel(metric: GoalMetric): string {
  return GOAL_METRIC_MAP[metric]?.label.toLowerCase() ?? metric
}

/** "per month" */
export function periodLabel(period: GoalPeriod): string {
  return GOAL_PERIODS.find((p) => p.id === period)?.label ?? ""
}

export function periodNoun(period: GoalPeriod): string {
  return period === "weekly" ? "week" : period === "quarterly" ? "quarter" : "month"
}

export function goalMetric(goal: Pick<ContentGoal, "category" | "target_metric">): GoalMetric {
  return goal.target_metric ?? GOAL_CATEGORIES[goal.category]?.metric ?? "views"
}

/** "150,000 reach per month" — empty without a positive target. */
export function goalTargetText(goal: Pick<ContentGoal, "category" | "target_metric" | "target_value" | "period">): string {
  if (!goal.target_value || goal.target_value <= 0) return ""
  return `${formatNumber(goal.target_value)} ${metricLabel(goalMetric(goal))} ${periodLabel(goal.period)}`.trim()
}

export type GoalPace = "hit" | "on_track" | "behind" | "not_started" | "no_target"

/** `started` false (nothing published in the workspace yet): a zero hasn't fallen behind — it hasn't begun. */
export function goalPace(progress: GoalProgress, started = true): GoalPace {
  if (progress.target === null) return "no_target"
  if (progress.current >= progress.target) return "hit"
  if (progress.onTrack) return "on_track"
  return !started && progress.current === 0 ? "not_started" : "behind"
}

/* ------------------------------ Strategic focus ----------------------------- */

/** Brand patch that makes `goalId` the primary / secondary goal, swapping when it held the other role. */
export function focusPatch(
  brand: Pick<BrandProfile, "primary_goal_id" | "secondary_goal_id">,
  role: GoalRole,
  goalId: ID | null
): UpdateRow<"brand_profiles"> {
  if (role === "primary") {
    if (goalId && goalId === brand.secondary_goal_id) return { primary_goal_id: goalId, secondary_goal_id: brand.primary_goal_id }
    return { primary_goal_id: goalId }
  }
  if (goalId && goalId === brand.primary_goal_id) return { secondary_goal_id: goalId, primary_goal_id: brand.secondary_goal_id }
  return { secondary_goal_id: goalId }
}

export interface GoalReferences {
  items: number
  ideas: number
  campaigns: number
  platforms: number
  role: GoalRole | null
}

/** What points at a goal (all of it is unlinked — set to null — when the goal is deleted). */
export function goalReferences(db: Database, goalId: ID): GoalReferences {
  const brand = db.brand_profiles[0]
  return {
    items: db.content_items.filter((i) => i.goal_id === goalId).length,
    ideas: db.content_ideas.filter((i) => i.goal_id === goalId).length,
    campaigns: db.content_campaigns.filter((c) => c.goal_id === goalId).length,
    platforms: db.content_platforms.filter((p) => p.primary_goal_id === goalId).length,
    role: brand?.primary_goal_id === goalId ? "primary" : brand?.secondary_goal_id === goalId ? "secondary" : null,
  }
}

/* ---------------------------------- Form ---------------------------------- */

export interface GoalFormValues {
  category: GoalCategory
  name: string
  description: string
  kpis: string[]
  target_metric: GoalMetric | null
  target_value: number | null
  period: GoalPeriod
  is_active: boolean
}

export type GoalFormErrors = Partial<Record<"name" | "target_value", string>>

export function newGoalValues(category: GoalCategory): GoalFormValues {
  return {
    category,
    name: "",
    description: "",
    kpis: [...GOAL_CATEGORIES[category].kpis],
    target_metric: null,
    target_value: null,
    period: "monthly",
    is_active: true,
  }
}

export function goalFormValues(goal: ContentGoal): GoalFormValues {
  return {
    category: goal.category,
    name: goal.name,
    description: goal.description,
    kpis: goal.kpis,
    target_metric: goal.target_metric,
    target_value: goal.target_value,
    period: goal.period,
    is_active: goal.is_active,
  }
}

export function validateGoal(values: GoalFormValues, lang: UiLang = "en"): GoalFormErrors {
  const t = translator(goalFormMessages, lang)
  const errors: GoalFormErrors = {}
  if (!values.name.trim()) errors.name = t("error_name")
  if (values.target_value !== null && (!Number.isFinite(values.target_value) || values.target_value < 1)) {
    errors.target_value = t("error_target")
  }
  return errors
}

/** Row values to save. `target_value` is an integer column. */
export function goalPayload(values: GoalFormValues): UpdateRow<"content_goals"> {
  return {
    category: values.category,
    name: values.name.trim(),
    description: values.description.trim(),
    kpis: cleanList(values.kpis),
    target_metric: values.target_metric,
    target_value: values.target_value === null ? null : Math.max(1, Math.round(values.target_value)),
    period: values.period,
    is_active: values.is_active,
  }
}

/** KPIs follow a category change unless the user already edited them. */
export function kpisForCategoryChange(kpis: string[], from: GoalCategory, to: GoalCategory): string[] {
  const defaults = GOAL_CATEGORIES[from].kpis
  const untouched = !kpis.length || (kpis.length === defaults.length && kpis.every((k, i) => k === defaults[i]))
  return untouched ? [...GOAL_CATEGORIES[to].kpis] : kpis
}
