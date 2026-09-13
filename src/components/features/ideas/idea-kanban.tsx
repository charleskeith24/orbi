"use client"

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
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
import { ChevronsLeft, ChevronsRight, GripVertical } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { IDEA_STATUS_ICONS } from "@/components/common"
import { Button } from "@/components/ui/button"
import { IDEA_STATUS_MAP } from "@/lib/constants"
import type { ContentIdea, ID, IdeaStatus } from "@/lib/types"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import { useIdeaActions } from "./idea-actions"
import { IdeaActionsMenu } from "./idea-actions-menu"
import { IdeaCard } from "./idea-card"
import { ALL_STATUSES, compareIdeas, type IdeaSort } from "./idea-model"
import type { IdeaLookups } from "./idea-table"

const DROP_PREFIX = "status:"
const droppableId = (status: IdeaStatus) => `${DROP_PREFIX}${status}`
function statusFromDroppable(id: UniqueIdentifier | null | undefined): IdeaStatus | null {
  if (typeof id !== "string" || !id.startsWith(DROP_PREFIX)) return null
  const status = id.slice(DROP_PREFIX.length) as IdeaStatus
  return ALL_STATUSES.includes(status) ? status : null
}

const statusLabel = (status: IdeaStatus | null | undefined) => (status ? (IDEA_STATUS_MAP[status]?.label ?? status) : "no status")

/** One line per column explaining what belongs there (shown when it's empty). */
const EMPTY_HINTS: Record<IdeaStatus, string> = {
  inbox: "Captured ideas land here first.",
  researching: "Ideas you're collecting examples, data or angles for.",
  validated: "Ideas with a confirmed audience problem.",
  selected: "Ideas chosen for an upcoming slot.",
  converted: "Drop an idea here to turn it into content.",
  archived: "Parked or rejected ideas.",
}

/**
 * Pointer drags target the column under the cursor. Keyboard drags (no pointer) centre the card on the
 * chosen column, so the nearest column centre is exact — overlap would favour wide neighbours of the
 * narrow collapsed columns.
 */
const collisionDetection: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const within = pointerWithin(args)
    if (within.length) return within
  }
  return closestCenter(args)
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
  const fromStatus = (active.data.current as { status?: IdeaStatus } | undefined)?.status
  const currentId = over?.id ?? (fromStatus ? droppableId(fromStatus) : null)
  const index = columns.findIndex((column) => column.id === currentId)
  const target = index >= 0 ? columns[index + step] : undefined
  if (!target) return undefined
  return { x: target.rect.left + (target.rect.width - collisionRect.width) / 2, y: collisionRect.top }
}

const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] }

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Press Space to pick up this idea. Use the left and right arrow keys to choose a status, then press Space or Enter to drop it, or Escape to cancel.",
}

// `relative` keeps absolutely positioned descendants (sr-only text) inside the board's scroll container.
const FRAME = "relative snap-start rounded-lg border transition-[background-color,border-color] duration-150"

interface KanbanProps {
  /** Ideas matching search + facets, every status (hidden statuses still count and accept drops). */
  ideas: ContentIdea[]
  /** Statuses the status filter shows — the others render as narrow drop targets. */
  visibleStatuses: IdeaStatus[]
  sort: IdeaSort
  lookups: IdeaLookups
  now: Date
  onOpen: (id: ID) => void
  onVisibleStatusesChange: (statuses: IdeaStatus[]) => void
}

/**
 * Status Kanban: drag a card to change its status. Dropping on Converted to Content opens the
 * convert flow; dropping on Archived archives with Undo. Columns hidden by the status filter stay
 * as narrow drop targets.
 */
