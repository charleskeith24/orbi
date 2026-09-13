"use client"

import { ArrowUpRight, FilePlus2, MessageCircleQuestion } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { CampaignBadge, contentDateInfo, EmptyState, PlatformIcon, StageBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { IDEA_SOURCE_MAP, PLATFORMS, PROBLEM_CATEGORY_MAP, RESEARCH_TYPE_MAP, STORY_TYPE_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import type { AudienceQuestion, ContentIdea, ContentItem, ResearchItem, Story } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { useIdeaActions } from "./idea-actions"

interface SourceLink {
  kind: string
  title: string
  detail: string
  href: string
}

function resolveSource(
  idea: ContentIdea,
  rows: { stories: Story[]; research: ResearchItem[]; questions: AudienceQuestion[]; items: ContentItem[] }
): SourceLink | null {
  const ref = idea.source_ref_id
  if (!ref) return null
  const story = rows.stories.find((s) => s.id === ref)
  if (story) return { kind: "Story Vault", title: story.title, detail: STORY_TYPE_MAP[story.type]?.label ?? "Story", href: `/stories?open=${story.id}` }
  const research = rows.research.find((r) => r.id === ref)
  if (research)
    return {
      kind: "Research Library",
      title: research.title,
      detail: [RESEARCH_TYPE_MAP[research.type]?.label, research.creator || research.source].filter(Boolean).join(" · "),
      href: `/research?open=${research.id}`,
    }
  const question = rows.questions.find((q) => q.id === ref)
  if (question)
    return {
      kind: "Question Bank",
      title: question.question,
      detail: `Asked ${pluralize(question.frequency, "time")}${question.source_person ? ` · ${question.source_person}` : ""}`,
      href: `/audience/questions?open=${question.id}`,
    }
  const item = rows.items.find((i) => i.id === ref)
  if (item)
    return {
      kind: idea.source === "winner" ? "Winning content" : "Content",
      title: item.title,
      detail: PLATFORMS[item.platform]?.label ?? item.platform,
      href: `/studio/${item.id}`,
    }
  return null
}

function useRelated(idea: ContentIdea) {
  const items = useTable("content_items")
  const stories = useTable("stories")
  const research = useTable("research_items")
  const questions = useTable("audience_questions")
  const problems = useTable("audience_problems")
  return useMemo(() => {
    const made = items.filter((i) => i.idea_id === idea.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const source = resolveSource(idea, { stories, research, questions, items })
    const linkedQuestions = questions.filter((q) => q.idea_id === idea.id && q.id !== idea.source_ref_id)
    const problem = idea.problem_id ? (problems.find((p) => p.id === idea.problem_id) ?? null) : null
    return { made, source, linkedQuestions, problem }
  }, [idea, items, stories, research, questions, problems])
}

/** Number shown on the Related tab. */
export function useRelatedCount(idea: ContentIdea): number {
  const { made, source, linkedQuestions, problem } = useRelated(idea)
  return made.length + (source ? 1 : 0) + linkedQuestions.length + (problem ? 1 : 0)
}

function Block({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="flex items-center gap-1.5 border-b pb-1.5 text-sm font-medium">
        {title}
        {count ? <span className="text-xs font-normal text-muted-foreground num">{count}</span> : null}
      </h3>
      {children}
    </section>
  )
}

const ROW_LINK =
  "block truncate text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"

/** Content made from the idea, where it came from, its audience problem, linked questions, campaign and series. */
export function IdeaRelated({ idea, now }: { idea: ContentIdea; now: Date }) {
  const actions = useIdeaActions()
  const campaigns = useTable("content_campaigns")
  const series = useTable("content_series")
  const { made, source, linkedQuestions, problem } = useRelated(idea)
  const campaign = idea.campaign_id ? campaigns.find((c) => c.id === idea.campaign_id) : undefined
  const seriesRow = idea.series_id ? series.find((s) => s.id === idea.series_id) : undefined

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Block title="Content made from this idea" count={made.length}>
        {made.length ? (
          <ul className="divide-y rounded-lg border">
            {made.map((item) => {
              const info = contentDateInfo(item, now)
              const Icon = info?.icon
              return (
                <li key={item.id} className="flex min-w-0 items-center gap-3 px-3 py-2">
                  <PlatformIcon platform={item.platform} label className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/studio/${item.id}`} className={ROW_LINK} title={item.title}>
                      {item.title || "Untitled content"}
                    </Link>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                      {info && Icon ? (
                        <span title={info.title} className={cn("inline-flex min-w-0 items-center gap-1 truncate", info.overdue && "font-medium text-critical-fg")}>
                          <Icon className="size-3 shrink-0" aria-hidden />
                          {info.label}
                        </span>
                      ) : (
                        "No date yet"
                      )}
                    </p>
                  </div>
                  <StageBadge stage={item.stage} />
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={FilePlus2}
            title="Not converted yet"
            description="Converting creates one content item per platform, each with a Content Brief pre-filled from this idea."
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => actions.convert(idea.id)}>
                <FilePlus2 aria-hidden />
                Convert to content
              </Button>
            }
          />
        )}
      </Block>

      <Block title="Where it came from">
        {source ? (
          <Link
            href={source.href}
            className="group/source flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2.5 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{source.kind}</p>
              <p className="line-clamp-2 text-sm font-medium">{source.title || "Untitled"}</p>
              {source.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{source.detail}</p> : null}
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover/source:text-foreground" aria-hidden />
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            {IDEA_SOURCE_MAP[idea.source]?.label ?? "Manual"} · captured {formatDate(idea.created_at)}
          </p>
        )}
      </Block>

      {problem ? (
        <Block title="Audience problem">
          <Link
            href={`/audience/problems?open=${problem.id}`}
            className="group/problem flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2.5 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-pretty">{problem.problem}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {PROBLEM_CATEGORY_MAP[problem.category]?.label ?? "Problem"} · severity <span className="num">{problem.severity}</span>/5
              </p>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover/problem:text-foreground" aria-hidden />
          </Link>
        </Block>
      ) : null}

      {linkedQuestions.length ? (
        <Block title="Linked questions" count={linkedQuestions.length}>
          <ul className="flex flex-col gap-1.5">
            {linkedQuestions.map((question) => (
              <li key={question.id} className="flex min-w-0 items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Link href={`/audience/questions?open=${question.id}`} className="min-w-0 text-sm underline-offset-4 hover:underline">
                  {question.question}
                </Link>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground num">×{question.frequency}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {campaign || seriesRow ? (
        <Block title="Campaign & series">
          <div className="flex flex-wrap items-center gap-2">
            {campaign ? (
              <Link href={`/campaigns/${campaign.id}`} className="rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50">
                <CampaignBadge campaign={campaign} size="md" />
              </Link>
            ) : null}
            {seriesRow ? (
              <Link
                href={`/series?open=${seriesRow.id}`}
                className="inline-flex h-6 items-center rounded-md border bg-card px-2 text-sm font-medium outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {seriesRow.name || "Untitled series"}
              </Link>
            ) : null}
          </div>
        </Block>
      ) : null}
    </div>
  )
}
