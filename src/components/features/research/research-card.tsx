"use client"

import { PillarBadge, PlatformIcon, Token } from "@/components/common"
import type { SourceUsage } from "@/components/features/stories/story-model"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { ContentPillar, ResearchItem } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { useResearchActions } from "./research-actions"
import { ResearchActionsMenu } from "./research-actions-menu"
import { ResearchStatusBadge, ResearchTypeBadge } from "./research-badges"

/** Card view: type, status, title, byline, why it caught attention, the analysed angle, pillar and usage. */
export function ResearchCard({ item, usage, pillar }: { item: ResearchItem; usage?: SourceUsage; pillar?: ContentPillar }) {
  const actions = useResearchActions()
  const ideas = usage?.ideas.length ?? 0
  const byline = [item.creator, item.platform ? PLATFORMS[item.platform].label : item.source].filter(Boolean).join(" · ")
  const preview = item.why_attention || item.learnings || item.hook

  return (
    <article className="relative flex min-w-0 flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-xs transition-colors hover:border-foreground/20 has-[button:focus-visible]:border-ring">
      <div className="flex min-w-0 items-center gap-1.5">
        <ResearchTypeBadge type={item.type} />
        <ResearchStatusBadge status={item.status} />
        <div className="relative z-10 -my-1 -mr-1.5 ml-auto">
          <ResearchActionsMenu item={item} />
        </div>
      </div>
      <h3 className="mt-2 text-sm leading-snug font-medium text-pretty break-words">
        {/* Stretched button: the whole card opens the reference; the menu sits on top of it. */}
        <button
          type="button"
          onClick={() => actions.open(item.id)}
          className="text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
        >
          {item.title || "Untitled reference"}
        </button>
      </h3>
      {byline ? (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {item.platform ? <PlatformIcon platform={item.platform} className="size-3.5" /> : null}
          <span className="truncate">{byline}</span>
        </p>
      ) : null}
      {preview ? <p className="mt-2 line-clamp-3 text-sm text-pretty text-muted-foreground">{preview}</p> : null}
      {item.analysis?.angle ? (
        <div className="mt-3">
          <Token className="max-w-full font-normal text-muted-foreground">
            <span className="truncate">Angle · {item.analysis.angle}</span>
          </Token>
        </div>
      ) : null}
      <div className="mt-auto flex min-w-0 items-center gap-2 pt-3 text-xs text-muted-foreground">
        <PillarBadge pillar={pillar ?? null} variant="plain" className="min-w-0" />
        <span className="ml-auto shrink-0 num">{formatDate(item.created_at, "MMM d")}</span>
        <span aria-hidden>·</span>
        <span className={cn("shrink-0 num", ideas > 0 && "text-foreground/80")}>{ideas ? pluralize(ideas, "idea") : "No ideas yet"}</span>
      </div>
    </article>
  )
}
