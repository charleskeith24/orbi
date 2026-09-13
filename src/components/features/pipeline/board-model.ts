/**
 * Pure model behind the Pipeline board: which items sit on the board, filtering, per-column
 * sorting and counts, move neighbours and scheduling suggestions. No React, no store access —
 * callers pass rows and `now`.
 */
import { addDays, addWeeks, format, startOfDay } from "date-fns"
import { isOverdue, publishedAtOf, trailingDays } from "@/lib/analytics"
import { PIPELINE_STAGES, PLATFORM_IDS, PRIORITIES, PUBLISHED_STAGES } from "@/lib/constants"
import { combineDateTime, contentItemDate, parseDate, startOfWeek, toISODate } from "@/lib/dates"
import type { ContentItem, ID, ISODate, PipelineStage, PlatformId, PostingSlot, Priority, StageGroup } from "@/lib/types"
import { matchesQuery } from "@/lib/utils"

/** The Published column shows this many trailing days; the full history lives in Analytics. */
export const PUBLISHED_COLUMN_DAYS = 14
/** Columns with an inline quick-add form. */
export const QUICK_ADD_STAGES: readonly PipelineStage[] = ["idea", "selected", "brief"]
export const STAGE_IDS: PipelineStage[] = PIPELINE_STAGES.map((s) => s.id)
/** Facet value for "no pillar / campaign / format / owner". */
export const NONE = "__none__"

export const FACET_KEYS = ["platform", "pillar", "owner", "priority", "campaign", "format"] as const
export type FacetKey = (typeof FACET_KEYS)[number]
export type FacetFilters = Record<FacetKey, string[]>
export interface PipelineFilters extends FacetFilters {
  q: string
}

export const EMPTY_FACETS: FacetFilters = { platform: [], pillar: [], owner: [], priority: [], campaign: [], format: [] }

export function hasActiveFilters(filters: PipelineFilters): boolean {
  return filters.q.trim() !== "" || FACET_KEYS.some((key) => filters[key].length > 0)
}

/* ---------------------------------- Ids ----------------------------------- */

export const columnDomId = (stage: PipelineStage) => `pipeline-column-${stage}`
export const cardDomId = (id: ID) => `pipeline-card-${id}`
export const droppableId = (stage: PipelineStage) => `column:${stage}`

export function stageFromDroppable(id: string | number | null | undefined): PipelineStage | null {
  if (typeof id !== "string" || !id.startsWith("column:")) return null
  const stage = id.slice("column:".length) as PipelineStage
  return STAGE_IDS.includes(stage) ? stage : null
}

/* -------------------------------- Filtering ------------------------------- */

/** The value an item carries for a facet (missing references map to NONE). */
export function facetValue(item: ContentItem, key: FacetKey): string {
  switch (key) {
    case "platform":
      return item.platform
    case "pillar":
      return item.pillar_id ?? NONE
    case "owner":
      return item.owner.trim() || NONE
    case "priority":
      return item.priority
    case "campaign":
      return item.campaign_id ?? NONE
    case "format":
      return item.format_id ?? NONE
  }
}

export function matchesFilters(item: ContentItem, filters: PipelineFilters): boolean {
  for (const key of FACET_KEYS) {
    const wanted = filters[key]
    if (wanted.length && !wanted.includes(facetValue(item, key))) return false
  }
  return matchesQuery(filters.q, item.title, item.hook, item.owner, item.notes)
}

export function countFacet(items: ContentItem[], key: FacetKey): Map<string, number> {
  const out = new Map<string, number>()
  for (const item of items) {
    const value = facetValue(item, key)
    out.set(value, (out.get(value) ?? 0) + 1)
  }
  return out
}

/** Owners seen on content plus the default owner, alphabetical. */
export function knownOwners(items: ContentItem[], defaultOwner: string): string[] {
  const owners = new Set<string>()
  if (defaultOwner.trim()) owners.add(defaultOwner.trim())
  for (const item of items) if (item.owner.trim()) owners.add(item.owner.trim())
  return [...owners].sort((a, b) => a.localeCompare(b))
}

/* --------------------------------- Columns -------------------------------- */

