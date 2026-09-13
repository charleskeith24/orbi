"use client"

import { Lightbulb, Sparkles } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import {
  ContentCard,
  DetailSheet,
  EmptyState,
  FormField,
  FormRow,
  IdeaStatusBadge,
  PersonaSelect,
  PillarSelect,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { PROBLEM_CATEGORY_MAP } from "@/lib/constants"
import { dataActions } from "@/lib/store"
import type { AudienceProblem, UpdateRow } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { clampSeverity, generatorHref, severityLabel, type ProblemLinks } from "./audience-model"
import { AutosaveTextarea } from "./autosave-field"
import { ProblemActionsMenu, type ProblemActions } from "./problem-actions"
import { ProblemCategorySelect } from "./problem-category-select"
import { SeverityPicker } from "./severity"

/** `/audience/problems?open=<id>` — edit the problem and see the ideas and content made from it. */
export function ProblemSheet({
  problem,
  open,
  links,
  actions,
  onOpenChange,
}: {
  problem: AudienceProblem | null
  open: boolean
  links: ProblemLinks
  actions: ProblemActions
  onOpenChange: (open: boolean) => void
}) {
  if (!problem) return null
  const severity = clampSeverity(problem.severity)
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={truncate(problem.problem || "Untitled problem", 160)}
      description={`${PROBLEM_CATEGORY_MAP[problem.category]?.label ?? "Audience"} problem · Severity ${severity}/5 · ${severityLabel(severity)}`}
      actions={<ProblemActionsMenu problem={problem} actions={actions} showOpen={false} className="size-7" />}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={generatorHref(problem)}>
              <Sparkles className="text-brand" aria-hidden />
              Generate ideas
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={() => actions.createIdea(problem)}>
            <Lightbulb aria-hidden />
            Create idea
          </Button>
        </>
      }
    >
      <SheetBody key={problem.id} problem={problem} links={links} />
    </DetailSheet>
  )
}

function SheetBody({ problem, links }: { problem: AudienceProblem; links: ProblemLinks }) {
  const id = useId()
  const [now] = useState(() => new Date())
  const save = (patch: UpdateRow<"audience_problems">) => dataActions.update("audience_problems", problem.id, patch)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FormField label="Problem" htmlFor={`${id}-problem`} required description="In your audience's words — specific beats general.">
        <AutosaveTextarea
          id={`${id}-problem`}
          value={problem.problem}
          required
          requiredMessage="Describe the problem."
          maxLength={500}
          rows={2}
          onCommit={(text) => save({ problem: text })}
        />
      </FormField>
      <FormRow>
        <FormField label="Category" htmlFor={`${id}-category`}>
          <ProblemCategorySelect id={`${id}-category`} value={problem.category} onChange={(category) => save({ category })} />
        </FormField>
        <FormField label="Severity">
          <SeverityPicker value={problem.severity} onChange={(severity) => save({ severity: clampSeverity(severity) })} />
        </FormField>
        <FormField label="Persona" htmlFor={`${id}-persona`}>
          <PersonaSelect id={`${id}-persona`} allowNone value={problem.persona_id} onChange={(persona_id) => save({ persona_id })} />
        </FormField>
        <FormField label="Pillar" htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={problem.pillar_id} onChange={(pillar_id) => save({ pillar_id })} />
        </FormField>
      </FormRow>
      <FormField label="Notes" htmlFor={`${id}-notes`}>
        <AutosaveTextarea
          id={`${id}-notes`}
          value={problem.notes}
          maxLength={2000}
          rows={2}
          placeholder="Where you heard it, how often, examples…"
          onCommit={(notes) => save({ notes })}
        />
      </FormField>

      <Separator />

      <section className="flex min-w-0 flex-col gap-2" aria-label="Ideas from this problem">
        <h3 className="text-sm font-medium">
          Ideas <span className="font-normal text-muted-foreground num">{formatNumber(links.ideas.length)}</span>
        </h3>
        {links.ideas.length ? (
          <ul className="divide-y rounded-lg border">
            {links.ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/ideas?open=${idea.id}`}
                  className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate" title={idea.title}>
                    {idea.title || "Untitled idea"}
                  </span>
                  <IdeaStatusBadge status={idea.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={Lightbulb}
            title={links.items.length ? "No ideas yet" : "Untapped problem"}
            description="Each problem can become a content idea — create one here or let the Idea Generator suggest angles."
            className="rounded-lg border border-dashed"
          />
        )}
      </section>

      {links.items.length ? (
        <section className="flex min-w-0 flex-col gap-2" aria-label="Content addressing this problem">
          <h3 className="text-sm font-medium">
            Content <span className="font-normal text-muted-foreground num">{formatNumber(links.items.length)}</span>
          </h3>
          <div className="flex flex-col gap-2">
            {links.items.map((item) => (
              <ContentCard key={item.id} item={item} compact href={`/studio/${item.id}`} now={now} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
