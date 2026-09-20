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
import { AlarmClock, FileText, ListChecks } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { PlatformIcon } from "@/components/common"
import { DEAL_STATUS_IDS, PLATFORMS } from "@/lib/constants"
import { formatShortDate, toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { dealStatusDescriptionMessages, dealStatusMessages } from "@/lib/i18n/messages/money"
import type { BrandDeal, DealStatus, ID } from "@/lib/types"
import { cn, formatMoney } from "@/lib/utils"
import { DealActionsMenu } from "./deal-actions-menu"
import { dealsMessages } from "./deals-messages"
import { setDealStatus } from "./money-actions"
import { deliverableProgress, totalsByCurrency, type CurrencyTotal } from "./money-model"
import { DealStatusIcon } from "./money-ui"

const COLUMN_PREFIX = "deal-status:"
const droppableId = (status: DealStatus) => `${COLUMN_PREFIX}${status}`
const statusFromDroppable = (id: UniqueIdentifier | null | undefined): DealStatus | null => {
  const value = typeof id === "string" && id.startsWith(COLUMN_PREFIX) ? id.slice(COLUMN_PREFIX.length) : null
  return value && (DEAL_STATUS_IDS as string[]).includes(value) ? (value as DealStatus) : null
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
  const fromStatus = (active.data.current as { status?: DealStatus } | undefined)?.status
  const currentId = over?.id ?? (fromStatus ? droppableId(fromStatus) : null)
  const index = columns.findIndex((column) => column.id === currentId)
  const target = index >= 0 ? columns[index + step] : undefined
  if (!target) return undefined
  return { x: target.rect.left + (target.rect.width - collisionRect.width) / 2, y: collisionRect.top }
}

const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] }

interface BoardProps {
  deals: BrandDeal[]
  /** Deals per status before filters, for "no matches" hints. */
  totals: Record<DealStatus, number>
  filtered: boolean
  primary: string
  now: Date
  openId: ID | null
  onOpen: (id: ID) => void
  onEdit: (deal: BrandDeal) => void
  onBeforeDelete: (deal: BrandDeal) => void
}

