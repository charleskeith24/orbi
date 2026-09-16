"use client"

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core"
import { ArrowRight, BadgeCheck, Ellipsis, Pencil, Receipt, Trash2 } from "lucide-react"
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
import { DEAL_STATUS_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dealStatusMessages } from "@/lib/i18n/messages/money"
import { uiActions } from "@/lib/store"
import type { BrandDeal, DealStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { dealsMessages } from "./deals-messages"
import { moneyMessages } from "./messages"
import { deleteDeal, markDealPaid, setDealStatus } from "./money-actions"
import { DealStatusIcon } from "./money-ui"

export interface DealDragHandle {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  isDragging: boolean
}

/**
 * "⋯" menu for a deal: edit, move to a status, mark paid, log payment, delete (confirmed). On the board it
 * doubles as the drag handle: press-and-drag moves the card (touch too), Space picks it up for a keyboard
 * move, a click or Enter opens the menu.
 */
export function DealActionsMenu({
  deal,
  onEdit,
  onBeforeDelete,
  drag,
  className,
}: {
  deal: BrandDeal
  onEdit: (deal: BrandDeal) => void
  onBeforeDelete?: () => void
  drag?: DealDragHandle
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const t = useT(dealsMessages)
  const m = useT(moneyMessages)
  const c = useT(commonMessages)
  const statusLabel = useT(dealStatusMessages)
  const [confirm, confirmDialog] = useConfirm()
  const brand = deal.brand_name || t("untitled")

  async function handleDelete() {
    const ok = await confirm({
      title: t("delete_title", { brand }),
      description: t("delete_description"),
      confirmLabel: t("delete_confirm"),
      cancelLabel: c("cancel"),
    })
    if (!ok) return
    onBeforeDelete?.()
    deleteDeal(deal)
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
          // Keyboard activations (detail 0) are handled by Radix (Enter) or the drag (Space).
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
            aria-label={m("actions_for", { name: brand })}
            className={cn("text-muted-foreground", drag && "cursor-grab touch-none", className)}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          // Menu events bubble through the React tree to the card; keep them from starting a drag.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem onSelect={() => onEdit(deal)}>
            <Pencil aria-hidden />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRight aria-hidden />
              {t("move_to")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48" onPointerDown={(event) => event.stopPropagation()}>
              <DropdownMenuRadioGroup value={deal.status} onValueChange={(next) => setDealStatus(deal, next as DealStatus, { announce: true })}>
                {DEAL_STATUS_IDS.map((status) => (
                  <DropdownMenuRadioItem key={status} value={status}>
                    <DealStatusIcon status={status} />
                    {statusLabel(status)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {deal.status !== "paid" && deal.status !== "lost" ? (
            <DropdownMenuItem onSelect={() => markDealPaid(deal.id)}>
              <BadgeCheck aria-hidden />
              {t("mark_paid")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => uiActions.openDialog({ type: "log-income", dealId: deal.id })}>
            <Receipt aria-hidden />
            {t("log_payment")}
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
