"use client"

import { memo } from "react"
import { FormatLabel, FunnelBadge, PillarBadge, PriorityBadge } from "@/components/common"
import { useT } from "@/lib/i18n"
import type { ContentFormat, ContentIdea, ContentPillar, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CapturedDate, IdeaScoreBadge, IdeaStatusChip, PlatformIcons } from "./idea-badges"
import { ideaBankMessages } from "./messages"

export interface IdeaCardProps {
  idea: ContentIdea
  pillar?: ContentPillar
  format?: ContentFormat
  now: Date
  showStatus?: boolean
  /** Makes the whole card open the detail sheet (stretched button, inner controls stay clickable). */
  onOpen?: (id: ID) => void
  /** Top-right slots (drag handle, "⋯" menu) rendered above the click target. */
  dragHandle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

const STRETCHED = "outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none"

/** Dense idea summary for the card grid and Kanban columns (~272px). */
export const IdeaCard = memo(function IdeaCard({
  idea,
  pillar,
  format,
  now,
  showStatus = false,
  onOpen,
  dragHandle,
  actions,
  className,
}: IdeaCardProps) {
  const t = useT(ideaBankMessages)
  const title = idea.title.trim() || t("untitled_idea")
  return (
    <article
      className={cn(
        "group/idea relative flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-[border-color,box-shadow]",
        onOpen && "hover:border-foreground/20 hover:shadow-sm",
        "has-[[data-card-link]:focus-visible]:border-ring has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50",
        idea.status === "archived" && "bg-muted/30 dark:bg-muted/20",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <h3 className="min-w-0 flex-1 text-sm leading-snug font-medium break-words" title={title.length > 80 ? title : undefined}>
          {onOpen ? (
            <button type="button" data-card-link onClick={() => onOpen(idea.id)} className={cn(STRETCHED, "block w-full text-left")}>
              <span className="line-clamp-2">{title}</span>
            </button>
          ) : (
            <span className="line-clamp-2">{title}</span>
          )}
        </h3>
        {dragHandle || actions ? (
          <div className="relative z-10 -mt-1 -mr-1.5 flex shrink-0 items-center">
            {dragHandle}
            {actions}
          </div>
        ) : null}
      </div>

      {idea.hook ? <p className="line-clamp-2 text-xs text-pretty text-muted-foreground">“{idea.hook}”</p> : null}

      {pillar || idea.funnel_stage || idea.priority === "high" || showStatus ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {showStatus ? <IdeaStatusChip status={idea.status} /> : null}
          {pillar ? <PillarBadge pillar={pillar} className="max-w-full" /> : null}
          <FunnelBadge stage={idea.funnel_stage} />
          {idea.priority === "high" ? <PriorityBadge priority="high" /> : null}
        </div>
      ) : null}

      <div className="mt-auto flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {idea.platforms.length ? <PlatformIcons platforms={idea.platforms} /> : null}
        {format ? <FormatLabel format={format} showIcon={false} className="min-w-0 shrink" /> : null}
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <IdeaScoreBadge score={idea.score} />
          <CapturedDate value={idea.created_at} now={now} />
        </span>
      </div>
    </article>
  )
})
