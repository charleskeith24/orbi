"use client"

import { ArrowRight, CircleCheck, FileStack, Lightbulb, Plus, Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ColorDot,
  ContentThumbnail,
  EmptyState,
  PillarBadge,
  PlatformIcon,
  PlatformToggleGroup,
  SectionCard,
  StageBadge,
  TierBadge,
  ViewToggle,
  contentDateInfo,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PIPELINE_STAGE_MAP, PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { convertIdeaToContent, uiActions, useBrand, useLookup } from "@/lib/store"
import type { ContentIdea, ContentItem, ContentScript, ID, PerformanceTier, PipelineStage, PlatformId } from "@/lib/types"
import { cn, formatCompact, pluralize } from "@/lib/utils"
import { CONTINUE_STAGES, wordsIn } from "./studio-utils"

const ROW = "-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-input/20"

/** One content item as a row: thumbnail, title, platform · pillar · script status, score, stage and date. */
export function ContentRow({
  item,
  script,
  now,
  showStage = true,
}: {
  item: ContentItem
  script: ContentScript | undefined
  now: Date
  showStage?: boolean
}) {
  const date = contentDateInfo(item, now)
  const DateIcon = date?.icon
  const scriptLabel = script ? `${SCRIPT_FORMATS[script.format].label} v${script.version} · ${pluralize(wordsIn(script.sections), "word")}` : "No script yet"
  const dateNode =
    date && DateIcon ? (
      <span
        title={date.title}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 text-xs whitespace-nowrap",
          date.overdue ? "font-medium text-critical-fg" : "text-muted-foreground"
        )}
      >
        <DateIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{date.label}</span>
      </span>
    ) : null
  return (
    <Link href={`/studio/${item.id}`} className={ROW}>
      <ContentThumbnail item={item} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium sm:line-clamp-1" title={item.title}>
          {item.title.trim() || "Untitled content"}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0" />
          <PillarBadge pillarId={item.pillar_id} variant="plain" className="max-w-40 min-w-0 shrink" />
          <span className="hidden min-w-0 truncate sm:inline">{scriptLabel}</span>
          {dateNode ? <span className="flex min-w-0 shrink sm:hidden">{dateNode}</span> : null}
        </span>
      </span>
      {item.quality_score ? (
        <span className="hidden shrink-0 text-xs text-muted-foreground num md:inline" title="Content Score (quality, not virality)">
          Score <span className="font-medium text-foreground">{item.quality_score.total}</span>
        </span>
      ) : null}
      {showStage ? <StageBadge stage={item.stage} className="hidden sm:inline-flex" /> : null}
      <span className="hidden w-32 shrink-0 justify-end sm:flex">
        {dateNode ?? <span className="text-xs text-muted-foreground">No date</span>}
      </span>
    </Link>
  )
}

type ContinueFilter = "all" | PipelineStage

