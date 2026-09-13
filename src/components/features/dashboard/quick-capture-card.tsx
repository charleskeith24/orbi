"use client"

import { CornerDownLeft, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { createIdea, uiActions } from "@/lib/store"
import { pluralize } from "@/lib/utils"
import { CardLink } from "./card-link"
import { ideaTitleFromText } from "./dashboard-utils"

const MAX_LENGTH = 500

/** Inline capture: Enter saves an inbox idea; "Transform with AI" hands the text to the Quick Capture dialog. */
export function QuickCaptureCard({ capturedToday, className }: { capturedToday: number; className?: string }) {
  const router = useRouter()
  const inputId = useId()
  const [text, setText] = useState("")
  const trimmed = text.trim()

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed) return
    const idea = createIdea({
      title: ideaTitleFromText(trimmed),
      description: trimmed,
      source: "quick_capture",
      status: "inbox",
    })
    setText("")
    toast.success("Idea saved to the Idea Bank", {
      description: idea.title,
      action: { label: "Open", onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  return (
    <SectionCard
      title="Quick Capture"
      description={`${capturedToday ? `${pluralize(capturedToday, "idea")} captured today` : "Nothing captured today yet"} · saved to your Idea Bank inbox`}
      action={<CardLink href="/ideas">Idea Bank</CardLink>}
      className={className}
    >
      <form onSubmit={save} className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          New idea
        </label>
        <Input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="An idea, a hook, a question someone asked…"
          autoComplete="off"
          enterKeyHint="done"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={!trimmed}>
            Save idea
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => uiActions.openDialog({ type: "quick-capture", initialText: trimmed || undefined })}
          >
            <Sparkles className="text-brand" />
            Transform with AI
          </Button>
          <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <Kbd>
              <CornerDownLeft aria-hidden />
            </Kbd>
            saves
          </span>
        </div>
      </form>
    </SectionCard>
  )
}
