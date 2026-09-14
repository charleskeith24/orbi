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
import { useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
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
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const stories = useTable("stories")
  const storyOptions = useMemo<SelectOption<ID>[]>(
    () =>
      [...stories]
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.title.localeCompare(b.title))
        .map((s) => ({
          value: s.id,
          label: s.title || "Untitled story",
          icon: s.is_favorite ? <Star className="fill-current text-muted-foreground" aria-hidden /> : undefined,
        })),
    [stories]
  )

  return (
    <StepCard
      step={3}
      state={state}
      title="Original version"
      description="For your audience, from your expertise and stories, in your voice. Only the structure and psychology are borrowed."
    >
      {state === "locked" ? (
        <p>Analyze the reference in step 2 first.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Content Pillar" htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={targets.pillarId} onChange={(pillarId) => onTargetsChange({ pillarId })} />
            </FormField>
            <FormField label="Persona" htmlFor={field("persona")}>
              <PersonaSelect id={field("persona")} allowNone value={targets.personaId} onChange={(personaId) => onTargetsChange({ personaId })} />
            </FormField>
            <FormField label="Platform" htmlFor={field("platform")}>
              <PlatformSelect
                id={field("platform")}
                value={targets.platform}
                onChange={(platform) => {
                  if (platform) onTargetsChange({ platform })
                }}
              />
            </FormField>
            <FormField label="Format" htmlFor={field("format")}>
              <FormatSelect id={field("format")} allowNone value={targets.formatId} onChange={(formatId) => onTargetsChange({ formatId })} />
            </FormField>
            <FormField label="Story (optional)" htmlFor={field("story")} className="sm:col-span-2 lg:col-span-2">
              <OptionSelect
                id={field("story")}
                options={storyOptions}
                allowNone
                noneLabel="No story"
                placeholder="Weave in a Story Vault story"
                value={targets.storyId}
                onChange={(storyId) => onTargetsChange({ storyId })}
                emptyText="Your Story Vault is empty."
              />
            </FormField>
          </div>
          <FormField
            label="What do you want to say?"
            htmlFor={field("topic")}
            description="Optional — your point, in your own words. Leave it empty and your audience's problems lead."
          >
            <Input id={field("topic")} value={targets.topic} maxLength={500} onChange={(event) => onTargetsChange({ topic: event.target.value })} />
          </FormField>
          <div className="flex flex-wrap items-center gap-2">
            <AiButton
              type="button"
              size="sm"
              variant={original ? "outline" : "default"}
              pending={pending}
              pendingLabel="Writing your version…"
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              {original ? "Regenerate original" : "Create original version"}
            </AiButton>
          </div>
          {error ? <AiErrorNotice message={error} onRetry={onGenerate} /> : null}
          {original ? (
            <div className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={LABEL}>Your original</span>
                <ProviderBadge provider={original.provider} model={original.model ?? undefined} />
                {original.edited ? <StatusPill icon={PenLine}>Edited</StatusPill> : null}
              </div>
              <FormField label="Title" htmlFor={field("title")} required error={original.title.trim() ? undefined : "Give it a title."}>
                <Input
                  id={field("title")}
                  value={original.title}
                  maxLength={300}
                  aria-invalid={!original.title.trim() || undefined}
                  onChange={(event) => onOriginalChange({ title: event.target.value })}
                />
              </FormField>
              <FormField label="Hook" htmlFor={field("hook")}>
                <Textarea id={field("hook")} rows={2} className="min-h-14" value={original.hook} onChange={(event) => onOriginalChange({ hook: event.target.value })} />
              </FormField>
              <FormField label="Outline" description="Each borrowed beat, filled with your own substance.">
                <ListEditor
                  variant="lines"
                  value={original.outline}
                  onChange={(outline) => onOriginalChange({ outline })}
                  maxItems={12}
                  addLabel="Add beat"
                  placeholder="A beat of your piece"
                  aria-label="Outline"
                />
              </FormField>
              <FormField label="Draft" htmlFor={field("draft")}>
                <Textarea id={field("draft")} rows={12} className="min-h-56" value={original.draft} onChange={(event) => onOriginalChange({ draft: event.target.value })} />
              </FormField>
              <div role="note" className="flex items-start gap-2.5 rounded-md border bg-muted/30 px-3 py-2.5 dark:bg-muted/15">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-medium">Originality note</p>
                  <p className="text-sm text-pretty text-muted-foreground">{original.originality_note || "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {savedIdeaId ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={`/ideas?open=${savedIdeaId}`}>
                      <ExternalLink aria-hidden />
                      Open idea
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled={!original.title.trim()} onClick={onSaveIdea}>
                    <BookmarkPlus aria-hidden />
                    Save as idea
                  </Button>
                )}
                {itemId ? (
                  <Button type="button" size="sm" asChild>
                    <Link href={`/studio/${itemId}`}>
                      <ExternalLink aria-hidden />
                      Open in Studio
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" size="sm" disabled={!original.title.trim()} onClick={onCreateContent}>
                    <FilePlus2 aria-hidden />
                    Create content
                  </Button>
                )}
                <CopyButton text={angleCopyText(original)} label="Copy draft" successMessage="Draft copied" />
                <div className="ml-auto">{referenceAction}</div>
              </div>
              <AiNotice>Built on the reference&apos;s structure and your own substance. Edit it until it sounds like you before you post it.</AiNotice>
            </div>
          ) : null}
        </div>
      )}
    </StepCard>
  )
}
