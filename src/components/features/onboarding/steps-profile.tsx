"use client"

import { Check, Plus } from "lucide-react"
import { chipVariants, ChipToggleGroup, FormField, FormRow, ListEditor, NumberField, PlatformToggleGroup } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EXPERTISE_SUGGESTIONS } from "@/lib/constants"
import { EXPERIENCE_LEVELS, LIMITS, norm, positioningOf, type OnboardingAnswers, type StepErrors } from "./onboarding-model"
import { StepSection } from "./wizard-chrome"

export interface StepProps {
  answers: OnboardingAnswers
  update: (patch: Partial<OnboardingAnswers>) => void
  errors: StepErrors
}

/** DOM id of a field — validation errors use the same key, so the first invalid field can be focused. */
export const fid = (field: string) => `ob-${field}`

export function TextField({
  field,
  label,
  value,
  onChange,
  error,
  required,
  placeholder,
  description,
  maxLength,
  autoComplete,
  multiline = false,
  rows,
}: {
  field: string
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  placeholder?: string
  description?: React.ReactNode
  maxLength?: number
  autoComplete?: string
  multiline?: boolean
  rows?: number
}) {
  const id = fid(field)
  const invalid = error ? true : undefined
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} description={description}>
      {multiline ? (
        <Textarea
          id={id}
          name={field}
          value={value}
          rows={rows ?? 3}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-20"
        />
      ) : (
        <Input
          id={id}
          name={field}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  )
}

/* ------------------------------ 1 · Who are you? --------------------------- */

export function IdentityStep({ answers: a, update, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <FormRow>
        <TextField
          field="name"
          label="Your name"
          required
          value={a.name}
          onChange={(name) => update({ name })}
          error={errors.name}
          placeholder="e.g. Maria Santos"
          maxLength={LIMITS.name}
          autoComplete="name"
        />
        <TextField
          field="brand_name"
          label="Brand name"
          value={a.brand_name}
          onChange={(brand_name) => update({ brand_name })}
          placeholder="e.g. Santos Studio"
          description="Leave empty if your brand is simply you."
          maxLength={LIMITS.brandName}
          autoComplete="organization"
        />
      </FormRow>
      <FormRow>
        <TextField
          field="role"
          label="Role"
          required
          value={a.role}
          onChange={(role) => update({ role })}
          error={errors.role}
          placeholder="e.g. Founder & CEO"
          maxLength={LIMITS.role}
          autoComplete="organization-title"
        />
        <TextField
          field="industry"
          label="Industry"
          required
          value={a.industry}
          onChange={(industry) => update({ industry })}
          error={errors.industry}
          placeholder="e.g. E-commerce, B2B SaaS, fitness coaching"
          maxLength={LIMITS.industry}
        />
      </FormRow>
      <FormRow>
        <FormField label="Years of experience" htmlFor={fid("years_experience")} error={errors.years_experience}>
          <NumberField
            id={fid("years_experience")}
            value={a.years_experience}
            onChange={(years_experience) => update({ years_experience })}
            min={0}
            max={LIMITS.years}
            placeholder="e.g. 8"
            suffix="years"
            aria-invalid={errors.years_experience ? true : undefined}
          />
        </FormField>
        <TextField
          field="location"
          label="Location"
          value={a.location}
          onChange={(location) => update({ location })}
          placeholder="e.g. Manila, Philippines"
          maxLength={LIMITS.location}
          autoComplete="address-level2"
        />
      </FormRow>
    </div>
  )
}

/* ------------------------------ 2 · Known for ------------------------------ */

