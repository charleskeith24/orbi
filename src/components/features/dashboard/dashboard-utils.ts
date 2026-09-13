/**
 * Pure helpers for the Home dashboard: greeting, idea titles, the week grid
 * (posting slots vs posts) and derived lists. No React, no store access.
 */
import { addDays, differenceInCalendarDays, format } from "date-fns"
import { isPublishedItem, percentChange } from "@/lib/analytics"
import type { MixWarning, PillarAggregate, PlatformAggregate, TieredRow, WeeklyProgress } from "@/lib/analytics"
import { parseDate, toISODate, weekRange } from "@/lib/dates"
import type { ContentItem, ContentPillar, Database, ISODate, PlatformId, PostingSlot } from "@/lib/types"
import { pluralize, truncate } from "@/lib/utils"

/* --------------------------------- Header --------------------------------- */

/** 'Rafael "Raf" Mendoza' → "Raf", "Maria Santos" → "Maria", "" → "". */
export function firstName(fullName: string): string {
  const nickname = /["“]([^"”]+)["”]/.exec(fullName)?.[1]?.trim()
  if (nickname) return nickname
  return fullName.replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] ?? ""
}

export function greetingFor(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/** "Sep 7 – Sep 13". */
export function weekRangeLabel(start: Date, end: Date): string {
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`
}

/** Posting slot time "18:30" → "6:30 PM"; null when unset or malformed. */
export function formatSlotTime(time: string | null | undefined): string | null {
  const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null
  if (!match) return null
  const hours = Number(match[1])
  if (hours > 23) return null
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`
}

/* ---------------------------------- Today ---------------------------------- */

/** Why an overdue item is late: "Missed 9:00 AM" (earlier today), "2 days late" (publish time), "Due 3 days ago" (deadline). */
export function overdueLabel(item: Pick<ContentItem, "scheduled_at" | "due_date">, now: Date): string {
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled && scheduled < now) {
    const days = differenceInCalendarDays(now, scheduled)
    return days === 0 ? `Missed ${format(scheduled, "h:mm a")}` : `${pluralize(days, "day")} late`
  }
  const due = parseDate(item.due_date)
  const days = due ? differenceInCalendarDays(now, due) : 0
  return days > 0 ? `Due ${pluralize(days, "day")} ago` : "Overdue"
}

/* ------------------------------ Quick capture ------------------------------ */

/** Sentences shorter than this are treated as abbreviations ("e.g.") and the title keeps going. */
const MIN_SENTENCE = 15

/** Idea title from free text: the first sentence (trailing period dropped), at most `max` chars, cut on a word. */
export function ideaTitleFromText(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  let sentence = clean
  for (const match of clean.matchAll(/[.!?](?=\s|$)/g)) {
    const end = (match.index ?? 0) + 1
    if (end >= MIN_SENTENCE) {
      sentence = clean.slice(0, end)
      break
    }
  }
  sentence = sentence.replace(/\.$/, "").trim()
  if (sentence.length <= max) return sentence
  const cut = sentence.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space >= max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/* -------------------------------- This week -------------------------------- */

export type SlotStatus = "filled" | "open" | "missed"

export interface WeekSlot {
  slot: PostingSlot
  pillar: ContentPillar | null
  status: SlotStatus
}

export interface WeekDay {
  key: ISODate
  date: Date
  isToday: boolean
  isPast: boolean
  slots: WeekSlot[]
  /** Published and scheduled posts that go out this day, earliest first. */
  items: ContentItem[]
}

/**
 * When a post goes out: published → its go-live date; unpublished → only a set publish time.
 * Due dates are production deadlines, not posts, so they don't place an item on the week.
 */
export function postDateOf(item: ContentItem): Date | null {
  if (isPublishedItem(item)) return parseDate(item.published_at) ?? parseDate(item.scheduled_at) ?? parseDate(item.due_date)
  return parseDate(item.scheduled_at)
}

/**
 * The current week, day by day: active posting slots (content_calendar) and the posts on that day.
 * A slot is filled when a post that day is on one of its platforms (any post when it names none);
 * an unfilled slot is open today and later, missed before today.
 */
export function buildWeekDays(db: Database, now: Date, weekStartsOn: 0 | 1): WeekDay[] {
  const { start } = weekRange(now, weekStartsOn)
  const todayKey = toISODate(now)
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const key = toISODate(date)
    return { key, date, isToday: key === todayKey, isPast: key < todayKey, slots: [], items: [] }
  })
  const byKey = new Map(days.map((day) => [day.key, day]))
  const times = new Map<ContentItem, number>()
  for (const item of db.content_items) {
    const at = postDateOf(item)
    const day = at ? byKey.get(toISODate(at)) : undefined
    if (!at || !day) continue
    day.items.push(item)
    times.set(item, at.getTime())
  }

  const pillars = new Map(db.content_pillars.map((p) => [p.id, p]))
  const slots = db.content_calendar
    .filter((s) => s.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || (a.time ?? "").localeCompare(b.time ?? ""))
  for (const day of days) {
    day.items.sort((a, b) => (times.get(a) ?? 0) - (times.get(b) ?? 0))
    const weekday = day.date.getDay()
    day.slots = slots
      .filter((slot) => slot.day_of_week === weekday)
      .map((slot) => {
        const filled = day.items.some((item) => !slot.platforms.length || slot.platforms.includes(item.platform))
        const status: SlotStatus = filled ? "filled" : day.isPast ? "missed" : "open"
        return { slot, pillar: slot.pillar_id ? (pillars.get(slot.pillar_id) ?? null) : null, status }
      })
  }
  return days
}

