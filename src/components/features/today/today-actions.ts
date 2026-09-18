/**
 * Every Today mutation goes through here so stage moves, publishing and rescheduling behave the same
 * in every section: domain operations, a toast with the result and an Undo that restores the item.
 */
import { toast } from "sonner"
import { PIPELINE_STAGE_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { formatDate, parseDate } from "@/lib/dates"
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions, moveItemToStage, scheduleItem, uiActions } from "@/lib/store"
import type { ContentItem, ID, ISODate, PipelineStage } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { todayActionMessages } from "./messages"
import { reschedulePatch } from "./today-utils"

type Snapshot = Pick<ContentItem, "id" | "stage" | "published_at" | "scheduled_at" | "due_date">

/** Handlers act on the latest row, not the one captured when the list rendered. */
const fresh = (id: ID) => dataActions.getDb().content_items.find((item) => item.id === id)
const tr = (key: keyof typeof todayActionMessages.en, vars?: Record<string, string | number>) =>
  translate(todayActionMessages, getUiLang(), key, vars)
const titleOf = (item: Pick<ContentItem, "title">) => truncate(item.title.trim() || tr("untitled_content"), 64)
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
  toast.success(tr("back_in", { stage: stageLabel(snapshot.stage) }))
}

/** Published now (or at its scheduled time if that has passed), then offer Add analytics. */
export function markPublished(target: ContentItem) {
  const item = fresh(target.id)
  if (!item || PUBLISHED_STAGES.includes(item.stage)) return
  const snapshot = snapshotOf(item)
  moveItemToStage(item.id, "published")
  toast.success(tr("published", { title: titleOf(item) }), {
    description: tr("published_description"),
    action: { label: tr("add_analytics"), onClick: () => uiActions.openDialog({ type: "add-metrics", itemId: item.id }) },
    cancel: { label: tr("undo"), onClick: () => restore(snapshot) },
  })
}

/** Stage move with an Undo toast (start recording, done, request revision…). `message` is already translated. */
export function moveTo(target: ContentItem, stage: PipelineStage, message?: string) {
  const item = fresh(target.id)
  if (!item || item.stage === stage) return
  const snapshot = snapshotOf(item)
  moveItemToStage(item.id, stage)
  toast.success(message ?? tr("moved_to", { stage: stageLabel(stage) }), {
    description: titleOf(item),
    action: { label: tr("undo"), onClick: () => restore(snapshot) },
  })
}

/** Approve: with a publish time still ahead it becomes Scheduled, otherwise Ready to Post. */
export function approve(target: ContentItem) {
  const item = fresh(target.id)
  if (!item) return
  const scheduled = parseDate(item.scheduled_at)
  if (scheduled && scheduled.getTime() > Date.now()) {
    moveTo(item, "scheduled", tr("approved_scheduled", { date: formatDate(scheduled, "EEE, MMM d · h:mm a") }))
  } else {
    moveTo(item, "ready_to_post", tr("approved_ready"))
  }
}

/** Toast text for the stage moves the work lists trigger. */
export const moveMessage = (key: "changes_requested" | "recorded" | "recording_started") => tr(key)

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
      ? tr("rescheduled_for", { date: formatDate(patch.scheduled_at, "EEE, MMM d · h:mm a") })
      : tr("now_due", { date: formatDate(day, "EEE, MMM d") }),
    { description: titleOf(item), action: { label: tr("undo"), onClick: () => restore(snapshot) } }
  )
}