function SentenceRow({
  field,
  lead,
  hint,
  value,
  onChange,
  placeholder,
  error,
  required,
}: {
  field: "audience" | "result" | "method"
  lead: string
  hint: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  error?: string
  required?: boolean
}) {
  const id = fid(field)
  return (
    <div className="grid gap-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground sm:pt-1.5">
        {lead}
        <span className="sr-only">
          {" "}
          — {hint}
          {required ? " (required)" : ""}
        </span>
      </label>
      <div className="min-w-0 space-y-1">
        <Input
          id={id}
          name={field}
          value={value}
          maxLength={LIMITS.positioning}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function PositioningStep({ answers: a, update, errors }: StepProps) {
  const statement = positioningOf(a)
  return (
    <div className="flex flex-col gap-6">
      <StepSection title="Your positioning" description="One sentence your audience could repeat about you.">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 dark:bg-input/20">
          <SentenceRow
            field="audience"
            lead="I help"
            hint="who you help"
            required
            value={a.audience}
            onChange={(audience) => update({ audience })}
            error={errors.audience}
            placeholder="e.g. first-time e-commerce founders"
          />
          <SentenceRow
            field="result"
            lead="to"
            hint="the result you help them get"
            required
            value={a.result}
            onChange={(result) => update({ result })}
            error={errors.result}
            placeholder="e.g. grow profitably without burning cash"
          />
          <SentenceRow
            field="method"
            lead="through"
            hint="your method"
            value={a.method}
            onChange={(method) => update({ method })}
            placeholder="e.g. simple ad systems and honest numbers"
          />
          <p className="border-t pt-3 text-sm text-pretty" aria-live="polite">
            {statement || <span className="text-muted-foreground">Your positioning statement appears here as you type.</span>}
          </p>
        </div>
      </StepSection>
      <TextField
        multiline
        field="known_for"
        label="What do you want to be known for?"
        required
        value={a.known_for}
        onChange={(known_for) => update({ known_for })}
        error={errors.known_for}
        placeholder="e.g. Turning messy ad accounts into predictable growth systems — explained in plain language."
        maxLength={LIMITS.longText}
      />
      <TextField
        multiline
        field="problems_solved"
        label="Problems you solve"
        value={a.problems_solved}
        onChange={(problems_solved) => update({ problems_solved })}
        placeholder="e.g. Founders stuck at the same revenue for months; ad costs rising while sales stay flat."
        maxLength={LIMITS.longText}
      />
      <TextField
        multiline
        field="why_listen"
        label="Why should people listen to you?"
        value={a.why_listen}
        onChange={(why_listen) => update({ why_listen })}
        placeholder="e.g. 9 years running ads for 60+ brands — and I share the failures, not just the wins."
        maxLength={LIMITS.longText}
      />
      <TextField
        multiline
        field="point_of_view"
        label="Your point of view"
        value={a.point_of_view}
        onChange={(point_of_view) => update({ point_of_view })}
        description="Beliefs you'd defend. Leave it empty and your initial strategy will suggest some."
        placeholder="e.g. Systems beat motivation. Most ad problems are offer problems."
        maxLength={LIMITS.longText}
      />
    </div>
  )
}

/* ------------------------------ 3 · Audience ------------------------------- */

/** "A; B. C" → ["A", "B", "C"] (a single comma-separated sentence splits on commas). */
export function splitProblems(text: string): string[] {
  let parts = text
    .split(/\n+|;\s*|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").replace(/[.!]+$/, "").trim())
    .filter((s) => s.length > 3)
  if (parts.length === 1 && parts[0].includes(", ")) parts = parts[0].split(/,\s+(?:and\s+)?/).map((s) => s.trim())
  return parts.filter((s) => s.length > 3).slice(0, 5)
}

export function AudienceStep({ answers: a, update, errors }: StepProps) {
  const imported = !a.persona_problems.length && a.problems_solved.trim() ? splitProblems(a.problems_solved) : []
  return (
    <div className="flex flex-col gap-6">
      <FormRow>
        <TextField
          field="persona_name"
          label="Persona name"
          required
          value={a.persona_name}
          onChange={(persona_name) => update({ persona_name })}
          error={errors.persona_name}
          placeholder="e.g. Growth-stage founders"
          description="A short label you'll see across the app."
          maxLength={80}
        />
        <TextField
          field="persona_profession"
          label="Profession"
          value={a.persona_profession}
          onChange={(persona_profession) => update({ persona_profession })}
          placeholder="e.g. Runs a 5–20 person online store"
          maxLength={LIMITS.role}
        />
      </FormRow>
      <FormField label="Experience level">
        <ChipToggleGroup
          aria-label="Experience level"
          size="default"
          options={EXPERIENCE_LEVELS.map((l) => ({ value: l.id as string, label: l.label }))}
          value={a.persona_experience || null}
          onChange={(value) => update({ persona_experience: value ?? "" })}
        />
      </FormField>
      <FormField
        label="Their biggest problems"
        required
        htmlFor={fid("persona_problems")}
        error={errors.persona_problems}
        description="Most painful first — these seed your Problem Bank and your first ideas."
        labelAction={
          imported.length ? (
            <Button type="button" variant="ghost" size="xs" onClick={() => update({ persona_problems: imported })}>
              Use “Problems you solve”
            </Button>
          ) : null
        }
      >
        <ListEditor
          variant="lines"
          id={fid("persona_problems")}
          value={a.persona_problems}
          onChange={(persona_problems) => update({ persona_problems })}
          placeholder="e.g. Ad costs keep rising while sales stay flat"
          addLabel="Add problem"
          maxItems={LIMITS.problemsMax}
          aria-label="Problems"
        />
      </FormField>
      <FormField label="What they want" htmlFor={fid("persona_goals")} description="Their goals, in their own words.">
        <ListEditor
          variant="lines"
          id={fid("persona_goals")}
          value={a.persona_goals}
          onChange={(persona_goals) => update({ persona_goals })}
          placeholder="e.g. Hit ₱1M a month without working weekends"
          addLabel="Add goal"
          maxItems={LIMITS.personaGoalsMax}
          aria-label="Goals"
        />
      </FormField>
      <FormField label="Where they spend time" description="We'll suggest these as your main platforms in step 6.">
        <PlatformToggleGroup
          value={a.persona_platforms}
          onChange={(persona_platforms) => update({ persona_platforms })}
          aria-label="Platforms your persona uses"
        />
      </FormField>
    </div>
  )
}

/* ------------------------------ 4 · Expertise ------------------------------ */

export function ExpertiseStep({ answers: a, update, errors }: StepProps) {
  const selected = a.expertise_areas
  const full = selected.length >= LIMITS.expertiseMax
  const has = (area: string) => selected.some((x) => norm(x) === norm(area))
  const toggle = (area: string) => {
    if (has(area)) update({ expertise_areas: selected.filter((x) => norm(x) !== norm(area)) })
    else if (!full) update({ expertise_areas: [...selected, area] })
  }
  return (
    <div className="flex flex-col gap-6">
      <FormField
        label="Your expertise areas"
        required
        htmlFor={fid("expertise_areas")}
        error={errors.expertise_areas}
        description={`Type an area and press Enter, or pick from the suggestions. Up to ${LIMITS.expertiseMax}.`}
      >
        <ListEditor
          variant="chips"
          id={fid("expertise_areas")}
          value={selected}
          onChange={(expertise_areas) => update({ expertise_areas: expertise_areas.map((x) => x.slice(0, LIMITS.expertise)) })}
          maxItems={LIMITS.expertiseMax}
          placeholder="e.g. Pricing, Hiring, Community building"
          aria-label="Expertise areas"
        />
      </FormField>
      <StepSection title="Suggestions">
        <div role="group" aria-label="Suggested expertise areas" className="flex flex-wrap gap-1.5">
          {EXPERTISE_SUGGESTIONS.map((area) => {
            const on = has(area)
            return (
              <button
                key={area}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(area)}
                className={chipVariants({ size: "default", selected: on })}
              >
                {on ? <Check aria-hidden /> : <Plus aria-hidden />}
                {area}
              </button>
            )
          })}
        </div>
      </StepSection>
      <TextField
        multiline
        field="expertise_summary"
        label="Your experience in a sentence or two"
        value={a.expertise_summary}
        onChange={(expertise_summary) => update({ expertise_summary })}
        placeholder="e.g. 9 years running paid ads for local brands; built a 12-person agency from scratch."
        maxLength={LIMITS.longText}
      />
      <TextField
        multiline
        rows={4}
        field="story"
        label="One story that shaped how you work"
        value={a.story}
        onChange={(story) => update({ story })}
        description="Optional — it grounds your first ideas in real experience and is saved to your Story Vault."
        placeholder="e.g. In 2022 we almost closed our first store because weekday sales dropped to ₱3,000 a day…"
        maxLength={LIMITS.story}
      />
    </div>
  )
}