/* ---------------------------- Platform growth ------------------------------ */

export interface PlatformGrowthRow {
  platform: PlatformId
  label: string
  posts: number
  followers: number
  views: number
  previousFollowers: number
  previousViews: number
  /** % change vs the previous window; null when it had nothing to compare. */
  followersDelta: number | null
  viewsDelta: number | null
}

/** Current vs previous window per platform (platforms with posts in either), most followers gained first. */
export function platformGrowthRows(current: PlatformAggregate[], previous: PlatformAggregate[]): PlatformGrowthRow[] {
  const now = new Map(current.map((p) => [p.platform, p]))
  const before = new Map(previous.map((p) => [p.platform, p]))
  const platforms = [...new Set([...now.keys(), ...before.keys()])]
  return platforms
    .map((platform) => {
      const cur = now.get(platform)
      const prev = before.get(platform)
      const followers = cur?.followersGained ?? 0
      const views = cur?.views ?? 0
      const previousFollowers = prev?.followersGained ?? 0
      const previousViews = prev?.views ?? 0
      return {
        platform,
        label: cur?.label ?? prev?.label ?? platform,
        posts: cur?.posts ?? 0,
        followers,
        views,
        previousFollowers,
        previousViews,
        followersDelta: percentChange(followers, previousFollowers),
        viewsDelta: percentChange(views, previousViews),
      }
    })
    .sort((a, b) => b.followers - a.followers || b.views - a.views || a.label.localeCompare(b.label))
}

/* --------------------------- Strategist prompts ---------------------------- */

const FALLBACK_PROMPTS = ["What should I focus on this week?", "Which content should I create more of?"]

/** 2–3 "Ask the strategist" prompts grounded in what the dashboard shows. */
export function strategistPrompts(input: {
  mixWarning?: MixWarning
  pillars: PillarAggregate[]
  top?: TieredRow
  weekly: WeeklyProgress
}): string[] {
  const out: string[] = []
  const { mixWarning, pillars, top, weekly } = input
  if (mixWarning) {
    out.push(
      mixWarning.direction === "under"
        ? `How do I bring ${mixWarning.label} back to its target share?`
        : `${mixWarning.label} is over-represented — what should I post instead?`
    )
  }
  const measured = pillars.filter((p) => p.pillar && p.measured >= 2 && p.avgViews !== null)
  if (measured.length >= 2) {
    const weakest = [...measured].sort((a, b) => (a.avgViews ?? 0) - (b.avgViews ?? 0))[0]
    out.push(`Why are my ${weakest.label} posts underperforming?`)
  }
  if (weekly.target - weekly.published - weekly.scheduledRemaining > 0) {
    out.push(`What can I still post to hit ${weekly.target} this week?`)
  } else if (top) {
    out.push(`Why did “${truncate(top.item.title, 26)}” work so well?`)
  }
  for (const prompt of FALLBACK_PROMPTS) if (out.length < 3 && !out.includes(prompt)) out.push(prompt)
  return out.slice(0, 3)
}
