"use client"

import { Copy, Ellipsis, Link2, PanelRightOpen, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AudiencePersona } from "@/lib/types"
import { cn } from "@/lib/utils"
import { personaName, type PersonaActions } from "./persona-actions"

/** "⋯" menu for one persona: open, set primary, duplicate, copy link, delete. */
export function PersonaActionsMenu({
  persona,
  actions,
  onOpen,
  className,
}: {
  persona: AudiencePersona
  actions: PersonaActions
  /** Adds "Open profile" (omit inside the profile sheet). */
  onOpen?: () => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for ${personaName(persona)}`}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onOpen ? (
          <DropdownMenuItem onSelect={onOpen}>
            <PanelRightOpen aria-hidden />
            Open profile
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={persona.is_primary} onSelect={() => actions.setPrimary(persona)}>
          <Star aria-hidden />
          {persona.is_primary ? "Primary persona" : "Set as primary"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.duplicate(persona)}>
          <Copy aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.copyLink(persona)}>
          <Link2 aria-hidden />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(persona)}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
