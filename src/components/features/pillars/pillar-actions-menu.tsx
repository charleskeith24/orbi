"use client"

import { ArrowDown, ArrowUp, Ellipsis, Grid3x3, Lightbulb, Pause, Pencil, Play, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n"
import type { ContentPillar } from "@/lib/types"
import { pillarMessages } from "./pillar-messages"

/** Pillar overflow menu: edit, reorder, pause/activate, cross-links and delete. */
export function PillarActionsMenu({
  pillar,
  onEdit,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  onToggleActive,
  onDelete,
  className,
}: {
  pillar: ContentPillar
  /** Omit to hide "Edit" (e.g. when an edit button sits next to the menu). */
  onEdit?: () => void
  /** Omit to hide the reorder items. */
  onMove?: (direction: -1 | 1) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onToggleActive: () => void
  onDelete: () => void
  className?: string
}) {
  const t = useT(pillarMessages)
  const name = pillar.name || t("untitled_pillar")
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions_for", { name })} className={className}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onEdit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            {t("edit_pillar")}
          </DropdownMenuItem>
        ) : null}
        {onMove ? (
          <>
            <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}>
              <ArrowUp aria-hidden />
              {t("move_earlier")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}>
              <ArrowDown aria-hidden />
              {t("move_later")}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onSelect={onToggleActive}>
          {pillar.is_active ? <Pause aria-hidden /> : <Play aria-hidden />}
          {pillar.is_active ? t("pause_pillar") : t("activate_pillar")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/ideas/generator?pillar=${pillar.id}`}>
            <Lightbulb aria-hidden />
            {t("generate_ideas")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/pillars/matrix?pillar=${pillar.id}`}>
            <Grid3x3 aria-hidden />
            {t("plan_in_matrix_menu")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden />
          {t("delete_pillar")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
