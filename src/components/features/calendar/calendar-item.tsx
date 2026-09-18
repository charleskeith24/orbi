"use client"

import { useDraggable, type DraggableAttributes, type DraggableSyntheticListeners } from "@dnd-kit/core"
import { format } from "date-fns"
import { CalendarClock, CalendarX2, ChartColumn, CircleCheck, Ellipsis, ExternalLink, Flag, SquareKanban } from "lucide-react"
import Link from "next/link"
import { memo, useState } from "react"
import { catVar, ColorDot, PlatformIcon, StageIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { useT, type Translator } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import type { CategoricalColor, ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCalendarActions } from "./calendar-actions"
import { isLiveItem, type PlacementKind } from "./calendar-model"
import { calendarMessages } from "./messages"

/** How an item shows up: placed on a day (published / scheduled / due) or waiting in the tray. */
export type ItemKind = PlacementKind | "unscheduled"
/** chip = one line (month, tray) · card = two lines (week) · row = full detail (day, agenda). */
export type ItemVariant = "chip" | "card" | "row"

interface DragBinding {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  isDragging: boolean
}

export interface ItemBodyProps {
  item: ContentItem
  kind: ItemKind
  at: Date | null
  pillarColor: CategoricalColor | null
  pillarName: string | null
  variant: ItemVariant
  highlighted?: boolean
  /** Extra control on rows (e.g. "Schedule"). */
  action?: React.ReactNode
  menu?: React.ReactNode
  /** Drag preview: no link, lifted look. */
  overlay?: boolean
}

const STRETCHED = "outline-none after:absolute after:inset-0 after:content-['']"

function describe(item: ContentItem, kind: ItemKind, at: Date | null, t: Translator<typeof calendarMessages.en>): string {
  const parts = [item.title.trim() || t("untitled_content"), PLATFORMS[item.platform]?.label ?? item.platform, PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage]
  if (at && kind === "published") parts.push(t("item_published", { date: format(at, "MMM d, h:mm a") }))
  if (at && kind === "scheduled") parts.push(t("item_scheduled", { date: format(at, "MMM d, h:mm a") }))
  if (at && kind === "due") parts.push(t("item_due", { date: format(at, "MMM d") }))
  if (kind === "unscheduled") parts.push(t("no_publish_time"))
  return parts.join(" · ")
}

/** Identity bar in the pillar colour (the text never wears it). */
function PillarBar({ color, className }: { color: CategoricalColor | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute w-[3px] rounded-full", !color && "opacity-30", className)}
      style={{ backgroundColor: catVar(color) }}
    />
  )
}

/** Presentational item (also the drag preview). */
export function ItemBody({ item, kind, at, pillarColor, pillarName, variant, highlighted = false, action, menu, overlay = false }: ItemBodyProps) {
  const t = useT(calendarMessages)
  const title = item.title.trim() || t("untitled_content")
  const live = kind === "published"
  const stage = PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage
  const time = at && (kind === "published" || kind === "scheduled") ? format(at, "h:mm a") : null
  const titleNode = overlay ? (
    title
  ) : (
    <Link
      href={`/studio/${item.id}`}
      data-card-link
      draggable={false}
      className={cn(STRETCHED, variant === "row" ? "after:rounded-lg" : "after:rounded-md")}
    >
      {title}
    </Link>
  )
  const surface =
    kind === "due"
      ? "border-dashed bg-card/60"
      : live
        ? "border-transparent bg-muted/70 dark:bg-muted/40"
        : "bg-card shadow-xs"
  const states = cn(
    "transition-[border-color,box-shadow] hover:border-foreground/20",
    "has-[[data-card-link]:focus-visible]:border-ring has-[[data-card-link]:focus-visible]:ring-2 has-[[data-card-link]:focus-visible]:ring-ring/50",
    highlighted && "border-brand/60 ring-2 ring-brand/30",
    overlay && "cursor-grabbing shadow-lg ring-1 ring-foreground/10"
  )
  const tooltip = describe(item, kind, at, t)

  if (variant === "chip") {
    return (
      <div title={tooltip} className={cn("relative flex h-6 min-w-0 items-center gap-1.5 rounded-md border pr-1.5 pl-2.5 text-xs", surface, states)}>
        <PillarBar color={pillarColor} className="inset-y-1 left-1" />
        <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("min-w-0 flex-1 truncate", live && "text-muted-foreground")}>{titleNode}</span>
        {live ? (
          <>
            <CircleCheck className="size-3.5 shrink-0 text-good-fg" aria-hidden />
            <span className="sr-only">{t("published")}</span>
          </>
        ) : kind === "scheduled" ? (
          <span className="shrink-0 text-[11px] text-muted-foreground num">{time}</span>
        ) : kind === "due" ? (
          <>
            <Flag className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">{t("due")}</span>
          </>
        ) : (
          <>
            <StageIcon stage={item.stage} />
            <span className="sr-only">{stage}</span>
          </>
        )}
        {menu}
      </div>
    )
  }

  if (variant === "card") {
    // Narrow week columns: platform + time first, the title, then the stage only while it still says something.
    const stageLine = !live && item.stage !== "scheduled"
    return (
      <div title={tooltip} className={cn("relative flex min-w-0 flex-col gap-0.5 rounded-md border py-1.5 pr-1.5 pl-3 text-xs", surface, states)}>
        <PillarBar color={pillarColor} className="inset-y-1.5 left-1" />
        <span className="flex min-w-0 items-center gap-1.5 pr-5 text-[11px] leading-4 text-muted-foreground">
          <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0" />
          {kind === "due" ? (
            <span className="inline-flex items-center gap-1">
              <Flag className="size-3" aria-hidden />
              {t("due")}
            </span>
          ) : time ? (
            <span className="num">{time}</span>
          ) : null}
          {live ? <CircleCheck className="ml-auto size-3.5 shrink-0 text-good-fg" aria-hidden /> : <StageIcon stage={item.stage} className="ml-auto" />}
          <span className="sr-only">{live ? t("published") : stage}</span>
        </span>
        <span className={cn("line-clamp-2 text-[13px] leading-snug font-medium break-words", live && "text-muted-foreground")}>{titleNode}</span>
        {stageLine ? (
          <span aria-hidden className="truncate text-[11px] text-muted-foreground">
            {stage}
          </span>
        ) : null}
        {menu}
      </div>
    )
  }

  return (
    <div title={tooltip} className={cn("relative flex min-w-0 items-start gap-3 rounded-lg border py-2.5 pr-2 pl-4 text-sm", surface, states)}>
      <PillarBar color={pillarColor} className="inset-y-2.5 left-1.5" />
      {kind !== "unscheduled" ? (
        <span className="w-16 shrink-0 pt-px text-xs">
          {kind === "due" ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Flag className="size-3.5" aria-hidden />
              {t("due")}
            </span>
          ) : (
            <span className={cn("font-medium num", live && "text-muted-foreground")}>{time}</span>
          )}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={cn("line-clamp-2 leading-snug font-medium break-words", live && "text-muted-foreground")}>{titleNode}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <PlatformIcon platform={item.platform} className="size-3.5" />
            {PLATFORMS[item.platform]?.label ?? item.platform}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {pillarName ? <ColorDot color={pillarColor} /> : null}
            <span className="truncate">{pillarName ?? t("no_pillar")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            {live ? <CircleCheck className="size-3.5 text-good-fg" aria-hidden /> : <StageIcon stage={item.stage} />}
            {stage}
          </span>
        </div>
      </div>
      {action ? <div className="relative z-10 shrink-0 self-center">{action}</div> : null}
      {menu}
    </div>
  )
}

export interface CalendarItemProps extends Omit<ItemBodyProps, "menu" | "overlay"> {
  /** Register with the calendar's drag and drop (published items never move). */
  dnd?: boolean
  className?: string
}

/**
 * A calendar item. Mouse: drag anywhere on it (a plain click opens the Content Studio — dragging starts
 * after 6px). Keyboard: the "⋯" button is the handle — Space picks it up, Enter opens its actions.
 */
export const CalendarItem = memo(function CalendarItem({ dnd = false, className, ...body }: CalendarItemProps) {
  const { item, kind, variant } = body
  const movable = dnd && kind !== "published"
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { kind },
    disabled: !movable,
  })
  const drag: DragBinding | undefined = movable ? { setActivatorNodeRef, attributes, listeners, isDragging } : undefined

  return (
    <div
      ref={setNodeRef}
      data-calendar-item={item.id}
      onPointerDown={movable ? (event) => listeners?.onPointerDown?.(event) : undefined}
      className={cn("group/citem relative min-w-0", movable && "cursor-grab", isDragging && "opacity-40", className)}
    >
      <ItemBody {...body} menu={<ItemMenu item={item} variant={variant} drag={drag} />} />
    </div>
  )
})

