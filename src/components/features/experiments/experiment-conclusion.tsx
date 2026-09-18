"use client"

import { Check, Lightbulb, Wand2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ChipToggleGroup, FormField, PageSection, type ChipOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ExperimentResults } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import { createIdea, dataActions, useTable } from "@/lib/store"
import type { ContentExperiment, ExperimentWinner } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { experimentSheetMessages } from "./detail-messages"
import { lessonIdeaValues } from "./experiment-model"
import { experimentsMessages } from "./messages"

interface Draft {
  result: string
  winner: ExperimentWinner | null
  lesson: string
}

const draftOf = (e: ContentExperiment): Draft => ({ result: e.result, winner: e.winner, lesson: e.lesson })

/** Result, winner and lesson — plus "Turn lesson into an idea" so every test feeds the Idea Bank. */
export function ExperimentConclusion({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
  const t = useT(experimentSheetMessages)
  const tx = useT(experimentsMessages)
  const lang = useUiLang()
  const router = useRouter()
  const ideas = useTable("content_ideas")
  const [draft, setDraft] = useState<Draft>(() => draftOf(experiment))
  const lessonIdea = ideas
    .filter((i) => i.source_ref_id === experiment.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

  const dirty =
    draft.result.trim() !== experiment.result.trim() || draft.winner !== experiment.winner || draft.lesson.trim() !== experiment.lesson.trim()
  const suggestion = results.suggestedWinner
  const canUseSuggestion = draft.winner !== suggestion && results.a.n + results.b.n > 0

  const winnerOptions: ChipOption<ExperimentWinner>[] = [
    { value: "a", label: `A · ${truncate(experiment.variant_a || tx("variant", { letter: "A" }), 28)}` },
    { value: "b", label: `B · ${truncate(experiment.variant_b || tx("variant", { letter: "B" }), 28)}` },
    { value: "inconclusive", label: tx("inconclusive") },
  ]

  function persist() {
    dataActions.update("content_experiments", experiment.id, {
      result: draft.result.trim(),
      winner: draft.winner,
      lesson: draft.lesson.trim(),
    })
  }

  function save() {
    persist()
    toast.success(t("conclusion_saved"), { description: experiment.name })
  }

  function useSuggestion() {
    setDraft((d) => ({ ...d, winner: suggestion, result: d.result.trim() ? d.result : `${results.reason}.` }))
  }

  function turnIntoIdea() {
    const lesson = draft.lesson.trim()
    if (!lesson) return
    if (dirty) persist()
    const idea = createIdea(lessonIdeaValues({ ...experiment, winner: draft.winner, result: draft.result }, lesson, lang))
    toast.success(t("lesson_idea_saved"), {
      description: idea.title,
      action: { label: t("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  return (
    <PageSection
      id="experiment-conclusion"
      title={t("conclusion")}
      description={t("conclusion_description")}
      action={
        canUseSuggestion ? (
          <Button type="button" size="sm" variant="outline" onClick={useSuggestion}>
            <Wand2 aria-hidden />
            {t("use_suggestion")}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t("winner")} description={experiment.status === "completed" ? undefined : t("winner_description")}>
          <ChipToggleGroup
            options={winnerOptions}
            value={draft.winner}
            onChange={(winner) => setDraft((d) => ({ ...d, winner }))}
            size="sm"
            aria-label={t("winner")}
          />
        </FormField>
        <FormField label={t("result")} htmlFor={`experiment-result-${experiment.id}`}>
          <Textarea
            id={`experiment-result-${experiment.id}`}
            value={draft.result}
            onChange={(e) => setDraft((d) => ({ ...d, result: e.target.value }))}
            rows={2}
            maxLength={1000}
            placeholder={t("result_placeholder")}
          />
        </FormField>
        <FormField label={t("lesson")} htmlFor={`experiment-lesson-${experiment.id}`}>
          <Textarea
            id={`experiment-lesson-${experiment.id}`}
            value={draft.lesson}
            onChange={(e) => setDraft((d) => ({ ...d, lesson: e.target.value }))}
            rows={2}
            maxLength={1000}
            placeholder={t("lesson_placeholder")}
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={turnIntoIdea} disabled={!draft.lesson.trim()}>
            <Lightbulb aria-hidden />
            {t("turn_into_idea")}
          </Button>
          {lessonIdea ? (
            <Button asChild variant="ghost" size="sm" className="text-good-fg">
              <Link href={`/ideas?open=${lessonIdea.id}`}>
                <Check aria-hidden />
                {t("idea_created")}
              </Link>
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {dirty ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(draftOf(experiment))}>
                {t("discard")}
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={save} disabled={!dirty}>
              {t("save_conclusion")}
            </Button>
          </div>
        </div>
      </div>
    </PageSection>
  )
}
