"use client"

import { endOfDay } from "date-fns"
import { ArrowUpRight, Crosshair, FileText, MessageCircleQuestion } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ContentCard, EmptyState, PriorityBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { contentItemDate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import type { AudiencePersona, ContentItem } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { questionPriority, RECENT_DAYS } from "./audience-model"
import type { PersonaStats } from "./persona-card"
import { SeverityMeter } from "./severity"

const LIMIT = 5
const ROW = "flex min-w-0 items-center gap-3 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"

function LinkedSection({
  title,
  count,
  detail,
  href,
  hrefLabel,
  children,
}: {
  title: string
  count: number
  detail?: string
  href?: string
  hrefLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium">
          {title} <span className="font-normal text-muted-foreground num">{formatNumber(count)}</span>
          {detail ? <span className="text-xs font-normal text-muted-foreground"> · {detail}</span> : null}
        </h3>
        {href ? (
          <Button type="button" variant="ghost" size="xs" className="shrink-0 text-muted-foreground" asChild>
            <Link href={href}>
              {hrefLabel}
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** What the persona is connected to: their problems, their questions and recent content aimed at them. */
export function PersonaLinked({ persona, stats }: { persona: AudiencePersona; stats: PersonaStats | undefined }) {
  const problems = useTable("audience_problems")
  const questions = useTable("audience_questions")
  const items = useTable("content_items")
  const [now] = useState(() => new Date())

  const personaProblems = useMemo(
    () =>
      problems
        .filter((p) => p.persona_id === persona.id)
        .sort((a, b) => b.severity - a.severity || a.problem.localeCompare(b.problem)),
    [problems, persona.id]
  )
  const personaQuestions = useMemo(
    () =>
      questions
        .filter((q) => q.persona_id === persona.id && q.status !== "dismissed")
        .sort((a, b) => b.frequency - a.frequency || b.last_asked_at.localeCompare(a.last_asked_at)),
    [questions, persona.id]
  )
  const recent = useMemo(() => {
    const end = endOfDay(now).getTime()
    return items
      .filter((item) => item.persona_id === persona.id)
      .map((item) => ({ item, time: contentItemDate(item)?.getTime() ?? null }))
      .filter((entry): entry is { item: ContentItem; time: number } => entry.time !== null && entry.time <= end)
      .sort((a, b) => b.time - a.time)
      .slice(0, LIMIT)
      .map((entry) => entry.item)
  }, [items, persona.id, now])

  const share = stats && stats.contentTotal ? (stats.content / stats.contentTotal) * 100 : null

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <LinkedSection
        title="Problem Bank"
        count={personaProblems.length}
        detail={stats?.untapped ? `${formatNumber(stats.untapped)} untapped` : undefined}
        href={`/audience/problems?persona=${persona.id}`}
        hrefLabel="View all"
      >
        {personaProblems.length ? (
          <ul className="divide-y rounded-lg border">
            {personaProblems.slice(0, LIMIT).map((problem) => (
              <li key={problem.id}>
                <Link href={`/audience/problems?open=${problem.id}`} className={ROW}>
                  <SeverityMeter value={problem.severity} />
                  <span className="min-w-0 flex-1 truncate" title={problem.problem}>
                    {problem.problem}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={Crosshair}
            title="No problems for this persona yet"
            description="Each problem in the Problem Bank can become a content idea."
            action={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/audience/problems?new=1&persona=${persona.id}`}>Add a problem</Link>
              </Button>
            }
          />
        )}
      </LinkedSection>

      <LinkedSection
        title="Question Bank"
        count={personaQuestions.length}
        detail={stats?.openQuestions ? `${formatNumber(stats.openQuestions)} open` : undefined}
        href={`/audience/questions?persona=${persona.id}`}
        hrefLabel="View all"
      >
        {personaQuestions.length ? (
          <ul className="divide-y rounded-lg border">
            {personaQuestions.slice(0, LIMIT).map((question) => (
              <li key={question.id}>
                <Link href={`/audience/questions?open=${question.id}`} className={ROW}>
                  <span className="w-7 shrink-0 text-right text-xs font-medium text-muted-foreground num" title="Times asked">
                    {formatNumber(question.frequency)}×
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={question.question}>
                    {question.question}
                  </span>
                  <PriorityBadge priority={questionPriority(question.frequency)} showLabel={false} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={MessageCircleQuestion}
            title="No questions from this persona yet"
            description="Log what they ask in comments and DMs — repeated questions are your best content ideas."
            action={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/audience/questions?new=1&persona=${persona.id}`}>Add a question</Link>
              </Button>
            }
          />
        )}
      </LinkedSection>

      <LinkedSection
        title="Recent content"
        count={stats?.content ?? recent.length}
        detail={share === null ? undefined : `${formatPercent(share, 0)} of the last ${RECENT_DAYS} days`}
      >
        {recent.length ? (
          <div className="flex flex-col gap-2">
            {recent.map((item) => (
              <ContentCard key={item.id} item={item} compact href={`/studio/${item.id}`} now={now} />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={FileText}
            title="No recent content for this persona"
            description="Aim your next idea at them so they keep hearing from you."
            action={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/ideas/generator?persona=${persona.id}`}>Generate ideas</Link>
              </Button>
            }
          />
        )}
      </LinkedSection>
    </div>
  )
}
