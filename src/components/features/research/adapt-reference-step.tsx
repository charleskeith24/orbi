"use client"

import { ClipboardPaste, ExternalLink, Info, Library } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import { FormField, FormRow, OptionSelect, PlatformSelect, ViewToggle, type SelectOption, type ViewOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { ID, ResearchItem } from "@/lib/types"
import { adaptMessages } from "./adapt-messages"
import type { PastedReference } from "./adapt-model"
import { RESEARCH_TYPE_ICONS, RESEARCH_TYPE_OPTIONS, ResearchStatusBadge, ResearchTypeBadge } from "./research-badges"
import { isHttpUrl, MIN_REFERENCE_CHARS } from "./research-model"
import { StepCard, type StepState } from "./step-card"

export type SourceMode = "paste" | "library"

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
  const t = useT(adaptMessages)
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const currentId = libraryItem?.id ?? null
  const modeOptions = useMemo<ViewOption<SourceMode>[]>(
    () => [
      { value: "paste", label: t("mode_paste"), icon: ClipboardPaste },
      { value: "library", label: t("mode_library"), icon: Library },
    ],
    [t]
  )
  const options = useMemo<SelectOption<ID>[]>(
    () =>
      items
        .filter((r) => r.status !== "archived" || r.id === currentId)
        .sort((a, b) => Number(Boolean(b.analysis)) - Number(Boolean(a.analysis)) || b.created_at.localeCompare(a.created_at))
        .map((r) => {
          const Icon = RESEARCH_TYPE_ICONS[r.type]
          return { value: r.id, label: r.title || t("untitled_reference"), icon: <Icon className="text-muted-foreground" aria-hidden /> }
        }),
    [items, currentId, t]
  )
  const chars = pasted.content.trim().length
  const urlError = pasted.url.trim() && !isHttpUrl(pasted.url) ? t("error_url") : undefined

  return (
    <StepCard
      step={1}
      state={state}
      title={t("reference")}
      description={t("reference_description")}
      action={<ViewToggle value={mode} onChange={onModeChange} options={modeOptions} aria-label={t("source_aria")} />}
    >
      {mode === "paste" ? (
        <div className="flex min-w-0 flex-col gap-4">
          <FormField
            label={t("reference_text")}
            htmlFor={field("content")}
            required
            description={t("reference_text_description")}
            error={chars > 0 && chars < MIN_REFERENCE_CHARS ? t("error_min", { min: MIN_REFERENCE_CHARS }) : undefined}
          >
            <Textarea
              id={field("content")}
              rows={6}
              className="min-h-32"
              value={pasted.content}
              maxLength={15000}
              placeholder={t("reference_text_placeholder")}
              onChange={(event) => onPastedChange({ content: event.target.value })}
            />
          </FormField>
          <FormRow>
            <FormField label={t("title")} htmlFor={field("title")} description={t("title_description")}>
              <Input id={field("title")} value={pasted.title} maxLength={300} onChange={(event) => onPastedChange({ title: event.target.value })} />
            </FormField>
            <FormField label={t("creator")} htmlFor={field("creator")} description={t("creator_description")}>
              <Input id={field("creator")} value={pasted.creator} maxLength={120} onChange={(event) => onPastedChange({ creator: event.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label={t("platform")} htmlFor={field("platform")}>
              <PlatformSelect id={field("platform")} allowNone value={pasted.platform} onChange={(platform) => onPastedChange({ platform })} />
            </FormField>
            <FormField label={t("type")} htmlFor={field("type")}>
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
          <FormField label={t("url")} htmlFor={field("url")} error={urlError}>
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
          <FormField label={t("reference")} htmlFor={field("library")}>
            <OptionSelect
              id={field("library")}
              options={options}
              value={currentId}
              onChange={onSelect}
              placeholder={t("choose_reference")}
              emptyText={t("library_empty")}
            />
          </FormField>
          {libraryItem ? <LibrarySummary item={libraryItem} /> : null}
        </div>
      )}
    </StepCard>
  )
}

function LibrarySummary({ item }: { item: ResearchItem }) {
  const t = useT(adaptMessages)
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
            {t("open_in_library")}
          </Link>
        </Button>
      </div>
      {byline ? <p className="text-xs text-muted-foreground">{byline}</p> : null}
      {item.topic ? (
        <p className="text-sm">
          <span className="text-muted-foreground">{t("topic_prefix")}</span>
          {item.topic}
        </p>
      ) : null}
      {item.why_attention ? <p className="text-sm text-pretty text-muted-foreground">{item.why_attention}</p> : null}
      {noText ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("no_text")}
        </p>
      ) : null}
    </div>
  )
}
