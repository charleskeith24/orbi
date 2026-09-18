/**
 * Pipeline roll-up, the Today command center and the Content Buffer (spec §2, §32, §55).
 */
import { endOfDay, startOfDay } from "date-fns"
import { BUFFER_STAGES, PIPELINE_STAGE_MAP, PIPELINE_STAGES, PRODUCTION_STAGES, REVIEW_STAGES, STAGE_GROUPS } from "@/lib/constants"
import { translate, type UiLang } from "@/lib/i18n/core"
import type {
  AppSettings,
  ContentIdea,
  ContentItem,
  ContentScript,
  Database,
  IdeaStatus,
  PipelineStage,
  StageGroup,
} from "@/lib/types"
import { mixMessages } from "./messages"
import { compareText, isOverdue, isPublishedItem, plannedMs, publishedMs, roundTo, timeOf, trailingDays } from "./shared"

/** The dashboard's PUBLISHED column counts items published in this many trailing days. */
export const PUBLISHED_WINDOW_DAYS = 30

const OPEN_IDEA_STATUSES: IdeaStatus[] = ["inbox", "researching", "validated", "selected"]
const READY_IDEA_STATUSES: IdeaStatus[] = ["validated", "selected"]

export interface PipelineCounts {
  /** Items per board column (all time, including every published item). */
  stages: Record<PipelineStage, number>
  /** Items per roll-up stage; `published` only counts the last `publishedWindowDays`. */
  groups: Record<StageGroup, number>
  /** `groups` in dashboard order (Idea → Published) with labels. */
  groupList: { id: StageGroup; label: string; count: number }[]
  publishedWindowDays: number
  /** Items not yet published (Idea → Scheduled). */
  inProgress: number
  /** Idea Bank ideas still open (inbox, researching, validated, selected) — not content items. */
  openIdeas: number
}

/** Items per PipelineStage and StageGroup; the Published group counts items published in the last 30 days. */
export function pipelineCounts(db: Database, now: Date): PipelineCounts {
  const stages = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, 0])) as Record<PipelineStage, number>
  const groups = Object.fromEntries(STAGE_GROUPS.map((g) => [g.id, 0])) as Record<StageGroup, number>
  const window = trailingDays(now, PUBLISHED_WINDOW_DAYS)
  const from = window.start.getTime()
  const to = window.end.getTime()
  let inProgress = 0
  for (const item of db.content_items) {
    const stage = PIPELINE_STAGE_MAP[item.stage]
    if (!stage) continue
    stages[item.stage]++
    if (stage.group === "published") {
      const at = publishedMs(item)
      if (at >= from && at <= to) groups.published++
    } else {
      groups[stage.group]++
      inProgress++
    }
  }
  return {
    stages,
    groups,
    groupList: STAGE_GROUPS.map((g) => ({ id: g.id, label: g.label, count: groups[g.id] })),
    publishedWindowDays: PUBLISHED_WINDOW_DAYS,
    inProgress,
    openIdeas: db.content_ideas.filter((i) => OPEN_IDEA_STATUSES.includes(i.status)).length,
  }
}

/** Sorts in place: earliest planned date first (undated last), then title. */
function sortByPlannedDate(items: ContentItem[]): ContentItem[] {
  const times = new Map<ContentItem, number>()
  for (const item of items) {
    const at = plannedMs(item)
    times.set(item, Number.isNaN(at) ? Number.POSITIVE_INFINITY : at)
  }
  return items.sort((a, b) => {
    const ta = times.get(a) ?? Number.POSITIVE_INFINITY
    const tb = times.get(b) ?? Number.POSITIVE_INFINITY
    return (ta === tb ? 0 : ta - tb) || compareText(a.title, b.title)
  })
}

export interface TodayContent {
  /** Items still in production (not yet Ready to Post / Scheduled) whose deadline is today. */
  dueToday: ContentItem[]
  /** Unpublished items scheduled for today. */
  scheduledToday: ContentItem[]
  publishedToday: ContentItem[]
  /** Ready for Production, Recording, Editing. */
  awaitingProduction: ContentItem[]
  /** Review, Revision. */
  awaitingApproval: ContentItem[]
  /** Ready for Production, Recording. */
  toRecord: ContentItem[]
  /** Review, Revision. */
  toReview: ContentItem[]
  /** Ready to Post plus anything scheduled today. */
  toPost: ContentItem[]
  /** Not published and scheduled before now, or still in production past its due date (see isOverdue). */
  overdue: ContentItem[]
  /** Ideas created today, newest first. */
  ideasCapturedToday: ContentIdea[]
}

