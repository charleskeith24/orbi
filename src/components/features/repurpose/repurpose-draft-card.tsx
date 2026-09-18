"use client"

import { ArrowUpRight, CircleCheck, Lightbulb, Plus, X } from "lucide-react"
import Link from "next/link"
import { useId } from "react"
import { CopyButton, PlatformIcon, PlatformSelect, ProviderBadge, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { translate, useT, useUiLang, type UiLang } from "@/lib/i18n"
import { PLATFORMS, REPURPOSE_TYPES, SCRIPT_FORMATS } from "@/lib/constants"
import type { AiProviderId, ID, PlatformId, RepurposeType, ScriptSection } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { repurposeMessages } from "./messages"
import { countWords, sectionsText } from "./repurpose-model"

export type DraftOrigin = { kind: "ai"; provider: AiProviderId; model: string } | { kind: "suggestion"; rowId: ID }

/** An editable repurposed asset that isn't a content item yet. */
export interface RepurposeDraft {
  type: RepurposeType
  title: string
  platform: PlatformId
  sections: ScriptSection[]
  origin: DraftOrigin
  /** Set once "Create content item" succeeded. */
  createdItemId: ID | null
  edited: boolean
}

export function draftIssues(draft: Pick<RepurposeDraft, "title" | "sections">, lang: UiLang = "en"): { title: string | null; body: string | null } {
  return {
    title: draft.title.trim() ? null : translate(repurposeMessages, lang, "add_title"),
    body: draft.sections.some((s) => s.content.trim()) ? null : translate(repurposeMessages, lang, "write_section"),
  }
}

export function DraftSkeleton({ type }: { type: RepurposeType }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <span className="text-sm text-muted-foreground">{REPURPOSE_TYPES[type].label}</span>
        <Skeleton className="ml-auto h-5 w-28" />
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}

/** Generated (or reopened) asset: editable title, platform and sections, then create or save. */
export function RepurposeDraftCard({
  draft,
  regenerating = false,
  onChange,
  onCreate,
  onSaveSuggestion,
  onDiscard,
}: {
  draft: RepurposeDraft
  regenerating?: boolean
  onChange: (patch: Partial<Pick<RepurposeDraft, "title" | "platform" | "sections">>) => void
  onCreate: () => void
  onSaveSuggestion: () => void
  onDiscard: () => void
}) {
  const t = useT(repurposeMessages)
  const lang = useUiLang()
  const id = useId()
  const spec = REPURPOSE_TYPES[draft.type]
  const issues = draftIssues(draft, lang)
  const text = sectionsText(draft.sections)

  if (draft.createdItemId) {
    return (
      <article className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2.5">
        <StatusPill tone="good" icon={CircleCheck}>
          {t("created")}
        </StatusPill>
        <PlatformIcon platform={draft.platform} label className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm" title={draft.title}>
          {draft.title}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/studio/${draft.createdItemId}`}>
              {t("open_in_studio")}
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={t("remove_from_list")} onClick={onDiscard}>
            <X aria-hidden />
          </Button>
        </span>
      </article>
    )
  }

  return (
    <article
      aria-labelledby={`${id}-heading`}
      aria-busy={regenerating || undefined}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-opacity", regenerating && "opacity-60")}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-2">
        <PlatformIcon platform={draft.platform} className="size-4 text-muted-foreground" />
        <h4 id={`${id}-heading`} className="min-w-0 truncate text-sm font-medium">
          {spec.label}
        </h4>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {PLATFORMS[draft.platform].label} · {SCRIPT_FORMATS[spec.scriptFormat].label}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {draft.edited ? <span className="mr-1 text-xs text-muted-foreground">{t("edited")}</span> : null}
          {draft.origin.kind === "ai" ? (
            <ProviderBadge provider={draft.origin.provider} model={draft.origin.model} />
          ) : (
            <StatusPill tone="neutral" icon={Lightbulb}>
              {t("saved_suggestion_pill")}
            </StatusPill>
          )}
          <CopyButton text={`${draft.title.trim()}\n\n${text}`.trim()} successMessage={t("draft_copied")} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t("discard_draft", { type: spec.label })}
            onClick={onDiscard}
          >
            <X aria-hidden />
          </Button>
        </span>
      </header>

      <div className="flex min-w-0 flex-col gap-3 p-3">
        <div className={cn("grid min-w-0 gap-3", !spec.platform && "@xl:grid-cols-[minmax(0,1fr)_12rem]")}>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${id}-title`} className="text-xs font-medium text-muted-foreground">
              {t("title")}
            </label>
            <Input
              id={`${id}-title`}
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              aria-invalid={Boolean(issues.title) || undefined}
              aria-describedby={issues.title ? `${id}-title-error` : undefined}
            />
            {issues.title ? (
              <p id={`${id}-title-error`} className="text-xs text-critical-fg">
                {issues.title}
              </p>
            ) : null}
          </div>
          {!spec.platform ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("platform")}</span>
              <PlatformSelect
                value={draft.platform}
                onChange={(p) => p && onChange({ platform: p })}
                aria-label={t("platform_for", { type: spec.label })}
              />
            </div>
          ) : null}
        </div>

        {draft.sections.map((section, index) => (
          <div key={section.key} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`${id}-section-${index}`} className="text-xs font-medium text-muted-foreground">
              {section.label}
            </label>
            <Textarea
              id={`${id}-section-${index}`}
              value={section.content}
              rows={1}
              onChange={(e) =>
                onChange({ sections: draft.sections.map((s, i) => (i === index ? { ...s, content: e.target.value } : s)) })
              }
              className="min-h-9 resize-none"
            />
          </div>
        ))}
        {issues.body ? <p className="text-xs text-critical-fg">{issues.body}</p> : null}
      </div>

      <footer className="flex min-w-0 flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground num">{t.plural("words", countWords(text), { count: formatNumber(countWords(text)) })}</span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSaveSuggestion} disabled={Boolean(issues.title) || regenerating}>
            <Lightbulb aria-hidden />
            {t("save_as_suggestion")}
          </Button>
          <Button type="button" size="sm" onClick={onCreate} disabled={Boolean(issues.title || issues.body) || regenerating}>
            <Plus aria-hidden />
            {t("create_item")}
          </Button>
        </span>
      </footer>
    </article>
  )
}
