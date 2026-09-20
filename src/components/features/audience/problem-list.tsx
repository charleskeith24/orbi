"use client"

import { FileText, Lightbulb, Sparkles } from "lucide-react"
import Link from "next/link"
import { PersonaBadge, PillarBadge, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { PROBLEM_CATEGORY_MAP } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { AudiencePersona, AudienceProblem, ContentPillar, ID, ProblemCategory } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { generatorHref, isUntapped, NO_LINKS, type ProblemLinks } from "./audience-model"
import { audienceMessages } from "./messages"
import { ProblemActionsMenu, type ProblemActions } from "./problem-actions"
import { problemMessages } from "./problem-messages"
import { SeverityMeter } from "./severity"

export interface ProblemGroup {
  category: ProblemCategory
  problems: AudienceProblem[]
}

interface Lookups {
  links: Map<ID, ProblemLinks>
  personas: Map<ID, AudiencePersona>
  pillars: Map<ID, ContentPillar>
}

/** Problems grouped by category; each group is one bordered list. */
export function ProblemGroups({
  groups,
  showHeaders,
  actions,
  ...lookups
}: Lookups & { groups: ProblemGroup[]; showHeaders: boolean; actions: ProblemActions }) {
  const a = useT(audienceMessages)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {groups.map((group) => {
        const label = PROBLEM_CATEGORY_MAP[group.category]?.label ?? group.category
        const untapped = group.problems.filter((p) => isUntapped(lookups.links.get(p.id))).length
        const headingId = `problems-${group.category}`
        return (
          <section key={group.category} aria-labelledby={headingId} className="min-w-0 overflow-hidden rounded-lg border bg-card">
            <header className={showHeaders ? "flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2" : "sr-only"}>
              <h2 id={headingId} className="text-sm font-medium">
                {label} <span className="font-normal text-muted-foreground num">{formatNumber(group.problems.length)}</span>
              </h2>
              {untapped ? <span className="text-xs text-muted-foreground num">{a("untapped", { count: formatNumber(untapped) })}</span> : null}
            </header>
            <ul className="divide-y">
              {group.problems.map((problem) => (
                <ProblemRow
                  key={problem.id}
                  problem={problem}
                  links={lookups.links.get(problem.id) ?? NO_LINKS}
                  persona={problem.persona_id ? (lookups.personas.get(problem.persona_id) ?? null) : null}
                  pillar={problem.pillar_id ? (lookups.pillars.get(problem.pillar_id) ?? null) : null}
                  actions={actions}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function LinkCounts({ links }: { links: ProblemLinks }) {
  const t = useT(problemMessages)
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {links.ideas.length ? (
        <span className="inline-flex items-center gap-1">
          <Lightbulb className="size-3.5" aria-hidden />
          {t.plural("ideas_count", links.ideas.length, { count: formatNumber(links.ideas.length) })}
        </span>
      ) : null}
      {links.items.length ? (
        <span className="inline-flex items-center gap-1">
          <FileText className="size-3.5" aria-hidden />
          {t.plural("pieces_count", links.items.length, { count: formatNumber(links.items.length) })}
        </span>
      ) : null}
    </span>
  )
}

function ProblemRow({
  problem,
  links,
  persona,
  pillar,
  actions,
}: {
  problem: AudienceProblem
  links: ProblemLinks
  persona: AudiencePersona | null
  pillar: ContentPillar | null
  actions: ProblemActions
}) {
  const t = useT(problemMessages)
  const a = useT(audienceMessages)
  const untapped = isUntapped(links)
  return (
    <li className="group/row relative flex min-w-0 items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 has-[[data-row-link]:focus-visible]:bg-muted/50">
      <SeverityMeter value={problem.severity} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          data-row-link
          onClick={() => actions.open(problem.id)}
          className="block w-full text-left text-sm leading-snug outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
        >
          {problem.problem || t("untitled")}
        </button>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <PersonaBadge persona={persona} variant="plain" />
          <PillarBadge pillar={pillar} variant="plain" />
          {untapped ? (
            <StatusPill tone="warning" icon={Lightbulb} title={t("untapped_title")}>
              {t("untapped")}
            </StatusPill>
          ) : (
            <LinkCounts links={links} />
          )}
        </div>
      </div>
      {/* Untapped rows keep their call to action visible; covered rows reveal it on hover (desktop). */}
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity",
            !untapped && "md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100"
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-md:size-7 max-md:px-0"
            onClick={() => actions.createIdea(problem)}
          >
            <Lightbulb aria-hidden />
            <span className="max-md:sr-only">{a("create_idea")}</span>
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title={a("generate_ideas")} asChild>
            <Link href={generatorHref(problem)} aria-label={a("generate_ideas")}>
              <Sparkles className="text-brand" aria-hidden />
            </Link>
          </Button>
        </div>
        <ProblemActionsMenu problem={problem} actions={actions} />
      </div>
    </li>
  )
}