/** Everything unpublished, the Repurpose queue, and Published posts from the last 14 days. */
export function isOnBoard(item: ContentItem, now: Date): boolean {
  if (item.stage !== "published") return true
  const at = publishedAtOf(item)
  return at !== null && at.getTime() >= trailingDays(now, PUBLISHED_COLUMN_DAYS).start.getTime()
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/**
 * Unpublished columns: earliest planned date first (undated last), then priority, then most recently
 * touched. Published columns: newest first.
 */
export function sortStageItems(stage: PipelineStage, items: ContentItem[]): ContentItem[] {
  if (PUBLISHED_STAGES.includes(stage)) {
    const at = new Map(items.map((i) => [i.id, publishedAtOf(i)?.getTime() ?? 0]))
    return [...items].sort((a, b) => (at.get(b.id) ?? 0) - (at.get(a.id) ?? 0) || a.title.localeCompare(b.title))
  }
  const planned = new Map(items.map((i) => [i.id, contentItemDate(i)?.getTime() ?? Number.POSITIVE_INFINITY]))
  return [...items].sort((a, b) => {
    const ta = planned.get(a.id) ?? Number.POSITIVE_INFINITY
    const tb = planned.get(b.id) ?? Number.POSITIVE_INFINITY
    if (ta !== tb) return ta < tb ? -1 : 1
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.updated_at.localeCompare(a.updated_at)
  })
}

export interface StageColumnData {
  stage: PipelineStage
  /** Filtered and sorted. */
  items: ContentItem[]
  /** Items on the board in this stage before filters. */
  total: number
  /** Filtered items past their deadline or scheduled time. */
  overdue: number
}

export function buildColumns(pool: ContentItem[], filters: PipelineFilters, now: Date): Record<PipelineStage, StageColumnData> {
  const columns = {} as Record<PipelineStage, StageColumnData>
  for (const stage of STAGE_IDS) columns[stage] = { stage, items: [], total: 0, overdue: 0 }
  for (const item of pool) {
    const column = columns[item.stage]
    if (!column) continue
    column.total++
    if (!matchesFilters(item, filters)) continue
    column.items.push(item)
    if (isOverdue(item, now)) column.overdue++
  }
  for (const column of Object.values(columns)) column.items = sortStageItems(column.stage, column.items)
  return columns
}

export function adjacentStages(stage: PipelineStage): { prev: PipelineStage | null; next: PipelineStage | null } {
  const index = STAGE_IDS.indexOf(stage)
  return {
    prev: index > 0 ? STAGE_IDS[index - 1] : null,
    next: index >= 0 && index < STAGE_IDS.length - 1 ? STAGE_IDS[index + 1] : null,
  }
}

export function firstStageOfGroup(group: StageGroup): PipelineStage {
  return PIPELINE_STAGES.find((s) => s.group === group)?.id ?? "idea"
}

/* -------------------------------- Quick add ------------------------------- */

export interface QuickAddDefaults {
  platform?: PlatformId
  pillar_id?: ID
  campaign_id?: ID
  format_id?: ID
  owner?: string
  priority?: Priority
}

/** Facets filtered to exactly one value become defaults, so a quick-added card stays visible. */
export function quickAddDefaults(filters: FacetFilters): QuickAddDefaults {
  const single = (key: FacetKey) => (filters[key].length === 1 && filters[key][0] !== NONE ? filters[key][0] : undefined)
  const out: QuickAddDefaults = {}
  const platform = single("platform")
  if (platform && PLATFORM_IDS.includes(platform as PlatformId)) out.platform = platform as PlatformId
  const priority = single("priority")
  if (priority && PRIORITIES.some((p) => p.id === priority)) out.priority = priority as Priority
  const pillar = single("pillar")
  if (pillar) out.pillar_id = pillar
  const campaign = single("campaign")
  if (campaign) out.campaign_id = campaign
  const formatId = single("format")
  if (formatId) out.format_id = formatId
  const owner = single("owner")
  if (owner) out.owner = owner
  return out
}

/* ------------------------------- Scheduling ------------------------------- */

/** True when the item already has a publish time still ahead of `now`. */
export function hasFutureSchedule(item: Pick<ContentItem, "scheduled_at">, now: Date): boolean {
  const at = parseDate(item.scheduled_at)
  return at !== null && at.getTime() > now.getTime()
}

export interface SlotSuggestion {
  at: Date
  /** The posting slot's theme, e.g. "Educational / Authority". */
  label: string
}

const hourKey = (platform: PlatformId, at: Date) => `${platform}|${toISODate(at)}|${at.getHours()}`

/**
 * Upcoming weekly posting slots (Posting Schedule) for the item's platform in the next two weeks,
 * skipping past times and hours already taken by another scheduled post on that platform.
 */
export function nextPostingSlots(
  slots: PostingSlot[],
  items: ContentItem[],
  item: Pick<ContentItem, "id" | "platform">,
  now: Date,
  limit = 3
): SlotSuggestion[] {
  const active = slots.filter((s) => s.is_active && (!s.platforms.length || s.platforms.includes(item.platform)))
  if (!active.length) return []
  const taken = new Set<string>()
  for (const other of items) {
    if (other.id === item.id || PUBLISHED_STAGES.includes(other.stage) || other.platform !== item.platform) continue
    const at = parseDate(other.scheduled_at)
    if (at) taken.add(hourKey(other.platform, at))
  }
  const out: SlotSuggestion[] = []
  const today = startOfDay(now)
  for (let offset = 0; offset < 14 && out.length < limit; offset++) {
    const day = addDays(today, offset)
    const daySlots = active
      .filter((s) => s.day_of_week === day.getDay())
      .sort((a, b) => (a.time ?? "09:00").localeCompare(b.time ?? "09:00") || a.sort_order - b.sort_order)
    for (const slot of daySlots) {
      const at = parseDate(combineDateTime(day, slot.time ?? "09:00"))
      if (!at || at.getTime() <= now.getTime()) continue
      const key = hourKey(item.platform, at)
      if (taken.has(key)) continue
      taken.add(key)
      out.push({ at, label: slot.label })
      if (out.length >= limit) break
    }
  }
  return out
}

/** Existing future schedule → next open slot → tomorrow at the item's usual time (09:00). */
export function defaultScheduleTime(item: Pick<ContentItem, "scheduled_at">, suggestions: SlotSuggestion[], now: Date): Date {
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled && scheduled.getTime() > now.getTime()) return scheduled
  if (suggestions[0]) return suggestions[0].at
  const time = scheduled ? format(scheduled, "HH:mm") : "09:00"
  return parseDate(combineDateTime(addDays(startOfDay(now), 1), time)) ?? addDays(now, 1)
}

/** Quick due dates for the card menu; a date offered twice (e.g. "In 3 days" = next Monday) is listed once. */
export function dueDateShortcuts(now: Date, weekStartsOn: 0 | 1): { label: string; value: ISODate }[] {
  const today = startOfDay(now)
  const all = [
    { label: "Today", value: toISODate(today) },
    { label: "Tomorrow", value: toISODate(addDays(today, 1)) },
    { label: "In 3 days", value: toISODate(addDays(today, 3)) },
    { label: "Next week", value: toISODate(startOfWeek(addWeeks(today, 1), weekStartsOn)) },
  ]
  return all.filter((shortcut, index) => all.findIndex((s) => s.value === shortcut.value) === index)
}
