/**
 * Every Today mutation goes through here so stage moves, publishing and rescheduling behave the same
 * in every section: domain operations, a toast with the result and an Undo that restores the item.
 */
import { toast } from "sonner"
import { PIPELINE_STAGE_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { formatDate, parseDate } from "@/lib/dates"
import { dataActions, moveItemToStage, scheduleItem, uiActions } from "@/lib/store"
import type { ContentItem, ID, ISODate, PipelineStage } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { reschedulePatch } from "./today-utils"

type Snapshot = Pick<ContentItem, "id" | "stage" | "published_at" | "scheduled_at" | "due_date">

/** Handlers act on the latest row, not the one captured when the list rendered. */
const fresh = (id: ID) => dataActions.getDb().content_items.find((item) => item.id === id)
const titleOf = (item: Pick<ContentItem, "title">) => truncate(item.title.trim() || "Untitled content", 64)
const stageLabel = (stage: PipelineStage) => PIPELINE_STAGE_MAP[stage]?.label ?? stage

function snapshotOf(item: ContentItem): Snapshot {
  return {
    id: item.id,
    stage: item.stage,
    published_at: item.published_at,
    scheduled_at: item.scheduled_at,
    due_date: item.due_date,
  }
}

function restore(snapshot: Snapshot) {
  if (!fresh(snapshot.id)) return
  dataActions.update("content_items", snapshot.id, {
    stage: snapshot.stage,
    published_at: snapshot.published_at,
    scheduled_at: snapshot.scheduled_at,
    due_date: snapshot.due_date,
  })
  toast.success(`Back in ${stageLabel(snapshot.stage)}`)
}

/** Published now (or at its scheduled time if that has passed), then offer Add analytics. */
export function markPublished(target: ContentItem) {
  const item = fresh(target.id)
  if (!item || PUBLISHED_STAGES.includes(item.stage)) return
  const snapshot = snapshotOf(item)
  moveItemToStage(item.id, "published")
  toast.success(`Published · ${titleOf(item)}`, {
    description: "Add its first numbers so Analytics can track how it performs.",
    action: { label: "Add analytics", onClick: () => uiActions.openDialog({ type: "add-metrics", itemId: item.id }) },
    cancel: { label: "Undo", onClick: () => restore(snapshot) },
  })
}

/** Stage move with an Undo toast (start recording, done, request revision…). */
export function moveTo(target: ContentItem, stage: PipelineStage, message?: string) {
  const item = fresh(target.id)
  if (!item || item.stage === stage) return
  const snapshot = snapshotOf(item)
  moveItemToStage(item.id, stage)
  toast.success(message ?? `Moved to ${stageLabel(stage)}`, {
    description: titleOf(item),
    action: { label: "Undo", onClick: () => restore(snapshot) },
  })
}

/** Approve: with a publish time still ahead it becomes Scheduled, otherwise Ready to Post. */
export function approve(target: ContentItem) {
  const item = fresh(target.id)
  if (!item) return
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled && scheduled.getTime() > Date.now()) {
    moveTo(item, "scheduled", `Approved · goes out ${formatDate(scheduled, "EEE, MMM d · h:mm a")}`)
  } else {
    moveTo(item, "ready_to_post", "Approved · Ready to Post")
  }
}

/** Move an overdue item to `day` (see reschedulePatch). */
export function reschedule(target: ContentItem, day: ISODate) {
  const item = fresh(target.id)
  if (!item) return
  const snapshot = snapshotOf(item)
  const patch = reschedulePatch(item, day, new Date())
  if (patch.scheduled_at) scheduleItem(item.id, patch.scheduled_at)
  if (patch.due_date) dataActions.update("content_items", item.id, { due_date: patch.due_date })
  toast.success(
    patch.scheduled_at
      ? `Rescheduled for ${formatDate(patch.scheduled_at, "EEE, MMM d · h:mm a")}`
      : `Now due ${formatDate(day, "EEE, MMM d")}`,
    { description: titleOf(item), action: { label: "Undo", onClick: () => restore(snapshot) } }
  )
}
