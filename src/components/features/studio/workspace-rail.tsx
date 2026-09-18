"use client"

import { formatDistanceStrict } from "date-fns"
import { BookOpen, Check, Cpu, GitFork, Lightbulb, Link2, Megaphone, Mic, Repeat, Sparkles } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { ColorDot, IdeaStatusBadge, SectionCard, StatusPill, Token } from "@/components/common"
import { ItemDealLink } from "@/components/features/money/item-deal-link"
import { Button } from "@/components/ui/button"
import { providerLabel } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { LANGUAGE_MAP, STORY_TYPE_MAP, TONE_MAP } from "@/lib/constants"
import { parseDate } from "@/lib/dates"
import { useBrand, useRow, useTable } from "@/lib/store"
import type { ContentItem, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { workspaceMessages } from "./messages"
import { useStudioStore } from "./studio-store"
import { relatedStories } from "./studio-utils"

const ROW_LINK =
  "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"

/** Context beside the editor: brand voice, linked records, related stories and AI activity. */
export function WorkspaceRail({
  item,
  now,
  onUseStory,
  className,
}: {
  item: ContentItem
  now: Date
  /** Pick a story for AI script generation (switches to the Script tab). */
  onUseStory?: (storyId: ID) => void
  className?: string
}) {
  const t = useT(workspaceMessages)
  return (
    <aside aria-label={t("context")} className={cn("grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-1", className)}>
      <BrandVoiceCard />
      <ConnectionsCard item={item} />
      <RelatedStoriesCard item={item} onUseStory={onUseStory} />
      <AiActivityCard item={item} now={now} />
    </aside>
  )
}

function VoiceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 text-sm text-pretty">{children}</div>
    </div>
  )
}

