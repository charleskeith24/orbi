"use client"

import { ClipboardPaste, ExternalLink, Info, Library } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import { FormField, FormRow, OptionSelect, PlatformSelect, ViewToggle, type SelectOption, type ViewOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PLATFORMS } from "@/lib/constants"
import type { ID, ResearchItem } from "@/lib/types"
import type { PastedReference } from "./adapt-model"
import { RESEARCH_TYPE_ICONS, RESEARCH_TYPE_OPTIONS, ResearchStatusBadge, ResearchTypeBadge } from "./research-badges"
import { isHttpUrl, MIN_REFERENCE_CHARS } from "./research-model"
import { StepCard, type StepState } from "./step-card"

export type SourceMode = "paste" | "library"

const MODE_OPTIONS: ViewOption<SourceMode>[] = [
  { value: "paste", label: "Paste", icon: ClipboardPaste },
  { value: "library", label: "From library", icon: Library },
]

/** Step 1: paste a reference (text used for analysis only) or pick one from the Research Library. */
export function AdaptReferenceStep({
  state,
  mode,
  onModeChange,
  pasted,
  onPastedChange,
  items,
  libraryItem,
  onSelect,
}: {
  state: StepState
  mode: SourceMode
  onModeChange: (mode: SourceMode) => void
  pasted: PastedReference
  onPastedChange: (patch: Partial<PastedReference>) => void
  items: readonly ResearchItem[]
  libraryItem: ResearchItem | undefined
  onSelect: (id: ID | null) => void
}) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const currentId = libraryItem?.id ?? null
  const options = useMemo<SelectOption<ID>[]>(
    () =>
      items
        .filter((r) => r.status !== "archived" || r.id === currentId)
        .sort((a, b) => Number(Boolean(b.analysis)) - Number(Boolean(a.analysis)) || b.created_at.localeCompare(a.created_at))
        .map((r) => {
          const Icon = RESEARCH_TYPE_ICONS[r.type]
          return { value: r.id, label: r.title || "Untitled reference", icon: <Icon className="text-muted-foreground" aria-hidden /> }
        }),
    [items, currentId]
  )
  const chars = pasted.content.trim().length
  const urlError = pasted.url.trim() && !isHttpUrl(pasted.url) ? "Use a full web address, starting with https://" : undefined

  return (
    <StepCard
      step={1}
      state={state}
      title="Reference"
      description="Paste the post, script or transcript — or pick one from your Research Library."
      action={<ViewToggle value={mode} onChange={onModeChange} options={MODE_OPTIONS} aria-label="Reference source" />}
    >
      {mode === "paste" ? (
        <div className="flex min-w-0 flex-col gap-4">
          <FormField
            label="Reference text"
            htmlFor={field("content")}
            required
            description="Used for analysis only — it's never shown as your draft and never republished."
            error={chars > 0 && chars < MIN_REFERENCE_CHARS ? `Paste at least ${MIN_REFERENCE_CHARS} characters.` : undefined}
          >
            <Textarea
              id={field("content")}
              rows={6}
              className="min-h-32"
              value={pasted.content}
              maxLength={15000}
              placeholder="Paste the post, caption, script or transcript you want to learn from…"
              onChange={(event) => onPastedChange({ content: event.target.value })}
            />
          </FormField>
          <FormRow>
            <FormField label="Title" htmlFor={field("title")} description="Optional — how you'll recognise it in your library.">
              <Input id={field("title")} value={pasted.title} maxLength={300} onChange={(event) => onPastedChange({ title: event.target.value })} />
            </FormField>
            <FormField label="Creator" htmlFor={field("creator")} description="Describe them — e.g. SaaS founder, ~90k followers.">
              <Input id={field("creator")} value={pasted.creator} maxLength={120} onChange={(event) => onPastedChange({ creator: event.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Platform" htmlFor={field("platform")}>
              <PlatformSelect id={field("platform")} allowNone value={pasted.platform} onChange={(platform) => onPastedChange({ platform })} />
            </FormField>
            <FormField label="Type" htmlFor={field("type")}>
              <OptionSelect
                id={field("type")}
                options={RESEARCH_TYPE_OPTIONS}
                value={pasted.type}
                onChange={(type) => {
                  if (type) onPastedChange({ type })
                }}
              />
            </FormField>
          </FormRow>
          <FormField label="URL" htmlFor={field("url")} error={urlError}>
            <Input
              id={field("url")}
              type="url"
              inputMode="url"
              value={pasted.url}
              maxLength={2000}
              placeholder="https://…"
              aria-invalid={Boolean(urlError) || undefined}
              onChange={(event) => onPastedChange({ url: event.target.value })}
            />
          </FormField>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <FormField label="Reference" htmlFor={field("library")}>
            <OptionSelect
              id={field("library")}
              options={options}
              value={currentId}
              onChange={onSelect}
              placeholder="Choose a reference from your library"
              emptyText="Your Research Library is empty — paste a reference instead."
            />
          </FormField>
          {libraryItem ? <LibrarySummary item={libraryItem} /> : null}
        </div>
      )}
    </StepCard>
  )
}

function LibrarySummary({ item }: { item: ResearchItem }) {
  const byline = [item.creator, item.platform ? PLATFORMS[item.platform].label : item.source].filter(Boolean).join(" · ")
  const noText = !item.analysis && item.content.trim().length < MIN_REFERENCE_CHARS
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ResearchTypeBadge type={item.type} />
        <ResearchStatusBadge status={item.status} />
        <Button type="button" variant="ghost" size="xs" className="ml-auto text-muted-foreground" asChild>
          <Link href={`/research?open=${item.id}`}>
            <ExternalLink aria-hidden />
            Open in library
          </Link>
        </Button>
      </div>
      {byline ? <p className="text-xs text-muted-foreground">{byline}</p> : null}
      {item.topic ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Topic: </span>
          {item.topic}
        </p>
      ) : null}
      {item.why_attention ? <p className="text-sm text-pretty text-muted-foreground">{item.why_attention}</p> : null}
      {noText ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          This reference has no pasted text yet — add it in the library to analyze it.
        </p>
      ) : null}
    </div>
  )
}
