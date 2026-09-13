"use client"

import { useId } from "react"
import {
  AngleSelect,
  CampaignSelect,
  EntityTagEditor,
  FormatSelect,
  FormField,
  FormRow,
  FunnelSelect,
  GoalSelect,
  HookCategorySelect,
  ListEditor,
  OptionSelect,
  PersonaSelect,
  PillarSelect,
  PlatformToggleGroup,
  ProblemSelect,
  SeriesSelect,
  type SelectOption,
} from "@/components/common"
import { IDEA_SOURCES } from "@/lib/constants"
import { dataActions, useTable } from "@/lib/store"
import type { ContentIdea, ID, IdeaSource, UpdateRow } from "@/lib/types"
import { AutosaveInput, AutosaveTextarea } from "./idea-autosave"
import { IdeaHookField } from "./idea-hook-field"

const SOURCE_OPTIONS: SelectOption<IdeaSource>[] = IDEA_SOURCES.map((s) => ({ value: s.id, label: s.label }))

function FieldGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="border-b pb-1.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** Every editable field of an idea. Selects save immediately; text saves on blur. */
export function IdeaFields({ idea }: { idea: ContentIdea }) {
  const id = useId()
  const problems = useTable("audience_problems")
  const set = (patch: UpdateRow<"content_ideas">) => dataActions.update("content_ideas", idea.id, patch)

  /** A problem that belongs to another persona no longer fits — clear it with the persona change. */
  function setPersona(personaId: ID | null) {
    const problem = idea.problem_id ? problems.find((p) => p.id === idea.problem_id) : undefined
    const fits = !problem || !personaId || !problem.persona_id || problem.persona_id === personaId
    set({ persona_id: personaId, ...(fits ? {} : { problem_id: null }) })
  }

  /** Picking a problem fills an empty persona and pillar from it. */
  function setProblem(problemId: ID | null) {
    const problem = problemId ? problems.find((p) => p.id === problemId) : undefined
    set({
      problem_id: problemId,
      ...(problem?.persona_id && !idea.persona_id ? { persona_id: problem.persona_id } : {}),
      ...(problem?.pillar_id && !idea.pillar_id ? { pillar_id: problem.pillar_id } : {}),
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <FieldGroup title="The idea">
        <FormField label="Core topic" htmlFor={`${id}-topic`} description="Two or three words — groups related ideas in search and ⌘K.">
          <AutosaveInput
            id={`${id}-topic`}
            value={idea.core_topic}
            placeholder="e.g. Cart recovery"
            onCommit={(core_topic) => set({ core_topic })}
          />
        </FormField>
        <FormField label="Description" htmlFor={`${id}-description`}>
          <AutosaveTextarea
            id={`${id}-description`}
            rows={3}
            value={idea.description}
            placeholder="What's the idea, in two or three sentences?"
            onCommit={(description) => set({ description })}
          />
        </FormField>
        <IdeaHookField idea={idea} />
        <FormRow>
          <FormField label="Hook type" htmlFor={`${id}-hook-type`}>
            <HookCategorySelect
              id={`${id}-hook-type`}
              allowNone
              value={idea.hook_category}
              onChange={(hook_category) => set({ hook_category })}
            />
          </FormField>
          <FormField label="Angle" htmlFor={`${id}-angle`}>
            <AngleSelect id={`${id}-angle`} allowNone value={idea.angle_id} onChange={(angle_id) => set({ angle_id })} />
          </FormField>
        </FormRow>
        <FormField label="Talking points">
          <ListEditor
            variant="lines"
            value={idea.talking_points}
            onChange={(talking_points) => set({ talking_points })}
            placeholder="Add a talking point"
            addLabel="Add"
            aria-label="Talking points"
          />
        </FormField>
        <FormField label="Call to action" htmlFor={`${id}-cta`}>
          <AutosaveInput id={`${id}-cta`} value={idea.cta} placeholder="What should people do next?" onCommit={(cta) => set({ cta })} />
        </FormField>
        <FormField label="Why it matters" htmlFor={`${id}-why`} description="The audience problem or business reason behind it.">
          <AutosaveTextarea
            id={`${id}-why`}
            rows={2}
            value={idea.why_it_matters}
            placeholder="Who needs this, and why now?"
            onCommit={(why_it_matters) => set({ why_it_matters })}
          />
        </FormField>
        <FormField label="Inspiration" htmlFor={`${id}-inspiration`} description="A link, a conversation, a post you saw — never republished.">
          <AutosaveTextarea
            id={`${id}-inspiration`}
            rows={2}
            value={idea.inspiration}
            placeholder="Where did this come from?"
            onCommit={(inspiration) => set({ inspiration })}
          />
        </FormField>
      </FieldGroup>

      <FieldGroup title="Strategy" description="Tie every idea to a pillar, a persona and a real problem.">
        <FormRow>
          <FormField label="Content Pillar" htmlFor={`${id}-pillar`}>
            <PillarSelect id={`${id}-pillar`} allowNone value={idea.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
          </FormField>
          <FormField label="Persona" htmlFor={`${id}-persona`}>
            <PersonaSelect id={`${id}-persona`} allowNone value={idea.persona_id} onChange={setPersona} />
          </FormField>
        </FormRow>
        <FormField
          label="Audience problem"
          htmlFor={`${id}-problem`}
          description={idea.persona_id ? "Showing this persona's problems from the Problem Bank." : "Pick a persona to narrow the Problem Bank."}
        >
          <ProblemSelect id={`${id}-problem`} personaId={idea.persona_id} allowNone value={idea.problem_id} onChange={setProblem} />
        </FormField>
        <FormRow>
          <FormField label="Goal" htmlFor={`${id}-goal`}>
            <GoalSelect id={`${id}-goal`} allowNone value={idea.goal_id} onChange={(goal_id) => set({ goal_id })} />
          </FormField>
          <FormField label="Funnel stage" htmlFor={`${id}-funnel`}>
            <FunnelSelect id={`${id}-funnel`} allowNone value={idea.funnel_stage} onChange={(funnel_stage) => set({ funnel_stage })} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Format" htmlFor={`${id}-format`}>
            <FormatSelect id={`${id}-format`} allowNone value={idea.format_id} onChange={(format_id) => set({ format_id })} />
          </FormField>
        </FormRow>
        <FormField label="Platforms">
          <PlatformToggleGroup size="xs" value={idea.platforms} onChange={(platforms) => set({ platforms })} aria-label="Platforms for this idea" />
        </FormField>
      </FieldGroup>

      <FieldGroup title="Planning">
        <FormRow>
          <FormField label="Campaign" htmlFor={`${id}-campaign`}>
            <CampaignSelect id={`${id}-campaign`} allowNone value={idea.campaign_id} onChange={(campaign_id) => set({ campaign_id })} />
          </FormField>
          <FormField label="Series" htmlFor={`${id}-series`}>
            <SeriesSelect id={`${id}-series`} allowNone value={idea.series_id} onChange={(series_id) => set({ series_id })} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Source" htmlFor={`${id}-source`}>
            <OptionSelect
              id={`${id}-source`}
              options={SOURCE_OPTIONS}
              value={idea.source}
              onChange={(source) => {
                if (source) set({ source })
              }}
            />
          </FormField>
          <FormField label="Tags">
            <EntityTagEditor entityType="content_ideas" entityId={idea.id} />
          </FormField>
        </FormRow>
      </FieldGroup>
    </div>
  )
}