/** The Today command center lists (arrays of rows, sorted by planned date). */
export function contentToday(db: Database, now: Date): TodayContent {
  const out: TodayContent = {
    dueToday: [],
    scheduledToday: [],
    publishedToday: [],
    awaitingProduction: [],
    awaitingApproval: [],
    toRecord: [],
    toReview: [],
    toPost: [],
    overdue: [],
    ideasCapturedToday: [],
  }
  const todayStart = startOfDay(now)
  const from = todayStart.getTime()
  const to = endOfDay(now).getTime()
  const isToday = (ms: number) => ms >= from && ms <= to
  for (const item of db.content_items) {
    if (isPublishedItem(item)) {
      if (isToday(publishedMs(item))) out.publishedToday.push(item)
      continue
    }
    const scheduledToday = isToday(timeOf(item, "scheduled_at"))
    if (isToday(timeOf(item, "due_date")) && !BUFFER_STAGES.includes(item.stage)) out.dueToday.push(item)
    if (scheduledToday) out.scheduledToday.push(item)
    if (PRODUCTION_STAGES.includes(item.stage)) out.awaitingProduction.push(item)
    if (item.stage === "ready_for_production" || item.stage === "recording") out.toRecord.push(item)
    if (REVIEW_STAGES.includes(item.stage)) {
      out.awaitingApproval.push(item)
      out.toReview.push(item)
    }
    if (item.stage === "ready_to_post" || scheduledToday) out.toPost.push(item)
    if (isOverdue(item, now, todayStart)) out.overdue.push(item)
  }
  for (const key of Object.keys(out) as (keyof TodayContent)[]) {
    if (key !== "ideasCapturedToday") sortByPlannedDate(out[key])
  }
  out.ideasCapturedToday = db.content_ideas
    .filter((i) => isToday(timeOf(i, "created_at")))
    .sort((a, b) => compareText(b.created_at, a.created_at))
  return out
}

/* --------------------------------- Buffer ---------------------------------- */

export type BufferStatus = "healthy" | "ok" | "low"

/** English labels; use `bufferStatusLabel(status, lang)` in translated UI. */
export const BUFFER_STATUS_LABELS: Record<BufferStatus, string> = {
  healthy: "Healthy",
  ok: "OK",
  low: "Content Buffer Low",
}

export function bufferStatusLabel(status: BufferStatus, lang: UiLang = "en"): string {
  return lang === "en" ? BUFFER_STATUS_LABELS[status] : translate(mixMessages, lang, `buffer_${status}`)
}

export interface BufferBreakdown {
  /** Idea Bank ideas that are validated or selected. */
  readyIdeas: number
  /** Scripting items with a current script, plus Ready for Production items. */
  readyScripts: number
  /** Ready for Production. */
  readyToRecord: number
  /** Editing, Review, Revision. */
  edited: number
  /** Ready to Post plus Scheduled items still ahead. */
  readyToPublish: number
}

export interface ContentBuffer {
  /** Days of publishable content at the target posting rate (1 decimal). */
  days: number
  readyCount: number
  /** Posts per day implied by weekly_post_target (min 1 post / week). */
  dailyRate: number
  targetDays: number
  warningDays: number
  status: BufferStatus
  label: string
  breakdown: BufferBreakdown
  /** The items counted in `readyCount`, earliest planned first. */
  readyItems: ContentItem[]
}

/** Ready to Post, or Scheduled with a time still ahead of `now` (or no time set). */
export function isBufferReady(item: ContentItem, now: Date): boolean {
  if (item.stage === "ready_to_post") return true
  if (item.stage !== "scheduled") return false
  const at = timeOf(item, "scheduled_at")
  return Number.isNaN(at) || at > now.getTime()
}

function hasScriptContent(script: ContentScript): boolean {
  return script.body.trim() !== "" || script.sections.some((s) => s.content.trim() !== "")
}

/**
 * Buffer days = (Ready to Post + future Scheduled) ÷ (weekly_post_target ÷ 7);
 * status healthy ≥ buffer_healthy_days, ok ≥ buffer_warning_days, else low. `label` is in `lang` (default English).
 */
export function contentBuffer(db: Database, now: Date, settings: AppSettings, lang: UiLang = "en"): ContentBuffer {
  const readyItems = sortByPlannedDate(db.content_items.filter((i) => isBufferReady(i, now)))
  const dailyRate = Math.max(1, settings.weekly_post_target) / 7
  const days = roundTo(readyItems.length / dailyRate)
  const status: BufferStatus =
    days >= settings.buffer_healthy_days ? "healthy" : days >= settings.buffer_warning_days ? "ok" : "low"

  const scripted = new Set(db.content_scripts.filter((s) => s.is_current && hasScriptContent(s)).map((s) => s.content_item_id))
  let readyScripts = 0
  let readyToRecord = 0
  let edited = 0
  for (const item of db.content_items) {
    if (item.stage === "scripting" && scripted.has(item.id)) readyScripts++
    if (item.stage === "ready_for_production") {
      readyScripts++
      readyToRecord++
    }
    if (item.stage === "editing" || REVIEW_STAGES.includes(item.stage)) edited++
  }

  return {
    days,
    readyCount: readyItems.length,
    dailyRate,
    targetDays: settings.buffer_healthy_days,
    warningDays: settings.buffer_warning_days,
    status,
    label: bufferStatusLabel(status, lang),
    breakdown: {
      readyIdeas: db.content_ideas.filter((i) => READY_IDEA_STATUSES.includes(i.status)).length,
      readyScripts,
      readyToRecord,
      edited,
      readyToPublish: readyItems.length,
    },
    readyItems,
  }
}