const MENU_BUTTON: Record<ItemVariant, string> = {
  chip: "absolute top-1/2 right-0.5 z-10 size-5 -translate-y-1/2 bg-card opacity-0 shadow-xs group-hover/citem:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100",
  card: "absolute top-1 right-1 z-10 size-5 bg-card opacity-0 group-hover/citem:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100",
  row: "relative z-10 -my-0.5 shrink-0",
}

function ItemMenu({ item, variant, drag }: { item: ContentItem; variant: ItemVariant; drag?: DragBinding }) {
  const t = useT(calendarMessages)
  const actions = useCalendarActions()
  const [open, setOpen] = useState(false)
  const live = isLiveItem(item)
  const title = item.title.trim() || t("untitled_content")

  const dragHandlers = drag
    ? {
        // Radix opens menus on pointer down; this one opens on click so a press can become a drag (the item starts it).
        onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => event.preventDefault(),
        onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
          if (drag.isDragging) {
            // Arrows, Space, Enter and Escape belong to the keyboard drag, not the menu.
            event.preventDefault()
            return
          }
          if (event.code === "Space") {
            drag.listeners?.onKeyDown?.(event)
            event.preventDefault()
          }
        },
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          // Keyboard activations (detail 0) are handled by Radix (Enter) or the drag (Space).
          if (event.detail > 0) setOpen(true)
        },
      }
    : {}

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={drag?.setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          {...drag?.attributes}
          {...dragHandlers}
          aria-label={t("actions_for", { title })}
          className={cn("text-muted-foreground", drag && "touch-none", MENU_BUTTON[variant])}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        // Menu events bubble through the React tree to the item; keep them from starting a drag.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem asChild>
          <Link href={`/studio/${item.id}`}>
            <ExternalLink aria-hidden />
            {t("open_in_studio")}
          </Link>
        </DropdownMenuItem>
        {!live ? (
          <DropdownMenuItem onSelect={() => actions.schedule(item)}>
            <CalendarClock aria-hidden />
            {item.scheduled_at ? t("reschedule_menu") : t("schedule_menu")}
          </DropdownMenuItem>
        ) : null}
        {!live && item.scheduled_at ? (
          <DropdownMenuItem onSelect={() => actions.unschedule(item)}>
            <CalendarX2 aria-hidden />
            {t("unschedule")}
          </DropdownMenuItem>
        ) : null}
        {!live ? (
          <DropdownMenuItem onSelect={() => actions.changeDue(item)}>
            <Flag aria-hidden />
            {item.due_date ? t("change_due_menu") : t("set_due_menu")}
          </DropdownMenuItem>
        ) : null}
        {live ? (
          <DropdownMenuItem onSelect={() => uiActions.openDialog({ type: "add-metrics", itemId: item.id })}>
            <ChartColumn aria-hidden />
            {t("add_analytics")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/pipeline?open=${item.id}`}>
            <SquareKanban aria-hidden />
            {t("show_in_pipeline")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
