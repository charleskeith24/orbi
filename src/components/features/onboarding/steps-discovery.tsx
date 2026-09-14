"use client"

import { Check, CircleAlert, CircleCheck, Lightbulb, Plus } from "lucide-react"
import { chipVariants, ChipToggleGroup, FormField, FormRow, ListEditor, NumberField, PlatformToggleGroup } from "@/components/common"
import { Input } from "@/components/ui/input"
import { useCopy } from "./copy"
import { GALING_GROUPS, HILIG_GROUPS, KANINO_CHIPS } from "./niche-model"
import { EXPERIENCE_LEVELS, LIMITS, norm } from "./onboarding-model"
import { fid, TextField, type StepProps } from "./steps-profile"
import { StepSection } from "./wizard-chrome"

/** Suggestion chips that add to (or remove from) a list the creator can also type into. */
function SuggestionChips({
  groups,
  value,
  onChange,
  max,
}: {
  groups: { id: string; label: string | null; items: string[] }[]
  value: string[]
  onChange: (value: string[]) => void
  max: number
}) {
  const full = value.length >= max
  const has = (item: string) => value.some((x) => norm(x) === norm(item))
  const toggle = (item: string) => {
    if (has(item)) onChange(value.filter((x) => norm(x) !== norm(item)))
    else if (!full) onChange([...value, item])
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.id} role="group" aria-label={group.label ?? undefined} className="flex flex-col gap-1.5">
          {group.label ? <p className="text-xs font-medium text-muted-foreground">{group.label}</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item) => {
              const on = has(item)
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(item)}
                  className={chipVariants({ size: "default", selected: on })}
                >
                  {on ? <Check aria-hidden /> : <Plus aria-hidden />}
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const cap = (list: string[], each: number) => list.map((x) => x.slice(0, each))

/* ---------------------------------- Hilig --------------------------------- */

export function HiligStep({ answers: a, update, errors }: StepProps) {
  const copy = useCopy()
  const t = copy.hilig
  const count = a.interests.filter((x) => x.trim()).length
  const set = (interests: string[]) => update({ interests: cap(interests, LIMITS.interest) })
  return (
    <div className="flex flex-col gap-6">
      <FormField
        label={t.label}
        required
        htmlFor={fid("interests")}
        error={errors.interests}
        description={t.description}
        labelAction={<span className="text-xs text-muted-foreground num">{t.count(count)}</span>}
      >
        <ListEditor
          variant="chips"
          id={fid("interests")}
          value={a.interests}
          onChange={set}
          maxItems={LIMITS.interestsMax}
          placeholder={t.placeholder}
          aria-label={t.label}
        />
      </FormField>
      <StepSection title={t.suggestions}>
        <SuggestionChips groups={HILIG_GROUPS.map((g) => ({ id: g.id, label: t.groups[g.id], items: g.items }))} value={a.interests} onChange={set} max={LIMITS.interestsMax} />
      </StepSection>
      <p className="flex items-start gap-1.5 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-pretty text-muted-foreground">
        <Lightbulb className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
        {t.test}
      </p>
    </div>
  )
}

/* ---------------------------------- Galing -------------------------------- */

export function GalingStep({ answers: a, update, errors }: StepProps) {
  const copy = useCopy()
  const t = copy.galing
  const set = (expertise_areas: string[]) => update({ expertise_areas: cap(expertise_areas, LIMITS.expertise) })
  return (
    <div className="flex flex-col gap-6">
      <FormField label={t.skills} required htmlFor={fid("expertise_areas")} error={errors.expertise_areas} description={t.skillsDescription}>
        <ListEditor
          variant="chips"
          id={fid("expertise_areas")}
          value={a.expertise_areas}
          onChange={set}
          maxItems={LIMITS.expertiseMax}
          placeholder={t.skillsPlaceholder}
          aria-label={t.skills}
        />
      </FormField>
      <StepSection title={copy.hilig.suggestions}>
        <SuggestionChips groups={GALING_GROUPS.map((g) => ({ id: g.id, label: t.groups[g.id], items: g.items }))} value={a.expertise_areas} onChange={set} max={LIMITS.expertiseMax} />
      </StepSection>
      <TextField
        multiline
        rows={2}
        field="help_requests"
        label={t.help}
        value={a.help_requests}
        onChange={(help_requests) => update({ help_requests })}
        placeholder={t.helpPlaceholder}
        maxLength={LIMITS.help}
      />
      <FormRow>
        <FormField label={t.years} htmlFor={fid("years_experience")} error={errors.years_experience}>
          <NumberField
            id={fid("years_experience")}
            value={a.years_experience}
            onChange={(years_experience) => update({ years_experience })}
            min={0}
            max={LIMITS.years}
            placeholder="e.g. 5"
            suffix={t.yearsSuffix}
            aria-invalid={errors.years_experience ? true : undefined}
          />
        </FormField>
        <FormField label={t.proof} htmlFor={fid("proof")} description={t.proofDescription}>
          <Input id={fid("proof")} value={a.proof} maxLength={LIMITS.proof} placeholder={t.proofPlaceholder} onChange={(event) => update({ proof: event.target.value })} />
        </FormField>
      </FormRow>
      <TextField
        multiline
        rows={3}
        field="story"
        label={t.story}
        value={a.story}
        onChange={(story) => update({ story })}
        description={t.storyDescription}
        placeholder={t.storyPlaceholder}
        maxLength={LIMITS.story}
      />
    </div>
  )
}

/* ---------------------------------- Kanino -------------------------------- */

export function KaninoStep({ answers: a, update, errors }: StepProps) {
  const copy = useCopy()
  const t = copy.kanino
  const problems = a.persona_problems.filter((p) => p.trim()).length
  const set = (audiences: string[]) => update({ audiences: cap(audiences, LIMITS.audience) })
  return (
    <div className="flex flex-col gap-6">
      <FormField label={t.who} required htmlFor={fid("audiences")} error={errors.audiences} description={t.whoDescription}>
        <ListEditor
          variant="chips"
          id={fid("audiences")}
          value={a.audiences}
          onChange={set}
          maxItems={LIMITS.audiencesMax}
          placeholder={t.whoPlaceholder}
          aria-label={t.who}
        />
      </FormField>
      <SuggestionChips groups={[{ id: "kanino", label: null, items: KANINO_CHIPS }]} value={a.audiences} onChange={set} max={LIMITS.audiencesMax} />
      <FormRow>
        <TextField
          field="persona_profession"
          label={t.stage}
          value={a.persona_profession}
          onChange={(persona_profession) => update({ persona_profession })}
          placeholder={t.stagePlaceholder}
          maxLength={300}
        />
        <TextField
          field="audience_goal"
          label={t.goal}
          value={a.audience_goal}
          onChange={(audience_goal) => update({ audience_goal })}
          placeholder={t.goalPlaceholder}
          maxLength={LIMITS.audienceGoal}
        />
      </FormRow>
      <FormField label={t.level}>
        <ChipToggleGroup
          aria-label={t.level}
          size="default"
          options={EXPERIENCE_LEVELS.map((id) => ({ value: id as string, label: t.levels[id] }))}
          value={a.persona_experience || null}
          onChange={(value) => update({ persona_experience: value ?? "" })}
        />
      </FormField>
      <FormField
        label={t.problems}
        required
        htmlFor={fid("persona_problems")}
        error={errors.persona_problems}
        description={t.problemsDescription}
      >
        <ListEditor
          variant="lines"
          id={fid("persona_problems")}
          value={a.persona_problems}
          onChange={(persona_problems) => update({ persona_problems: cap(persona_problems, LIMITS.problem) })}
          placeholder={t.problemsPlaceholder}
          addLabel={t.addProblem}
          maxItems={LIMITS.problemsMax}
          aria-label={t.problems}
        />
        {problems ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {problems >= LIMITS.problemsGood ? (
              <CircleCheck className="size-3.5 text-good-fg" aria-hidden />
            ) : (
              <CircleAlert className="size-3.5 text-warning-fg" aria-hidden />
            )}
            {t.problemsHint(problems)}
          </p>
        ) : null}
      </FormField>
      <FormField label={t.platforms} description={t.platformsDescription}>
        <PlatformToggleGroup value={a.persona_platforms} onChange={(persona_platforms) => update({ persona_platforms })} aria-label={t.platforms} />
      </FormField>
    </div>
  )
}