function BrandVoiceCard() {
  const t = useT(workspaceMessages)
  const brand = useBrand()
  const tones = brand.tones.map((t) => TONE_MAP[t]?.label ?? t)
  const hasVoice = Boolean(
    tones.length || brand.cta_style || brand.phrases_used.length || brand.phrases_avoid.length || brand.always_do || brand.never_do
  )
  return (
    <SectionCard
      title={t("brand_voice")}
      icon={Mic}
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/strategy">{t("brand_hq")}</Link>
        </Button>
      }
      contentClassName="flex flex-col gap-3"
    >
      {hasVoice ? (
        <>
          <VoiceRow label={t("language_tone")}>
            {[LANGUAGE_MAP[brand.language]?.label, tones.join(", ")].filter(Boolean).join(" · ")}
          </VoiceRow>
          {brand.cta_style ? (
            <VoiceRow label={t("cta_style")}>
              <span className="line-clamp-3">{brand.cta_style}</span>
            </VoiceRow>
          ) : null}
          {brand.phrases_used.length ? (
            <VoiceRow label={t("phrases_used")}>
              <span className="flex flex-wrap gap-1">
                {brand.phrases_used.slice(0, 6).map((phrase) => (
                  <Token key={phrase} className="h-auto min-h-5 py-0.5 whitespace-normal">
                    {phrase}
                  </Token>
                ))}
              </span>
            </VoiceRow>
          ) : null}
          {brand.phrases_avoid.length ? (
            <VoiceRow label={t("avoid")}>
              <span className="flex flex-wrap gap-1">
                {brand.phrases_avoid.slice(0, 6).map((phrase) => (
                  <Token key={phrase} className="h-auto min-h-5 py-0.5 font-normal whitespace-normal text-muted-foreground line-through decoration-muted-foreground/60">
                    {phrase}
                  </Token>
                ))}
              </span>
            </VoiceRow>
          ) : null}
          {brand.always_do ? (
            <VoiceRow label={t("always")}>
              <span className="line-clamp-2">{brand.always_do}</span>
            </VoiceRow>
          ) : null}
          {brand.never_do ? (
            <VoiceRow label={t("never")}>
              <span className="line-clamp-2">{brand.never_do}</span>
            </VoiceRow>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">
          {t("voice_empty")}
        </p>
      )}
    </SectionCard>
  )
}

function ConnectionsCard({ item }: { item: ContentItem }) {
  const t = useT(workspaceMessages)
  const idea = useRow("content_ideas", item.idea_id)
  const parent = useRow("content_items", item.parent_id)
  const campaign = useRow("content_campaigns", item.campaign_id)
  const series = useRow("content_series", item.series_id)
  const others = Boolean(parent || campaign || series)

  return (
    <SectionCard title={t("linked")} icon={Link2} contentClassName="flex flex-col gap-3">
      {idea ? (
        <Link
          href={`/ideas?open=${idea.id}`}
          className="flex min-w-0 flex-col gap-1.5 rounded-md border p-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t("idea")}</span>
            {idea.score !== null ? <span className="ml-auto shrink-0 num">{t("idea_score", { score: idea.score })}</span> : null}
          </span>
          <span className="line-clamp-2 text-sm font-medium">{idea.title || t("untitled_idea")}</span>
          {idea.why_it_matters ? <span className="line-clamp-2 text-xs text-muted-foreground">{idea.why_it_matters}</span> : null}
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <IdeaStatusBadge status={idea.status} />
            {idea.talking_points.length ? (
              <span>
                {t.plural("talking_points", idea.talking_points.length)}
                {idea.cta ? ` · ${t("cta_ready")}` : ""}
              </span>
            ) : null}
          </span>
        </Link>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">
          {t("no_idea")}
        </p>
      )}
      {others ? (
        <ul className="flex flex-col">
          {parent ? (
            <li>
              <Link href={`/studio/${parent.id}`} className={ROW_LINK}>
                <GitFork className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 text-xs text-muted-foreground">{t("source")}</span>
                <span className="min-w-0 flex-1 truncate">{parent.title || t("untitled_content")}</span>
              </Link>
            </li>
          ) : null}
          {campaign ? (
            <li>
              <Link href={`/campaigns/${campaign.id}`} className={ROW_LINK}>
                <Megaphone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 text-xs text-muted-foreground">{t("campaign")}</span>
                <ColorDot color={campaign.color} shape="square" />
                <span className="min-w-0 flex-1 truncate">{campaign.name || t("untitled_campaign")}</span>
              </Link>
            </li>
          ) : null}
          {series ? (
            <li>
              <Link href={`/series?open=${series.id}`} className={ROW_LINK}>
                <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 text-xs text-muted-foreground">{t("series")}</span>
                <span className="min-w-0 flex-1 truncate">{series.name || t("untitled_series")}</span>
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
      <ItemDealLink item={item} />
    </SectionCard>
  )
}

function RelatedStoriesCard({ item, onUseStory }: { item: ContentItem; onUseStory?: (storyId: ID) => void }) {
  const t = useT(workspaceMessages)
  const stories = useTable("stories")
  const briefs = useTable("content_briefs")
  const chosen = useStudioStore((s) => s.stories[item.id] ?? null)
  const brief = useMemo(() => briefs.find((b) => b.content_item_id === item.id), [briefs, item.id])
  const related = useMemo(() => relatedStories(stories, item, brief), [stories, item, brief])

  return (
    <SectionCard
      title={t("related_stories")}
      icon={BookOpen}
      description={t("related_stories_description")}
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/stories">{t("story_vault")}</Link>
        </Button>
      }
    >
      {related.length ? (
        <ul className="-my-1 flex flex-col divide-y">
          {related.map(({ story, matches }) => (
            <li key={story.id} className="flex min-w-0 flex-col gap-1 py-2.5">
              <Link
                href={`/stories?open=${story.id}`}
                className="line-clamp-2 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {story.title || t("untitled_story")}
              </Link>
              {story.lesson || story.result ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{story.lesson || story.result}</p>
              ) : null}
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {STORY_TYPE_MAP[story.type]?.label ?? story.type} · {matches.slice(0, 3).join(", ")}
                </span>
                {onUseStory ? (
                  chosen === story.id ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-good-fg">
                      <Check className="size-3.5" aria-hidden />
                      {t("in_script")}
                    </span>
                  ) : (
                    <Button type="button" variant="ghost" size="xs" className="-mr-2 shrink-0" onClick={() => onUseStory(story.id)}>
                      {t("use_in_script")}
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">
          {stories.length ? t("stories_no_match") : t("stories_empty")}
        </p>
      )}
    </SectionCard>
  )
}

function AiActivityCard({ item, now }: { item: ContentItem; now: Date }) {
  const t = useT(workspaceMessages)
  const generations = useTable("ai_generations")
  const rows = useMemo(
    () =>
      generations
        .filter((g) => g.entity_type === "content_items" && g.entity_id === item.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [generations, item.id]
  )

  return (
    <SectionCard title={t("ai_activity")} icon={Sparkles}>
      {rows.length ? (
        <ul className="flex flex-col gap-2.5">
          {rows.map((g) => {
            const at = parseDate(g.created_at)
            const Icon = g.provider === "offline" ? Cpu : Sparkles
            const taskKey = `task_${g.task}`
            const taskLabel = taskKey in workspaceMessages.en ? t(taskKey as keyof typeof workspaceMessages.en) : g.task.replace(/_/g, " ")
            return (
              <li key={g.id} className="flex min-w-0 items-start gap-2">
                <Icon className={cn("mt-0.5 size-3.5 shrink-0", g.provider === "offline" ? "text-muted-foreground" : "text-brand")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{taskLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {providerLabel(g.provider, g.model)}
                    {at ? ` · ${now.getTime() - at.getTime() < 60_000 ? t("just_now") : formatDistanceStrict(at, now, { addSuffix: true })}` : ""}
                  </p>
                </div>
                {g.status === "error" ? <StatusPill tone="critical">{t("failed")}</StatusPill> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">
          {t("ai_activity_empty")}
        </p>
      )}
    </SectionCard>
  )
}