/** Kanban by deal status. Dropping a card runs the same status change as the card menu (Paid → Mark paid). */
export function DealsBoard({ deals, totals, filtered, primary, now, openId, onOpen, onEdit, onBeforeDelete }: BoardProps) {
  const t = useT(dealsMessages)
  const statusLabel = useT(dealStatusMessages)
  const [activeId, setActiveId] = useState<ID | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES })
  )
  const byId = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals])
  const columns = useMemo(
    () => DEAL_STATUS_IDS.map((status) => ({ status, deals: deals.filter((d) => d.status === status) })),
    [deals]
  )
  const active = activeId ? (byId.get(activeId) ?? null) : null
  const today = toISODate(now)

  const announcements = useMemo<Announcements>(() => {
    const brand = (id: UniqueIdentifier) => byId.get(String(id))?.brand_name || t("untitled")
    const from = (id: UniqueIdentifier) => {
      const status = byId.get(String(id))?.status
      return status ? statusLabel(status) : ""
    }
    return {
      onDragStart: ({ active: a }) => t("sr_pick", { brand: brand(a.id), status: from(a.id) }),
      onDragOver: ({ over }) => {
        const status = statusFromDroppable(over?.id)
        return status ? t("sr_over", { status: statusLabel(status) }) : t("sr_not_over")
      },
      onDragEnd: ({ active: a, over }) => {
        const to = statusFromDroppable(over?.id)
        return to && to !== byId.get(String(a.id))?.status
          ? t("sr_drop", { brand: brand(a.id), status: statusLabel(to) })
          : t("sr_stay", { brand: brand(a.id), status: from(a.id) })
      },
      onDragCancel: ({ active: a }) => t("sr_cancel", { brand: brand(a.id), status: from(a.id) }),
    }
  }, [byId, t, statusLabel])

  function handleDragEnd({ active: a, over }: DragEndEvent) {
    setActiveId(null)
    const deal = byId.get(String(a.id))
    const status = statusFromDroppable(over?.id)
    if (deal && status && status !== deal.status) setDealStatus(deal, status)
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
        {columns.map((column) => (
          <DealColumn
            key={column.status}
            status={column.status}
            deals={column.deals}
            total={totals[column.status]}
            filtered={filtered}
            dragging={activeId !== null}
            primary={primary}
            today={today}
            openId={openId}
            onOpen={onOpen}
            onEdit={onEdit}
            onBeforeDelete={onBeforeDelete}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <DealCardBody deal={active} today={today} className="cursor-grabbing shadow-lg ring-1 ring-foreground/10" /> : null}
      </DragOverlay>
    </DndContext>
  )
}

const DealColumn = memo(function DealColumn({
  status,
  deals,
  total,
  filtered,
  dragging,
  primary,
  today,
  openId,
  onOpen,
  onEdit,
  onBeforeDelete,
}: {
  status: DealStatus
  deals: BrandDeal[]
  total: number
  filtered: boolean
  dragging: boolean
  primary: string
  today: string
  openId: ID | null
  onOpen: (id: ID) => void
  onEdit: (deal: BrandDeal) => void
  onBeforeDelete: (deal: BrandDeal) => void
}) {
  const t = useT(dealsMessages)
  const statusLabel = useT(dealStatusMessages)
  const statusDescription = useT(dealStatusDescriptionMessages)
  const { setNodeRef, isOver } = useDroppable({ id: droppableId(status), data: { status } })
  const titleId = `${droppableId(status)}-title`
  const fees = useMemo(() => totalsByCurrency(deals, (d) => d.fee, (d) => d.currency, primary), [deals, primary])

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
      <header className="flex shrink-0 flex-col gap-0.5 px-3 pt-2.5 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <DealStatusIcon status={status} />
          <h2 id={titleId} className="min-w-0 truncate text-sm font-medium" title={statusDescription(status)}>
            {statusLabel(status)}
          </h2>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground num" aria-label={t("column_count", { count: deals.length, status: statusLabel(status) })}>
            {filtered && deals.length !== total ? t("shown_of", { shown: deals.length, total }) : deals.length}
          </span>
        </div>
        <FeeLine fees={fees} />
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard deal={deal} today={today} selected={deal.id === openId} onOpen={onOpen} onEdit={onEdit} onBeforeDelete={onBeforeDelete} />
          </li>
        ))}
        {!deals.length ? (
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

function FeeLine({ fees }: { fees: CurrencyTotal[] }) {
  if (!fees.length) return <span className="h-4" aria-hidden />
  return (
    <span className="truncate text-xs text-muted-foreground num">
      {fees.map((f) => formatMoney(f.amount, f.currency, { compact: true })).join(" + ")}
    </span>
  )
}

const DealCard = memo(function DealCard({
  deal,
  today,
  selected,
  onOpen,
  onEdit,
  onBeforeDelete,
}: {
  deal: BrandDeal
  today: string
  selected: boolean
  onOpen: (id: ID) => void
  onEdit: (deal: BrandDeal) => void
  onBeforeDelete: (deal: BrandDeal) => void
}) {
  const t = useT(dealsMessages)
  const brand = deal.brand_name || t("untitled")
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: deal.id, data: { status: deal.status } })

  return (
    <div
      ref={setNodeRef}
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
      className={cn("relative rounded-lg", isDragging && "opacity-40")}
    >
      <DealCardBody
        deal={deal}
        today={today}
        selected={selected}
        title={
          <button
            type="button"
            onClick={() => onOpen(deal.id)}
            aria-label={t("open_deal", { brand })}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
          >
            {brand}
          </button>
        }
        actions={
          <span className="relative z-10 -my-1 -mr-1.5 flex shrink-0 items-center">
            <DealActionsMenu
              deal={deal}
              onEdit={onEdit}
              onBeforeDelete={() => onBeforeDelete(deal)}
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
function DealCardBody({
  deal,
  today,
  selected = false,
  title,
  actions,
  className,
}: {
  deal: BrandDeal
  today: string
  selected?: boolean
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  const t = useT(dealsMessages)
  const progress = deliverableProgress(deal.deliverables)
  const overdue = deal.due_date !== null && deal.due_date < today && deal.status !== "paid" && deal.status !== "delivered" && deal.status !== "lost"
  const date = deal.status === "paid" && deal.paid_at ? t("paid_on", { date: formatShortDate(deal.paid_at) }) : deal.due_date ? t("due", { date: formatShortDate(deal.due_date) }) : null

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-xs transition-colors hover:border-foreground/15",
        selected && "border-brand/60 ring-2 ring-brand/25",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {title ?? <span className="min-w-0 flex-1 truncate text-sm font-medium">{deal.brand_name || t("untitled")}</span>}
        {actions}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className={cn("num", deal.fee !== null && "font-medium text-foreground")}>
          {deal.fee === null ? t("no_fee") : formatMoney(deal.fee, deal.currency)}
        </span>
        {date ? (
          <span className={cn("inline-flex items-center gap-1 num", overdue && "font-medium text-critical-fg")}>
            {overdue ? <AlarmClock className="size-3" aria-hidden /> : null}
            {date}
          </span>
        ) : null}
      </div>
      {deal.platforms.length || progress.total || deal.content_item_ids.length ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {deal.platforms.length ? (
            <span className="flex items-center gap-1">
              {deal.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} label={PLATFORMS[p].label} className="size-3" />
              ))}
            </span>
          ) : null}
          {/* Numbers with an icon; the words are for screen readers and the tooltip. */}
          {progress.total ? (
            <span className="inline-flex items-center gap-1 num" title={t("deliverables_progress", progress)}>
              <ListChecks className="size-3" aria-hidden />
              <span aria-hidden>{`${progress.done}/${progress.total}`}</span>
              <span className="sr-only">{t("deliverables_progress", progress)}</span>
            </span>
          ) : null}
          {deal.content_item_ids.length ? (
            <span className="inline-flex items-center gap-1 num" title={t.plural("posts", deal.content_item_ids.length)}>
              <FileText className="size-3" aria-hidden />
              <span aria-hidden>{deal.content_item_ids.length}</span>
              <span className="sr-only">{t.plural("posts", deal.content_item_ids.length)}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
