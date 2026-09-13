"use client"

import { useId } from "react"
import {
  AngleSelect,
  FormatSelect,
  FormField,
  FormRow,
  FunnelSelect,
  GoalSelect,
  HookCategorySelect,
  ListEditor,
  PersonaSelect,
  PillarSelect,
  PlatformToggleGroup,
  ProblemSelect,
} from "@/components/common"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { AiTaskOutput } from "@/lib/ai"
import { GOAL_CATEGORIES } from "@/lib/constants"
import type { Database, FunnelStage, GoalCategory, HookCategory, ID, InsertRow, PlatformId } from "@/lib/types"

/** The AI's structured idea, as an editable form model. */
export interface IdeaDraft {
  title: string
  core_topic: string
  description: string
  hook: string
  hook_category: HookCategory | null
  angle_id: ID | null
  pillar_id: ID | null
  persona_id: ID | null
  problem_id: ID | null
  goal_id: ID | null
  format_id: ID | null
  platforms: PlatformId[]
  funnel_stage: FunnelStage | null
  why_it_matters: string
  talking_points: string[]
  /** What the AI suggested; shown when no goal of that category exists yet. */
  goal_category: GoalCategory
}

function knownId<T extends { id: ID }>(rows: T[], id: ID | null): ID | null {
  return id && rows.some((row) => row.id === id) ? id : null
}

/** capture_idea output → draft. Angle and goal come back as names/categories and are matched to rows. */
export function draftFromCapture(output: AiTaskOutput<"capture_idea">, db: Database): IdeaDraft {
  const angleName = output.angle.trim().toLowerCase()
  const angle = angleName ? db.angles.find((a) => a.name.trim().toLowerCase() === angleName) : undefined
  const goals = db.content_goals.filter((g) => g.category === output.goal_category)
  const goal = goals.find((g) => g.is_active) ?? goals[0]
  return {
    title: output.title.trim(),
    core_topic: output.core_topic.trim(),
    description: output.description.trim(),
    hook: output.hook.trim(),
    hook_category: output.hook_category,
    angle_id: angle?.id ?? null,
    pillar_id: knownId(db.content_pillars, output.pillar_id),
    persona_id: knownId(db.audience_personas, output.persona_id),
    problem_id: knownId(db.audience_problems, output.problem_id),
    goal_id: goal?.id ?? null,
    format_id: knownId(db.content_formats, output.format_id),
    platforms: output.platforms,
    funnel_stage: output.funnel_stage,
    why_it_matters: output.why_it_matters.trim(),
    talking_points: output.talking_points.map((point) => point.trim()).filter(Boolean),
    goal_category: output.goal_category,
  }
}

/** Draft → idea row values (source and status are set by the caller). */
export function ideaValuesFromDraft(draft: IdeaDraft): InsertRow<"content_ideas"> {
  const hook = draft.hook.trim()
  return {
    title: draft.title.trim(),
    core_topic: draft.core_topic.trim(),
    description: draft.description.trim(),
    hook,
    hook_category: hook ? draft.hook_category : null,
    angle_id: draft.angle_id,
    pillar_id: draft.pillar_id,
    persona_id: draft.persona_id,
    problem_id: draft.problem_id,
    goal_id: draft.goal_id,
    format_id: draft.format_id,
    platforms: draft.platforms,
    funnel_stage: draft.funnel_stage,
    why_it_matters: draft.why_it_matters.trim(),
    talking_points: draft.talking_points.map((point) => point.trim()).filter(Boolean),
  }
}

/** Every field of the structured idea, editable before it is saved. */
export function IdeaPreviewFields({
  draft,
  onChange,
  titleError,
}: {
  draft: IdeaDraft
  onChange: (patch: Partial<IdeaDraft>) => void
  titleError?: string
}) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const goalHint = draft.goal_id
    ? undefined
    : `Suggested: a ${GOAL_CATEGORIES[draft.goal_category]?.label ?? "business"} goal — none is set up in Strategy yet.`

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Title" htmlFor={field("title")} required error={titleError}>
        <Input
          id={field("title")}
          value={draft.title}
          maxLength={200}
          aria-invalid={Boolean(titleError) || undefined}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </FormField>

      <FormRow>
        <FormField label="Core topic" htmlFor={field("topic")}>
          <Input
            id={field("topic")}
            value={draft.core_topic}
            maxLength={120}
            placeholder="The topic in 2–6 words"
            onChange={(event) => onChange({ core_topic: event.target.value })}
          />
        </FormField>
        <FormField label="Funnel stage" htmlFor={field("funnel")}>
          <FunnelSelect id={field("funnel")} allowNone value={draft.funnel_stage} onChange={(funnel_stage) => onChange({ funnel_stage })} />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="Pillar" htmlFor={field("pillar")}>
          <PillarSelect id={field("pillar")} allowNone value={draft.pillar_id} onChange={(pillar_id) => onChange({ pillar_id })} />
        </FormField>
        <FormField label="Persona" htmlFor={field("persona")}>
          <PersonaSelect id={field("persona")} allowNone value={draft.persona_id} onChange={(persona_id) => onChange({ persona_id })} />
        </FormField>
      </FormRow>

      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <FormField label="Hook" htmlFor={field("hook")}>
          <Textarea
            id={field("hook")}
            rows={2}
            className="min-h-14"
            value={draft.hook}
            placeholder="The opening line that stops the scroll"
            onChange={(event) => onChange({ hook: event.target.value })}
          />
        </FormField>
        <FormField label="Hook type" htmlFor={field("hook-type")}>
          <HookCategorySelect
            id={field("hook-type")}
            allowNone
            value={draft.hook_category}
            onChange={(hook_category) => onChange({ hook_category })}
          />
        </FormField>
      </div>

      <FormRow>
        <FormField label="Format" htmlFor={field("format")}>
          <FormatSelect id={field("format")} allowNone value={draft.format_id} onChange={(format_id) => onChange({ format_id })} />
        </FormField>
        <FormField label="Angle" htmlFor={field("angle")}>
          <AngleSelect id={field("angle")} allowNone value={draft.angle_id} onChange={(angle_id) => onChange({ angle_id })} />
        </FormField>
      </FormRow>

      <FormField label="Platforms">
        <PlatformToggleGroup value={draft.platforms} onChange={(platforms) => onChange({ platforms })} aria-label="Platforms" />
      </FormField>

      <FormRow>
        <FormField label="Goal" htmlFor={field("goal")} description={goalHint}>
          <GoalSelect id={field("goal")} allowNone value={draft.goal_id} onChange={(goal_id) => onChange({ goal_id })} />
        </FormField>
        <FormField label="Audience problem" htmlFor={field("problem")}>
          <ProblemSelect
            id={field("problem")}
            allowNone
            personaId={draft.persona_id}
            value={draft.problem_id}
            onChange={(problem_id) => onChange({ problem_id })}
          />
        </FormField>
      </FormRow>

      <FormField label="Description" htmlFor={field("description")}>
        <Textarea
          id={field("description")}
          rows={3}
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </FormField>

      <FormField label="Why it matters" htmlFor={field("why")}>
        <Textarea
          id={field("why")}
          rows={2}
          className="min-h-14"
          value={draft.why_it_matters}
          onChange={(event) => onChange({ why_it_matters: event.target.value })}
        />
      </FormField>

      <FormField label="Talking points">
        <ListEditor
          variant="lines"
          value={draft.talking_points}
          onChange={(talking_points) => onChange({ talking_points })}
          addLabel="Add talking point"
          placeholder="A concrete point in your voice"
          maxItems={8}
          aria-label="Talking points"
        />
      </FormField>
    </div>
  )
}
