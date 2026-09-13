/**
 * Weekly Planner helpers (spec §20): picks, auto-filled publish slots and due dates, the AI draft mapping and
 * the Weekly Content Plan by day. Pure — no React, no store access.
 */
import { addDays, startOfDay, subDays } from "date-fns"
import { BUFFER_STAGES, PLATFORM_IDS, PUBLISHED_STAGES } from "@/lib/constants"
import { combineDateTime, parseDate, toISODate } from "@/lib/dates"
import type { ContentFormat, ContentIdea, ContentItem, ID, ISODate, ISODateTime, PipelineStage, PlatformId, PostingSlot } from "@/lib/types"
import {
  compareSlots,
  DEFAULT_SLOT_TIME,
  fillSlots,
  nextHalfHour,
  placementsByDay,
  slotsForWeekday,
  type DaySlot,
  type Placement,
} from "./calendar-model"

/* ---------------------------------- Steps ---------------------------------- */

export const PLANNER_STEPS = [
  { id: "review", title: "Review last week", short: "Review" },
  { id: "winners", title: "Top performers", short: "Winners" },
  { id: "focus", title: "Strategic focus", short: "Focus" },
  { id: "ideas", title: "Select content ideas", short: "Ideas" },
  { id: "platforms", title: "Assign platforms", short: "Platforms" },
  { id: "deadlines", title: "Set deadlines", short: "Deadlines" },
  { id: "briefs", title: "Generate content briefs", short: "Briefs" },
] as const

export type PlannerStepId = (typeof PLANNER_STEPS)[number]["id"]

/* ---------------------------------- Picks ---------------------------------- */

export type PickSource =
  | { kind: "idea"; ideaId: ID }
  | { kind: "item"; itemId: ID }
  /** A new idea proposed by the AI draft — created in the Idea Bank on step 7. */
  | { kind: "new"; title: string; hook: string; formatId: ID | null }

/** One planned post (one platform) of a pick. */
export interface PlanEntry {
  platform: PlatformId
  publishAt: ISODateTime | null
  dueDate: ISODate | null
  /** The posting slot it fills, when it lands on one. */
  slotId: ID | null
}

export interface PlanPick {
  /** `idea:<id>`, `item:<id>` or `new:<slug>`. */
  key: string
  source: PickSource
  title: string
  pillarId: ID | null
  entries: PlanEntry[]
  /** Why it's in the plan (recommendation / AI reason). */
  reason: string
  origin: "recommended" | "bank" | "ai"
}

export const pickPlatforms = (pick: PlanPick): PlatformId[] => pick.entries.map((e) => e.platform)

export const plannedPostCount = (picks: PlanPick[]) => picks.reduce((n, p) => n + p.entries.length, 0)

const blankEntry = (platform: PlatformId): PlanEntry => ({ platform, publishAt: null, dueDate: null, slotId: null })

/** Keep the entries of platforms still chosen (canonical order); new platforms start blank. */
export function withPlatforms(pick: PlanPick, platforms: PlatformId[]): PlanPick {
  const ordered = PLATFORM_IDS.filter((p) => platforms.includes(p))
  return { ...pick, entries: ordered.map((platform) => pick.entries.find((e) => e.platform === platform) ?? blankEntry(platform)) }
}

export function pickFromIdea(idea: ContentIdea, platforms: PlatformId[], origin: PlanPick["origin"], reason: string): PlanPick {
  return {
    key: `idea:${idea.id}`,
    source: { kind: "idea", ideaId: idea.id },
    title: idea.title,
    pillarId: idea.pillar_id,
    entries: PLATFORM_IDS.filter((p) => platforms.includes(p)).map(blankEntry),
    reason,
    origin,
  }
}

export function pickFromItem(item: ContentItem, origin: PlanPick["origin"], reason: string): PlanPick {
  return {
    key: `item:${item.id}`,
    source: { kind: "item", itemId: item.id },
    title: item.title,
    pillarId: item.pillar_id,
    entries: [{ ...blankEntry(item.platform), publishAt: item.scheduled_at, dueDate: item.due_date }],
    reason,
    origin,
  }
}

