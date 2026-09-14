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
import { createIdea, dataActions, useTable } from "@/lib/store"
import type { ContentExperiment, ExperimentWinner } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { lessonIdeaValues } from "./experiment-model"

interface Draft {
  result: string
  winner: ExperimentWinner | null
  lesson: string
}

const draftOf = (e: ContentExperiment): Draft => ({ result: e.result, winner: e.winner, lesson: e.lesson })

/** Result, winner and lesson — plus "Turn lesson into an idea" so every test feeds the Idea Bank. */
export function ExperimentConclusion({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
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
    { value: "a", label: `A · ${truncate(experiment.variant_a || "Variant A", 28)}` },
    { value: "b", label: `B · ${truncate(experiment.variant_b || "Variant B", 28)}` },
    { value: "inconclusive", label: "Inconclusive" },
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
    toast.success("Conclusion saved", { description: experiment.name })
  }

  function useSuggestion() {
    setDraft((d) => ({ ...d, winner: suggestion, result: d.result.trim() ? d.result : `${results.reason}.` }))
  }

  function turnIntoIdea() {
    const lesson = draft.lesson.trim()
    if (!lesson) return
    if (dirty) persist()
    const idea = createIdea(lessonIdeaValues({ ...experiment, winner: draft.winner, result: draft.result }, lesson))
    toast.success("Lesson saved as an idea", {
      description: idea.title,
      action: { label: "Open", onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  return (
    <PageSection
      id="experiment-conclusion"
      title="Conclusion"
      description="What happened, who won, and the rule you'll follow from now on."
      action={
        canUseSuggestion ? (
          <Button type="button" size="sm" variant="outline" onClick={useSuggestion}>
            <Wand2 aria-hidden />
            Use suggestion
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Winner" description={experiment.status === "completed" ? undefined : "You can record a winner at any time; it's final once the experiment is completed."}>
          <ChipToggleGroup
            options={winnerOptions}
            value={draft.winner}
            onChange={(winner) => setDraft((d) => ({ ...d, winner }))}
            size="sm"
            aria-label="Winner"
          />
        </FormField>
        <FormField label="Result" htmlFor={`experiment-result-${experiment.id}`}>
          <Textarea
            id={`experiment-result-${experiment.id}`}
            value={draft.result}
            onChange={(e) => setDraft((d) => ({ ...d, result: e.target.value }))}
            rows={2}
            maxLength={1000}
            placeholder="What happened? Include the numbers."
          />
        </FormField>
        <FormField label="Lesson" htmlFor={`experiment-lesson-${experiment.id}`}>
          <Textarea
            id={`experiment-lesson-${experiment.id}`}
            value={draft.lesson}
            onChange={(e) => setDraft((d) => ({ ...d, lesson: e.target.value }))}
            rows={2}
            maxLength={1000}
            placeholder="The rule you'll follow from now on, e.g. “Lead with the claim, not the context.”"
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={turnIntoIdea} disabled={!draft.lesson.trim()}>
            <Lightbulb aria-hidden />
            Turn lesson into an idea
          </Button>
          {lessonIdea ? (
            <Button asChild variant="ghost" size="sm" className="text-good-fg">
              <Link href={`/ideas?open=${lessonIdea.id}`}>
                <Check aria-hidden />
                Idea created · Open
              </Link>
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {dirty ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(draftOf(experiment))}>
                Discard
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={save} disabled={!dirty}>
              Save conclusion
            </Button>
          </div>
        </div>
      </div>
    </PageSection>
  )
}
