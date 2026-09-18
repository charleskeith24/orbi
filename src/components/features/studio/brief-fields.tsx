"use client"

import { Check, CircleCheck, Sparkles, TriangleAlert } from "lucide-react"
import { useId } from "react"
import { FormField, ListEditor } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import type { PlatformId } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import type { SaveState } from "./brief-autosave"
import { briefMessages } from "./brief-messages"

/** Autosave status next to the tab title. */
export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useT(briefMessages)
  return (
    <span aria-live="polite" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {state === "saving" ? (
        t("saving")
      ) : state === "saved" ? (
        <>
          <CircleCheck className="size-3.5 text-good-fg" aria-hidden />
          {t("saved")}
        </>
      ) : (
        t("autosaves")
      )}
    </span>
  )
}

/** An editable AI suggestion under a field — apply it or dismiss it. */
export function SuggestionBox({
  label,
  value,
  onChange,
  onApply,
  onDismiss,
  list = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onApply: () => void
  onDismiss: () => void
  list?: boolean
}) {
  const t = useT(briefMessages)
  const id = useId()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-brand/25 bg-brand-soft p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden />
        <label htmlFor={id} className="min-w-0 truncate text-xs font-medium">
          {t("suggested", { label: label.toLowerCase() })}
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
            {t("dismiss")}
          </Button>
          <Button type="button" size="xs" onClick={onApply}>
            <Check aria-hidden />
            {t("apply")}
          </Button>
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 bg-background/80 dark:bg-input/40"
      />
      {list ? <p className="text-[11px] text-muted-foreground">{t("one_per_line")}</p> : null}
    </div>
  )
}

/** Multiline brief field with an optional suggestion underneath. */
export function BriefTextField({
  label,
  value,
  onChange,
  placeholder,
  description,
  suggestion,
  footer,
  rows = 2,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  description?: React.ReactNode
  suggestion?: React.ReactNode
  footer?: React.ReactNode
  rows?: number
  className?: string
}) {
  const id = useId()
  return (
    <FormField label={label} htmlFor={id} description={description} className={className}>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(rows <= 1 ? "min-h-8" : "min-h-16")}
      />
      {footer}
      {suggestion}
    </FormField>
  )
}

/** List brief field (supporting points, B-roll, on-screen text). */
export function BriefListField({
  label,
  value,
  onChange,
  placeholder,
  addLabel,
  description,
  suggestion,
  className,
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  addLabel?: string
  description?: React.ReactNode
  suggestion?: React.ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <FormField label={label} htmlFor={id} description={description} className={className}>
      <ListEditor id={id} variant="lines" value={value} onChange={onChange} placeholder={placeholder} addLabel={addLabel} aria-label={label} />
      {suggestion}
    </FormField>
  )
}

/** Platform caption limits worth warning about (characters). */
const CAPTION_LIMITS: Partial<Record<PlatformId, number>> = {
  x: 280,
  threads: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
}

/** "142 / 2,200 characters" — warns (icon + text) past the platform limit. */
export function CaptionCounter({ text, platform, className }: { text: string; platform: PlatformId; className?: string }) {
  const t = useT(briefMessages)
  const limit = CAPTION_LIMITS[platform]
  const length = [...text].length
  const over = limit !== undefined && length > limit
  if (!length && !limit) return null
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground num", over && "font-medium text-warning-fg", className)}>
      {over ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> : null}
      {formatNumber(length)}
      {limit ? ` / ${formatNumber(limit)}` : ""} {t("characters")}
      {over ? ` — ${t("over_limit")}` : ""}
    </p>
  )
}
