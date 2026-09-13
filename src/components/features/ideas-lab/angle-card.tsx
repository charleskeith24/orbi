"use client"

import { Sparkles } from "lucide-react"
import Link from "next/link"
import { Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatMultiple, type GroupAggregate } from "@/lib/analytics"
import type { ContentAngle, ID } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { generatorHref, type AngleStats } from "./angle-model"
import { formatHookMetric } from "./hook-model"

/** One angle: what it is, an example, how often it's used and how its posts performed. */
export function AngleCard({
  angle,
  stats,
  overall,
  onOpen,
}: {
  angle: ContentAngle
  stats: AngleStats
  overall: GroupAggregate
  onOpen: (id: ID) => void
}) {
  const performance = stats.performance && stats.performance.measured > 0 ? stats.performance : null
  const lift = performance?.avgViews && overall.avgViews ? performance.avgViews / overall.avgViews : null
  return (
    <article className="relative flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-4 text-card-foreground shadow-xs transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm has-[[data-card-link]:focus-visible]:border-ring has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm leading-snug font-medium break-words">
          <button
            type="button"
            data-card-link
            onClick={() => onOpen(angle.id)}
            className="text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
          >
            {angle.name || "Untitled angle"}
          </button>
        </h3>
        <Token className="font-normal text-muted-foreground">{angle.is_default ? "Default" : "Custom"}</Token>
      </div>
      {angle.description ? (
        <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">{angle.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No description yet — open it to add one.</p>
      )}
      {angle.example ? <p className="line-clamp-2 text-xs text-pretty text-foreground/80">e.g. “{angle.example}”</p> : null}
      <div className="mt-auto flex min-w-0 flex-col gap-2.5 border-t pt-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="num">{pluralize(stats.ideaIds.length, "idea")}</span>
          <span aria-hidden>·</span>
          <span className="num">{pluralize(stats.itemIds.length, "content piece")}</span>
          {performance ? (
            <>
              <span aria-hidden>·</span>
              <span className="num">
                <span className="font-medium text-foreground">{formatHookMetric(performance.avgViews, "views")}</span> avg views
                {lift ? ` (${formatMultiple(lift)})` : ""}
              </span>
            </>
          ) : null}
        </p>
        <Button type="button" size="xs" variant="outline" className="relative z-10 self-start" asChild>
          <Link href={generatorHref(angle.id)}>
            <Sparkles className="text-brand" aria-hidden />
            Generate ideas
          </Link>
        </Button>
      </div>
    </article>
  )
}
