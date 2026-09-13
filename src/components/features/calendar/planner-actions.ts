/**
 * Step 7 of the Weekly Planner: turn the draft into real content (domain operations only) and save the plan
 * on the week's `weekly_reviews` row.
 */
import { BUFFER_STAGES } from "@/lib/constants"
import { convertIdeaToContent, createIdea, dataActions, scheduleItem } from "@/lib/store"
import type { ContentItem, ID, ISODate } from "@/lib/types"
import type { PlanPick } from "./planner-model"

export interface CreatePlanResult {
  /** New content items (one per platform of each idea). */
  created: ContentItem[]
  /** Existing items that got a publish time / deadline. */
  scheduledIds: ID[]
  /** Ideas the AI draft proposed that were added to the Idea Bank. */
  ideasCreated: number
}

/**
 * Ideas (and AI-proposed new ideas) → `convertIdeaToContent` with the planned platforms, first publish time and
 * deadline, then per-platform times; existing items → `scheduleItem` (+ due date while still in production).
 */
export function createPlannedContent(picks: PlanPick[], focus: string): CreatePlanResult {
  const result: CreatePlanResult = { created: [], scheduledIds: [], ideasCreated: 0 }
  for (const pick of picks) {
    const entries = pick.entries.filter((e) => e.publishAt)
    const first = entries[0]
    if (!first?.publishAt) continue

    if (pick.source.kind === "item") {
      const itemId = pick.source.itemId
      scheduleItem(itemId, first.publishAt)
      const item = dataActions.getDb().content_items.find((i) => i.id === itemId)
      if (item && !BUFFER_STAGES.includes(item.stage) && item.due_date !== first.dueDate) {
        dataActions.update("content_items", itemId, { due_date: first.dueDate })
      }
      result.scheduledIds.push(itemId)
      continue
    }

    let ideaId: ID
    if (pick.source.kind === "new") {
      const idea = createIdea({
        title: pick.source.title,
        hook: pick.source.hook,
        pillar_id: pick.pillarId,
        format_id: pick.source.formatId,
        platforms: entries.map((e) => e.platform),
        why_it_matters: pick.reason,
        inspiration: focus ? `Weekly Planner focus: ${focus}` : "",
        source: "planner",
        status: "selected",
      })
      ideaId = idea.id
      result.ideasCreated++
    } else {
      ideaId = pick.source.ideaId
    }

    const items = convertIdeaToContent(ideaId, {
      platforms: entries.map((e) => e.platform),
      stage: "brief",
      scheduled_at: first.publishAt,
      due_date: first.dueDate,
    })
    for (const item of items) {
      const entry = entries.find((e) => e.platform === item.platform)
      if (entry && (entry.publishAt !== first.publishAt || entry.dueDate !== first.dueDate)) {
        dataActions.update("content_items", item.id, { scheduled_at: entry.publishAt, due_date: entry.dueDate })
      }
      result.created.push(item)
    }
  }
  return result
}

/** Frozen plan snapshot for `weekly_reviews.stats.plan` — plain JSON (numbers, strings, ids). */
export interface PlanStats {
  source: "weekly_planner"
  saved_at: string
  week_start: ISODate
  week_end: ISODate
  target: number
  planned_posts: number
  new_items: number
  slots_total: number
  slots_filled: number
  ai_drafted: boolean
  pillar_mix: { pillar_id: ID | null; label: string; posts: number; target_pct: number }[]
  previous_week: { week_start: ISODate; published: number; target: number; views: number; engagement_rate: number | null; followers: number; leads: number }
}

/**
 * Upsert the week's review row: focus + planned items (merged with any already saved), the plan snapshot under
 * `stats.plan` (other stats keys are kept). Returns the row id.
 */
export function savePlanReview(weekStart: ISODate, focus: string, plannedIds: ID[], stats: PlanStats): ID {
  const existing = dataActions.getDb().weekly_reviews.find((r) => r.week_start === weekStart)
  if (existing) {
    const previous = existing.stats && typeof existing.stats === "object" ? existing.stats : {}
    dataActions.update("weekly_reviews", existing.id, {
      focus,
      planned_item_ids: [...new Set([...existing.planned_item_ids, ...plannedIds])],
      stats: { ...previous, plan: stats },
    })
    return existing.id
  }
  return dataActions.insert("weekly_reviews", {
    week_start: weekStart,
    focus,
    planned_item_ids: [...new Set(plannedIds)],
    stats: { plan: stats },
    status: "draft",
    generated_by: null,
  }).id
}
