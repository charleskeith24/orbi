"use client"

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core"
import { ArrowRight, BellRing, Ellipsis, FilePlus2, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { COLLAB_STATUS_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { collabStatusMessages } from "@/lib/i18n/messages/collabs"
import type { Collab, CollabStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { deleteCollab, markFollowedUp, setCollabStatus } from "./collab-actions"
import { openNewContentForCollab } from "./collab-content"
import { awaitsFollowUp } from "./collab-model"
import { CollabStatusIcon, useCollabName } from "./collab-ui"
import { collabsMessages } from "./messages"

export interface CollabDragHandle {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  isDragging: boolean
}

/**
 * "⋯" menu for a collab: edit, move to a status, followed up, create content, delete (confirmed). On the
 * board it doubles as the drag handle: press-and-drag moves the card, Space picks it up for a keyboard
 * move, a click or Enter opens the menu.
 */
export function CollabActionsMenu({
  collab,
  onEdit,
  onBeforeDelete,
  drag,
  className,
}: {
  collab: Collab
  onEdit: (collab: Collab) => void
  onBeforeDelete?: () => void
  drag?: CollabDragHandle
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const t = useT(collabsMessages)
  const c = useT(commonMessages)
  const statusLabel = useT(collabStatusMessages)
  const name = useCollabName()
  const [confirm, confirmDialog] = useConfirm()
  const title = name(collab)

  async function handleDelete() {
    const ok = await confirm({
      title: t("delete_title", { title }),
      description: t("delete_description"),
      confirmLabel: t("delete_confirm"),
      cancelLabel: c("cancel"),
    })
    if (!ok) return
    onBeforeDelete?.()
    deleteCollab(collab)
  }

  const dragHandlers = drag
    ? {
        onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
          drag.listeners?.onPointerDown?.(event)
          // Radix opens menus on pointer down; this one opens on click so a press can become a drag.
          event.preventDefault()
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
          if (drag.isDragging) {
            event.preventDefault()
            return
          }
          if (event.code === "Space") {
            drag.listeners?.onKeyDown?.(event)
            event.preventDefault()
          }
        },
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          if (event.detail > 0) setOpen(true)
        },
      }
    : {}

  return (
    <>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={drag?.setActivatorNodeRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            {...drag?.attributes}
            {...dragHandlers}
            aria-label={t("actions_for", { title })}
            className={cn("text-muted-foreground", drag && "cursor-grab touch-none", className)}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onPointerDown={(event) => event.stopPropagation()}>
          <DropdownMenuItem onSelect={() => onEdit(collab)}>
            <Pencil aria-hidden />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRight aria-hidden />
              {t("move_to")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48" onPointerDown={(event) => event.stopPropagation()}>
              <DropdownMenuRadioGroup value={collab.status} onValueChange={(next) => setCollabStatus(collab, next as CollabStatus, { announce: true })}>
                {COLLAB_STATUS_IDS.map((status) => (
                  <DropdownMenuRadioItem key={status} value={status}>
                    <CollabStatusIcon status={status} />
                    {statusLabel(status)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {awaitsFollowUp(collab.status) ? (
            <DropdownMenuItem onSelect={() => markFollowedUp(collab)}>
              <BellRing aria-hidden />
              {t("followed_up")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => openNewContentForCollab(collab)}>
            <FilePlus2 aria-hidden />
            {t("create_content")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void handleDelete()}>
            <Trash2 aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
