/**
 * Flywheel & System: operating-rhythm evidence (§52) and the core loop (§1).
 * Pure — no React, no store. `now` is passed in.
 */
import { format, parseISO, startOfMonth, subDays, subMonths } from "date-fns"
import {
  getWinners,
  isPublishedItem,
  pillarMix,
  publishedAtOf,
  scopedRows,
  strategicInsights,
  weeklyPostingProgress,
} from "@/lib/analytics"
import { PRODUCTION_STAGES, REVIEW_STAGES } from "@/lib/constants"
import { formatRelativeDay, toISODate, weekRange } from "@/lib/dates"
import type { AppSettings, Database } from "@/lib/types"
import { pluralize } from "@/lib/utils"

export type RhythmKey = "daily" | "weekly" | "monthly"

/** One evidence line per OPERATING_RHYTHM step (same order). */
export function rhythmEvidence(db: Database, now: Date, settings: AppSettings): Record<RhythmKey, string[]> {
  const today = toISODate(now)
  const isToday = (value: string | null) => Boolean(value) && toISODate(parseISO(value as string)) === today
  const count = (stages: string[]) => db.content_items.filter((i) => stages.includes(i.stage)).length

  const capturedToday = db.content_ideas.filter((i) => isToday(i.created_at)).length
  const inCreation = count(["brief", "scripting"])
  const inReview = count(REVIEW_STAGES)
  const publishedToday = db.content_items.filter((i) => isPublishedItem(i) && isToday(publishedAtOf(i)?.toISOString() ?? null)).length
  const scheduledToday = db.content_items.filter((i) => !isPublishedItem(i) && isToday(i.scheduled_at)).length
  const log = db.engagement_logs.find((l) => l.date === today)
  const tasks = settings.engagement_tasks.length

  const weekStartsOn = settings.week_starts_on
  const thisWeek = toISODate(weekRange(now, weekStartsOn).start)
  const lastWeek = toISODate(weekRange(subDays(now, 7), weekStartsOn).start)
  const lastReview = db.weekly_reviews.find((r) => r.week_start === lastWeek)
  const thisPlan = db.weekly_reviews.find((r) => r.week_start === thisWeek && (r.focus.trim() || r.planned_item_ids.length))
  const week = weeklyPostingProgress(db, now, settings)
  const running = db.content_experiments.filter((e) => e.status === "running").length

  const lastMonth = startOfMonth(subMonths(now, 1))
  const monthName = format(lastMonth, "MMMM")
  const monthly = db.monthly_reviews.find((r) => r.month === toISODate(lastMonth))
  const brand = db.brand_profiles[0]
  const updated = brand ? formatRelativeDay(brand.updated_at, now) : ""
  const mix = pillarMix(db, now, settings)
  const winners = getWinners(db, settings, now, { days: 30 }).length
  const fixes = strategicInsights(db, now, settings).filter((i) => i.type === "fix" || i.type === "warning").length

  return {
    daily: [
      capturedToday ? `${pluralize(capturedToday, "idea")} captured today` : "Nothing captured yet today",
      `${pluralize(inCreation, "item")} in brief or scripting`,
      inReview ? `${pluralize(inReview, "item")} awaiting review` : "Nothing waiting for review",
      `${publishedToday} published · ${scheduledToday} scheduled today`,
      tasks ? `${log?.completed_tasks.length ?? 0}/${tasks} engagement tasks done today` : "No engagement tasks set up",
    ],
    weekly: [
      lastReview ? (lastReview.status === "final" ? "Last week reviewed" : "Last week's review is a draft") : "Last week not reviewed yet",
      thisPlan ? "This week is planned" : "No plan for this week yet",
      `${pluralize(count(PRODUCTION_STAGES), "item")} in production`,
      `${week.published + week.scheduledRemaining}/${week.target} published or scheduled this week`,
      running ? `${pluralize(running, "experiment")} running` : "No experiment running",
    ],
    monthly: [
      monthly ? `${monthName} reviewed` : `${monthName} not reviewed yet`,
      updated ? `Brand HQ updated ${["Today", "Yesterday"].includes(updated) ? updated.toLowerCase() : updated}` : "Brand HQ not set up",
      mix.warnings.length ? `${pluralize(mix.warnings.length, "pillar")} off target` : "Pillar mix on target",
      winners ? `${pluralize(winners, "winner")} to replicate` : "No winners this month yet",
      fixes ? `${pluralize(fixes, "fix", "fixes")} flagged by insights` : "Nothing flagged by insights",
    ],
  }
}

export interface LoopStep {
  label: string
  href: string
  stat: string
}

/** Strategy → … → New strategy, each step linked to its module with a live count. */
export function coreLoop(db: Database, now: Date, settings: AppSettings, brandCompleteness: number): LoopStep[] {
  const count = (stages: string[]) => db.content_items.filter((i) => stages.includes(i.stage)).length
  const rows30 = scopedRows(db, now, { days: 30, settings })
  const openIdeas = db.content_ideas.filter((i) => i.status !== "archived" && i.status !== "converted").length
  return [
    { label: "Strategy", href: "/strategy", stat: `Brand HQ ${brandCompleteness}%` },
    { label: "Audience", href: "/audience", stat: `${pluralize(db.audience_personas.length, "persona")} · ${pluralize(db.audience_problems.length, "problem")}` },
    { label: "Pillars", href: "/pillars", stat: pluralize(db.content_pillars.filter((p) => p.is_active).length, "active pillar") },
    { label: "Ideas", href: "/ideas", stat: pluralize(openIdeas, "open idea") },
    { label: "Create", href: "/studio", stat: `${count(["brief", "scripting"])} in brief & script` },
    { label: "Produce", href: "/pipeline", stat: `${count([...PRODUCTION_STAGES, ...REVIEW_STAGES])} in production` },
    { label: "Publish", href: "/calendar", stat: `${count(["scheduled"])} scheduled` },
    { label: "Measure", href: "/analytics", stat: `${rows30.filter((r) => r.metric).length}/${rows30.length} posts measured` },
    { label: "Learn", href: "/reports", stat: pluralize(db.weekly_reviews.length, "weekly report") },
    { label: "New strategy", href: "/reports/monthly", stat: pluralize(db.monthly_reviews.length, "monthly review") },
  ]
}
