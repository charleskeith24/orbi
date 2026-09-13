"use client"

import { Lightbulb } from "lucide-react"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { DatePicker, EmptyState, FormField, FormRow, PlatformToggleGroup, StageSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { convertIdeaToContent, uiActions, useBrand, useLookup } from "@/lib/store"
import type { ContentIdea, ID, ISODate, PipelineStage, PlatformId } from "@/lib/types"
import { CaptureBody, CaptureFooter, ShortcutHint } from "./capture-dialog"
import { submitOnModEnter } from "./capture-utils"
import { IdeaPicker, SelectedIdea } from "./idea-picker"
import { createLabel, platformsFor, type ContentDefaults, type OnContentCreated } from "./new-content-shared"

/** "From an idea": pick an idea, choose platforms / stage / due date → one item per platform (convertIdeaToContent). */
export function FromIdeaForm({
  initialIdeaId,
  defaults,
  ideas,
  onCancel,
  onCreated,
  onScratch,
}: {
  initialIdeaId?: ID
  defaults?: ContentDefaults
  ideas: ContentIdea[]
  onCancel: () => void
  onCreated: OnContentCreated
  onScratch: () => void
}) {
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const brand = useBrand()
  const pillars = useLookup("content_pillars")
  const [ideaId, setIdeaId] = useState<ID | null>(() =>
    initialIdeaId && ideas.some((idea) => idea.id === initialIdeaId) ? initialIdeaId : null
  )
  const idea = ideaId ? ideas.find((i) => i.id === ideaId) : undefined
  const [platforms, setPlatforms] = useState<PlatformId[]>(() => platformsFor(idea, defaults, brand))
  const [stage, setStage] = useState<PipelineStage>(defaults?.stage ?? "brief")
  const [due, setDue] = useState<ISODate | null>(defaults?.due_date ?? null)
  const [attempted, setAttempted] = useState(false)

  const errors = {
    idea: idea ? null : "Choose an idea to produce.",
    platforms: platforms.length ? null : "Pick at least one platform.",
  }
  const firstError = errors.idea ?? errors.platforms
  const valid = firstError === null

  function choose(id: ID) {
    setIdeaId(id)
    setPlatforms(platformsFor(ideas.find((i) => i.id === id), defaults, brand))
    setAttempted(false)
    // The picker unmounts with focus inside it — keep focus in the form so ⌘/Ctrl+Enter still creates.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[role="group"][aria-label="Platforms"] button')?.focus())
  }

  function submit() {
    setAttempted(true)
    if (!idea || !valid) return
    try {
      const items = convertIdeaToContent(idea.id, {
        platforms,
        stage,
        due_date: due,
        ...(defaults?.scheduled_at ? { scheduled_at: defaults.scheduled_at } : {}),
        ...(defaults?.campaign_id ? { campaign_id: defaults.campaign_id } : {}),
      })
      onCreated(items, idea.title)
    } catch (error) {
      toast.error("Couldn't create the content", { description: error instanceof Error ? error.message : String(error) })
    }
  }

  if (!ideas.length) {
    return (
      <>
        <CaptureBody className="flex flex-col justify-center">
          <EmptyState
            icon={Lightbulb}
            title="Your Idea Bank is empty"
            description="Ideas carry the strategy — pillar, persona and hook — into production. Capture one first, or start this piece from scratch."
            action={
              <Button type="button" size="sm" onClick={onScratch}>
                Start from scratch
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
                Capture an idea
              </Button>
            }
          />
        </CaptureBody>
        <CaptureFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </CaptureFooter>
      </>
    )
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => submitOnModEnter(event, submit)}
    >
      <CaptureBody className="flex flex-col gap-4">
        <FormField label="Idea" required error={attempted ? (errors.idea ?? undefined) : undefined}>
          {idea ? (
            <SelectedIdea idea={idea} onChange={() => setIdeaId(null)} />
          ) : (
            <IdeaPicker ideas={ideas} pillars={pillars} onSelect={choose} />
          )}
        </FormField>
        {idea?.status === "converted" ? (
          <p className="-mt-2 text-xs text-muted-foreground">Already converted once — this adds another set of content items.</p>
        ) : null}
        {idea ? (
          <>
            <FormField
              label="Platforms"
              required
              description="One content item per platform, each with its own brief."
              error={attempted ? (errors.platforms ?? undefined) : undefined}
            >
              <PlatformToggleGroup value={platforms} onChange={setPlatforms} aria-label="Platforms" />
            </FormField>
            <FormRow>
              <FormField label="Stage" htmlFor={`${formId}-stage`}>
                <StageSelect id={`${formId}-stage`} value={stage} onChange={(next) => next && setStage(next)} />
              </FormField>
              <FormField label="Due date" htmlFor={`${formId}-due`}>
                <DatePicker id={`${formId}-due`} value={due} placeholder="No deadline" onChange={setDue} />
              </FormField>
            </FormRow>
          </>
        ) : null}
      </CaptureBody>
      <CaptureFooter status={valid ? <ShortcutHint label="to create" /> : <span className="truncate max-sm:hidden">{firstError}</span>}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {createLabel(platforms.length)}
        </Button>
      </CaptureFooter>
    </form>
  )
}