/** Items in Brief, Scripting, Review and Revision, soonest deadline first. */
export function ContinueCreating({
  items,
  scripts,
  now,
  onNewContent,
  className,
}: {
  items: ContentItem[]
  scripts: Map<ID, ContentScript>
  now: Date
  onNewContent: () => void
  className?: string
}) {
  const [filter, setFilter] = useState<ContinueFilter>("all")
  const [expanded, setExpanded] = useState(false)
  const counts = useMemo(() => new Map(CONTINUE_STAGES.map((stage) => [stage, items.filter((i) => i.stage === stage).length])), [items])
  const shown = filter === "all" ? items : items.filter((i) => i.stage === filter)
  const visible = expanded ? shown : shown.slice(0, 8)
  const options = [
    { value: "all" as const, label: `All ${items.length}` },
    ...CONTINUE_STAGES.filter((stage) => counts.get(stage)).map((stage) => ({
      value: stage,
      label: `${PIPELINE_STAGE_MAP[stage].label} ${counts.get(stage)}`,
    })),
  ]

  return (
    <SectionCard
      className={className}
      title="Continue creating"
      description="In brief, scripting or review — soonest deadline first."
      action={items.length ? <ViewToggle value={filter} onChange={(v) => setFilter(v)} options={options} aria-label="Filter by stage" className="hidden sm:inline-flex" /> : undefined}
    >
      {!items.length ? (
        <EmptyState
          compact
          icon={FileStack}
          title="Nothing in production right now"
          description="Start from a validated idea or a format — every piece you brief, script or review shows up here."
          action={
            <Button type="button" size="sm" onClick={onNewContent}>
              <Plus aria-hidden />
              New content
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col">
            {visible.map((item) => (
              <li key={item.id}>
                <ContentRow item={item} script={scripts.get(item.id)} now={now} />
              </li>
            ))}
          </ul>
          {shown.length > 8 ? (
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : `Show all ${shown.length}`}
            </Button>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}

/** Validated and selected ideas, best Idea Score first — one click to briefs per platform. */
export function IdeaStarts({ ideas, className }: { ideas: ContentIdea[]; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? ideas : ideas.slice(0, 6)
  return (
    <SectionCard
      className={className}
      title="Start from an idea"
      description="Validated and selected ideas, best Idea Score first."
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/ideas">Idea Bank</Link>
        </Button>
      }
    >
      {!ideas.length ? (
        <EmptyState
          compact
          icon={Lightbulb}
          title="No ideas ready yet"
          description="Validate ideas in the Idea Bank — the strongest ones wait here to become content."
          action={
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/ideas">Open Idea Bank</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="-my-1 flex flex-col divide-y">
            {visible.map((idea) => (
              <IdeaStartRow key={idea.id} idea={idea} />
            ))}
          </ul>
          {ideas.length > 6 ? (
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : `Show all ${ideas.length}`}
            </Button>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}

function IdeaStartRow({ idea }: { idea: ContentIdea }) {
  const router = useRouter()
  const brand = useBrand()
  const pillars = useLookup("content_pillars")
  const pillar = idea.pillar_id ? pillars.get(idea.pillar_id) : undefined
  const [open, setOpen] = useState(false)
  const [platforms, setPlatforms] = useState<PlatformId[]>(() => (idea.platforms.length ? idea.platforms : [brand.main_platforms[0] ?? "facebook"]))

  function start() {
    if (!platforms.length) return
    const created = convertIdeaToContent(idea.id, { platforms, stage: "brief" })
    const first = created[0]
    if (!first) return
    setOpen(false)
    toast.success(created.length > 1 ? `Created ${created.length} content items` : "Content created", {
      description: created.length > 1 ? `One per platform — opening the ${PLATFORMS[first.platform].label} brief.` : "Opening the brief — it's prefilled from the idea.",
    })
    router.push(`/studio/${first.id}?tab=brief`)
  }

  return (
    <li className="flex min-w-0 items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Link
          href={`/ideas?open=${idea.id}`}
          className="line-clamp-2 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {idea.title || "Untitled idea"}
        </Link>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {pillar ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ColorDot color={pillar.color} />
              <span className="truncate">{pillar.name}</span>
            </span>
          ) : null}
          {idea.score !== null ? <span className="num">Idea Score {idea.score}</span> : null}
          <span className="inline-flex items-center gap-1">
            {idea.platforms.slice(0, 4).map((p) => (
              <PlatformIcon key={p} platform={p} label className="size-3.5" />
            ))}
          </span>
        </p>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="xs" className="shrink-0">
            Start
            <ArrowRight aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-3">
          <div>
            <p className="text-sm font-medium">Create content from this idea</p>
            <p className="text-xs text-pretty text-muted-foreground">One piece per platform, each with a brief prefilled from the idea.</p>
          </div>
          <PlatformToggleGroup value={platforms} onChange={setPlatforms} aria-label="Platforms" />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!platforms.length} onClick={start}>
              {platforms.length > 1 ? `Create ${platforms.length} pieces` : "Create & open"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </li>
  )
}

export interface PublishedEntry {
  item: ContentItem
  views: number | null
  tier: PerformanceTier
  publishedAt: Date
}

/** The latest published pieces with views and tier — straight into their Performance tab. */
export function RecentlyPublished({ entries, className }: { entries: PublishedEntry[]; className?: string }) {
  return (
    <SectionCard
      className={className}
      title="Recently published"
      description="Log the numbers, then repurpose what works."
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/analytics/posts">Post Performance</Link>
        </Button>
      }
    >
      {!entries.length ? (
        <EmptyState
          compact
          icon={Send}
          title="Nothing published yet"
          description="Published pieces land here with their views and tier, ready to log analytics or repurpose."
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <CircleCheck aria-hidden />
              Log a published post
            </Button>
          }
        />
      ) : (
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(({ item, views, tier, publishedAt }) => (
            <li key={item.id}>
              <Link
                href={`/studio/${item.id}?tab=performance`}
                className="flex min-w-0 items-start gap-3 rounded-lg border p-3 outline-none transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-input/20"
              >
                <ContentThumbnail item={item} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium">{item.title.trim() || "Untitled content"}</span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <PlatformIcon platform={item.platform} label className="size-3.5" />
                    <span>{formatDate(publishedAt, "MMM d")}</span>
                    <span className="num">{views === null ? "No analytics yet" : `${formatCompact(views)} views`}</span>
                    <TierBadge tier={tier} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
