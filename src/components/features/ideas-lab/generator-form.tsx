"use client"

import { RotateCcw } from "lucide-react"
import { useId, useState } from "react"
import {
  AiButton,
  AngleSelect,
  FormatSelect,
  FormField,
  FunnelSelect,
  GoalSelect,
  NumberField,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  ProblemSelect,
  SectionCard,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { EMPTY_BRIEF, isValidCount, MAX_COUNT, MIN_COUNT, TOPIC_MAX, type GeneratorBrief } from "./generator-model"

const PAIR = "grid min-w-0 grid-cols-2 gap-3"

/**
 * The Idea Generator brief. Owns its own state (typing never re-renders the results); the view
 * remounts it with a new `key` to load a brief from the URL, an example or a recent generation.
 */
export function GeneratorBriefForm({
  initialBrief,
  pending,
  disabled,
  onGenerate,
  onReset,
  footer,
}: {
  initialBrief: GeneratorBrief
  pending: boolean
  disabled: boolean
  onGenerate: (brief: GeneratorBrief) => void
  onReset: () => void
  footer?: React.ReactNode
}) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const problems = useTable("audience_problems")
  const [brief, setBrief] = useState<GeneratorBrief>(initialBrief)
  const [count, setCount] = useState<number | null>(initialBrief.count)
  const countOk = isValidCount(count)
  const set = (patch: Partial<GeneratorBrief>) => setBrief((current) => ({ ...current, ...patch }))

  /** A problem that belongs to another persona no longer fits — clear it with the persona change. */
  function setPersona(personaId: ID | null) {
    setBrief((current) => {
      const problem = current.problemId ? problems.find((p) => p.id === current.problemId) : undefined
      const fits = !problem || !personaId || !problem.persona_id || problem.persona_id === personaId
      return { ...current, personaId, problemId: fits ? current.problemId : null }
    })
  }

  /** Picking a problem fills an empty persona and pillar from it. */
  function setProblem(problemId: ID | null) {
    const problem = problemId ? problems.find((p) => p.id === problemId) : undefined
    setBrief((current) => ({
      ...current,
      problemId,
      personaId: current.personaId ?? problem?.persona_id ?? null,
      pillarId: current.pillarId ?? problem?.pillar_id ?? null,
    }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!isValidCount(count) || disabled) return
    onGenerate({ ...brief, topic: brief.topic.replace(/\s+/g, " ").trim(), count })
  }

  function reset() {
    setBrief({ ...EMPTY_BRIEF })
    setCount(EMPTY_BRIEF.count)
    onReset()
  }

  return (
    <SectionCard
      title="Brief"
      description="Every filter is optional — leave one on “Any” and the generator balances it using your strategy."
      action={
        <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={reset}>
          <RotateCcw aria-hidden />
          Reset
        </Button>
      }
    >
      <form noValidate aria-label="Idea brief" onSubmit={submit} className="flex min-w-0 flex-col gap-4">
        <FormField label="Content Pillar" htmlFor={field("pillar")}>
          <PillarSelect
            id={field("pillar")}
            allowNone
            noneLabel="Any pillar"
            placeholder="Any pillar"
            value={brief.pillarId}
            onChange={(pillarId) => set({ pillarId })}
          />
        </FormField>
        <FormField label="Audience" htmlFor={field("persona")}>
          <PersonaSelect
            id={field("persona")}
            allowNone
            noneLabel="Any persona"
            placeholder="Any persona"
            value={brief.personaId}
            onChange={setPersona}
          />
        </FormField>
        <div className={PAIR}>
          <FormField label="Platform" htmlFor={field("platform")}>
            <PlatformSelect
              id={field("platform")}
              allowNone
              noneLabel="Any platform"
              placeholder="Any platform"
              value={brief.platform}
              onChange={(platform) => set({ platform })}
            />
          </FormField>
          <FormField label="Content goal" htmlFor={field("goal")}>
            <GoalSelect id={field("goal")} allowNone noneLabel="Any goal" placeholder="Any goal" value={brief.goalId} onChange={(goalId) => set({ goalId })} />
          </FormField>
        </div>
        <FormField label="Topic" htmlFor={field("topic")} description="Optional — a subject, a question someone asked or a story to build on.">
          <Input
            id={field("topic")}
            value={brief.topic}
            maxLength={TOPIC_MAX}
            autoComplete="off"
            enterKeyHint="go"
            placeholder="e.g. pricing your first offer"
            onChange={(event) => set({ topic: event.target.value })}
          />
        </FormField>
        <div className={PAIR}>
          <FormField label="Funnel stage" htmlFor={field("funnel")}>
            <FunnelSelect
              id={field("funnel")}
              allowNone
              noneLabel="Any stage"
              placeholder="Any stage"
              value={brief.funnel}
              onChange={(funnel) => set({ funnel })}
            />
          </FormField>
          <FormField label="Angle" htmlFor={field("angle")}>
            <AngleSelect id={field("angle")} allowNone noneLabel="Any angle" placeholder="Any angle" value={brief.angleId} onChange={(angleId) => set({ angleId })} />
          </FormField>
        </div>
        <FormField
          label="Audience problem"
          htmlFor={field("problem")}
          description={brief.personaId ? "Problems of the selected persona." : "Optional — pick an audience first to narrow the list."}
        >
          <ProblemSelect
            id={field("problem")}
            personaId={brief.personaId}
            allowNone
            noneLabel="Any problem"
            placeholder="Any problem"
            value={brief.problemId}
            onChange={setProblem}
          />
        </FormField>
        <div className={PAIR}>
          <FormField label="Format" htmlFor={field("format")}>
            <FormatSelect
              id={field("format")}
              allowNone
              noneLabel="Any format"
              placeholder="Any format"
              value={brief.formatId}
              onChange={(formatId) => set({ formatId })}
            />
          </FormField>
          <FormField label="Number of ideas" htmlFor={field("count")} error={countOk ? undefined : `Choose ${MIN_COUNT}–${MAX_COUNT}.`}>
            <NumberField
              id={field("count")}
              integer
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={count}
              onChange={setCount}
              aria-invalid={!countOk || undefined}
            />
          </FormField>
        </div>
        <AiButton type="submit" variant="default" pending={pending} disabled={disabled || !countOk} className="w-full">
          {countOk ? `Generate ${count} ${count === 1 ? "idea" : "ideas"}` : "Generate ideas"}
        </AiButton>
        {footer}
      </form>
    </SectionCard>
  )
}
