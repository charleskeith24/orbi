"use client"

import { BookmarkPlus, ExternalLink, FilePlus2, PenLine, ShieldCheck, Star } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import {
  AiButton,
  AiNotice,
  CopyButton,
  FormatSelect,
  FormField,
  ListEditor,
  OptionSelect,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  ProviderBadge,
  StatusPill,
  type SelectOption,
} from "@/components/common"
import { AiErrorNotice } from "@/components/features/stories/ai-error"
import { angleCopyText } from "@/components/features/stories/angle-model"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { adaptMessages } from "./adapt-messages"
import type { AdaptTargets, OriginalDraft } from "./adapt-model"
import { StepCard, type StepState } from "./step-card"

const LABEL = "text-[11px] leading-4 font-medium tracking-wide text-muted-foreground uppercase"

/** Step 3: targets (pillar, persona, platform, format, story, topic) → adapt_reference → an editable original. */
export function AdaptOriginalStep({
  state,
  targets,
  onTargetsChange,
  canGenerate,
  pending,
  error,
  onGenerate,
  original,
  onOriginalChange,
  savedIdeaId,
  itemId,
  onSaveIdea,
  onCreateContent,
  referenceAction,
}: {
  state: StepState
  targets: AdaptTargets
  onTargetsChange: (patch: Partial<AdaptTargets>) => void
  canGenerate: boolean
  pending: boolean
  error: string | null
  onGenerate: () => void
  original: OriginalDraft | null
  onOriginalChange: (patch: Partial<OriginalDraft>) => void
  savedIdeaId: ID | null
  itemId: ID | null
  onSaveIdea: () => void
  onCreateContent: () => void
  referenceAction: React.ReactNode
}) {
  const t = useT(adaptMessages)
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const stories = useTable("stories")
  const storyOptions = useMemo<SelectOption<ID>[]>(
    () =>
      [...stories]
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.title.localeCompare(b.title))
        .map((s) => ({
          value: s.id,
          label: s.title || t("untitled_story"),
          icon: s.is_favorite ? <Star className="fill-current text-muted-foreground" aria-hidden /> : undefined,
        })),
    [stories, t]
  )

  return (
    <StepCard
      step={3}
      state={state}
      title={t("original_version")}
      description={t("original_description")}
    >
      {state === "locked" ? (
        <p>{t("locked_step2")}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={t("content_pillar")} htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={targets.pillarId} onChange={(pillarId) => onTargetsChange({ pillarId })} />
            </FormField>
            <FormField label={t("persona")} htmlFor={field("persona")}>
              <PersonaSelect id={field("persona")} allowNone value={targets.personaId} onChange={(personaId) => onTargetsChange({ personaId })} />
            </FormField>
            <FormField label={t("platform")} htmlFor={field("platform")}>
              <PlatformSelect
                id={field("platform")}
                value={targets.platform}
                onChange={(platform) => {
                  if (platform) onTargetsChange({ platform })
                }}
              />
            </FormField>
            <FormField label={t("format")} htmlFor={field("format")}>
              <FormatSelect id={field("format")} allowNone value={targets.formatId} onChange={(formatId) => onTargetsChange({ formatId })} />
            </FormField>
            <FormField label={t("story_optional")} htmlFor={field("story")} className="sm:col-span-2 lg:col-span-2">
              <OptionSelect
                id={field("story")}
                options={storyOptions}
                allowNone
                noneLabel={t("no_story")}
                placeholder={t("story_placeholder")}
                value={targets.storyId}
                onChange={(storyId) => onTargetsChange({ storyId })}
                emptyText={t("story_empty")}
              />
            </FormField>
          </div>
          <FormField
            label={t("what_to_say")}
            htmlFor={field("topic")}
            description={t("what_to_say_description")}
          >
            <Input id={field("topic")} value={targets.topic} maxLength={500} onChange={(event) => onTargetsChange({ topic: event.target.value })} />
          </FormField>
          <div className="flex flex-wrap items-center gap-2">
            <AiButton
              type="button"
              size="sm"
              variant={original ? "outline" : "default"}
              pending={pending}
              pendingLabel={t("writing")}
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              {original ? t("regenerate") : t("create_original")}
            </AiButton>
          </div>
          {error ? <AiErrorNotice message={error} retryLabel={t("retry")} onRetry={onGenerate} /> : null}
          {original ? (
            <div className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={LABEL}>{t("your_original")}</span>
                <ProviderBadge provider={original.provider} model={original.model ?? undefined} />
                {original.edited ? <StatusPill icon={PenLine}>{t("edited")}</StatusPill> : null}
              </div>
              <FormField label={t("title")} htmlFor={field("title")} required error={original.title.trim() ? undefined : t("error_title")}>
                <Input
                  id={field("title")}
                  value={original.title}
                  maxLength={300}
                  aria-invalid={!original.title.trim() || undefined}
                  onChange={(event) => onOriginalChange({ title: event.target.value })}
                />
              </FormField>
              <FormField label={t("hook")} htmlFor={field("hook")}>
                <Textarea id={field("hook")} rows={2} className="min-h-14" value={original.hook} onChange={(event) => onOriginalChange({ hook: event.target.value })} />
              </FormField>
              <FormField label={t("outline")} description={t("outline_description")}>
                <ListEditor
                  variant="lines"
                  value={original.outline}
                  onChange={(outline) => onOriginalChange({ outline })}
                  maxItems={12}
                  addLabel={t("add_beat")}
                  placeholder={t("beat_placeholder")}
                  aria-label={t("outline")}
                />
              </FormField>
              <FormField label={t("draft")} htmlFor={field("draft")}>
                <Textarea id={field("draft")} rows={12} className="min-h-56" value={original.draft} onChange={(event) => onOriginalChange({ draft: event.target.value })} />
              </FormField>
              <div role="note" className="flex items-start gap-2.5 rounded-md border bg-muted/30 px-3 py-2.5 dark:bg-muted/15">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{t("originality_note")}</p>
                  <p className="text-sm text-pretty text-muted-foreground">{original.originality_note || "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {savedIdeaId ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={`/ideas?open=${savedIdeaId}`}>
                      <ExternalLink aria-hidden />
                      {t("open_idea")}
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled={!original.title.trim()} onClick={onSaveIdea}>
                    <BookmarkPlus aria-hidden />
                    {t("save_as_idea")}
                  </Button>
                )}
                {itemId ? (
                  <Button type="button" size="sm" asChild>
                    <Link href={`/studio/${itemId}`}>
                      <ExternalLink aria-hidden />
                      {t("open_in_studio")}
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" size="sm" disabled={!original.title.trim()} onClick={onCreateContent}>
                    <FilePlus2 aria-hidden />
                    {t("create_content")}
                  </Button>
                )}
                <CopyButton text={angleCopyText(original)} label={t("copy_draft")} successMessage={t("draft_copied")} />
                <div className="ml-auto">{referenceAction}</div>
              </div>
              <AiNotice>{t("original_notice")}</AiNotice>
            </div>
          ) : null}
        </div>
      )}
    </StepCard>
  )
}
