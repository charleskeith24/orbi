"use client"

import { Lightbulb } from "lucide-react"
import Link from "next/link"
import { SectionHeader } from "@/components/common"
import { StageRail } from "@/components/features/pipeline/pipeline-summary"
import type { PipelineCounts } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import { CardLink } from "./card-link"
import { dashboardMessages } from "./messages"

/**
 * Home's pipeline row (desktop): the open ideas in the Idea Bank, then Idea → … → Published as numbers — the
 * Pipeline page's own stage rail. Every stage opens the Pipeline at that column (`?stage=`). Phones and tablets
 * keep Home to one screen; there the same counts are under "More on your week".
 */
export function PipelineRail({ pipeline, className }: { pipeline: PipelineCounts; className?: string }) {
  const t = useT(dashboardMessages)
  return (
    <section aria-labelledby="home-pipeline" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <SectionHeader
        id="home-pipeline"
        title={t("pipeline_title")}
        count={pipeline.inProgress}
        action={<CardLink href="/pipeline">Pipeline</CardLink>}
      />
      <div className="-mx-1.5 flex min-w-0 items-center gap-1">
        <Link
          href="/ideas"
          title={t("open_idea_bank")}
          aria-label={`Idea Bank ${formatNumber(pipeline.openIdeas)}`}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Lightbulb className="size-3.5" aria-hidden />
          <span>Idea Bank</span>
          <span className={cn("font-medium num", pipeline.openIdeas ? "text-foreground" : "text-muted-foreground")}>
            {formatNumber(pipeline.openIdeas)}
          </span>
        </Link>
        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
        <StageRail counts={pipeline} hrefFor={(stage) => `/pipeline?stage=${stage}`} className="mx-0" />
      </div>
    </section>
  )
}
