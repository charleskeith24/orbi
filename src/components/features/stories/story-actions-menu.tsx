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
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import type { Story } from "@/lib/types"
import { cn } from "@/lib/utils"
import { storyVaultMessages } from "./messages"
import { useStoryActions } from "./story-actions"

/** "⋯" menu for one story: open, turn into ideas, create idea, favourite, duplicate, copy link, delete. */
export function StoryActionsMenu({ story, inSheet = false, className }: { story: Story; inSheet?: boolean; className?: string }) {
  const actions = useStoryActions()
  const t = useT(storyVaultMessages)
  const c = useT(commonMessages)
  const title = story.title.trim() || t("untitled")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={t("actions_for", { title })} className={cn("text-muted-foreground", className)}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {inSheet ? null : (
          <DropdownMenuItem onSelect={() => actions.open(story.id)}>
            <PanelRightOpen aria-hidden />
            {t("open_details")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.turnIntoIdeas(story)}>
          <Sparkles aria-hidden />
          {t("turn_into_ideas")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.createIdea(story)}>
          <Lightbulb aria-hidden />
          {t("create_idea_menu")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.toggleFavorite(story)}>
          <Star aria-hidden />
          {story.is_favorite ? t("remove_favourite") : t("add_favourite")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.duplicate(story)}>
          <CopyPlus aria-hidden />
          {t("duplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.copyLink(story)}>
          <Link2 aria-hidden />
          {t("copy_link")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(story)}>
          <Trash2 aria-hidden />
          {c("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
