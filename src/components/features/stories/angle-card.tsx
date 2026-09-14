"use client"

import { BookmarkPlus, ChevronRight, CircleCheck, ExternalLink, FilePlus2, PenLine, Pencil } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { CopyButton, PillarBadge, PlatformIcon, StatusPill, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PLATFORMS } from "@/lib/constants"
import type { ContentPillar, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AngleEditor } from "./angle-editor"
import { ANGLE_META, angleCopyText, type AngleDraft } from "./angle-model"

const LABEL = "text-[11px] leading-4 font-medium tracking-wide text-muted-foreground uppercase"

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  )
}

export interface AngleCardProps {
  draft: AngleDraft
  pillars: ReadonlyMap<ID, ContentPillar>
  selected?: boolean
  /** Omit to hide the selection checkbox. */
  onSelectedChange?: (selected: boolean) => void
  onChange: (patch: Partial<AngleDraft>) => void
  onSave: () => void
  onCreate: () => void
  className?: string
}

/** One Experience → Content angle: hook, outline and expandable draft; save as idea, create content, copy, edit. */
export function AngleCard({ draft, pillars, selected = false, onSelectedChange, onChange, onSave, onCreate, className }: AngleCardProps) {
  const titleId = useId()
  const [editing, setEditing] = useState(false)
  const [showDraft, setShowDraft] = useState(false)
  const meta = ANGLE_META[draft.type]
  const pillar = draft.pillar_id ? pillars.get(draft.pillar_id) : undefined
  const saved = Boolean(draft.ideaId)
  const title = draft.title.trim() || "Untitled angle"
  const canSave = Boolean(draft.title.trim())

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-xs transition-[border-color,box-shadow]",
        selected && "border-brand/50 ring-1 ring-brand/30",
        className
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5">
        {onSelectedChange ? (
          <Checkbox
            checked={selected}
            disabled={saved || editing || !canSave}
            onCheckedChange={(value) => onSelectedChange(value === true)}
            aria-label={saved ? `“${title}” is saved to the Idea Bank` : `Select “${title}”`}
            className="mt-0.5"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className={LABEL}>{meta.label}</p>
          <h3 id={titleId} className="mt-0.5 text-sm leading-snug font-medium text-pretty break-words">
            {title}
          </h3>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
            <Token className="font-normal">
              <PlatformIcon platform={draft.platform} className="text-muted-foreground" />
              {PLATFORMS[draft.platform]?.label ?? draft.platform}
            </Token>
            {draft.format ? (
              <Token className="max-w-44 font-normal text-muted-foreground">
                <span className="truncate">{draft.format}</span>
              </Token>
            ) : null}
            {pillar ? <PillarBadge pillar={pillar} /> : null}
            {draft.itemId ? (
              <StatusPill tone="good" icon={CircleCheck}>
                Content created
              </StatusPill>
            ) : saved ? (
              <StatusPill tone="good" icon={CircleCheck}>
                Saved as idea
              </StatusPill>
            ) : draft.edited ? (
              <StatusPill icon={PenLine}>Edited</StatusPill>
            ) : null}
          </div>
        </div>
      </header>

      {editing ? (
        <AngleEditor
          draft={draft}
          onCancel={() => setEditing(false)}
          onDone={(patch) => {
            onChange({ ...patch, edited: true })
            setEditing(false)
          }}
        />
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4 text-sm">
            {draft.hook ? (
              <Section label="Hook">
                <p className="text-pretty">“{draft.hook}”</p>
              </Section>
            ) : null}
            {draft.outline.length ? (
              <Section label="Outline">
                <ol className="flex list-decimal flex-col gap-1 pl-4 text-pretty marker:text-muted-foreground">
                  {draft.outline.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </Section>
            ) : null}
            {draft.draft ? (
              <Collapsible open={showDraft} onOpenChange={setShowDraft} className="flex min-w-0 flex-col gap-1.5">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="xs" className="-ml-2 w-fit text-muted-foreground">
                    <ChevronRight className={cn("transition-transform", showDraft && "rotate-90")} aria-hidden />
                    {showDraft ? "Hide draft" : "Show draft"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap scrollbar-thin dark:bg-muted/15">
                    {draft.draft}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
          <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
            {saved ? (
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/ideas?open=${draft.ideaId}`}>
                  <ExternalLink aria-hidden />
                  Open idea
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={!canSave} onClick={onSave}>
                <BookmarkPlus aria-hidden />
                Save as idea
              </Button>
            )}
            {draft.itemId ? (
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/studio/${draft.itemId}`}>
                  <ExternalLink aria-hidden />
                  Open in Studio
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={!canSave} onClick={onCreate}>
                <FilePlus2 aria-hidden />
                Create content
              </Button>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <CopyButton text={angleCopyText(draft)} successMessage="Draft copied" />
              {saved ? null : (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden />
                  Edit
                </Button>
              )}
            </div>
          </footer>
        </>
      )}
    </article>
  )
}
