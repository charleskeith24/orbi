"use client"

import { BookmarkPlus, ChevronDown, ChevronRight, X } from "lucide-react"
import { useId } from "react"
import { AiButton, AiNotice, ProviderBadge, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { ContentIdea } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { GeneratedIdeaCard, type DraftLookups } from "./generated-idea-card"
import {
  clampCount,
  describeBrief,
  timeAgo,
  titleKey,
  type BriefDb,
  type GeneratedBatch,
  type GeneratedDraft,
  type GeneratorBrief,
} from "./generator-model"

export interface PendingJob {
  origin: string
  kind: "brief" | "more"
  brief: GeneratorBrief
  sourceTitle: string | null
}

const selectableDrafts = (batch: GeneratedBatch) => batch.drafts.filter((d) => !d.saved_idea_id && d.title.trim())

/** Batches of generated ideas (newest first), a pending placeholder and the selection bar. */
export function GeneratorResults({
  batches,
  job,
  isOpen,
  onToggle,
  lookups,
  db,
  selected,
  onSelectedChange,
  onSelectBatch,
  onSelectAll,
  onClearSelection,
  onSaveSelected,
  onSaveOne,
  onEdit,
  onMore,
  onRegenerate,
  onDismiss,
  onClearAll,
  aiBusy,
  ideaTitles,
  now,
}: {
  batches: GeneratedBatch[]
  job: PendingJob | null
  isOpen: (batch: GeneratedBatch, index: number) => boolean
  onToggle: (batch: GeneratedBatch, open: boolean) => void
  lookups: DraftLookups
  db: BriefDb
  selected: Set<string>
  onSelectedChange: (key: string, selected: boolean) => void
  onSelectBatch: (batch: GeneratedBatch, selected: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onSaveSelected: () => void
  onSaveOne: (batch: GeneratedBatch, draft: GeneratedDraft) => void
  onEdit: (key: string, patch: Partial<GeneratedDraft>) => void
  onMore: (batch: GeneratedBatch, draft: GeneratedDraft) => void
  onRegenerate: (batch: GeneratedBatch) => void
  onDismiss: (batch: GeneratedBatch) => void
  onClearAll: () => void
  aiBusy: boolean
  /** Idea Bank titles (titleKey → idea) for duplicate warnings. */
  ideaTitles: Map<string, ContentIdea>
  now: Date
}) {
  const total = batches.reduce((n, b) => n + b.drafts.length, 0)
  const savedCount = batches.reduce((n, b) => n + b.drafts.filter((d) => d.saved_idea_id).length, 0)
  const selectedCount = batches.reduce((n, b) => n + b.drafts.filter((d) => selected.has(d.key) && !d.saved_idea_id).length, 0)
  const selectableOpen = batches.some((b, i) => isOpen(b, i) && selectableDrafts(b).length > 0)

  return (
    <section aria-label="Generated ideas" className="flex min-w-0 flex-col gap-5">
      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">Results</h2>
        {total ? (
          <span className="text-xs text-muted-foreground num" aria-live="polite">
            {total} {total === 1 ? "idea" : "ideas"}
            {savedCount ? ` · ${savedCount} saved` : ""}
          </span>
        ) : null}
        {batches.length ? (
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={!selectableOpen} onClick={onSelectAll}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onClearAll}>
              <X aria-hidden />
              Clear results
            </Button>
          </div>
        ) : null}
      </div>

      {job ? <PendingBatch job={job} db={db} /> : null}

      {batches.map((batch, index) => (
        <BatchSection
          key={batch.id}
          batch={batch}
          open={isOpen(batch, index)}
          onToggle={(open) => onToggle(batch, open)}
          lookups={lookups}
          db={db}
          selected={selected}
          onSelectedChange={onSelectedChange}
          onSelectBatch={onSelectBatch}
          onSaveOne={onSaveOne}
          onEdit={onEdit}
          onMore={onMore}
          onRegenerate={onRegenerate}
          onDismiss={onDismiss}
          aiBusy={aiBusy}
          pendingOrigin={job?.origin ?? null}
          ideaTitles={ideaTitles}
          now={now}
        />
      ))}

      {selectedCount ? (
        <div
          role="region"
          aria-label="Selected ideas"
          className="sticky bottom-3 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
        >
          <span className="text-sm num">{selectedCount} selected</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
          <Button type="button" size="sm" onClick={onSaveSelected}>
            <BookmarkPlus aria-hidden />
            Save {selectedCount} to Idea Bank
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function BatchTitle({ batch }: { batch: GeneratedBatch }) {
  if (batch.kind === "more") return <>More like “{truncate(batch.sourceTitle ?? "this idea", 64)}”</>
  if (batch.kind === "restored") return <>Restored from Recent generations</>
  return <>Generated ideas</>
}

function BatchSection({
  batch,
  open,
  onToggle,
  lookups,
  db,
  selected,
  onSelectedChange,
  onSelectBatch,
  onSaveOne,
  onEdit,
  onMore,
  onRegenerate,
  onDismiss,
  aiBusy,
  pendingOrigin,
  ideaTitles,
  now,
}: {
  batch: GeneratedBatch
  open: boolean
  onToggle: (open: boolean) => void
  lookups: DraftLookups
  db: BriefDb
  selected: Set<string>
  onSelectedChange: (key: string, selected: boolean) => void
  onSelectBatch: (batch: GeneratedBatch, selected: boolean) => void
  onSaveOne: (batch: GeneratedBatch, draft: GeneratedDraft) => void
  onEdit: (key: string, patch: Partial<GeneratedDraft>) => void
  onMore: (batch: GeneratedBatch, draft: GeneratedDraft) => void
  onRegenerate: (batch: GeneratedBatch) => void
  onDismiss: (batch: GeneratedBatch) => void
  aiBusy: boolean
  pendingOrigin: string | null
  ideaTitles: Map<string, ContentIdea>
  now: Date
}) {
  const headingId = useId()
  const bodyId = useId()
  const parts = describeBrief(batch.brief, db)
  const selectable = selectableDrafts(batch)
  const allSelected = selectable.length > 0 && selectable.every((d) => selected.has(d.key))
  const requested = clampCount(batch.requested)
  const fewer = batch.drafts.length < requested

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2 border-b pb-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => onToggle(!open)}
            className="-ml-1 flex min-w-0 items-center gap-1 rounded-md px-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {open ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <h3 id={headingId} className="min-w-0 truncate text-sm font-medium">
              <BatchTitle batch={batch} />
            </h3>
          </button>
          <span className="text-xs text-muted-foreground num">
            {batch.drafts.length}
            {fewer ? ` of ${requested}` : ""} {batch.drafts.length === 1 && !fewer ? "idea" : "ideas"}
          </span>
          <ProviderBadge provider={batch.provider} model={batch.model || undefined} />
          <span className="text-xs text-muted-foreground">{timeAgo(batch.createdAt, now)}</span>
          <div className="ml-auto flex items-center gap-0.5">
            {open && selectable.length ? (
              <Button type="button" variant="ghost" size="xs" onClick={() => onSelectBatch(batch, !allSelected)}>
                {allSelected ? "Deselect" : "Select batch"}
              </Button>
            ) : null}
            <AiButton
              type="button"
              variant="ghost"
              size="xs"
              pending={pendingOrigin === `batch:${batch.id}`}
              pendingLabel="Regenerating…"
              disabled={aiBusy}
              title="Run this brief again — the new batch appears above"
              onClick={() => onRegenerate(batch)}
            >
              Regenerate
            </AiButton>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label="Dismiss this batch"
              title="Dismiss — bring it back from Recent generations"
              onClick={() => onDismiss(batch)}
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {parts.length ? (
            parts.map((part) => (
              <Token key={part} className="font-normal text-muted-foreground">
                <span className="truncate">{part}</span>
              </Token>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Balanced across your pillars, audiences and funnel stages</span>
          )}
        </div>
        {batch.trimmed ? (
          <AiNotice>Restored from the AI log, which keeps a shortened copy of large batches — review the text before saving.</AiNotice>
        ) : fewer ? (
          <AiNotice>
            {batch.provider === "offline"
              ? `The offline templates found ${batch.drafts.length} distinct ${batch.drafts.length === 1 ? "idea" : "ideas"} for this brief. Loosen a filter or add a topic for more.`
              : `The model returned ${batch.drafts.length} of ${requested} ideas — regenerate for more.`}
          </AiNotice>
        ) : null}
      </div>

      {open ? (
        batch.drafts.length ? (
          <div id={bodyId} className="grid min-w-0 gap-3 xl:grid-cols-2">
            {batch.drafts.map((draft) => (
              <GeneratedIdeaCard
                key={draft.key}
                draft={draft}
                lookups={lookups}
                selected={selected.has(draft.key)}
                onSelectedChange={onSelectedChange}
                onSave={(d) => onSaveOne(batch, d)}
                onEdit={onEdit}
                onMore={(d) => onMore(batch, d)}
                morePending={pendingOrigin === `draft:${draft.key}`}
                aiBusy={aiBusy}
                duplicate={draft.saved_idea_id ? undefined : ideaTitles.get(titleKey(draft.title))}
              />
            ))}
          </div>
        ) : (
          <p id={bodyId} className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No ideas came back for this brief. Loosen a filter or add a topic, then regenerate.
          </p>
        )
      ) : null}
    </section>
  )
}

function PendingBatch({ job, db }: { job: PendingJob; db: BriefDb }) {
  const count = clampCount(job.brief.count)
  const parts = job.kind === "brief" ? describeBrief(job.brief, db) : []
  return (
    <section aria-label="Generating ideas" aria-busy="true" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b pb-2.5 text-sm">
        <Spinner className="text-brand" />
        <span className="font-medium">
          {job.kind === "more" ? `Finding ${count} more like “${truncate(job.sourceTitle ?? "this idea", 56)}”…` : `Generating ${count} ${count === 1 ? "idea" : "ideas"}…`}
        </span>
        {parts.length ? <span className="min-w-0 truncate text-xs text-muted-foreground">{parts.join(" · ")}</span> : null}
      </div>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        {Array.from({ length: Math.min(count, 2) }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </section>
  )
}
