"use client"

import { Check, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { AiButton, AiNotice, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { AiProviderId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error"

export type SuggestionField = "statement" | "known_for" | "point_of_view"
export type SuggestionValues = Record<SuggestionField, string>

const ROWS: { key: SuggestionField; label: string; hint: string }[] = [
  { key: "statement", label: "Positioning statement", hint: "Fills the three parts of the statement builder." },
  { key: "known_for", label: "Known for", hint: "Replaces “What do I want to be known for?”" },
  { key: "point_of_view", label: "Point of view", hint: "Replaces “What makes my point of view different?”" },
]

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

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-brand/30 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-brand-soft px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="text-sm font-medium">AI suggestions</span>
          {provider && suggestion ? <ProviderBadge provider={provider} model={model ?? undefined} /> : null}
        </div>
        <div className="flex items-center gap-1">
          <AiButton type="button" size="sm" variant="ghost" pending={pending} onClick={onRegenerate}>
            Regenerate
          </AiButton>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss suggestions" onClick={onDismiss}>
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
          <div className="flex flex-col gap-3 p-3" aria-label="Generating suggestions">
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
                        {row.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{row.hint}</p>
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
                      {applied[row.key] ? "Applied" : matches ? "Matches current" : "Use this"}
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
                    <span className="font-medium">Current:</span> {current[row.key] || "empty"}
                  </p>
                </div>
              )
            })
          : null}
      </div>

      <div className="border-t px-3 py-2">
        <AiNotice>
          Drafted from your current answers, including unsaved edits. Using a suggestion only changes the form — review it, then
          save.
        </AiNotice>
      </div>
    </div>
  )
}
