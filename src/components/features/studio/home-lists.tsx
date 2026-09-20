"use client"

import { ArrowRight, CircleCheck, FileStack, Gauge, Lightbulb, Plus, Send } from "lucide-react"
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
import { useT, useUiLang } from "@/lib/i18n"
import { PIPELINE_STAGE_MAP, PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { convertIdeaToContent, uiActions, useBrand, useLookup } from "@/lib/store"
import type { ContentIdea, ContentItem, ContentScript, ID, PerformanceTier, PipelineStage, PlatformId } from "@/lib/types"
import { cn, formatCompact, formatNumber } from "@/lib/utils"
import { studioHomeMessages } from "./messages"
import { CONTINUE_STAGES, wordsIn } from "./studio-utils"

const ROW = "-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-input/20"

/** One content item as a row: thumbnail, title (script status in its tooltip), platform · pillar, score, stage and date. */
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
  const t = useT(studioHomeMessages)
  const lang = useUiLang()
  const date = contentDateInfo(item, now, lang)
  const DateIcon = date?.icon
  const words = script ? wordsIn(script.sections) : 0
  // Script format, version and length are the title's tooltip (the thumbnail shows the format).
  const scriptLabel = script
    ? `${SCRIPT_FORMATS[script.format].label} v${script.version} · ${t.plural("words", words, { count: formatNumber(words) })}`
    : t("no_script")
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
        <span className="line-clamp-2 text-sm font-medium sm:line-clamp-1" title={`${item.title} — ${scriptLabel}`}>
          {item.title.trim() || t("untitled_content")}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0" />
          <PillarBadge pillarId={item.pillar_id} variant="plain" className="max-w-40 min-w-0 shrink" />
          {dateNode ? <span className="flex min-w-0 shrink sm:hidden">{dateNode}</span> : null}
        </span>
      </span>
      {item.quality_score ? (
        <span
          className="hidden shrink-0 items-center gap-1 text-xs font-medium num md:inline-flex"
          title={t("score_title")}
          aria-label={`${t("score_title")}: ${item.quality_score.total}`}
        >
          <Gauge className="size-3.5 text-muted-foreground" aria-hidden />
          {item.quality_score.total}
        </span>
      ) : null}
      {showStage ? <StageBadge stage={item.stage} className="hidden sm:inline-flex" /> : null}
      <span className="hidden w-32 shrink-0 justify-end sm:flex">
        {dateNode ?? <span className="text-xs text-muted-foreground">{t("no_date")}</span>}
      </span>
    </Link>
  )
}

type ContinueFilter = "all" | PipelineStage

/** Rows before "Show all" (Calm UI: the soonest few, the rest one click away). */
const INITIAL_ROWS = 6
const INITIAL_IDEAS = 4

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
  const t = useT(studioHomeMessages)
  const [filter, setFilter] = useState<ContinueFilter>("all")
  const [expanded, setExpanded] = useState(false)
  const counts = useMemo(() => new Map(CONTINUE_STAGES.map((stage) => [stage, items.filter((i) => i.stage === stage).length])), [items])
  const shown = filter === "all" ? items : items.filter((i) => i.stage === filter)
  const visible = expanded ? shown : shown.slice(0, INITIAL_ROWS)
  const options = [
    { value: "all" as const, label: t("all") },
    ...CONTINUE_STAGES.filter((stage) => counts.get(stage)).map((stage) => ({
      value: stage,
      label: `${PIPELINE_STAGE_MAP[stage].label} ${counts.get(stage)}`,
    })),
  ]

  return (
    <SectionCard
      className={className}
      title={t("continue_title")}
      count={items.length || null}
      info={t("continue_info")}
      action={
        items.length ? (
          <ViewToggle value={filter} onChange={(v) => setFilter(v)} options={options} aria-label={t("filter_by_stage")} className="hidden sm:inline-flex" />
        ) : undefined
      }
    >
      {!items.length ? (
        <EmptyState
          compact
          icon={FileStack}
          title={t("continue_empty_title")}
          description={t("continue_empty_description")}
          action={
            <Button type="button" size="sm" onClick={onNewContent}>
              <Plus aria-hidden />
              {t("new_content")}
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
          {shown.length > INITIAL_ROWS ? (
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? t("show_less") : t("show_all", { count: shown.length })}
            </Button>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}

/** Validated and selected ideas, best Idea Score first — one click to briefs per platform. */
export function IdeaStarts({ ideas, className }: { ideas: ContentIdea[]; className?: string }) {
  const t = useT(studioHomeMessages)
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? ideas : ideas.slice(0, INITIAL_IDEAS)
  return (
    <SectionCard
      className={className}
      title={t("ideas_title")}
      count={ideas.length || null}
      info={t("ideas_info")}
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/ideas">{t("idea_bank")}</Link>
        </Button>
      }
    >
      {!ideas.length ? (
        <EmptyState
          compact
          icon={Lightbulb}
          title={t("ideas_empty_title")}
          description={t("ideas_empty_description")}
          action={
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/ideas">{t("open_idea_bank")}</Link>
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
          {ideas.length > INITIAL_IDEAS ? (
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? t("show_less") : t("show_all", { count: ideas.length })}
            </Button>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}

function IdeaStartRow({ idea }: { idea: ContentIdea }) {
  const t = useT(studioHomeMessages)
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
    toast.success(created.length > 1 ? t("created_many", { count: created.length }) : t("content_created"), {
      description:
        created.length > 1 ? t("created_many_description", { platform: PLATFORMS[first.platform].label }) : t("created_one_description"),
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
          {idea.title || t("untitled_idea")}
        </Link>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {pillar ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ColorDot color={pillar.color} />
              <span className="truncate">{pillar.name}</span>
            </span>
          ) : null}
          {idea.score !== null ? (
            <span className="inline-flex items-center gap-1 num" title={t("idea_score", { score: idea.score })}>
              <Gauge className="size-3.5" aria-hidden />
              <span className="sr-only">{t("idea_score", { score: idea.score })}</span>
              <span aria-hidden>{idea.score}</span>
            </span>
          ) : null}
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
            {t("start")}
            <ArrowRight aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-3">
          <div>
            <p className="text-sm font-medium">{t("from_idea_title")}</p>
            <p className="text-xs text-pretty text-muted-foreground">{t("from_idea_description")}</p>
          </div>
          <PlatformToggleGroup value={platforms} onChange={setPlatforms} aria-label={t("platforms")} />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" size="sm" disabled={!platforms.length} onClick={start}>
              {platforms.length > 1 ? t("create_pieces", { count: platforms.length }) : t("create_open")}
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
  const t = useT(studioHomeMessages)
  return (
    <SectionCard
      className={className}
      title={t("published_title")}
      info={t("published_info")}
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/analytics/posts">{t("post_performance")}</Link>
        </Button>
      }
    >
      {!entries.length ? (
        <EmptyState
          compact
          icon={Send}
          title={t("published_empty_title")}
          description={t("published_empty_description")}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
              <CircleCheck aria-hidden />
              {t("log_post")}
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
                  <span className="line-clamp-2 text-sm font-medium">{item.title.trim() || t("untitled_content")}</span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <PlatformIcon platform={item.platform} label className="size-3.5" />
                    <span>{formatDate(publishedAt, "MMM d")}</span>
                    <span className="num">{views === null ? t("no_analytics") : t("views", { count: formatCompact(views) })}</span>
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
