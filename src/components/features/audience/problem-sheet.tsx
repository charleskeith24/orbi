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
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { AudienceProblem, UpdateRow } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { clampSeverity, generatorHref, severityLabel, type ProblemLinks } from "./audience-model"
import { AutosaveTextarea } from "./autosave-field"
import { audienceMessages } from "./messages"
import { ProblemActionsMenu, type ProblemActions } from "./problem-actions"
import { ProblemCategorySelect } from "./problem-category-select"
import { problemMessages } from "./problem-messages"
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
  const t = useT(problemMessages)
  const a = useT(audienceMessages)
  if (!problem) return null
  const severity = clampSeverity(problem.severity)
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={truncate(problem.problem || t("untitled"), 160)}
      description={t("sheet_description", {
        category: PROBLEM_CATEGORY_MAP[problem.category]?.label ?? t("audience"),
        level: severity,
        label: severityLabel(severity),
      })}
      actions={<ProblemActionsMenu problem={problem} actions={actions} showOpen={false} className="size-7" />}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={generatorHref(problem)}>
              <Sparkles className="text-brand" aria-hidden />
              {a("generate_ideas")}
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={() => actions.createIdea(problem)}>
            <Lightbulb aria-hidden />
            {a("create_idea")}
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
  const t = useT(problemMessages)
  const a = useT(audienceMessages)
  const [now] = useState(() => new Date())
  const save = (patch: UpdateRow<"audience_problems">) => dataActions.update("audience_problems", problem.id, patch)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FormField label={t("problem")} htmlFor={`${id}-problem`} required description={t("problem_description")}>
        <AutosaveTextarea
          id={`${id}-problem`}
          value={problem.problem}
          required
          requiredMessage={t("describe")}
          maxLength={500}
          rows={2}
          onCommit={(text) => save({ problem: text })}
        />
      </FormField>
      <FormRow>
        <FormField label={t("category")} htmlFor={`${id}-category`}>
          <ProblemCategorySelect id={`${id}-category`} value={problem.category} onChange={(category) => save({ category })} />
        </FormField>
        <FormField label={t("severity")}>
          <SeverityPicker value={problem.severity} onChange={(severity) => save({ severity: clampSeverity(severity) })} />
        </FormField>
        <FormField label={a("persona")} htmlFor={`${id}-persona`}>
          <PersonaSelect id={`${id}-persona`} allowNone value={problem.persona_id} onChange={(persona_id) => save({ persona_id })} />
        </FormField>
        <FormField label={a("pillar")} htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={problem.pillar_id} onChange={(pillar_id) => save({ pillar_id })} />
        </FormField>
      </FormRow>
      <FormField label={a("notes")} htmlFor={`${id}-notes`}>
        <AutosaveTextarea
          id={`${id}-notes`}
          value={problem.notes}
          maxLength={2000}
          rows={2}
          placeholder={t("sheet_notes_placeholder")}
          onCommit={(notes) => save({ notes })}
        />
      </FormField>

      <Separator />

      <section className="flex min-w-0 flex-col gap-2" aria-label={t("ideas_aria")}>
        <h3 className="text-sm font-medium">
          {t("ideas")} <span className="font-normal text-muted-foreground num">{formatNumber(links.ideas.length)}</span>
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
                    {idea.title || a("untitled_idea")}
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
            title={links.items.length ? t("no_ideas") : t("untapped_problem")}
            description={t("no_ideas_description")}
            className="rounded-lg border border-dashed"
          />
        )}
      </section>

      {links.items.length ? (
        <section className="flex min-w-0 flex-col gap-2" aria-label={t("content_aria")}>
          <h3 className="text-sm font-medium">
            {t("content")} <span className="font-normal text-muted-foreground num">{formatNumber(links.items.length)}</span>
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
