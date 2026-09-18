"use client"

import { PenLine } from "lucide-react"
import { FormField, FormRow } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCopy } from "./copy"
import { LIMITS, type OnboardingAnswers, type StepErrors } from "./onboarding-model"

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
          data-ob-required={required || undefined}
          value={value}
          rows={rows ?? 3}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-16"
        />
      ) : (
        <Input
          id={id}
          name={field}
          data-ob-required={required || undefined}
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

/** One part of "I help [audience] [result] through [method]." */
export function SentenceRow({
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
          data-ob-required={required || undefined}
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

/* ------------------------------- Identity -------------------------------- */

export function IdentityStep({ answers: a, update, errors, onEditNiche }: StepProps & { onEditNiche?: () => void }) {
  const copy = useCopy()
  const t = copy.identity
  return (
    <div className="flex flex-col gap-5">
      {a.niche.trim() ? (
        <div className="flex items-start gap-3 rounded-lg border bg-card p-3 dark:bg-input/20">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{t.niche}</p>
            <p className="mt-0.5 text-sm text-pretty">{a.niche}</p>
          </div>
          {onEditNiche ? (
            <Button type="button" variant="ghost" size="xs" onClick={onEditNiche}>
              <PenLine aria-hidden />
              {t.changeNiche}
            </Button>
          ) : null}
        </div>
      ) : null}
      <FormRow>
        <TextField
          field="name"
          label={t.name}
          required
          value={a.name}
          onChange={(name) => update({ name })}
          error={errors.name}
          placeholder={t.namePlaceholder}
          maxLength={LIMITS.name}
          autoComplete="name"
        />
        <TextField
          field="brand_name"
          label={t.brandName}
          value={a.brand_name}
          onChange={(brand_name) => update({ brand_name })}
          placeholder={t.brandNamePlaceholder}
          description={t.brandNameHint}
          maxLength={LIMITS.brandName}
          autoComplete="organization"
        />
      </FormRow>
      <FormRow>
        <TextField
          field="role"
          label={t.role}
          required
          value={a.role}
          onChange={(role) => update({ role })}
          error={errors.role}
          placeholder={t.rolePlaceholder}
          maxLength={LIMITS.role}
          autoComplete="organization-title"
        />
        <TextField
          field="industry"
          label={t.industry}
          required
          value={a.industry}
          onChange={(industry) => update({ industry })}
          error={errors.industry}
          placeholder={t.industryPlaceholder}
          description={a.niche_option && a.industry.trim() === a.niche_option.industry.trim() ? t.industryHint : undefined}
          maxLength={LIMITS.industry}
        />
      </FormRow>
      <TextField
        field="location"
        label={t.location}
        value={a.location}
        onChange={(location) => update({ location })}
        placeholder={t.locationPlaceholder}
        maxLength={LIMITS.location}
        autoComplete="address-level2"
      />
      {errors.years_experience ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.years_experience}
        </p>
      ) : null}
    </div>
  )
}

/** Plain multi-line field for the strategy step panels. */
export function PanelTextarea({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <Textarea
      aria-label={label}
      value={value}
      rows={rows}
      maxLength={LIMITS.longText}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-16"
    />
  )
}
