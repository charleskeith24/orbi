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
  InfoHint,
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
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { ContentIdea, ID, IdeaSource, UpdateRow } from "@/lib/types"
import { AutosaveInput, AutosaveTextarea } from "./idea-autosave"
import { ideaDetailMessages } from "./idea-detail-messages"
import { IdeaHookField } from "./idea-hook-field"

const SOURCE_OPTIONS: SelectOption<IdeaSource>[] = IDEA_SOURCES.map((s) => ({ value: s.id, label: s.label }))

function FieldGroup({ title, info, children }: { title: string; info?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-1.5 border-b pb-1.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {info ? <InfoHint title={title}>{info}</InfoHint> : null}
      </div>
      {children}
    </section>
  )
}

/** Every editable field of an idea. Selects save immediately; text saves on blur. */
export function IdeaFields({ idea }: { idea: ContentIdea }) {
  const id = useId()
  const t = useT(ideaDetailMessages)
  const c = useT(commonMessages)
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
      <FieldGroup title={t("group_idea")} info={t("idea_info")}>
        <FormField label={t("core_topic")} htmlFor={`${id}-topic`}>
          <AutosaveInput
            id={`${id}-topic`}
            value={idea.core_topic}
            placeholder={t("core_topic_placeholder")}
            onCommit={(core_topic) => set({ core_topic })}
          />
        </FormField>
        <FormField label={t("description")} htmlFor={`${id}-description`}>
          <AutosaveTextarea
            id={`${id}-description`}
            rows={3}
            value={idea.description}
            placeholder={t("description_placeholder")}
            onCommit={(description) => set({ description })}
          />
        </FormField>
        <IdeaHookField idea={idea} />
        <FormRow>
          <FormField label={t("hook_type")} htmlFor={`${id}-hook-type`}>
            <HookCategorySelect
              id={`${id}-hook-type`}
              allowNone
              value={idea.hook_category}
              onChange={(hook_category) => set({ hook_category })}
            />
          </FormField>
          <FormField label={t("angle")} htmlFor={`${id}-angle`}>
            <AngleSelect id={`${id}-angle`} allowNone value={idea.angle_id} onChange={(angle_id) => set({ angle_id })} />
          </FormField>
        </FormRow>
        <FormField label={t("talking_points")}>
          <ListEditor
            variant="lines"
            value={idea.talking_points}
            onChange={(talking_points) => set({ talking_points })}
            placeholder={t("talking_point_placeholder")}
            addLabel={c("add")}
            aria-label={t("talking_points")}
          />
        </FormField>
        <FormField label={t("cta")} htmlFor={`${id}-cta`}>
          <AutosaveInput id={`${id}-cta`} value={idea.cta} placeholder={t("cta_placeholder")} onCommit={(cta) => set({ cta })} />
        </FormField>
        <FormField label={t("why")} htmlFor={`${id}-why`}>
          <AutosaveTextarea
            id={`${id}-why`}
            rows={2}
            value={idea.why_it_matters}
            placeholder={t("why_placeholder")}
            onCommit={(why_it_matters) => set({ why_it_matters })}
          />
        </FormField>
        <FormField label={t("inspiration")} htmlFor={`${id}-inspiration`}>
          <AutosaveTextarea
            id={`${id}-inspiration`}
            rows={2}
            value={idea.inspiration}
            placeholder={t("inspiration_placeholder")}
            onCommit={(inspiration) => set({ inspiration })}
          />
        </FormField>
      </FieldGroup>

      <FieldGroup title={t("group_strategy")} info={t("strategy_info")}>
        <FormRow>
          <FormField label="Content Pillar" htmlFor={`${id}-pillar`}>
            <PillarSelect id={`${id}-pillar`} allowNone value={idea.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
          </FormField>
          <FormField label="Persona" htmlFor={`${id}-persona`}>
            <PersonaSelect id={`${id}-persona`} allowNone value={idea.persona_id} onChange={setPersona} />
          </FormField>
        </FormRow>
        <FormField label={t("audience_problem")} htmlFor={`${id}-problem`}>
          <ProblemSelect id={`${id}-problem`} personaId={idea.persona_id} allowNone value={idea.problem_id} onChange={setProblem} />
        </FormField>
        <FormRow>
          <FormField label={t("goal")} htmlFor={`${id}-goal`}>
            <GoalSelect id={`${id}-goal`} allowNone value={idea.goal_id} onChange={(goal_id) => set({ goal_id })} />
          </FormField>
          <FormField label={t("funnel_stage")} htmlFor={`${id}-funnel`}>
            <FunnelSelect id={`${id}-funnel`} allowNone value={idea.funnel_stage} onChange={(funnel_stage) => set({ funnel_stage })} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t("format")} htmlFor={`${id}-format`}>
            <FormatSelect id={`${id}-format`} allowNone value={idea.format_id} onChange={(format_id) => set({ format_id })} />
          </FormField>
        </FormRow>
        <FormField label={t("platforms")}>
          <PlatformToggleGroup size="xs" value={idea.platforms} onChange={(platforms) => set({ platforms })} aria-label={t("platforms_label")} />
        </FormField>
      </FieldGroup>

      <FieldGroup title={t("group_planning")}>
        <FormRow>
          <FormField label="Campaign" htmlFor={`${id}-campaign`}>
            <CampaignSelect id={`${id}-campaign`} allowNone value={idea.campaign_id} onChange={(campaign_id) => set({ campaign_id })} />
          </FormField>
          <FormField label="Series" htmlFor={`${id}-series`}>
            <SeriesSelect id={`${id}-series`} allowNone value={idea.series_id} onChange={(series_id) => set({ series_id })} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t("source")} htmlFor={`${id}-source`}>
            <OptionSelect
              id={`${id}-source`}
              options={SOURCE_OPTIONS}
              value={idea.source}
              onChange={(source) => {
                if (source) set({ source })
              }}
            />
          </FormField>
          <FormField label={t("tags")}>
            <EntityTagEditor entityType="content_ideas" entityId={idea.id} />
          </FormField>
        </FormRow>
      </FieldGroup>
    </div>
  )
}
