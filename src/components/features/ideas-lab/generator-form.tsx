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
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { generatorMessages } from "./generator-messages"
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
  const t = useT(generatorMessages)
  const c = useT(commonMessages)
  const field = (name: string) => `${id}-${name}`
  const problems = useTable("audience_problems")
  const [brief, setBrief] = useState<GeneratorBrief>(initialBrief)
  const [count, setCount] = useState<number | null>(initialBrief.count)
  const countOk = isValidCount(count)
  const pristine =
    !brief.pillarId &&
    !brief.personaId &&
    !brief.problemId &&
    !brief.platform &&
    !brief.goalId &&
    !brief.topic.trim() &&
    !brief.funnel &&
    !brief.angleId &&
    !brief.formatId &&
    count === EMPTY_BRIEF.count
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
      title={t("brief")}
      description={t("brief_description")}
      action={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          disabled={pristine}
          title={pristine ? t("reset_pristine") : t("reset_title")}
          onClick={reset}
        >
          <RotateCcw aria-hidden />
          {c("reset")}
        </Button>
      }
    >
      <form noValidate aria-label={t("brief_label")} onSubmit={submit} className="flex min-w-0 flex-col gap-4">
        <FormField label={t("content_pillar")} htmlFor={field("pillar")}>
          <PillarSelect
            id={field("pillar")}
            allowNone
            noneLabel={t("any_pillar")}
            placeholder={t("any_pillar")}
            value={brief.pillarId}
            onChange={(pillarId) => set({ pillarId })}
          />
        </FormField>
        <FormField label={t("audience")} htmlFor={field("persona")}>
          <PersonaSelect
            id={field("persona")}
            allowNone
            noneLabel={t("any_persona")}
            placeholder={t("any_persona")}
            value={brief.personaId}
            onChange={setPersona}
          />
        </FormField>
        <div className={PAIR}>
          <FormField label={t("platform")} htmlFor={field("platform")}>
            <PlatformSelect
              id={field("platform")}
              allowNone
              noneLabel={t("any_platform")}
              placeholder={t("any_platform")}
              value={brief.platform}
              onChange={(platform) => set({ platform })}
            />
          </FormField>
          <FormField label={t("content_goal")} htmlFor={field("goal")}>
            <GoalSelect
              id={field("goal")}
              allowNone
              noneLabel={t("any_goal")}
              placeholder={t("any_goal")}
              value={brief.goalId}
              onChange={(goalId) => set({ goalId })}
            />
          </FormField>
        </div>
        <FormField label={t("topic")} htmlFor={field("topic")} description={t("topic_help")}>
          <Input
            id={field("topic")}
            value={brief.topic}
            maxLength={TOPIC_MAX}
            autoComplete="off"
            enterKeyHint="go"
            placeholder={t("topic_placeholder")}
            onChange={(event) => set({ topic: event.target.value })}
          />
        </FormField>
        <div className={PAIR}>
          <FormField label={t("funnel_stage")} htmlFor={field("funnel")}>
            <FunnelSelect
              id={field("funnel")}
              allowNone
              noneLabel={t("any_stage")}
              placeholder={t("any_stage")}
              value={brief.funnel}
              onChange={(funnel) => set({ funnel })}
            />
          </FormField>
          <FormField label={t("angle")} htmlFor={field("angle")}>
            <AngleSelect
              id={field("angle")}
              allowNone
              noneLabel={t("any_angle")}
              placeholder={t("any_angle")}
              value={brief.angleId}
              onChange={(angleId) => set({ angleId })}
            />
          </FormField>
        </div>
        <FormField
          label={t("audience_problem")}
          htmlFor={field("problem")}
          description={brief.personaId ? t("problem_help_persona") : t("problem_help_none")}
        >
          <ProblemSelect
            id={field("problem")}
            personaId={brief.personaId}
            allowNone
            noneLabel={t("any_problem")}
            placeholder={t("any_problem")}
            value={brief.problemId}
            onChange={setProblem}
          />
        </FormField>
        <div className={PAIR}>
          <FormField label={t("format")} htmlFor={field("format")}>
            <FormatSelect
              id={field("format")}
              allowNone
              noneLabel={t("any_format")}
              placeholder={t("any_format")}
              value={brief.formatId}
              onChange={(formatId) => set({ formatId })}
            />
          </FormField>
          <FormField label={t("count_label")} htmlFor={field("count")} error={countOk ? undefined : t("count_error", { min: MIN_COUNT, max: MAX_COUNT })}>
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
          {countOk ? t.plural("generate", count) : t("generate_ideas")}
        </AiButton>
        {footer}
      </form>
    </SectionCard>
  )
}
