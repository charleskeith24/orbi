/**
 * "Your first week" — seven daily missions (about 10 minutes each) that walk a new creator once around the
 * loop: capture → create → script → voice → publish → measure → review and plan. Pure.
 *
 * - Every mission is ticked from the workspace itself, never by a "done" click. Only the creator's own work
 *   counts: the starter ideas Quick setup generates (`source: "onboarding"`) don't.
 * - Paced, not locked: day N counts from the workspace start. Today's mission comes first; earlier ones
 *   stay open as "catch up", later ones can be done early.
 * - While it's visible (`isFirstWeekVisible`) it replaces Home's first-steps checklist (`firstSteps`), whose
 *   voice and problems steps it absorbs into day 4. Hidden for good once the creator dismisses it
 *   (`app_settings.first_week_dismissed`) or 14 days after the start.
 */
import { addDays, differenceInCalendarDays } from "date-fns"
import { isPublishedItem, latestMetricsByItem } from "@/lib/analytics"
import { parseDate, startOfWeek, toISODate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { ContentItem, Database, ISODate, WeeklyReview } from "@/lib/types"
import { hasWeeklyText, weeklyFieldsOf } from "@/components/features/reports/review-model"
import { hasVoice, ownIdeas, type FirstStepAction } from "./first-run"
import { firstStepMessages, firstWeekMessages } from "./messages"

/** Missions in the plan, one a day. */
export const FIRST_WEEK_DAYS = 7
/** The plan retires by itself this many days after the workspace start (day 15 onward). */
export const FIRST_WEEK_RETIRE_AFTER = 14
/** Day 1: ideas of the creator's own. */
export const CAPTURE_TARGET = 3

export type MissionKey = "capture" | "create" | "script" | "voice" | "publish" | "measure" | "review" | "collab"
/** Where a mission stands against today: done, today's, an earlier one still open, or a later one. */
export type MissionTiming = "done" | "today" | "catch_up" | "upcoming"

export interface MissionPart {
  key: "voice" | "problems"
  label: string
  done: boolean
}

export interface Mission {
  key: MissionKey
  /** 1–7; null for the bonus. */
  day: number | null
  label: string
  detail: string
  /** The mission's one action, as a short verb phrase. */
  cta: string
  done: boolean
  timing: MissionTiming
  /** Counted progress (day 1: ideas captured, capped at the target). */
  progress: { current: number; target: number } | null
  /** Day 4 is done when both parts are. */
  parts: MissionPart[]
  action: FirstStepAction
}

export type FirstWeekState = "active" | "finished" | "dismissed" | "retired"
export type FocusReason = "today" | "catch_up" | "ahead"

export interface FirstWeek {
  state: FirstWeekState
  /** 1 on the start day; 15+ once retired. */
  day: number
  startKey: ISODate
  /** The last day the plan shows (start + 13 days). */
  lastDayKey: ISODate
  missions: Mission[]
  /** Optional, after day 7; not needed to finish. */
  bonus: Mission
  doneCount: number
  /** The mission to lead with: today's if it's open, else the earliest open one. Null when finished. */
  focus: Mission | null
  focusReason: FocusReason | null
  /** Real counts for the finish card. */
  totals: { ideas: number; content: number; posts: number; views: number }
  /** The finish card's next step: plan next week, or Today when that's already planned. */
  next: { cta: string; action: FirstStepAction }
}

/**
 * The day the plan counts from: the earliest time a settings, brand, idea or content row was created. Unlike
 * `workspaceStartKey` it ignores publish, schedule and due dates the creator types — logging a post from last
 * month mustn't jump the plan to day 30 and retire it.
 */
export function firstWeekStartKey(db: Pick<Database, "app_settings" | "brand_profiles" | "content_ideas" | "content_items">, now: Date): ISODate {
  let min = Number.POSITIVE_INFINITY
  const consider = (value: string | null | undefined) => {
    const time = parseDate(value)?.getTime()
    if (time !== undefined && time < min) min = time
  }
  consider(db.app_settings[0]?.created_at)
  consider(db.brand_profiles[0]?.created_at)
  for (const idea of db.content_ideas) consider(idea.created_at)
  for (const item of db.content_items) consider(item.created_at)
  return toISODate(Number.isFinite(min) ? new Date(min) : now)
}

/** 1 on the start day. A start in the future (clock skew) still reads as day 1. */
export function firstWeekDay(startKey: ISODate, now: Date): number {
  const start = parseDate(startKey)
  return start ? Math.max(1, differenceInCalendarDays(now, start) + 1) : 1
}

const hasPlan = (review: WeeklyReview) =>
  Boolean(review.stats && typeof review.stats === "object" && !Array.isArray(review.stats) && "plan" in review.stats)

/**
 * Day 7's signal. Reports and the Weekly Planner both save to `weekly_reviews` (one row per week): a review
 * counts once it has text (Reports can't save an empty one); a plan (`stats.plan`) counts when it's for a week
 * after the one the workspace started in — planning the week you're already in isn't "the next".
 */
export function hasReviewOrNextPlan(reviews: readonly WeeklyReview[], startKey: ISODate, weekStartsOn: 0 | 1): boolean {
  const start = parseDate(startKey)
  const startWeek = start ? toISODate(startOfWeek(start, weekStartsOn)) : startKey
  return reviews.some((review) => hasWeeklyText(weeklyFieldsOf(review)) || (hasPlan(review) && review.week_start > startWeek))
}

const newestFirst = (a: ContentItem, b: ContentItem) => b.created_at.localeCompare(a.created_at)

function timingOf(done: boolean, day: number | null, today: number): MissionTiming {
  if (done) return "done"
  if (day === null || day > today) return "upcoming"
  return day === today ? "today" : "catch_up"
}

/** The seven missions and the bonus, each ticked from `db`, for day `today` of the plan. */
function buildMissions(db: Database, today: number, startKey: ISODate, lang: UiLang): { missions: Mission[]; bonus: Mission } {
  const t = translator(firstWeekMessages, lang)
  const steps = translator(firstStepMessages, lang)
  const brand = db.brand_profiles[0]
  const settings = db.app_settings[0]
  const items = [...db.content_items].sort(newestFirst)
  const open = items.filter((item) => !isPublishedItem(item))
  const published = items.filter(isPublishedItem)
  const scripted = new Set(db.content_scripts.map((script) => script.content_item_id))
  const measured = new Set(db.content_metrics.map((metric) => metric.content_item_id))
  const captured = ownIdeas(db.content_ideas).length

  // Day 3 scripts the newest unpublished piece without a script; day 5 publishes the newest scripted one.
  const toScript = open.find((item) => !scripted.has(item.id)) ?? open[0] ?? items[0]
  const toPublish = open.find((item) => scripted.has(item.id)) ?? open[0]
  const toMeasure = published.find((item) => !measured.has(item.id)) ?? published[0]

  const voice = hasVoice(brand)
  const problems = db.audience_problems.length > 0

  type Draft = Omit<Mission, "timing" | "day" | "progress" | "parts"> & Partial<Pick<Mission, "progress" | "parts">>
  const drafts: Draft[] = [
    {
      key: "capture",
      label: t("capture_label"),
      detail: t("capture_detail"),
      cta: t("capture_cta"),
      done: captured >= CAPTURE_TARGET,
      progress: { current: Math.min(captured, CAPTURE_TARGET), target: CAPTURE_TARGET },
      action: { kind: "dialog", dialog: "quick-capture" },
    },
    {
      key: "create",
      label: t("create_label"),
      detail: t("create_detail"),
      cta: t("create_cta"),
      done: db.content_items.length > 0,
      action: { kind: "dialog", dialog: "new-content" },
    },
    {
      key: "script",
      label: t("script_label"),
      detail: t("script_detail"),
      cta: toScript ? t("script_cta") : t("script_cta_create"),
      done: db.content_scripts.length > 0,
      action: toScript ? { kind: "link", href: `/studio/${toScript.id}?tab=script` } : { kind: "dialog", dialog: "new-content" },
    },
    {
      key: "voice",
      label: t("voice_label"),
      detail: t("voice_detail"),
      cta: voice ? steps("problems_cta") : steps("voice_cta"),
      done: voice && problems,
      parts: [
        { key: "voice", label: steps("voice_label"), done: voice },
        { key: "problems", label: steps("problems_label"), done: problems },
      ],
      action: { kind: "link", href: voice ? "/audience/problems" : "/strategy#personality" },
    },
    {
      key: "publish",
      label: t("publish_label"),
      detail: toPublish ? t("publish_detail_item") : t("publish_detail"),
      cta: toPublish ? t("publish_cta_item") : t("publish_cta"),
      done: published.length > 0,
      action: toPublish ? { kind: "link", href: `/studio/${toPublish.id}` } : { kind: "dialog", dialog: "log-post" },
    },
    {
      key: "measure",
      label: t("measure_label"),
      detail: t("measure_detail"),
      cta: t("measure_cta"),
      done: db.content_metrics.length > 0,
      action: { kind: "dialog", dialog: "add-metrics", itemId: toMeasure?.id },
    },
    {
      key: "review",
      label: t("review_label"),
      detail: t("review_detail"),
      cta: t("review_cta"),
      done: hasReviewOrNextPlan(db.weekly_reviews, startKey, settings?.week_starts_on ?? 1),
      action: { kind: "link", href: "/calendar/planner" },
    },
  ]

  const missions = drafts.map((draft, index): Mission => {
    const day = index + 1
    return { progress: null, parts: [], ...draft, day, timing: timingOf(draft.done, day, today) }
  })
  const collabDone = db.collabs.length > 0
  const bonus: Mission = {
    key: "collab",
    day: null,
    label: t("collab_label"),
    detail: t("collab_detail"),
    cta: t("collab_cta"),
    done: collabDone,
    timing: timingOf(collabDone, null, today),
    progress: null,
    parts: [],
    action: { kind: "link", href: "/collabs?new=1" },
  }
  return { missions, bonus }
}

/** Is a plan for the week after `now`'s saved? Then the finish card sends the creator to Today instead. */
function plannedNextWeek(db: Database, now: Date): boolean {
  const weekStartsOn = db.app_settings[0]?.week_starts_on ?? 1
  const next = toISODate(addDays(startOfWeek(now, weekStartsOn), 7))
  return db.weekly_reviews.some((review) => review.week_start === next && hasPlan(review))
}

export function firstWeek(db: Database, now: Date, lang: UiLang = "en"): FirstWeek {
  const t = translator(firstWeekMessages, lang)
  const startKey = firstWeekStartKey(db, now)
  const day = firstWeekDay(startKey, now)
  const { missions, bonus } = buildMissions(db, day, startKey, lang)
  const doneCount = missions.filter((m) => m.done).length
  const finished = doneCount === missions.length

  const state: FirstWeekState = db.app_settings[0]?.first_week_dismissed
    ? "dismissed"
    : day > FIRST_WEEK_RETIRE_AFTER
      ? "retired"
      : finished
        ? "finished"
        : "active"

  let focus: Mission | null = null
  let focusReason: FocusReason | null = null
  if (!finished) {
    const todays = missions.find((m) => m.timing === "today")
    const behind = missions.find((m) => m.timing === "catch_up")
    if (todays) [focus, focusReason] = [todays, "today"]
    else if (behind) [focus, focusReason] = [behind, "catch_up"]
    else [focus, focusReason] = [missions.find((m) => !m.done) ?? null, "ahead"]
  }

  const latest = latestMetricsByItem(db)
  let views = 0
  for (const metric of latest.values()) views += Number.isFinite(metric.views) ? metric.views : 0

  const planned = plannedNextWeek(db, now)
  return {
    state,
    day,
    startKey,
    lastDayKey: toISODate(addDays(parseDate(startKey) ?? now, FIRST_WEEK_RETIRE_AFTER - 1)),
    missions,
    bonus,
    doneCount,
    focus,
    focusReason,
    totals: {
      ideas: ownIdeas(db.content_ideas).length,
      content: db.content_items.length,
      posts: db.content_items.filter(isPublishedItem).length,
      views,
    },
    next: planned
      ? { cta: t("finish_today"), action: { kind: "link", href: "/today" } }
      : { cta: t("finish_plan"), action: { kind: "link", href: "/calendar/planner" } },
  }
}

/** Home and Today show the plan while it's active, and the finish card until it's hidden or retires. */
export function isFirstWeekVisible(plan: Pick<FirstWeek, "state">): boolean {
  return plan.state === "active" || plan.state === "finished"
}
