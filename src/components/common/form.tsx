"use client"

import { InfoHint } from "@/components/common/info-hint"
import { formMessages } from "@/components/common/messages"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * Label + control + help/error text on `ui/field`. Set `aria-invalid` on the control
 * yourself when `error` is present (the field can't reach into arbitrary children).
 */
export function FormField({
  label,
  htmlFor,
  description,
  error,
  required = false,
  info,
  infoTitle,
  labelAction,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor?: string
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  /** Calm UI: field guidance behind an ⓘ next to the label (outside the label, so it stays out of the control's name). */
  info?: React.ReactNode
  /** Popover heading and the ⓘ's accessible name; defaults to `label` when it's a string. */
  infoTitle?: string
  /** Small control aligned right of the label (e.g. an AI "Suggest" button). */
  labelAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const t = useT(formMessages)
  return (
    <Field className={cn("min-w-0 gap-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <FieldLabel htmlFor={htmlFor} className="gap-0.5 leading-5">
          {label}
          {required ? (
            <>
              <span aria-hidden className="text-muted-foreground">
                *
              </span>
              <span className="sr-only">{t("required")}</span>
            </>
          ) : null}
        </FieldLabel>
        {info ? (
          <InfoHint title={infoTitle ?? (typeof label === "string" ? label : undefined)} className="-my-1 -ml-1 mr-auto">
            {info}
          </InfoHint>
        ) : null}
        {labelAction ? <div className="-my-1 flex shrink-0 items-center">{labelAction}</div> : null}
      </div>
      {children}
      {description ? <FieldDescription className="text-xs">{description}</FieldDescription> : null}
      {error ? <FieldError className="text-xs">{error}</FieldError> : null}
    </Field>
  )
}

/** Responsive row of fields (stacks on mobile). */
export function FormRow({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3
  className?: string
}) {
  return (
    <div className={cn("grid min-w-0 gap-4 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", className)}>{children}</div>
  )
}

/** Button row at the end of a form. */
export function FormActions({
  children,
  align = "end",
  className,
}: {
  children: React.ReactNode
  align?: "start" | "end" | "between"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 pt-1",
        align === "end" && "justify-end",
        align === "between" && "justify-between",
        className
      )}
    >
      {children}
    </div>
  )
}
