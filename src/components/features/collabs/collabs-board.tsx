"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { AlarmClock, CalendarDays, ChevronsLeftRight, ChevronsRightLeft, FileText } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { COLLAB_STATUS_IDS, PLATFORMS } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { collabStatusDescriptionMessages, collabStatusMessages } from "@/lib/i18n/messages/collabs"
import type { Collab, CollabStatus, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CollabActionsMenu } from "./collab-actions-menu"
import { setCollabStatus } from "./collab-actions"
import { collabDateOf, isFollowUpDue, partnerLabel } from "./collab-model"
import { CollabStatusIcon, CollabTypeBadge, RatingStars, useCollabName } from "./collab-ui"
import { collabsMessages } from "./messages"

const COLUMN_PREFIX = "collab-status:"
const droppableId = (status: CollabStatus) => `${COLUMN_PREFIX}${status}`
const statusFromDroppable = (id: UniqueIdentifier | null | undefined): CollabStatus | null => {
  const value = typeof id === "string" && id.startsWith(COLUMN_PREFIX) ? id.slice(COLUMN_PREFIX.length) : null
  return value && (COLLAB_STATUS_IDS as string[]).includes(value) ? (value as CollabStatus) : null
}

/** Pointer drags target the column under the cursor; keyboard drags the column the card overlaps most. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : rectIntersection(args)
}

/** Left/right arrows jump a whole column. */
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
  const fromStatus = (active.data.current as { status?: CollabStatus } | undefined)?.status
  const currentId = over?.id ?? (fromStatus ? droppableId(fromStatus) : null)
  const index = columns.findIndex((column) => column.id === currentId)
  const target = index >= 0 ? columns[index + step] : undefined
  if (!target) return undefined
  return { x: target.rect.left + (target.rect.width - collisionRect.width) / 2, y: collisionRect.top }
}

const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] }

interface BoardProps {
  collabs: Collab[]
  /** Collabs per status before filters, for "no matches" hints. */
  totals: Record<CollabStatus, number>
  filtered: boolean
  now: Date
  openId: ID | null
  showDeclined: boolean
  onShowDeclined: (show: boolean) => void
  onOpen: (id: ID) => void
  onEdit: (collab: Collab) => void
  onBeforeDelete: (collab: Collab) => void
}

