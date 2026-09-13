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
import type { ContentPillar } from "@/lib/types"

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
  const name = pillar.name || "Untitled pillar"
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`} className={className}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onEdit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            Edit pillar
          </DropdownMenuItem>
        ) : null}
        {onMove ? (
          <>
            <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}>
              <ArrowUp aria-hidden />
              Move earlier
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}>
              <ArrowDown aria-hidden />
              Move later
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onSelect={onToggleActive}>
          {pillar.is_active ? <Pause aria-hidden /> : <Play aria-hidden />}
          {pillar.is_active ? "Pause pillar" : "Activate pillar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/ideas/generator?pillar=${pillar.id}`}>
            <Lightbulb aria-hidden />
            Generate ideas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/pillars/matrix?pillar=${pillar.id}`}>
            <Grid3x3 aria-hidden />
            Plan in Content Matrix
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden />
          Delete pillar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
