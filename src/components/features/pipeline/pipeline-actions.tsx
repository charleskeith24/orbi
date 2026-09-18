"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { getUiLang, translate, useT, type Vars } from "@/lib/i18n"
import { PIPELINE_STAGE_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import {
  dataActions,
  duplicateContentItem,
  moveItemToStage,
  scheduleItem,
  uiActions,
  unscheduleItem,
  useRow,
  useSettings,
  useTable,
} from "@/lib/store"
import type { ContentItem, ID, ISODate, ISODateTime, PipelineStage } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { hasFutureSchedule, knownOwners } from "./board-model"
import { pipelineCardMessages } from "./messages"
import { DueDateDialog, OwnerDialog, ScheduleDialog } from "./pipeline-dialogs"

/** Every card mutation on the board goes through here, so drag, menus and mobile buttons behave the same. */
export interface PipelineActions {
  /** Owners seen on content plus the default owner (for the assign menu). */
  owners: string[]
  moveItem: (item: ContentItem, stage: PipelineStage) => void
  reschedule: (item: ContentItem) => void
  setDueDate: (item: ContentItem, due: ISODate | null) => void
  pickDueDate: (item: ContentItem) => void
  assignOwner: (item: ContentItem, owner: string) => void
  pickOwner: (item: ContentItem) => void
  duplicate: (item: ContentItem) => void
  remove: (item: ContentItem) => void
}

const PipelineActionsContext = createContext<PipelineActions | null>(null)

export function usePipelineActions(): PipelineActions {
  const actions = useContext(PipelineActionsContext)
  if (!actions) throw new Error("usePipelineActions must be used inside <PipelineActionsProvider>")
  return actions
}

type Snapshot = Pick<ContentItem, "id" | "stage" | "published_at" | "scheduled_at">

type CardMessageKey = keyof (typeof pipelineCardMessages)["en"] & string
/** Toast text in the current app language (handlers run outside render). */
const tr = (key: CardMessageKey, vars?: Vars) => translate(pipelineCardMessages, getUiLang(), key, vars)

const stageLabel = (stage: PipelineStage) => PIPELINE_STAGE_MAP[stage]?.label ?? stage
const titleOf = (item: Pick<ContentItem, "title">) => truncate(item.title.trim() || tr("untitled"), 64)
/** Handlers act on the latest row, not the one captured when the card rendered. */
const freshItem = (id: ID) => dataActions.getDb().content_items.find((i) => i.id === id)
const snapshotOf = (item: ContentItem): Snapshot => ({
  id: item.id,
  stage: item.stage,
  published_at: item.published_at,
  scheduled_at: item.scheduled_at,
})

/** Undo restores the exact stage and timestamps the card had before the move. */
function restore(snapshot: Snapshot) {
  if (!freshItem(snapshot.id)) return
  dataActions.update("content_items", snapshot.id, {
    stage: snapshot.stage,
    published_at: snapshot.published_at,
    scheduled_at: snapshot.scheduled_at,
  })
  toast.success(tr("back_in", { stage: stageLabel(snapshot.stage) }))
}

function announceMove(item: ContentItem, stage: PipelineStage, snapshot: Snapshot) {
  const undo = { label: tr("undo"), onClick: () => restore(snapshot) }
  const wentLive = PUBLISHED_STAGES.includes(stage) && !PUBLISHED_STAGES.includes(snapshot.stage)
  if (wentLive) {
    toast.success(tr("published_toast", { title: titleOf(item) }), {
      description: tr("published_description"),
      action: { label: tr("add_analytics"), onClick: () => uiActions.openDialog({ type: "add-metrics", itemId: item.id }) },
      cancel: undo,
    })
    return
  }
  const unscheduled = stage === "ready_to_post" && snapshot.scheduled_at
  toast.success(tr("moved_to", { stage: stageLabel(stage) }), {
    description: unscheduled ? tr("publish_time_cleared", { title: titleOf(item) }) : titleOf(item),
    action: undo,
  })
}

interface DialogTarget {
  id: ID | null
  open: boolean
  nonce: number
}

const CLOSED: DialogTarget = { id: null, open: false, nonce: 0 }

function useDialogTarget() {
  const [state, setState] = useState<DialogTarget>(CLOSED)
  const show = useCallback((id: ID) => setState((s) => ({ id, open: true, nonce: s.nonce + 1 })), [])
  const setOpen = useCallback((open: boolean) => setState((s) => ({ ...s, open })), [])
  return [state, show, setOpen] as const
}

export function PipelineActionsProvider({ children }: { children: React.ReactNode }) {
  const t = useT(pipelineCardMessages)
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()
  const items = useTable("content_items")
  const settings = useSettings()
  const owners = useMemo(() => knownOwners(items, settings.default_owner), [items, settings.default_owner])

  const [schedule, showSchedule, setScheduleOpen] = useDialogTarget()
  const [scheduleMove, setScheduleMove] = useState(false)
  const [due, showDue, setDueOpen] = useDialogTarget()
  const [owner, showOwner, setOwnerOpen] = useDialogTarget()
  const scheduleTarget = useRow("content_items", schedule.id)
  const dueTarget = useRow("content_items", due.id)
  const ownerTarget = useRow("content_items", owner.id)

  const openSchedule = useCallback(
    (id: ID, move: boolean) => {
      setScheduleMove(move)
      showSchedule(id)
    },
    [showSchedule]
  )

  const moveItem = useCallback(
    async (target: ContentItem, stage: PipelineStage) => {
      const item = freshItem(target.id)
      if (!item || item.stage === stage) return
      if (PUBLISHED_STAGES.includes(item.stage) && !PUBLISHED_STAGES.includes(stage)) {
        const ok = await confirm({
          title: t("move_back_title", { stage: stageLabel(stage) }),
          description: t("move_back_description"),
          confirmLabel: t("move_back_confirm", { stage: stageLabel(stage) }),
          destructive: false,
        })
        if (!ok) return
      }
      if (stage === "scheduled" && !hasFutureSchedule(item, new Date())) {
        openSchedule(item.id, true)
        return
      }
      const snapshot = snapshotOf(item)
      // Ready to Post means "approved, not yet scheduled": moving a scheduled card back unschedules it.
      if (stage === "ready_to_post" && item.scheduled_at) unscheduleItem(item.id)
      moveItemToStage(item.id, stage)
      announceMove(item, stage, snapshot)
    },
    [confirm, openSchedule, t]
  )

  const confirmSchedule = useCallback(
    (when: ISODateTime) => {
      setScheduleOpen(false)
      const item = schedule.id ? freshItem(schedule.id) : undefined
      if (!item) return
      const snapshot = snapshotOf(item)
      if (scheduleMove) moveItemToStage(item.id, "scheduled")
      scheduleItem(item.id, when)
      toast.success(t("scheduled_for", { when: formatDate(when, "EEE, MMM d · h:mm a") }), {
        description: titleOf(item),
        action: { label: t("undo"), onClick: () => restore(snapshot) },
      })
    },
    [schedule.id, scheduleMove, setScheduleOpen, t]
  )

  const setDueDate = useCallback(
    (target: ContentItem, value: ISODate | null) => {
      const item = freshItem(target.id)
      if (!item || item.due_date === value) return
      const previous = item.due_date
      dataActions.update("content_items", item.id, { due_date: value })
      toast.success(value ? t("due_on", { date: formatDate(value, "EEE, MMM d") }) : t("due_cleared"), {
        description: titleOf(item),
        action: { label: t("undo"), onClick: () => dataActions.update("content_items", item.id, { due_date: previous }) },
      })
    },
    [t]
  )

  const assignOwner = useCallback(
    (target: ContentItem, name: string) => {
      const item = freshItem(target.id)
      const clean = name.trim()
      if (!item || item.owner.trim() === clean) return
      const previous = item.owner
      dataActions.update("content_items", item.id, { owner: clean })
      toast.success(clean ? t("assigned_to", { name: clean }) : t("owner_removed"), {
        description: titleOf(item),
        action: { label: t("undo"), onClick: () => dataActions.update("content_items", item.id, { owner: previous }) },
      })
    },
    [t]
  )

  const duplicate = useCallback(
    (target: ContentItem) => {
      try {
        const copy = duplicateContentItem(target.id)
        toast.success(t("duplicated"), {
          description: `${titleOf(copy)} · ${stageLabel(copy.stage)}`,
          action: { label: t("open"), onClick: () => router.push(`/studio/${copy.id}`) },
        })
      } catch (error) {
        toast.error(t("duplicate_failed"), { description: error instanceof Error ? error.message : String(error) })
      }
    },
    [router, t]
  )

  const remove = useCallback(
    async (target: ContentItem) => {
      const ok = await confirm({
        title: t("delete_title"),
        description: t("delete_description", { title: titleOf(target) }),
        confirmLabel: t("delete"),
      })
      if (!ok) return
      dataActions.remove("content_items", target.id)
      toast.success(t("deleted"), { description: titleOf(target) })
    },
    [confirm, t]
  )

  const value = useMemo<PipelineActions>(
    () => ({
      owners,
      moveItem: (item, stage) => void moveItem(item, stage),
      reschedule: (item) => openSchedule(item.id, false),
      setDueDate,
      pickDueDate: (item) => showDue(item.id),
      assignOwner,
      pickOwner: (item) => showOwner(item.id),
      duplicate,
      remove: (item) => void remove(item),
    }),
    [owners, moveItem, openSchedule, setDueDate, showDue, assignOwner, showOwner, duplicate, remove]
  )

  return (
    <PipelineActionsContext.Provider value={value}>
      {children}
      {confirmDialog}
      <ScheduleDialog
        item={scheduleTarget ?? null}
        open={schedule.open}
        nonce={schedule.nonce}
        onOpenChange={setScheduleOpen}
        move={scheduleMove}
        onConfirm={confirmSchedule}
      />
      <DueDateDialog
        item={dueTarget ?? null}
        open={due.open}
        nonce={due.nonce}
        onOpenChange={setDueOpen}
        onSave={(value) => {
          setDueOpen(false)
          if (dueTarget) setDueDate(dueTarget, value)
        }}
      />
      <OwnerDialog
        item={ownerTarget ?? null}
        open={owner.open}
        nonce={owner.nonce}
        onOpenChange={setOwnerOpen}
        owners={owners}
        onSave={(name) => {
          setOwnerOpen(false)
          if (ownerTarget) assignOwner(ownerTarget, name)
        }}
      />
    </PipelineActionsContext.Provider>
  )
}