/** Picks whose idea / item still exists and is still open. */
export function isPickValid(pick: PlanPick, ideas: Map<ID, ContentIdea>, items: Map<ID, ContentItem>): boolean {
  if (pick.source.kind === "idea") {
    const idea = ideas.get(pick.source.ideaId)
    return Boolean(idea) && idea?.status !== "converted" && idea?.status !== "archived"
  }
  if (pick.source.kind === "item") {
    const item = items.get(pick.source.itemId)
    return Boolean(item) && !PUBLISHED_STAGES.includes(item?.stage ?? "published")
  }
  return Boolean(pick.source.title.trim())
}

/* ------------------------------- Scheduling -------------------------------- */

export const weekDays = (weekStart: Date) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

export interface FillInput {
  weekStart: Date
  slots: PostingSlot[]
  items: ContentItem[]
  now: Date
  /** Days between the production deadline and the publish date (default 2). */
  leadDays?: number
  /** Recompute every entry, not only the empty ones. */
  replan?: boolean
}

interface Seat {
  day: Date
  at: Date
  platform: PlatformId | null
  slotId: ID
  pillarId: ID | null
}

/** Posts (scheduled / published) per day of the week, excluding some items. */
function postsByDay(items: ContentItem[], exclude: Set<ID>): Map<ISODate, Placement[]> {
  const byDay = placementsByDay(items.filter((i) => !exclude.has(i.id)))
  for (const [key, list] of byDay) byDay.set(key, list.filter((p) => p.kind !== "due"))
  return byDay
}

/** Posting-slot seats from now to the end of the week that no post outside the plan fills yet. */
function freeSeats(input: FillInput, byDay: Map<ISODate, Placement[]>): Seat[] {
  const todayKey = toISODate(input.now)
  const seats: Seat[] = []
  for (const day of weekDays(input.weekStart)) {
    const key = toISODate(day)
    if (key < todayKey) continue
    const { slots } = fillSlots(slotsForWeekday(input.slots, day.getDay()), byDay.get(key) ?? [], day, todayKey)
    for (const s of slots) {
      if (s.at.getTime() <= input.now.getTime()) continue
      for (const seat of s.seats) if (!seat.post) seats.push({ day, at: s.at, platform: seat.platform, slotId: s.slot.id, pillarId: s.slot.pillar_id })
    }
  }
  return seats
}

/** The platform's usual time: its first active slot, else 09:00. */
function usualTime(slots: PostingSlot[], platform: PlatformId): string {
  return [...slots].filter((s) => s.is_active && s.platforms.includes(platform)).sort(compareSlots)[0]?.time ?? DEFAULT_SLOT_TIME
}

/** Production deadline `leadDays` before publishing, never before today. */
export function dueBefore(publish: Date, now: Date, leadDays: number): ISODate {
  const due = startOfDay(subDays(publish, leadDays))
  const today = startOfDay(now)
  return toISODate(due < today ? today : due)
}

const isProduced = (stage: PipelineStage | null) => Boolean(stage && (BUFFER_STAGES.includes(stage) || PUBLISHED_STAGES.includes(stage)))

/**
 * Fill publish times and due dates. Each empty entry (every entry with `replan`) takes the best free
 * posting-slot seat on its platform — same pillar first, then the lightest day, then the earliest; with no seat
 * left it goes on the lightest remaining day at the platform's usual time. Due dates sit `leadDays` before a
 * pick's earliest publish time (never in the past); already-produced items get none.
 */
