"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAiTask } from "@/lib/ai"
import { createIdea, dataActions } from "@/lib/store"
import type { ContentIdea } from "@/lib/types"
import { AiErrorNotice } from "./ai-error-notice"
import { CaptureBody, CaptureDialog, CaptureFooter, CaptureHeader, ShortcutHint } from "./capture-dialog"
import { ideaTitleFromText, submitOnModEnter } from "./capture-utils"
import { draftFromCapture, IdeaPreviewFields, ideaValuesFromDraft, type IdeaDraft } from "./idea-preview"

/** The capture_idea task accepts up to 4,000 characters. */
const MAX_LENGTH = 4000
const COUNTER_FROM = MAX_LENGTH - 500

/**
 * Quick Capture (spec §10): save a raw note straight to the Idea Bank inbox, or transform it with AI
 * into a structured idea (pillar, persona, hook, format, platforms…) that stays editable until saved.
 */
export function QuickCaptureDialog({
  open,
  onOpenChange,
  initialText,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText?: string
}) {
  return (
    <CaptureDialog open={open} onOpenChange={onOpenChange} size="lg">
      <QuickCaptureForm initialText={initialText ?? ""} onClose={() => onOpenChange(false)} />
    </CaptureDialog>
  )
}

function QuickCaptureForm({ initialText, onClose }: { initialText: string; onClose: () => void }) {
  const router = useRouter()
  const textId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(initialText)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [step, setStep] = useState<"note" | "preview">("note")
  const [draft, setDraft] = useState<IdeaDraft | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const ai = useAiTask("capture_idea")
  const trimmed = text.trim()

  // Prefilled text (⌘K "Capture …", the dashboard card): caret at the end, ready to keep typing.
  useEffect(() => {
    const el = textRef.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  function announce(idea: ContentIdea) {
    toast.success("Idea saved to the Idea Bank", {
      description: idea.title,
      action: { label: "Open", onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  function requireText(): boolean {
    if (trimmed) return true
    setNoteError("Write the idea first.")
    textRef.current?.focus()
    return false
  }

  function saveNote() {
    if (ai.isPending || !requireText()) return
    const idea = createIdea({
      title: ideaTitleFromText(trimmed),
      description: trimmed,
      source: "quick_capture",
      status: "inbox",
    })
    announce(idea)
    onClose()
  }

  async function transform() {
    if (!requireText()) return
    const result = await ai.run({ text: trimmed })
    if (!result) return
    setDraft(draftFromCapture(result.output, dataActions.getDb()))
    setTitleError(null)
    setStep("preview")
  }

  function saveDraft() {
    if (!draft || ai.isPending) return
    if (!draft.title.trim()) {
      setTitleError("Give the idea a title.")
      return
    }
    const idea = createIdea({
      ...ideaValuesFromDraft(draft),
      inspiration: trimmed,
      source: "quick_capture",
      status: "inbox",
    })
    announce(idea)
    onClose()
  }

  const submit = step === "preview" && draft ? saveDraft : saveNote

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => submitOnModEnter(event, submit)}
    >
      {step === "preview" && draft ? (
        <>
          <CaptureHeader
            title="Review your idea"
            description="Structured from your note. Edit anything before it goes into the Idea Bank."
          />
          <CaptureBody className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Your note</span>
                <ProviderBadge provider={ai.provider ?? "offline"} model={ai.model ?? undefined} />
              </div>
              <p className="line-clamp-3 text-xs text-pretty whitespace-pre-line text-muted-foreground">{trimmed}</p>
            </div>
            {ai.error ? <AiErrorNotice message={ai.error.message} onRetry={() => void transform()} /> : null}
            <IdeaPreviewFields
              draft={draft}
              titleError={titleError ?? undefined}
              onChange={(patch) => {
                setDraft((current) => (current ? { ...current, ...patch } : current))
                if (patch.title !== undefined) setTitleError(null)
              }}
            />
            <AiNotice />
          </CaptureBody>
          <CaptureFooter status={<ShortcutHint />}>
            <Button type="button" variant="ghost" onClick={() => setStep("note")} aria-label="Back to your note">
              <ArrowLeft aria-hidden />
              <span className="max-sm:hidden">Edit note</span>
            </Button>
            <AiButton type="button" pending={ai.isPending} pendingLabel="Regenerating…" onClick={() => void transform()}>
              Regenerate
            </AiButton>
            <Button type="submit" disabled={ai.isPending}>
              Save idea
            </Button>
          </CaptureFooter>
        </>
      ) : (
        <>
          <CaptureHeader
            title="Quick Capture"
            description="Get the idea down the moment it appears. It lands in your Idea Bank inbox."
          />
          <CaptureBody className="flex flex-col gap-3">
            <label htmlFor={textId} className="sr-only">
              Idea
            </label>
            <Textarea
              ref={textRef}
              id={textId}
              autoFocus
              value={text}
              maxLength={MAX_LENGTH}
              rows={6}
              placeholder="Enter an idea…"
              aria-invalid={Boolean(noteError) || undefined}
              aria-describedby={`${textId}-help`}
              className="min-h-40 resize-none max-sm:flex-1"
              onChange={(event) => {
                setText(event.target.value)
                if (noteError) setNoteError(null)
              }}
            />
            {noteError ? (
              <p role="alert" className="text-xs text-destructive">
                {noteError}
              </p>
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <p id={`${textId}-help`} className="text-xs text-pretty text-muted-foreground">
                Saves exactly as written. <span className="font-medium text-foreground">Transform with AI</span> turns it into
                a full idea — pillar, persona, hook, format and talking points — for you to edit first.
              </p>
              {text.length >= COUNTER_FROM ? (
                <span className="shrink-0 text-xs text-muted-foreground num">
                  {text.length.toLocaleString("en-US")} / {MAX_LENGTH.toLocaleString("en-US")}
                </span>
              ) : null}
            </div>
            {ai.error ? <AiErrorNotice message={ai.error.message} onRetry={() => void transform()} /> : null}
          </CaptureBody>
          <CaptureFooter status={<ShortcutHint />}>
            <AiButton type="button" pending={ai.isPending} disabled={!trimmed} onClick={() => void transform()}>
              Transform with AI
            </AiButton>
            <Button type="submit" disabled={!trimmed || ai.isPending}>
              Save idea
            </Button>
          </CaptureFooter>
        </>
      )}
    </form>
  )
}
