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
import { toISODate, weekRange } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, Database } from "@/lib/types"
import { relativeDayInline } from "./relative-day"
import { systemEvidenceMessages } from "./system-messages"
import { counted } from "./system-model"

export type RhythmKey = "daily" | "weekly" | "monthly"

/** One evidence line per OPERATING_RHYTHM step (same order). */
export function rhythmEvidence(db: Database, now: Date, settings: AppSettings, lang: UiLang = "en"): Record<RhythmKey, string[]> {
  const t = translator(systemEvidenceMessages, lang)
  const n = (key: Parameters<typeof counted>[1], value: number) => counted(t, key, value)
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
  const updated = brand ? relativeDayInline(brand.updated_at, now, lang) : ""
  const mix = pillarMix(db, now, settings, { lang })
  const winners = getWinners(db, settings, now, { days: 30 }).length
  const fixes = strategicInsights(db, now, settings, lang).filter((i) => i.type === "fix" || i.type === "warning").length

  return {
    daily: [
      capturedToday ? t("captured_today", { ideas: n("ideas", capturedToday) }) : t("nothing_captured"),
      t("in_creation", { items: n("items", inCreation) }),
      inReview ? t("awaiting_review", { items: n("items", inReview) }) : t("nothing_review"),
      t("published_today", { published: publishedToday, scheduled: scheduledToday }),
      tasks ? t("tasks_done", { done: log?.completed_tasks.length ?? 0, total: tasks }) : t("no_tasks"),
    ],
    weekly: [
      lastReview ? (lastReview.status === "final" ? t("last_week_reviewed") : t("last_week_draft")) : t("last_week_not_reviewed"),
      thisPlan ? t("week_planned") : t("week_not_planned"),
      t("in_production", { items: n("items", count(PRODUCTION_STAGES)) }),
      t("week_progress", { done: week.published + week.scheduledRemaining, target: week.target }),
      running ? t("experiments_running", { experiments: n("experiments", running) }) : t("no_experiment"),
    ],
    monthly: [
      monthly ? t("month_reviewed", { month: monthName }) : t("month_not_reviewed", { month: monthName }),
      updated ? t("brand_updated", { when: updated }) : t("brand_not_set"),
      mix.warnings.length ? t("pillars_off", { pillars: n("pillars", mix.warnings.length) }) : t("mix_on_target"),
      winners ? t("winners_to_replicate", { winners: n("winners", winners) }) : t("no_winners_month"),
      fixes ? t("fixes_flagged", { fixes: n("fixes", fixes) }) : t("nothing_flagged"),
    ],
  }
}

export interface LoopStep {
  label: string
  href: string
  stat: string
}

/** Strategy → … → New strategy, each step linked to its module with a live count. */
export function coreLoop(db: Database, now: Date, settings: AppSettings, brandCompleteness: number, lang: UiLang = "en"): LoopStep[] {
  const t = translator(systemEvidenceMessages, lang)
  const n = (key: Parameters<typeof counted>[1], value: number) => counted(t, key, value)
  const count = (stages: string[]) => db.content_items.filter((i) => stages.includes(i.stage)).length
  const rows30 = scopedRows(db, now, { days: 30, settings })
  const openIdeas = db.content_ideas.filter((i) => i.status !== "archived" && i.status !== "converted").length
  return [
    { label: t("loop_strategy"), href: "/strategy", stat: t("loop_brand", { pct: brandCompleteness }) },
    {
      label: t("loop_audience"),
      href: "/audience",
      stat: `${n("personas", db.audience_personas.length)} · ${n("problems", db.audience_problems.length)}`,
    },
    { label: t("loop_pillars"), href: "/pillars", stat: n("active_pillars", db.content_pillars.filter((p) => p.is_active).length) },
    { label: t("loop_ideas"), href: "/ideas", stat: n("open_ideas", openIdeas) },
    { label: t("loop_create"), href: "/studio", stat: t("loop_in_brief", { count: count(["brief", "scripting"]) }) },
    { label: t("loop_produce"), href: "/pipeline", stat: t("loop_in_production", { count: count([...PRODUCTION_STAGES, ...REVIEW_STAGES]) }) },
    { label: t("loop_publish"), href: "/calendar", stat: t("loop_scheduled", { count: count(["scheduled"]) }) },
    {
      label: t("loop_measure"),
      href: "/analytics",
      stat: rows30.length ? t("loop_measured", { measured: rows30.filter((r) => r.metric).length, total: rows30.length }) : t("loop_no_posts"),
    },
    { label: t("loop_learn"), href: "/reports", stat: n("weekly_reports", db.weekly_reviews.length) },
    { label: t("loop_new_strategy"), href: "/reports/monthly", stat: n("monthly_reviews", db.monthly_reviews.length) },
  ]
}
