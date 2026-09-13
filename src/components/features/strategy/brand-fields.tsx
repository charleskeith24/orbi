"use client"

import { TriangleAlert } from "lucide-react"
import { FormField, SectionCard } from "@/components/common"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SECTION_ICONS } from "./brand-icons"
import { BRAND_SECTIONS, CONTEXT_LIMITS, fieldId, type BrandErrors, type BrandFormValues, type BrandSectionKey, type BrandTextField, type SetBrandValue } from "./brand-model"

export interface BrandSectionProps {
  values: BrandFormValues
  set: SetBrandValue
  errors: BrandErrors
}

const SECTION_META = new Map(BRAND_SECTIONS.map((s) => [s.key, s]))

/** One Brand HQ section: an anchored SectionCard (the sticky nav scrolls to `#<key>`). */
export function BrandSection({
  sectionKey,
  action,
  children,
}: {
  sectionKey: BrandSectionKey
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const meta = SECTION_META.get(sectionKey)
  return (
    <div id={sectionKey} className="scroll-mt-16">
      <SectionCard
        title={meta?.title}
        description={meta?.description}
        icon={SECTION_ICONS[sectionKey]}
        action={action}
        contentClassName="flex flex-col gap-4"
      >
        {children}
      </SectionCard>
    </div>
  )
}

/** "412 / 400" near a field's AI context limit; a warning once the AI would only read part of it. */
export function LimitHint({ length, limit }: { length: number; limit: number }) {
  if (length < limit * 0.85) return null
  const over = length > limit
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs num", over ? "text-warning-fg" : "text-muted-foreground")}
      title={over ? `The AI reads the first ${limit} characters of this field.` : undefined}
    >
      {over ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> : null}
      {length} / {limit}
      {over ? <span className="sr-only">— the AI reads the first {limit} characters</span> : null}
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
  description,
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
  description?: React.ReactNode
  required?: boolean
  error?: string
  autoComplete?: string
  className?: string
}) {
  const id = fieldId(field)
  const limit = CONTEXT_LIMITS[field]
  const invalid = Boolean(error) || undefined
  return (
    <FormField
      label={label}
      htmlFor={id}
      description={description}
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
    </FormField>
  )
}
