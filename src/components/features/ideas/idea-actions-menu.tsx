"use client"

import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Copy,
  Ellipsis,
  ExternalLink,
  FilePlus2,
  Link2,
  PanelRightOpen,
  Signal,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { IDEA_STATUS_ICONS, PriorityIcon } from "@/components/common"
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
import { IDEA_STATUSES, PRIORITIES } from "@/lib/constants"
import type { ContentIdea, IdeaStatus, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useIdeaActions } from "./idea-actions"

async function copyIdeaLink(id: string) {
  const url = `${window.location.origin}/ideas?open=${id}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copied", { description: url })
  } catch {
    toast.error("Couldn't copy the link", { description: url })
  }
}

/** "⋯" menu for one idea: open, convert, move, priority, duplicate, archive/restore, delete. */
export function IdeaActionsMenu({
  idea,
  showOpen = true,
  className,
}: {
  idea: ContentIdea
  /** Hide "Open details" when the menu already lives in the detail sheet. */
  showOpen?: boolean
  className?: string
}) {
  const actions = useIdeaActions()
  const title = idea.title.trim() || "Untitled idea"
  const hasContent = Boolean(idea.converted_item_id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for ${title}`}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        // Menu events bubble through the React tree to draggable cards; keep them from starting a drag.
        onPointerDown={(event) => event.stopPropagation()}
      >
        {showOpen ? (
          <DropdownMenuItem onSelect={() => actions.open(idea.id)}>
            <PanelRightOpen aria-hidden />
            Open details
          </DropdownMenuItem>
        ) : null}
        {hasContent ? (
          <DropdownMenuItem asChild>
            <Link href={`/studio/${idea.converted_item_id}`}>
              <ExternalLink aria-hidden />
              Open in Content Studio
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => actions.convert(idea.id)}>
          <FilePlus2 aria-hidden />
          {hasContent ? "Create more content…" : "Convert to content…"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft aria-hidden />
            Move to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuRadioGroup value={idea.status} onValueChange={(next) => actions.setStatus([idea.id], next as IdeaStatus)}>
              {IDEA_STATUSES.map((status) => {
                const Icon = IDEA_STATUS_ICONS[status.id]
                return (
                  <DropdownMenuRadioItem key={status.id} value={status.id}>
                    <Icon className="text-muted-foreground" aria-hidden />
                    {status.id === "converted" && !hasContent ? "Converted to Content…" : status.label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Signal aria-hidden />
            Priority
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuRadioGroup value={idea.priority} onValueChange={(next) => actions.setPriority([idea.id], next as Priority)}>
              {PRIORITIES.map((priority) => (
                <DropdownMenuRadioItem key={priority.id} value={priority.id}>
                  <PriorityIcon priority={priority.id} className="text-muted-foreground" />
                  {priority.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => actions.duplicate(idea.id)}>
          <Copy aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyIdeaLink(idea.id)}>
          <Link2 aria-hidden />
          Copy link
        </DropdownMenuItem>
        {idea.status === "archived" ? (
          <DropdownMenuItem onSelect={() => actions.restore([idea.id])}>
            <ArchiveRestore aria-hidden />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.archive([idea.id])}>
            <Archive aria-hidden />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove([idea.id])}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
