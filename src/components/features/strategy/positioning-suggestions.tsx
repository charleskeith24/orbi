"use client"

import { Check, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { AiButton, AiNotice, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import type { AiProviderId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error"
import { positioningSuggestionMessages } from "./brand-messages"

export type SuggestionField = "statement" | "known_for" | "point_of_view"
export type SuggestionValues = Record<SuggestionField, string>

const ROWS: { key: SuggestionField }[] = [{ key: "statement" }, { key: "known_for" }, { key: "point_of_view" }]

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase()

/**
 * "Suggest with AI" results: positioning statement, known-for and point of view — each editable and
 * accepted per field into the (unsaved) form. Mount with a new `key` per generation.
 */
export function PositioningSuggestions({
  suggestion,
  current,
  provider,
  model,
  pending,
  error,
  onApply,
  onRegenerate,
  onDismiss,
}: {
  suggestion: SuggestionValues | null
  current: SuggestionValues
  provider: AiProviderId | null
  model: string | null
  pending: boolean
  error: string | null
  onApply: (field: SuggestionField, value: string) => void
  onRegenerate: () => void
  onDismiss: () => void
}) {
  const [drafts, setDrafts] = useState<SuggestionValues | null>(suggestion)
  const [applied, setApplied] = useState<Partial<Record<SuggestionField, boolean>>>({})
  const t = useT(positioningSuggestionMessages)

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-brand/30 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-brand-soft px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="text-sm font-medium">{t("title")}</span>
          {provider && suggestion ? <ProviderBadge provider={provider} model={model ?? undefined} /> : null}
        </div>
        <div className="flex items-center gap-1">
          <AiButton type="button" size="sm" variant="ghost" pending={pending} onClick={onRegenerate}>
            {t("regenerate")}
          </AiButton>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("dismiss")} onClick={onDismiss}>
            <X aria-hidden />
          </Button>
        </div>
      </div>

      <div className={cn("flex flex-col divide-y", pending && suggestion && "opacity-60")} aria-busy={pending || undefined}>
        {error ? (
          <div className="p-3">
            <AiErrorNotice message={error} onRetry={onRegenerate} />
          </div>
        ) : null}
        {!drafts && pending ? (
          <div className="flex flex-col gap-3 p-3" aria-label={t("generating")}>
            {ROWS.map((row) => (
              <div key={row.key} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        ) : null}
        {drafts
          ? ROWS.map((row) => {
              const value = drafts[row.key]
              const matches = Boolean(current[row.key]) && same(value, current[row.key])
              const done = applied[row.key] || matches
              const id = `suggestion-${row.key}`
              return (
                <div key={row.key} className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor={id} className="text-sm font-medium">
                        {t(`${row.key}_label`)}
                      </label>
                      <p className="text-xs text-muted-foreground">{t(`${row.key}_hint`)}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={done ? "ghost" : "outline"}
                      disabled={done || !value.trim() || pending}
                      onClick={() => {
                        onApply(row.key, value.trim())
                        setApplied((a) => ({ ...a, [row.key]: true }))
                      }}
                    >
                      {done ? <Check className="text-good-fg" aria-hidden /> : null}
                      {applied[row.key] ? t("applied") : matches ? t("matches") : t("use")}
                    </Button>
                  </div>
                  <Textarea
                    id={id}
                    value={value}
                    className="min-h-14 leading-relaxed"
                    onChange={(event) => {
                      const next = event.target.value
                      setDrafts((d) => (d ? { ...d, [row.key]: next } : d))
                      setApplied((a) => ({ ...a, [row.key]: false }))
                    }}
                  />
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t("current")}</span> {current[row.key] || t("empty")}
                  </p>
                </div>
              )
            })
          : null}
      </div>

      <div className="border-t px-3 py-2">
        <AiNotice>{t("notice")}</AiNotice>
      </div>
    </div>
  )
}