/** Kanban by collab status; Declined is a collapsed side column until opened. Drops run the same move as the card menu. */
export function CollabsBoard({ collabs, totals, filtered, now, openId, showDeclined, onShowDeclined, onOpen, onEdit, onBeforeDelete }: BoardProps) {
  const t = useT(collabsMessages)
  const statusLabel = useT(collabStatusMessages)
  const name = useCollabName()
  const [activeId, setActiveId] = useState<ID | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES })
  )
  const byId = useMemo(() => new Map(collabs.map((c) => [c.id, c])), [collabs])
  const columns = useMemo(() => COLLAB_STATUS_IDS.map((status) => ({ status, collabs: collabs.filter((c) => c.status === status) })), [collabs])
  const active = activeId ? (byId.get(activeId) ?? null) : null

  const announcements = useMemo<Announcements>(() => {
    const title = (id: UniqueIdentifier) => {
      const row = byId.get(String(id))
      return row ? name(row) : t("untitled")
    }
    const from = (id: UniqueIdentifier) => {
      const status = byId.get(String(id))?.status
      return status ? statusLabel(status) : ""
    }
    return {
      onDragStart: ({ active: a }) => t("sr_pick", { title: title(a.id), status: from(a.id) }),
      onDragOver: ({ over }) => {
        const status = statusFromDroppable(over?.id)
        return status ? t("sr_over", { status: statusLabel(status) }) : t("sr_not_over")
      },
      onDragEnd: ({ active: a, over }) => {
        const to = statusFromDroppable(over?.id)
        return to && to !== byId.get(String(a.id))?.status
          ? t("sr_drop", { title: title(a.id), status: statusLabel(to) })
          : t("sr_stay", { title: title(a.id), status: from(a.id) })
      },
      onDragCancel: ({ active: a }) => t("sr_cancel", { title: title(a.id), status: from(a.id) }),
    }
  }, [byId, t, statusLabel, name])

  function handleDragEnd({ active: a, over }: DragEndEvent) {
    setActiveId(null)
    const collab = byId.get(String(a.id))
    const status = statusFromDroppable(over?.id)
    if (collab && status && status !== collab.status) setCollabStatus(collab, status, { announce: status === "declined" })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("sr_instructions") } }}
      onDragStart={({ active: a }) => setActiveId(String(a.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div
        role="region"
        aria-label={t("board_label")}
        className="relative -mx-4 flex min-w-0 snap-x gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-2 scrollbar-thin md:mx-0 md:px-0"
      >
        {columns.map((column) =>
          column.status === "declined" && !showDeclined ? (
            <CollapsedColumn key={column.status} count={column.collabs.length} dragging={activeId !== null} onExpand={() => onShowDeclined(true)} />
          ) : (
            <CollabColumn
              key={column.status}
              status={column.status}
              collabs={column.collabs}
              total={totals[column.status]}
              filtered={filtered}
              dragging={activeId !== null}
              now={now}
              openId={openId}
              onCollapse={column.status === "declined" ? () => onShowDeclined(false) : undefined}
              onOpen={onOpen}
              onEdit={onEdit}
              onBeforeDelete={onBeforeDelete}
            />
          )
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <CollabCardBody collab={active} now={now} className="cursor-grabbing shadow-lg ring-1 ring-foreground/10" /> : null}
      </DragOverlay>
    </DndContext>
  )
}

/** Declined, folded to a slim column; still a drop target. */
function CollapsedColumn({ count, dragging, onExpand }: { count: number; dragging: boolean; onExpand: () => void }) {
  const t = useT(collabsMessages)
  const statusLabel = useT(collabStatusMessages)
  const { setNodeRef, isOver } = useDroppable({ id: droppableId("declined"), data: { status: "declined" } })
  return (
    <section
      ref={setNodeRef}
      id={droppableId("declined")}
      aria-label={statusLabel("declined")}
      className={cn(
        "relative flex min-h-64 w-11 shrink-0 snap-start flex-col items-center rounded-lg border transition-[background-color,border-color] duration-150",
        isOver ? "border-brand/50 bg-brand-soft" : dragging ? "border-dashed bg-muted/40 dark:bg-muted/20" : "bg-muted/40 dark:bg-muted/20"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="mt-2 text-muted-foreground"
        aria-label={t("show_declined_column", { count })}
        title={t("show_declined_column", { count })}
        onClick={onExpand}
      >
        <ChevronsLeftRight aria-hidden />
      </Button>
      <button
        type="button"
        onClick={onExpand}
        className="mt-2 flex flex-1 items-start justify-center rounded-md px-1 pb-3 text-xs text-muted-foreground outline-none [writing-mode:vertical-rl] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        tabIndex={-1}
        aria-hidden
      >
        <span className="inline-flex items-center gap-1.5">
          <CollabStatusIcon status="declined" className="rotate-90" />
          {statusLabel("declined")} · <span className="num">{count}</span>
        </span>
      </button>
    </section>
  )
}

const CollabColumn = memo(function CollabColumn({
  status,
  collabs,
  total,
  filtered,
  dragging,
  now,
  openId,
  onCollapse,
  onOpen,
  onEdit,
  onBeforeDelete,
}: {
  status: CollabStatus
  collabs: Collab[]
  total: number
  filtered: boolean
  dragging: boolean
  now: Date
  openId: ID | null
  onCollapse?: () => void
  onOpen: (id: ID) => void
  onEdit: (collab: Collab) => void
  onBeforeDelete: (collab: Collab) => void
}) {
  const t = useT(collabsMessages)
  const statusLabel = useT(collabStatusMessages)
  const statusDescription = useT(collabStatusDescriptionMessages)
  const { setNodeRef, isOver } = useDroppable({ id: droppableId(status), data: { status } })
  const titleId = `${droppableId(status)}-title`

  return (
    <section
      ref={setNodeRef}
      id={droppableId(status)}
      aria-labelledby={titleId}
      className={cn(
        "relative flex min-h-64 w-[248px] shrink-0 snap-start flex-col rounded-lg border transition-[background-color,border-color] duration-150",
        isOver ? "border-brand/50 bg-brand-soft" : "bg-muted/40 dark:bg-muted/20"
      )}
    >
      <header className="flex shrink-0 min-w-0 items-center gap-1.5 px-3 pt-2.5 pb-2">
        <CollabStatusIcon status={status} />
        <h2 id={titleId} className="min-w-0 truncate text-sm font-medium" title={statusDescription(status)}>
          {statusLabel(status)}
        </h2>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground num" aria-label={t("column_count", { count: collabs.length, status: statusLabel(status) })}>
          {filtered && collabs.length !== total ? t("shown_of", { shown: collabs.length, total }) : collabs.length}
        </span>
        {onCollapse ? (
          <Button type="button" variant="ghost" size="icon-xs" className="-mr-1 text-muted-foreground" aria-label={t("hide_declined_column")} title={t("hide_declined_column")} onClick={onCollapse}>
            <ChevronsRightLeft aria-hidden />
          </Button>
        ) : null}
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
        {collabs.map((collab) => (
          <li key={collab.id}>
            <CollabCard collab={collab} now={now} selected={collab.id === openId} onOpen={onOpen} onEdit={onEdit} onBeforeDelete={onBeforeDelete} />
          </li>
        ))}
        {!collabs.length ? (
          // A quiet drop target; what belongs here is its tooltip on desktop, a line on touch screens.
          <li
            title={statusDescription(status)}
            className={cn(
              "flex min-h-20 flex-1 items-center justify-center rounded-md border border-dashed px-3 py-4 text-center text-xs text-pretty text-muted-foreground",
              dragging && "border-brand/40"
            )}
          >
            {dragging ? (
              t("drop_here", { status: statusLabel(status) })
            ) : filtered && total ? (
              t("no_matches_column")
            ) : (
              <span className="md:hidden">{statusDescription(status)}</span>
            )}
          </li>
        ) : null}
      </ul>
    </section>
  )
})

const CollabCard = memo(function CollabCard({
  collab,
  now,
  selected,
  onOpen,
  onEdit,
  onBeforeDelete,
}: {
  collab: Collab
  now: Date
  selected: boolean
  onOpen: (id: ID) => void
  onEdit: (collab: Collab) => void
  onBeforeDelete: (collab: Collab) => void
}) {
  const t = useT(collabsMessages)
  const name = useCollabName()
  const title = name(collab)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: collab.id, data: { status: collab.status } })

  return (
    <div ref={setNodeRef} onPointerDown={(event) => listeners?.onPointerDown?.(event)} className={cn("relative rounded-lg", isDragging && "opacity-40")}>
      <CollabCardBody
        collab={collab}
        now={now}
        selected={selected}
        title={
          <button
            type="button"
            onClick={() => onOpen(collab.id)}
            aria-label={t("open_collab", { title })}
            className="line-clamp-2 min-w-0 flex-1 text-left text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
          >
            {title}
          </button>
        }
        actions={
          <span className="relative z-10 -my-1 -mr-1.5 flex shrink-0 items-center">
            <CollabActionsMenu
              collab={collab}
              onEdit={onEdit}
              onBeforeDelete={() => onBeforeDelete(collab)}
              drag={{ setActivatorNodeRef, attributes, listeners, isDragging }}
              className="size-6"
            />
          </span>
        }
      />
    </div>
  )
})

/** Card face, shared by the board and the drag overlay. */
function CollabCardBody({
  collab,
  now,
  selected = false,
  title,
  actions,
  className,
}: {
  collab: Collab
  now: Date
  selected?: boolean
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  const t = useT(collabsMessages)
  const name = useCollabName()
  const partner = partnerLabel(collab)
  const date = collabDateOf(collab)
  const due = isFollowUpDue(collab, now)
  const posts = collab.content_item_ids.length

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-xs transition-colors hover:border-foreground/15",
        selected && "border-brand/60 ring-2 ring-brand/25",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-1">
        {title ?? <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium">{name(collab)}</span>}
        {actions}
      </div>
      {partner ? (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {collab.partner_platform ? <PlatformIcon platform={collab.partner_platform} label={PLATFORMS[collab.partner_platform].label} className="size-3 shrink-0" /> : null}
          <span className="truncate">{partner}</span>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <CollabTypeBadge type={collab.type} />
        {date ? (
          <span className={cn("inline-flex items-center gap-1 num", due && "font-medium text-critical-fg")}>
            {due ? <AlarmClock className="size-3" aria-hidden /> : <CalendarDays className="size-3" aria-hidden />}
            {date.kind === "follow_up" ? t("follow_up_on_short", { date: formatShortDate(date.date) }) : formatShortDate(date.date)}
          </span>
        ) : null}
        {posts ? (
          <span className="inline-flex items-center gap-1 num">
            <FileText className="size-3" aria-hidden />
            {t.plural("posts", posts)}
          </span>
        ) : null}
        <RatingStars rating={collab.rating} />
      </div>
    </article>
  )
}
