"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { useMemo, useState } from "react"
import { ContentCard } from "@/components/common"
import { useT } from "@/lib/i18n"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import type { ContentItem, ID, PerformanceTier, PipelineStage } from "@/lib/types"
import { droppableId, STAGE_IDS, stageFromDroppable, type QuickAddDefaults, type StageColumnData } from "./board-model"
import { pipelineCardMessages } from "./messages"
import { usePipelineActions } from "./pipeline-actions"
import { PipelineColumn } from "./pipeline-column"

const stageLabel = (stage: PipelineStage | null | undefined, none: string) => (stage ? (PIPELINE_STAGE_MAP[stage]?.label ?? stage) : none)

/** Pointer drags target the column under the cursor; keyboard drags the column the card overlaps most. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : rectIntersection(args)
}

/** Left/right arrows jump a whole column instead of nudging the card a few pixels. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code === "ArrowUp" || event.code === "ArrowDown") {
    event.preventDefault()
    return undefined
  }
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0
  const { active, collisionRect, droppableRects, droppableContainers, over } = context
  if (!step || !active || !collisionRect) return undefined
  event.preventDefault()
  const columns = droppableContainers
    .getEnabled()
    .map((container) => ({ id: container.id, rect: droppableRects.get(container.id) }))
    .filter((column): column is { id: UniqueIdentifier; rect: ClientRect } => Boolean(column.rect))
    .sort((a, b) => a.rect.left - b.rect.left)
  const fromStage = (active.data.current as { stage?: PipelineStage } | undefined)?.stage
  const currentId = over?.id ?? (fromStage ? droppableId(fromStage) : null)
  const index = columns.findIndex((column) => column.id === currentId)
  const target = index >= 0 ? columns[index + step] : undefined
  if (!target) return undefined
  return { x: target.rect.left + (target.rect.width - collisionRect.width) / 2, y: collisionRect.top }
}

const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] }

interface PipelineBoardProps {
  columns: Record<PipelineStage, StageColumnData>
  collapsed: Set<PipelineStage>
  filtered: boolean
  now: Date
  tiers: Map<ID, PerformanceTier>
  highlightId: ID | null
  quickAdd: PipelineStage | null
  quickAddDefaults: QuickAddDefaults
  onQuickAdd: (stage: PipelineStage | null) => void
  onCollapsedChange: (stage: PipelineStage, collapsed: boolean) => void
}

/** The 13-column Kanban. Dropping a card calls the same move logic as the card menu. */
export function PipelineBoard({
  columns,
  collapsed,
  filtered,
  now,
  tiers,
  highlightId,
  quickAdd,
  quickAddDefaults,
  onQuickAdd,
  onCollapsedChange,
}: PipelineBoardProps) {
  const t = useT(pipelineCardMessages)
  const actions = usePipelineActions()
  const [activeId, setActiveId] = useState<ID | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES })
  )

  const itemsById = useMemo(() => {
    const map = new Map<ID, ContentItem>()
    for (const stage of STAGE_IDS) for (const item of columns[stage].items) map.set(item.id, item)
    return map
  }, [columns])
  const activeItem = activeId ? (itemsById.get(activeId) ?? null) : null

  const screenReaderInstructions = useMemo<ScreenReaderInstructions>(() => ({ draggable: t("sr_instructions") }), [t])
  const announcements = useMemo<Announcements>(() => {
    const title = (id: UniqueIdentifier) => `“${itemsById.get(String(id))?.title.trim() || t("untitled")}”`
    const from = (id: UniqueIdentifier) => itemsById.get(String(id))?.stage
    const label = (stage: PipelineStage | null | undefined) => stageLabel(stage, t("no_stage"))
    return {
      onDragStart: ({ active }) => t("sr_pick", { title: title(active.id), stage: label(from(active.id)) }),
      onDragOver: ({ over }) => (over ? t("sr_over", { stage: label(stageFromDroppable(over.id)) }) : t("sr_not_over")),
      onDragEnd: ({ active, over }) => {
        const to = stageFromDroppable(over?.id)
        return to && to !== from(active.id)
          ? t("sr_drop", { title: title(active.id), stage: label(to) })
          : t("sr_stay", { title: title(active.id), stage: label(from(active.id)) })
      },
      onDragCancel: ({ active }) => t("sr_cancel", { title: title(active.id), stage: label(from(active.id)) }),
    }
  }, [itemsById, t])

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const item = itemsById.get(String(active.id))
    const stage = stageFromDroppable(over?.id)
    if (item && stage && stage !== item.stage) actions.moveItem(item, stage)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div
        role="region"
        aria-label={t("board_label")}
        className="relative flex h-full min-h-0 gap-2.5 overflow-x-auto overscroll-x-contain pb-2"
      >
        {STAGE_IDS.map((stage) => (
          <PipelineColumn
            key={stage}
            column={columns[stage]}
            collapsed={collapsed.has(stage)}
            filtered={filtered}
            dragging={activeId !== null}
            now={now}
            tiers={tiers}
            highlightId={highlightId}
            quickAddOpen={quickAdd === stage}
            quickAddDefaults={quickAddDefaults}
            onQuickAdd={onQuickAdd}
            onCollapsedChange={onCollapsedChange}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <ContentCard
            item={activeItem}
            now={now}
            tier={tiers.get(activeItem.id) ?? null}
            showFormat={false}
            showPriorityLabel={false}
            className="cursor-grabbing shadow-lg ring-1 ring-foreground/10"
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