export function autoFillPlan(picks: PlanPick[], input: FillInput, stageOf: (itemId: ID) => PipelineStage | null): PlanPick[] {
  const leadDays = input.leadDays ?? 2
  const planItemIds = new Set(picks.flatMap((p) => (p.source.kind === "item" ? [p.source.itemId] : [])))
  const byDay = postsByDay(input.items, planItemIds)
  const seats = freeSeats(input, byDay)
  const todayKey = toISODate(input.now)
  const days = weekDays(input.weekStart).filter((d) => toISODate(d) >= todayKey)
  const load = new Map<ISODate, number>(weekDays(input.weekStart).map((d) => [toISODate(d), byDay.get(toISODate(d))?.length ?? 0]))
  const bump = (key: ISODate) => load.set(key, (load.get(key) ?? 0) + 1)
  const keeps = (entry: PlanEntry) => !input.replan && Boolean(parseDate(entry.publishAt))

  // Entries that keep their time hold their seat.
  for (const pick of picks) {
    for (const entry of pick.entries) {
      const at = keeps(entry) ? parseDate(entry.publishAt) : null
      if (!at) continue
      const key = toISODate(at)
      bump(key)
      const index = seats.findIndex(
        (s) => toISODate(s.day) === key && (s.platform === entry.platform || s.platform === null) && (!entry.slotId || s.slotId === entry.slotId)
      )
      if (index >= 0) seats.splice(index, 1)
    }
  }

  return picks.map((pick) => {
    const entries = pick.entries.map((entry): PlanEntry => {
      if (keeps(entry)) return entry
      let best = -1
      let bestScore = Number.NEGATIVE_INFINITY
      seats.forEach((seat, i) => {
        if (seat.platform !== null && seat.platform !== entry.platform) return
        const dayIndex = Math.round((startOfDay(seat.day).getTime() - startOfDay(input.weekStart).getTime()) / 86_400_000)
        const score =
          (pick.pillarId && seat.pillarId === pick.pillarId ? 100 : 0) +
          (seat.platform === entry.platform ? 20 : 0) -
          (load.get(toISODate(seat.day)) ?? 0) * 3 -
          dayIndex
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      })
      let at: Date
      let slotId: ID | null = null
      if (best >= 0) {
        const [seat] = seats.splice(best, 1)
        at = seat.at
        slotId = seat.slotId
      } else {
        const day =
          [...days].sort((a, b) => (load.get(toISODate(a)) ?? 0) - (load.get(toISODate(b)) ?? 0) || a.getTime() - b.getTime())[0] ??
          startOfDay(input.now)
        at = parseDate(combineDateTime(day, usualTime(input.slots, entry.platform))) ?? day
        if (at.getTime() <= input.now.getTime()) at = nextHalfHour(input.now)
      }
      bump(toISODate(at))
      return { ...entry, publishAt: at.toISOString(), slotId }
    })
    const produced = pick.source.kind === "item" && isProduced(stageOf(pick.source.itemId))
    const earliest = entries
      .map((e) => parseDate(e.publishAt))
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const due = produced || !earliest ? null : dueBefore(earliest, input.now, leadDays)
    return { ...pick, entries: entries.map((e) => (keeps(e) && e.dueDate ? e : { ...e, dueDate: due })) }
  })
}

/* --------------------------------- AI draft -------------------------------- */

export interface AiPlanRow {
  date: string
  slot_label: string
  title: string
  idea_id: string | null
  item_id: string | null
  platform: PlatformId
  format: string
  pillar_id: string | null
  hook: string
  reason: string
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)

/** Map weekly_plan rows onto picks (rows for the same idea merge into one pick with several platforms). */
export function picksFromAiPlan(
  rows: AiPlanRow[],
  input: { slots: PostingSlot[]; ideas: ContentIdea[]; items: ContentItem[]; formats: ContentFormat[]; now: Date }
): PlanPick[] {
  const picks = new Map<string, PlanPick>()
  for (const row of rows) {
    const day = parseDate(row.date)
    if (!day) continue
    const daySlots = slotsForWeekday(input.slots, day.getDay())
    const slot = daySlots.find((s) => s.label === row.slot_label) ?? daySlots.find((s) => s.platforms.includes(row.platform)) ?? null
    let at = parseDate(combineDateTime(day, slot?.time ?? DEFAULT_SLOT_TIME)) ?? day
    if (at.getTime() <= input.now.getTime()) at = nextHalfHour(input.now)
    const item = row.item_id ? input.items.find((i) => i.id === row.item_id) : undefined
    const idea = !item && row.idea_id ? input.ideas.find((i) => i.id === row.idea_id) : undefined
    const platform = item ? item.platform : row.platform
    const entry: PlanEntry = { platform, publishAt: at.toISOString(), dueDate: null, slotId: slot?.id ?? null }
    const key = item ? `item:${item.id}` : idea ? `idea:${idea.id}` : `new:${slug(row.title) || "idea"}`
    const existing = picks.get(key)
    if (existing) {
      if (!existing.entries.some((e) => e.platform === platform)) {
        existing.entries = PLATFORM_IDS.flatMap((p) => (p === platform ? [entry] : existing.entries.filter((e) => e.platform === p)))
      }
      continue
    }
    picks.set(key, {
      key,
      source: item
        ? { kind: "item", itemId: item.id }
        : idea
          ? { kind: "idea", ideaId: idea.id }
          : {
              kind: "new",
              title: row.title,
              hook: row.hook,
              formatId: input.formats.find((f) => f.name.toLowerCase() === row.format.toLowerCase())?.id ?? null,
            },
      title: item?.title ?? idea?.title ?? row.title,
      pillarId: item?.pillar_id ?? idea?.pillar_id ?? row.pillar_id,
      entries: [entry],
      reason: row.reason,
      origin: "ai",
    })
  }
  return [...picks.values()]
}

