"use client"

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core"
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Check,
  Copy,
  Ellipsis,
  ExternalLink,
  Trash,
  UserRound,
  UserRoundPlus,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { StageIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n"
import { PIPELINE_STAGES, PUBLISHED_STAGES } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { uiActions, useSettings } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { dueDateShortcuts, NONE } from "./board-model"
import { pipelineCardMessages } from "./messages"
import { usePipelineActions } from "./pipeline-actions"
import { useNow } from "./use-now"

export interface CardDragProps {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  isDragging: boolean
}

/**
 * The card's "⋯" button. On the board it doubles as the drag handle: press-and-drag moves the card
 * (touch too), Space picks it up for a keyboard move, a click or Enter opens the actions menu.
 */
export function CardActions({ item, drag, className }: { item: ContentItem; drag?: CardDragProps; className?: string }) {
  const t = useT(pipelineCardMessages)
  const [open, setOpen] = useState(false)
  const actions = usePipelineActions()
  const settings = useSettings()
  const now = useNow()
  const title = item.title.trim() || t("untitled")
  const live = PUBLISHED_STAGES.includes(item.stage)

  const dragHandlers = drag
    ? {
        onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
          drag.listeners?.onPointerDown?.(event)
          // Radix opens menus on pointer down; this one opens on click so a press can become a drag.
          event.preventDefault()
        },
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
          className={cn(
            "text-muted-foreground",
            drag &&
              "cursor-grab touch-none opacity-0 transition-opacity group-hover/pcard:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100",
            className
          )}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        // Menu events bubble through the React tree to the card; keep them from starting a drag.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem asChild>
          <Link href={`/studio/${item.id}`}>
            <ExternalLink aria-hidden />
            {t("open_in_studio")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRight aria-hidden />
            {t("move_to")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52" onPointerDown={(event) => event.stopPropagation()}>
            {PIPELINE_STAGES.map((stage) => {
              const current = stage.id === item.stage
              return (
                <DropdownMenuItem key={stage.id} disabled={current} onSelect={() => actions.moveItem(item, stage.id)}>
                  <StageIcon stage={stage.id} />
                  <span className="min-w-0 flex-1 truncate">{stage.label}</span>
                  {current ? <Check className="text-muted-foreground" aria-label={t("current_stage")} /> : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {item.stage === "scheduled" ? (
          <DropdownMenuItem onSelect={() => actions.reschedule(item)}>
            <CalendarClock aria-hidden />
            {t("reschedule_menu")}
          </DropdownMenuItem>
        ) : null}
        {!live ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CalendarDays aria-hidden />
              {t("set_due_date")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60" onPointerDown={(event) => event.stopPropagation()}>
              {dueDateShortcuts(now, settings.week_starts_on).map((shortcut) => (
                <DropdownMenuItem key={shortcut.key} onSelect={() => actions.setDueDate(item, shortcut.value)}>
                  {t(`due_${shortcut.key}`)}
                  <DropdownMenuShortcut className="tracking-normal">{formatDate(shortcut.value, "EEE, MMM d")}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => actions.pickDueDate(item)}>{t("pick_date")}</DropdownMenuItem>
              {item.due_date ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => actions.setDueDate(item, null)}>{t("clear_due_date")}</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserRound aria-hidden />
            {t("assign_owner")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56" onPointerDown={(event) => event.stopPropagation()}>
            <DropdownMenuRadioGroup
              value={item.owner.trim() || NONE}
              onValueChange={(value) => actions.assignOwner(item, value === NONE ? "" : value)}
            >
              {actions.owners.map((owner) => (
                <DropdownMenuRadioItem key={owner} value={owner}>
                  <span className="truncate">{owner}</span>
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value={NONE} className="text-muted-foreground">
                {t("unassigned")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => actions.pickOwner(item)}>
              <UserRoundPlus aria-hidden />
              {t("someone_else")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {live ? (
          <DropdownMenuItem onSelect={() => uiActions.openDialog({ type: "add-metrics", itemId: item.id })}>
            <ChartColumn aria-hidden />
            {t("add_analytics")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.duplicate(item)}>
          <Copy aria-hidden />
          {t("duplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(item)}>
          <Trash aria-hidden />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
