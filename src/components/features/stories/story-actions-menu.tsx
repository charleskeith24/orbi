"use client"

import { CopyPlus, Ellipsis, Lightbulb, Link2, PanelRightOpen, Sparkles, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Story } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useStoryActions } from "./story-actions"

/** "⋯" menu for one story: open, turn into ideas, create idea, favourite, duplicate, copy link, delete. */
export function StoryActionsMenu({ story, inSheet = false, className }: { story: Story; inSheet?: boolean; className?: string }) {
  const actions = useStoryActions()
  const title = story.title.trim() || "Untitled story"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Actions for ${title}`} className={cn("text-muted-foreground", className)}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {inSheet ? null : (
          <DropdownMenuItem onSelect={() => actions.open(story.id)}>
            <PanelRightOpen aria-hidden />
            Open details
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.turnIntoIdeas(story)}>
          <Sparkles aria-hidden />
          Turn into content ideas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.createIdea(story)}>
          <Lightbulb aria-hidden />
          Create idea…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.toggleFavorite(story)}>
          <Star aria-hidden />
          {story.is_favorite ? "Remove from favourites" : "Add to favourites"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.duplicate(story)}>
          <CopyPlus aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.copyLink(story)}>
          <Link2 aria-hidden />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(story)}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
