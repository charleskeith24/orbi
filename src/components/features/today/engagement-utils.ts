/**
 * Engagement Tracker (spec §53): today's engagement_logs row, task rows with counters toward their
 * targets, counter / checkbox patches (whole numbers; reaching a target ticks the task) and the
 * 7-day history. Pure — no store access.
 */
import { addDays, format } from "date-fns"
import { toISODate } from "@/lib/dates"
import type { EngagementLog, EngagementTaskConfig, ISODate, UpdateRow } from "@/lib/types"

export type CounterKey = "comments_replied" | "dms_replied" | "creator_comments" | "questions_collected" | "ideas_captured"

export const COUNTERS: { key: CounterKey; label: string; hint: string }[] = [
  { key: "comments_replied", label: "Comments responded to", hint: "Replies on your own posts" },
  { key: "dms_replied", label: "DMs replied", hint: "Conversations answered" },
  { key: "creator_comments", label: "Creator comments", hint: "Thoughtful comments on relevant creators" },
  { key: "questions_collected", label: "Questions collected", hint: "Saved to the Question Bank" },
  { key: "ideas_captured", label: "Potential content ideas", hint: "Spotted while engaging" },
]

const COUNTER_MAP = new Map(COUNTERS.map((c) => [c.key, c]))

/** Engagement tasks (Settings → Engagement) whose progress is one of the log's counters. */
export const TASK_COUNTERS: Readonly<Record<string, CounterKey | undefined>> = {
  reply_comments: "comments_replied",
  reply_dms: "dms_replied",
  comment_creators: "creator_comments",
  collect_questions: "questions_collected",
}

export interface TrackerRow {
  /** Task key, or the counter key for counters no task tracks. */
  key: string
  kind: "task" | "counter"
  label: string
  hint: string
  /** Daily target (0 = none). */
  target: number
  counter: CounterKey | null
  count: number
  /** Tasks only: ticked in today's log. */
  done: boolean
}

/** The row for `day` (the most recently updated one if a day was logged twice). */
export function logForDay(logs: EngagementLog[], day: ISODate): EngagementLog | null {
  let best: EngagementLog | null = null
  for (const log of logs) if (log.date === day && (!best || log.updated_at > best.updated_at)) best = log
  return best
}

/** One row per configured task (with its counter when it has one), then every counter no task covers. */
export function trackerRows(tasks: EngagementTaskConfig[], log: EngagementLog | null): TrackerRow[] {
  const completed = new Set(log?.completed_tasks ?? [])
  const covered = new Set<CounterKey>()
  const rows: TrackerRow[] = tasks.map((task) => {
    const counter = TASK_COUNTERS[task.key] ?? null
    if (counter) covered.add(counter)
    return {
      key: task.key,
      kind: "task",
      label: task.label.trim() || (counter ? (COUNTER_MAP.get(counter)?.label ?? task.key) : task.key),
      hint: counter ? (COUNTER_MAP.get(counter)?.hint ?? "") : "Tick it off when done",
      target: Math.max(0, Math.round(task.target)),
      counter,
      count: counter && log ? log[counter] : 0,
      done: completed.has(task.key),
    }
  })
  for (const counter of COUNTERS) {
    if (covered.has(counter.key)) continue
    rows.push({
      key: counter.key,
      kind: "counter",
      label: counter.label,
      hint: counter.hint,
      target: 0,
      counter: counter.key,
      count: log ? log[counter.key] : 0,
      done: false,
    })
  }
  return rows
}

/** Completed keys in the configured task order (unknown keys kept at the end). */
function orderedTasks(completed: Set<string>, tasks: EngagementTaskConfig[]): string[] {
  const ordered = tasks.map((task) => task.key).filter((key) => completed.has(key))
  for (const key of completed) if (!ordered.includes(key)) ordered.push(key)
  return ordered
}

/** +/− on a counter: whole numbers ≥ 0; crossing a task's target ticks it, dropping below unticks it. */
export function counterPatch(
  log: EngagementLog | null,
  tasks: EngagementTaskConfig[],
  key: CounterKey,
  delta: number
): UpdateRow<"engagement_logs"> {
  const before = log ? log[key] : 0
  const after = Math.max(0, Math.round(before + delta))
  const completed = new Set(log?.completed_tasks ?? [])
  for (const task of tasks) {
    if (TASK_COUNTERS[task.key] !== key || task.target <= 0) continue
    if (before < task.target && after >= task.target) completed.add(task.key)
    if (before >= task.target && after < task.target) completed.delete(task.key)
  }
  const patch: UpdateRow<"engagement_logs"> = { completed_tasks: orderedTasks(completed, tasks) }
  patch[key] = after
  return patch
}

export function toggleTaskPatch(
  log: EngagementLog | null,
  tasks: EngagementTaskConfig[],
  key: string,
  done: boolean
): UpdateRow<"engagement_logs"> {
  const completed = new Set(log?.completed_tasks ?? [])
  if (done) completed.add(key)
  else completed.delete(key)
  return { completed_tasks: orderedTasks(completed, tasks) }
}

/** Every configured task is ticked in `completed`. */
export function allTasksDone(completed: readonly string[] | undefined, tasks: EngagementTaskConfig[]): boolean {
  if (!tasks.length || !completed) return false
  const set = new Set(completed)
  return tasks.every((task) => set.has(task.key))
}

export interface EngagementDay {
  date: ISODate
  /** "Mon". */
  label: string
  isToday: boolean
  logged: boolean
  completed: number
  total: number
  /** Comments + DMs + creator comments. */
  replies: number
}

/** The last `days` days ending today (oldest first). */
export function engagementHistory(logs: EngagementLog[], tasks: EngagementTaskConfig[], now: Date, days = 7): EngagementDay[] {
  const byDate = new Map<ISODate, EngagementLog>()
  for (const log of logs) {
    const current = byDate.get(log.date)
    if (!current || log.updated_at > current.updated_at) byDate.set(log.date, log)
  }
  const keys = new Set(tasks.map((task) => task.key))
  const todayKey = toISODate(now)
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(now, i - (days - 1))
    const key = toISODate(date)
    const log = byDate.get(key)
    return {
      date: key,
      label: format(date, "EEE"),
      isToday: key === todayKey,
      logged: Boolean(log),
      completed: log ? log.completed_tasks.filter((k) => keys.has(k)).length : 0,
      total: tasks.length,
      replies: log ? log.comments_replied + log.dms_replied + log.creator_comments : 0,
    }
  })
}

/** Loose equality for "the same question asked again": case, punctuation and spacing ignored. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}
