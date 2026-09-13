import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { StageIcon } from "@/components/common"
import type { PipelineCounts } from "@/lib/analytics"
import type { PipelineStage, StageGroup } from "@/lib/types"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import { CardLink } from "./card-link"

/** A board stage that stands for each roll-up group (drives the progress glyph). */
const GROUP_STAGE: Record<StageGroup, PipelineStage> = {
  idea: "idea",
  brief: "brief",
  script: "scripting",
  production: "recording",
  review: "review",
  ready: "ready_to_post",
  scheduled: "scheduled",
  published: "published",
}

/** IDEA → … → PUBLISHED counts; every stage opens the Pipeline. */
export function PipelineStrip({ pipeline, className }: { pipeline: PipelineCounts; className?: string }) {
  const last = pipeline.groupList.length - 1
  return (
    <section
      aria-labelledby="dashboard-pipeline"
      className={cn("flex min-w-0 flex-col rounded-lg border bg-card @5xl:flex-row @5xl:items-stretch", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 @5xl:w-48 @5xl:shrink-0 @5xl:flex-col @5xl:flex-nowrap @5xl:items-start @5xl:justify-center @5xl:gap-0.5 @5xl:border-r @5xl:py-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 @5xl:flex-col @5xl:gap-0.5">
          <h2 id="dashboard-pipeline" className="text-sm font-medium">
            Content Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">
            {pluralize(pipeline.inProgress, "item")} in progress<span className="@5xl:hidden"> · </span>
            <Link href="/ideas" title="Open the Idea Bank" className="underline-offset-2 hover:text-foreground hover:underline @5xl:block">
              {pluralize(pipeline.openIdeas, "open idea")}
              <span className="@5xl:hidden"> in the Idea Bank</span>
            </Link>
          </p>
        </div>
        <CardLink href="/pipeline" className="-mr-2 @5xl:hidden">
          Open Pipeline
        </CardLink>
      </div>
      <ol className="grid grid-cols-4 gap-1 p-2 @3xl:grid-cols-8 @5xl:min-w-0 @5xl:flex-1">
        {pipeline.groupList.map((group, i) => {
          const published = group.id === "published"
          return (
            <li key={group.id} className="relative min-w-0">
              <Link
                href="/pipeline"
                aria-label={`${group.label}: ${pluralize(group.count, "item")}${published ? ` in the last ${pipeline.publishedWindowDays} days` : ""} — open the Pipeline`}
                className="flex min-w-0 flex-col gap-1 rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 @md:px-2.5"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <StageIcon stage={GROUP_STAGE[group.id]} className="hidden @lg:block" />
                  <span className="truncate">{group.label}</span>
                </span>
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className={cn("text-xl leading-7 font-semibold tracking-tight num", group.count === 0 && "text-muted-foreground")}>
                    {formatNumber(group.count)}
                  </span>
                  {published ? (
                    <span className="truncate text-[11px] text-muted-foreground">{pipeline.publishedWindowDays}d</span>
                  ) : null}
                </span>
              </Link>
              {i < last ? (
                <ChevronRight
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 -right-2.5 hidden size-3.5 -translate-y-1/2 text-muted-foreground/50 @3xl:block"
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
