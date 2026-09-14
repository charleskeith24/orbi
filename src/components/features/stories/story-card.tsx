"use client"

import { PillarBadge, Token } from "@/components/common"
import { formatDate } from "@/lib/dates"
import type { ContentPillar, Story } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { useStoryActions } from "./story-actions"
import { StoryActionsMenu } from "./story-actions-menu"
import { FavoriteToggle, StoryTypeBadge } from "./story-badges"
import { storyDay, type SourceUsage } from "./story-model"

/** Grid card: type, favourite, title, lesson preview, keywords, pillar, date and usage. The whole card opens the story. */
export function StoryCard({ story, usage, pillar }: { story: Story; usage?: SourceUsage; pillar?: ContentPillar }) {
  const actions = useStoryActions()
  const ideas = usage?.ideas.length ?? 0
  const title = story.title.trim() || "Untitled story"
  const keywords = story.keywords.slice(0, 3)
  const more = story.keywords.length - keywords.length

  return (
    <article className="relative flex min-w-0 flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-xs transition-colors hover:border-foreground/20 has-[button:focus-visible]:border-ring">
      <div className="flex items-center gap-2">
        <StoryTypeBadge type={story.type} />
        <div className="relative z-10 -my-1 -mr-1.5 ml-auto flex items-center">
          <FavoriteToggle story={story} />
          <StoryActionsMenu story={story} />
        </div>
      </div>
      <h3 className="mt-2 text-sm leading-snug font-medium text-pretty break-words">
        {/* Stretched button: the whole card is the click target; the controls above sit on top of it. */}
        <button
          type="button"
          onClick={() => actions.open(story.id)}
          className="text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
        >
          {title}
        </button>
      </h3>
      {story.lesson.trim() ? (
        <p className="mt-1.5 line-clamp-3 text-sm text-pretty text-muted-foreground">{story.lesson}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground/80 italic">No lesson written yet</p>
      )}
      {keywords.length ? (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1">
          {keywords.map((keyword) => (
            <Token key={keyword} className="max-w-36 font-normal text-muted-foreground">
              <span className="truncate">{keyword}</span>
            </Token>
          ))}
          {more > 0 ? <span className="px-0.5 text-xs text-muted-foreground num">+{more}</span> : null}
        </div>
      ) : null}
      <div className="mt-auto flex min-w-0 items-center gap-2 pt-3 text-xs text-muted-foreground">
        <PillarBadge pillar={pillar ?? null} variant="plain" className="min-w-0" />
        <span className="ml-auto shrink-0 num">{formatDate(storyDay(story), "MMM yyyy")}</span>
        <span aria-hidden>·</span>
        <span className={cn("shrink-0 num", ideas > 0 && "text-foreground/80")}>{ideas ? pluralize(ideas, "idea") : "Not used yet"}</span>
      </div>
    </article>
  )
}