/* ------------------------------ Plan document ------------------------------ */

export type PlanRow =
  | { kind: "post"; at: Date; placement: Placement }
  | { kind: "draft"; at: Date | null; pick: PlanPick; entry: PlanEntry }
  | { kind: "open"; at: Date; daySlot: DaySlot; platform: PlatformId | null }

export interface PlanDay {
  key: ISODate
  date: Date
  isPast: boolean
  rows: PlanRow[]
  /** Posts (existing + draft) going out this day. */
  posts: number
}

export interface PlanDocument {
  days: PlanDay[]
  /** Draft entries without a publish time yet. */
  unscheduled: { pick: PlanPick; entry: PlanEntry }[]
  posts: number
  drafts: number
  slotsTotal: number
  slotsFilled: number
  /** Existing posts (scheduled / published) in the week, excluding items in the plan. */
  existingPostIds: ID[]
}

/**
 * The Weekly Content Plan by day: existing posts and deadlines in the week, the draft's planned posts, and the
 * posting-slot seats still open once both are counted.
 */
export function planDocument(input: { weekStart: Date; items: ContentItem[]; slots: PostingSlot[]; picks: PlanPick[]; now: Date }): PlanDocument {
  const todayKey = toISODate(input.now)
  const planItemIds = new Set(input.picks.flatMap((p) => (p.source.kind === "item" ? [p.source.itemId] : [])))
  const byDay = placementsByDay(input.items.filter((i) => !planItemIds.has(i.id)))
  const drafts = new Map<ISODate, { pick: PlanPick; entry: PlanEntry; at: Date }[]>()
  const unscheduled: PlanDocument["unscheduled"] = []
  for (const pick of input.picks) {
    for (const entry of pick.entries) {
      const at = parseDate(entry.publishAt)
      if (!at) {
        unscheduled.push({ pick, entry })
        continue
      }
      const key = toISODate(at)
      const list = drafts.get(key)
      if (list) list.push({ pick, entry, at })
      else drafts.set(key, [{ pick, entry, at }])
    }
  }

  let posts = 0
  let draftCount = 0
  let slotsTotal = 0
  let slotsFilled = 0
  const existingPostIds: ID[] = []
  const days = weekDays(input.weekStart).map((date): PlanDay => {
    const key = toISODate(date)
    const placements = byDay.get(key) ?? []
    const dayPosts = placements.filter((p) => p.kind !== "due")
    const dayDrafts = drafts.get(key) ?? []
    const { slots } = fillSlots(slotsForWeekday(input.slots, date.getDay()), dayPosts, date, todayKey)
    const open: PlanRow[] = []
    for (const s of slots) {
      let missing: (PlatformId | null)[] = s.seats.filter((seat) => !seat.post).map((seat) => seat.platform)
      // Draft posts fill the seats they were planned into (or any seat on their platform).
      for (const d of dayDrafts) {
        const index = missing.findIndex((p) => p === d.entry.platform || (p === null && (!d.entry.slotId || d.entry.slotId === s.slot.id)))
        if (index >= 0 && (!d.entry.slotId || d.entry.slotId === s.slot.id || missing[index] === d.entry.platform)) missing = missing.filter((_, i) => i !== index)
      }
      slotsTotal += s.seats.length
      slotsFilled += s.seats.length - missing.length
      if (key >= todayKey) for (const platform of missing) open.push({ kind: "open", at: s.at, daySlot: s, platform })
    }
    for (const p of dayPosts) existingPostIds.push(p.item.id)
    posts += dayPosts.length + dayDrafts.length
    draftCount += dayDrafts.length
    const rows: PlanRow[] = [
      ...placements.map((placement): PlanRow => ({ kind: "post", at: placement.at, placement })),
      ...dayDrafts.map((d): PlanRow => ({ kind: "draft", at: d.at, pick: d.pick, entry: d.entry })),
      ...open,
    ].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))
    return { key, date, isPast: key < todayKey, rows, posts: dayPosts.length + dayDrafts.length }
  })
  return { days, unscheduled, posts, drafts: draftCount, slotsTotal, slotsFilled, existingPostIds }
}
