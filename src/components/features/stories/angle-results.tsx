"use client"

import { BookmarkPlus } from "lucide-react"
import { useState } from "react"
import { AiButton, AiNotice, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useLookup } from "@/lib/store"
import { cn, pluralize } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error"
import { AngleCard } from "./angle-card"
import type { AngleOrigin } from "./angle-model"
import { updateAngleDraft, useAngleSession } from "./angle-store"
import { useAngleActions } from "./use-angle-actions"

/**
 * The angles of one experience_to_content session: bulk select + save, regenerate (previous drafts
 * stay visible), inline error with retry, and the cards themselves.
 */
export function AngleResults({
  sessionKey,
  origin,
  canRegenerate,
  onRegenerate,
  columns = 1,
  notice,
}: {
  sessionKey: string
  origin: AngleOrigin
  canRegenerate: boolean
  onRegenerate: () => void
  columns?: 1 | 2
  notice: string
}) {
  const session = useAngleSession(sessionKey)
  const pillars = useLookup("content_pillars")
  const actions = useAngleActions(sessionKey, origin)
  const [selected, setSelected] = useState<string[]>([])
  const pending = session.status === "pending"
  const drafts = session.drafts
  const unsaved = drafts.filter((d) => !d.ideaId && d.title.trim())
  const chosen = unsaved.filter((d) => selected.includes(d.key))
  const allChosen = unsaved.length > 0 && chosen.length === unsaved.length

  function regenerate() {
    setSelected([])
    onRegenerate()
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
        {unsaved.length ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allChosen ? true : chosen.length ? "indeterminate" : false}
              onCheckedChange={(value) => setSelected(value === true ? unsaved.map((d) => d.key) : [])}
              aria-label="Select all unsaved angles"
            />
            Select all
          </label>
        ) : null}
        <span className="text-xs text-muted-foreground num">{drafts.length ? pluralize(drafts.length, "content angle") : "Writing your angles…"}</span>
        {session.provider && drafts.length ? <ProviderBadge provider={session.provider} model={session.model ?? undefined} /> : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!chosen.length}
            onClick={() => {
              actions.saveMany(chosen)
              setSelected([])
            }}
          >
            <BookmarkPlus aria-hidden />
            {chosen.length ? `Save ${chosen.length} as idea${chosen.length === 1 ? "" : "s"}` : "Save selected"}
          </Button>
          <AiButton type="button" size="sm" variant="ghost" pending={pending} disabled={!canRegenerate} onClick={regenerate}>
            Regenerate
          </AiButton>
        </div>
      </div>

      {session.error ? <AiErrorNotice message={session.error} onRetry={regenerate} /> : null}

      <div className={cn("grid min-w-0 gap-3", columns === 2 && "md:grid-cols-2")}>
        {drafts.length
          ? drafts.map((draft) => (
              <AngleCard
                key={draft.key}
                draft={draft}
                pillars={pillars}
                selected={selected.includes(draft.key)}
                onSelectedChange={(value) => setSelected((keys) => (value ? [...keys, draft.key] : keys.filter((k) => k !== draft.key)))}
                onChange={(patch) => updateAngleDraft(sessionKey, draft.key, patch)}
                onSave={() => {
                  actions.save(draft)
                  setSelected((keys) => keys.filter((k) => k !== draft.key))
                }}
                onCreate={() => actions.create(draft)}
              />
            ))
          : Array.from({ length: columns === 2 ? 4 : 3 }, (_, index) => <Skeleton key={index} className="h-48 w-full rounded-lg" aria-hidden />)}
      </div>

      {drafts.length ? <AiNotice>{notice}</AiNotice> : null}
    </div>
  )
}
