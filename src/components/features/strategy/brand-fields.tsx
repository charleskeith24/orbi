"use client"

import { TriangleAlert } from "lucide-react"
import { InfoHint, SectionCard } from "@/components/common"
import { formMessages } from "@/components/common/messages"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { brandFieldMessages, brandSectionMessages } from "./brand-messages"
import { CONTEXT_LIMITS, fieldId, type BrandErrors, type BrandFormValues, type BrandSectionKey, type BrandTextField, type SetBrandValue } from "./brand-model"

export interface BrandSectionProps {
  values: BrandFormValues
  set: SetBrandValue
  errors: BrandErrors
}

/** One Brand HQ section (the section nav shows one at a time); what it's for sits behind the ⓘ. */
export function BrandSection({
  sectionKey,
  action,
  children,
}: {
  sectionKey: BrandSectionKey
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useT(brandSectionMessages)
  return (
    <div id={sectionKey} className="scroll-mt-16">
      <SectionCard
        title={t(`${sectionKey}_title`)}
        info={t(`${sectionKey}_description`)}
        action={action}
        contentClassName="flex flex-col gap-5"
      >
        {children}
      </SectionCard>
    </div>
  )
}

/**
 * Label row + control + error for Brand HQ fields. Guidance that used to sit under the field goes in `hint`
 * (an ⓘ beside the label, outside the `<label>` so it doesn't join the control's name); `description` is
 * only for format or validation text (Calm UI rule 8). `labelAction` sits on the right (a counter).
 */
export function BrandFieldShell({
  label,
  htmlFor,
  hint,
  description,
  error,
  required = false,
  labelAction,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  labelAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const tf = useT(formMessages)
  return (
    <Field className={cn("min-w-0 gap-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <FieldLabel htmlFor={htmlFor} className="gap-0.5 leading-5">
            {label}
            {required ? (
              <>
                <span aria-hidden className="text-muted-foreground">
                  *
                </span>
                <span className="sr-only">{tf("required")}</span>
              </>
            ) : null}
          </FieldLabel>
          {hint ? <InfoHint title={typeof label === "string" ? label : undefined}>{hint}</InfoHint> : null}
        </div>
        {labelAction ? <div className="-my-1 flex shrink-0 items-center">{labelAction}</div> : null}
      </div>
      {children}
      {description ? <FieldDescription className="text-xs">{description}</FieldDescription> : null}
      {error ? <FieldError className="text-xs">{error}</FieldError> : null}
    </Field>
  )
}

/** "412 / 400" near a field's AI context limit; a warning once the AI would only read part of it. */
export function LimitHint({ length, limit }: { length: number; limit: number }) {
  const t = useT(brandFieldMessages)
  if (length < limit * 0.85) return null
  const over = length > limit
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs num", over ? "text-warning-fg" : "text-muted-foreground")}
      title={over ? t("limit_title", { limit }) : undefined}
    >
      {over ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> : null}
      {length} / {limit}
      {over ? <span className="sr-only">{t("limit_sr", { limit })}</span> : null}
    </span>
  )
}

/**
 * Labelled text input / textarea bound to one Brand HQ field, with the AI-context length hint.
 * `wrap` renders a one-line field that grows instead of truncating long values (Enter doesn't add lines).
 */
export function BrandTextField({
  field,
  label,
  value,
  onChange,
  multiline = false,
  wrap = false,
  placeholder,
  hint,
  required,
  error,
  autoComplete,
  className,
}: {
  field: BrandTextField
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  wrap?: boolean
  placeholder?: string
  /** Guidance behind an ⓘ next to the label. */
  hint?: React.ReactNode
  required?: boolean
  error?: string
  autoComplete?: string
  className?: string
}) {
  const id = fieldId(field)
  const limit = CONTEXT_LIMITS[field]
  const invalid = Boolean(error) || undefined
  return (
    <BrandFieldShell
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      labelAction={limit ? <LimitHint length={value.trim().length} limit={limit} /> : undefined}
      className={className}
    >
      {multiline ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid}
          className="min-h-20 leading-relaxed"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : wrap ? (
        <Textarea
          id={id}
          rows={1}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          className="min-h-8 resize-none py-1.5"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault()
          }}
          onChange={(event) => onChange(event.target.value.replace(/\s*\n+\s*/g, " "))}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </BrandFieldShell>
  )
}
