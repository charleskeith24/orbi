/**
 * Pure helpers for the Today command center: the merged "Today's Content" list, overdue labels,
 * reschedule targets, copy-ready captions, today's posting slots and the Daily rhythm checks.
 * No React, no store access.
 */
import { differenceInCalendarDays, format } from "date-fns"
import type { TodayContent } from "@/lib/analytics"
import { BUFFER_STAGES, OPERATING_RHYTHM, PUBLISHED_STAGES } from "@/lib/constants"
import { combineDateTime, parseDate, toISODate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type {
  ContentBrief,
  ContentItem,
  ContentScript,
  Database,
  EngagementLog,
  EngagementTaskConfig,
  ID,
  ISODate,
  ISODateTime,
  PostingSlot,
} from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { overdueMessages, rhythmMessages } from "./messages"

/* ----------------------------- Today's content ----------------------------- */

const timeOf = (value: string | null) => parseDate(value)?.getTime() ?? Number.POSITIVE_INFINITY

/** Scheduled today (by publish time), then due today (production deadlines) — each item once. */
export function todaysContent(today: Pick<TodayContent, "scheduledToday" | "dueToday">): ContentItem[] {
  const scheduled = [...today.scheduledToday].sort((a, b) => timeOf(a.scheduled_at) - timeOf(b.scheduled_at))
  const ids = new Set(scheduled.map((item) => item.id))
  return [...scheduled, ...today.dueToday.filter((item) => !ids.has(item.id))]
}

/** Active posting slots for `now`'s weekday, in schedule order. */
export function todaySlots(slots: PostingSlot[], now: Date): PostingSlot[] {
  const weekday = now.getDay()
  return slots
    .filter((slot) => slot.is_active && slot.day_of_week === weekday)
    .sort((a, b) => a.sort_order - b.sort_order || (a.time ?? "").localeCompare(b.time ?? ""))
}

/** "18:30" → "6:30 PM"; null when unset or malformed. */
export function slotTime(time: string | null | undefined): string | null {
  const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null
  if (!match) return null
  const hours = Number(match[1])
  if (hours > 23) return null
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`
}

/* --------------------------------- Overdue --------------------------------- */

/** Why it's late: "Missed 9:00 AM" (earlier today), "2 days late" (publish time), "Due 3 days ago" (deadline). */
export function overdueLabel(item: Pick<ContentItem, "scheduled_at" | "due_date">, now: Date, lang: UiLang = "en"): string {
  const t = translator(overdueMessages, lang)
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled && scheduled < now) {
    const days = differenceInCalendarDays(now, scheduled)
    return days === 0 ? t("missed_at", { time: format(scheduled, "h:mm a") }) : t.plural("days_late", days, { count: formatNumber(days) })
  }
  const due = parseDate(item.due_date)
  const days = due ? differenceInCalendarDays(now, due) : 0
  return days > 0 ? t.plural("due_ago", days, { count: formatNumber(days) }) : t("overdue")
}

export interface ReschedulePatch {
  scheduled_at?: ISODateTime
  due_date?: ISODate
}

/**
 * Move an overdue item to `day`: a missed publish time keeps its time of day; a missed production
 * deadline moves to `day`. Only the fields that change are returned.
 */
export function reschedulePatch(item: ContentItem, day: ISODate, now: Date): ReschedulePatch {
  const patch: ReschedulePatch = {}
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled && scheduled < now) patch.scheduled_at = combineDateTime(day, format(scheduled, "HH:mm"))
  if (!BUFFER_STAGES.includes(item.stage) && item.due_date && item.due_date < toISODate(now)) patch.due_date = day
  if (!patch.scheduled_at && !patch.due_date) {
    // Not late by either rule (e.g. picked from a stale list) — move whichever date it has.
    if (scheduled) patch.scheduled_at = combineDateTime(day, format(scheduled, "HH:mm"))
    else patch.due_date = day
  }
  return patch
}

/* ---------------------------------- Posting --------------------------------- */

export interface PostCopy {
  text: string
  /** Which kind of text it is (English identifier; the button label is translated where it renders). */
  label: "Copy caption" | "Copy script"
}

const hashtagLine = (tags: string[]) => (tags.length ? `\n\n${tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}` : "")

/** What to paste when posting: the script caption (+ hashtags), else the brief caption, else the script body. */
export function postCopy(script: ContentScript | undefined, brief: ContentBrief | undefined): PostCopy {
  const tags = hashtagLine(script?.hashtags ?? [])
  const caption = script?.caption.trim()
  if (caption) return { text: `${caption}${tags}`, label: "Copy caption" }
  const briefCaption = brief?.caption.trim()
  if (briefCaption) return { text: briefCaption, label: "Copy caption" }
  const body = script?.body.trim()
  if (body) return { text: `${body}${tags}`, label: "Copy script" }
  return { text: "", label: "Copy script" }
}

/* ------------------------------- Daily rhythm ------------------------------- */

export type RhythmKey = "capture" | "create" | "review" | "publish" | "engage"

export interface RhythmStep {
  key: RhythmKey
  label: string
  description: string
  /** Today's activity proves the habit happened. */
  done: boolean
  detail: string
}

const RHYTHM_KEYS: RhythmKey[] = ["capture", "create", "review", "publish", "engage"]

/**
 * Capture · Create · Review · Publish · Engage (spec §52), each checked from today's data:
 * ideas captured today; a piece created, scripted or moved forward today; nothing left in review;
 * something published today; every engagement task done. Details are in `lang` (default English).
 */
export function dailyRhythm({
  db,
  today,
  now,
  log,
  tasks,
  lang = "en",
}: {
  db: Pick<Database, "content_items" | "content_scripts">
  today: Pick<TodayContent, "ideasCapturedToday" | "toReview" | "publishedToday" | "scheduledToday">
  now: Date
  log: EngagementLog | null
  tasks: EngagementTaskConfig[]
  lang?: UiLang
}): RhythmStep[] {
  const t = translator(rhythmMessages, lang)
  const n = (count: number) => ({ count: formatNumber(count) })
  const day = toISODate(now)
  const onDay = (value: string | null | undefined) => {
    const date = parseDate(value)
    return date !== null && toISODate(date) === day
  }
  const worked = new Set<ID>()
  for (const item of db.content_items) {
    if (PUBLISHED_STAGES.includes(item.stage)) continue
    if (onDay(item.created_at) || (item.stage !== "idea" && onDay(item.updated_at))) worked.add(item.id)
  }
  for (const script of db.content_scripts) if (onDay(script.created_at)) worked.add(script.content_item_id)

  const captured = today.ideasCapturedToday.length
  const waiting = today.toReview.length
  const published = today.publishedToday.length
  const goingOut = today.scheduledToday.length
  const completed = new Set(log?.completed_tasks ?? [])
  const tasksDone = tasks.filter((task) => completed.has(task.key)).length
  const replies = log ? log.comments_replied + log.dms_replied + log.creator_comments : 0

  const checks: Record<RhythmKey, { done: boolean; detail: string }> = {
    capture: { done: captured > 0, detail: captured ? t.plural("ideas_captured", captured, n(captured)) : t("no_ideas") },
    create: {
      done: worked.size > 0,
      detail: worked.size ? t.plural("moved", worked.size, n(worked.size)) : t("nothing_moved"),
    },
    review: { done: waiting === 0, detail: waiting ? t.plural("waiting", waiting, n(waiting)) : t("queue_clear") },
    publish: {
      done: published > 0,
      detail: published ? t.plural("out", published, n(published)) : goingOut ? t("going_out", { count: goingOut }) : t("nothing_out"),
    },
    engage: tasks.length
      ? { done: tasksDone === tasks.length, detail: t("tasks", { done: tasksDone, total: tasks.length }) }
      : { done: replies > 0, detail: replies ? t.plural("replies", replies, n(replies)) : t("no_tasks") },
  }
  return RHYTHM_KEYS.map((key, index) => ({
    key,
    label: OPERATING_RHYTHM.daily.steps[index]?.label ?? key,
    description: lang === "en" ? (OPERATING_RHYTHM.daily.steps[index]?.description ?? "") : t(`desc_${key}`),
    ...checks[key],
  }))
}
