"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, PageSection, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { buildWinnerReplicationInput, useAiTask } from "@/lib/ai"
import { dataActions, useDataStore } from "@/lib/store"
import type { AiProviderId, ContentItem } from "@/lib/types"
import { AiErrorNotice } from "./ai-error-notice"

/** Matches the winner_replication input limit, so a saved note never breaks the next AI run. */
const MAX_LENGTH = 1000

/** "Why It Worked": the creator's own read of the win, editable, with an AI first draft on request. */
export function WinnerWhy({ item }: { item: ContentItem }) {
  const saved = item.why_it_worked
  const [draft, setDraft] = useState(saved)
  const [base, setBase] = useState(saved)
  // Follow saves made elsewhere (undo, another tab) unless there are unsaved edits.
  if (saved !== base) {
    setBase(saved)
    if (draft === base) setDraft(saved)
  }
  const [source, setSource] = useState<{ provider: AiProviderId; model: string } | null>(null)
  const ai = useAiTask("winner_replication")
  const dirty = draft.trim() !== saved.trim()

  async function analyze() {
    const input = buildWinnerReplicationInput(useDataStore.getState().db, item.id, new Date())
    if (!input) {
      toast.error("Only published posts can be analyzed.")
      return
    }
    const result = await ai.run(input, { entityType: "content_items", entityId: item.id })
    if (!result) return
    setDraft(result.output.why_it_worked.trim().slice(0, MAX_LENGTH))
    setSource({ provider: result.provider, model: result.model })
  }

  function save() {
    dataActions.update("content_items", item.id, { why_it_worked: draft.trim().slice(0, MAX_LENGTH) })
    setSource(null)
    toast.success("“Why it worked” saved")
  }

  function discard() {
    setDraft(saved)
    setSource(null)
  }

  return (
    <PageSection
      id="winner-why"
      title="Why It Worked"
      description="Your read of the win — the hook, the timing, the story. It feeds every future generation."
      action={
        <AiButton size="sm" pending={ai.isPending} pendingLabel="Analyzing…" onClick={analyze}>
          Analyze with AI
        </AiButton>
      }
    >
      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && dirty) {
              event.preventDefault()
              save()
            }
          }}
          maxLength={MAX_LENGTH}
          rows={3}
          aria-label="Why it worked"
          placeholder="What made this land? A sharp hook, a real story, perfect timing, a format your audience saves…"
          className="min-h-20"
        />
        <AiErrorNotice error={ai.error} onRetry={analyze} pending={ai.isPending} />
        {source || dirty ? (
          <div className="flex flex-wrap items-center gap-2">
            {source ? <ProviderBadge provider={source.provider} model={source.model} /> : null}
            {source ? <AiNotice className="min-w-0 flex-1 basis-48">Edit it until it sounds like you, then save.</AiNotice> : null}
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={discard}>
                Discard
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={!dirty}>
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PageSection>
  )
}