export function IdeaKanban({ ideas, visibleStatuses, sort, lookups, now, onOpen, onVisibleStatusesChange }: KanbanProps) {
  const actions = useIdeaActions()
  const [activeId, setActiveId] = useState<ID | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES })
  )

  const byId = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas])
  const columns = useMemo(() => {
    const out = Object.fromEntries(ALL_STATUSES.map((s) => [s, [] as ContentIdea[]])) as Record<IdeaStatus, ContentIdea[]>
    for (const idea of ideas) out[idea.status]?.push(idea)
    const compare = compareIdeas(sort)
    for (const status of ALL_STATUSES) out[status].sort(compare)
    return out
  }, [ideas, sort])
  const activeIdea = activeId ? byId.get(activeId) : undefined

  const announcements = useMemo<Announcements>(() => {
    const title = (id: UniqueIdentifier) => `“${byId.get(String(id))?.title.trim() || "Untitled idea"}”`
    const from = (id: UniqueIdentifier) => byId.get(String(id))?.status
    return {
      onDragStart: ({ active }) => `Picked up ${title(active.id)} from ${statusLabel(from(active.id))}.`,
      onDragOver: ({ over }) => (over ? `Over ${statusLabel(statusFromDroppable(over.id))}.` : "Not over a status."),
      onDragEnd: ({ active, over }) => {
        const to = statusFromDroppable(over?.id)
        return to && to !== from(active.id)
          ? `Dropped ${title(active.id)} in ${statusLabel(to)}.`
          : `${title(active.id)} stays in ${statusLabel(from(active.id))}.`
      },
      onDragCancel: ({ active }) => `Move cancelled. ${title(active.id)} stays in ${statusLabel(from(active.id))}.`,
    }
  }, [byId])

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const idea = byId.get(String(active.id))
    const status = statusFromDroppable(over?.id)
    if (!idea || !status || status === idea.status) return
    // Moves into a visible column are visually obvious; hidden targets and archiving get a toast with Undo.
    const quiet = visibleStatuses.includes(status) && status !== "archived"
    actions.setStatus([idea.id], status, { quiet })
  }

  const expand = (status: IdeaStatus) => onVisibleStatusesChange(ALL_STATUSES.filter((s) => s === status || visibleStatuses.includes(s)))
  const collapse = (status: IdeaStatus) => onVisibleStatusesChange(visibleStatuses.filter((s) => s !== status))

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
        aria-label="Idea Kanban"
        className="relative flex h-[calc(100svh-18rem)] min-h-[26rem] snap-x gap-2.5 overflow-x-auto overscroll-x-contain pb-2"
      >
        {ALL_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            ideas={columns[status]}
            expanded={visibleStatuses.includes(status)}
            canCollapse={visibleStatuses.length > 1}
            dragging={activeId !== null}
            lookups={lookups}
            now={now}
            onOpen={onOpen}
            onExpand={expand}
            onCollapse={collapse}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeIdea ? (
          <IdeaCard
            idea={activeIdea}
            pillar={activeIdea.pillar_id ? lookups.pillars.get(activeIdea.pillar_id) : undefined}
            format={activeIdea.format_id ? lookups.formats.get(activeIdea.format_id) : undefined}
            now={now}
            className="w-[256px] cursor-grabbing shadow-lg ring-1 ring-foreground/10"
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface ColumnProps {
  status: IdeaStatus
  ideas: ContentIdea[]
  expanded: boolean
  canCollapse: boolean
  dragging: boolean
  lookups: IdeaLookups
  now: Date
  onOpen: (id: ID) => void
  onExpand: (status: IdeaStatus) => void
  onCollapse: (status: IdeaStatus) => void
}

const KanbanColumn = memo(function KanbanColumn({
  status,
  ideas,
  expanded,
  canCollapse,
  dragging,
  lookups,
  now,
  onOpen,
  onExpand,
  onCollapse,
}: ColumnProps) {
  const meta = IDEA_STATUS_MAP[status]
  const Icon = IDEA_STATUS_ICONS[status]
  const { setNodeRef, isOver } = useDroppable({ id: droppableId(status), data: { status } })
  const count = ideas.length
  const surface = isOver ? "border-brand/50 bg-brand-soft" : "bg-muted/40 dark:bg-muted/20"

  if (!expanded) {
    return (
      <section ref={setNodeRef} aria-label={`${meta.label} (hidden by the status filter)`} className={cn(FRAME, "flex h-full w-11 shrink-0 flex-col", surface)}>
        <button
          type="button"
          onClick={() => onExpand(status)}
          aria-label={`Show ${meta.label}: ${pluralize(count, "idea")}`}
          title={`Show ${meta.label}`}
          className="flex h-full w-full flex-col items-center gap-2 rounded-lg py-2.5 outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted/40"
        >
          <ChevronsRight className="size-3.5 text-muted-foreground" aria-hidden />
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium num">{formatNumber(count)}</span>
          <span className="text-sm font-medium whitespace-nowrap [writing-mode:vertical-rl]">{meta.label}</span>
        </button>
      </section>
    )
  }

  const titleId = `idea-column-${status}`
  return (
    <section ref={setNodeRef} aria-labelledby={titleId} className={cn(FRAME, "flex h-full max-w-[340px] min-w-[240px] shrink grow basis-[272px] flex-col", surface)}>
      <header className="flex h-10 shrink-0 items-center gap-1.5 pr-1.5 pl-3">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <h2 id={titleId} className="min-w-0 truncate text-sm font-medium" title={meta.description}>
          {meta.label}
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground num">{formatNumber(count)}</span>
        {canCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto text-muted-foreground"
            aria-label={`Hide ${meta.label}`}
            title="Hide column"
            onClick={() => onCollapse(status)}
          >
            <ChevronsLeft aria-hidden />
          </Button>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 pb-2">
        {ideas.map((idea) => (
          <KanbanCard
            key={idea.id}
            idea={idea}
            lookups={lookups}
            now={now}
            onOpen={onOpen}
          />
        ))}
        {!count ? (
          <div
            className={cn(
              "flex min-h-24 shrink-0 items-center justify-center rounded-md border border-dashed px-4 py-5 text-center text-xs text-pretty text-muted-foreground",
              dragging && "border-brand/40"
            )}
          >
            {dragging ? `Drop here to move to ${meta.label}` : EMPTY_HINTS[status]}
          </div>
        ) : null}
      </div>
    </section>
  )
})

const KanbanCard = memo(function KanbanCard({
  idea,
  lookups,
  now,
  onOpen,
}: {
  idea: ContentIdea
  lookups: IdeaLookups
  now: Date
  onOpen: (id: ID) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: idea.id,
    data: { status: idea.status },
  })
  const title = idea.title.trim() || "Untitled idea"

  return (
    <div
      ref={setNodeRef}
      // Mouse: drag from anywhere on the card (a plain click still opens it — drags start after 6px).
      onPointerDown={(event) => {
        if (event.currentTarget.contains(event.target as Node)) listeners?.onPointerDown?.(event)
      }}
      className={cn("relative shrink-0 rounded-lg", isDragging && "opacity-40")}
    >
      <IdeaCard
        idea={idea}
        pillar={idea.pillar_id ? lookups.pillars.get(idea.pillar_id) : undefined}
        format={idea.format_id ? lookups.formats.get(idea.format_id) : undefined}
        now={now}
        onOpen={onOpen}
        dragHandle={
          <Button
            ref={setActivatorNodeRef}
            type="button"
            variant="ghost"
            size="icon-xs"
            {...attributes}
            onKeyDown={(event) => listeners?.onKeyDown?.(event)}
            aria-label={`Move “${title}” to another status`}
            className="cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover/idea:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          >
            <GripVertical aria-hidden />
          </Button>
        }
        actions={<IdeaActionsMenu idea={idea} />}
      />
    </div>
  )
})
