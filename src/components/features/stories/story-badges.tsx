"use client"

import {
  BookOpen,
  Boxes,
  Briefcase,
  Compass,
  Footprints,
  GraduationCap,
  MessageSquareQuote,
  Quote,
  Star,
  TrendingDown,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import type { SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { STORY_TYPES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { Story, StoryType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { storyVaultMessages } from "./messages"
import { storyTypeLabel } from "./story-model"

export const STORY_TYPE_ICONS: Record<StoryType, LucideIcon> = {
  story: BookOpen,
  experience: Footprints,
  lesson: GraduationCap,
  quote: Quote,
  opinion: MessageSquareQuote,
  framework: Boxes,
  case_study: Briefcase,
  achievement: Trophy,
  failure: TrendingDown,
  belief: Compass,
}

export const STORY_TYPE_OPTIONS: SelectOption<StoryType>[] = STORY_TYPES.map((type) => {
  const Icon = STORY_TYPE_ICONS[type.id]
  return { value: type.id, label: type.label, icon: <Icon className="text-muted-foreground" aria-hidden /> }
})

/** Neutral story-type label with its glyph (a category, not a status). */
export function StoryTypeBadge({ type, className }: { type: StoryType; className?: string }) {
  const Icon = STORY_TYPE_ICONS[type] ?? BookOpen
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit max-w-full shrink-0 items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium whitespace-nowrap text-foreground/85 dark:bg-input/30",
        className
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{storyTypeLabel(type)}</span>
    </span>
  )
}

/** Star toggle for `is_favorite`. */
export function FavoriteToggle({ story, className }: { story: Story; className?: string }) {
  const on = story.is_favorite
  const t = useT(storyVaultMessages)
  const title = story.title.trim() || t("this_story")
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-pressed={on}
      aria-label={on ? t("unfavourite_label", { title }) : t("favourite_label", { title })}
      title={on ? t("favourite_title") : t("add_favourite")}
      onClick={() => dataActions.update("stories", story.id, { is_favorite: !on })}
      className={cn(on ? "text-foreground" : "text-muted-foreground", className)}
    >
      <Star className={cn(on && "fill-current")} aria-hidden />
    </Button>
  )
}
