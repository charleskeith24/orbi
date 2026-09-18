"use client"

import { CornerDownLeft, Lightbulb } from "lucide-react"
import { useId, useState } from "react"
import { AiButton, chipVariants, IDEA_STATUS_ICONS } from "@/components/common"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { IDEA_STATUSES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { createIdea, uiActions } from "@/lib/store"
import type { ContentIdea, IdeaStatus } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { SHORT_STATUS_LABEL } from "./idea-badges"
import { titleFromText } from "./idea-model"
import { ideaBankMessages } from "./messages"

const MAX_LENGTH = 500

/** Inline Quick Capture: Enter saves an Inbox idea; "Transform with AI" hands the text to the Quick Capture dialog. */
export function IdeaQuickCapture({ onCreated, className }: { onCreated: (idea: ContentIdea) => void; className?: string }) {
  const inputId = useId()
  const t = useT(ideaBankMessages)
  const c = useT(commonMessages)
  const [text, setText] = useState("")
  const trimmed = text.trim()

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed) return
    const title = titleFromText(trimmed)
    const idea = createIdea({
      title,
      description: trimmed.replace(/\s+/g, " ") !== title ? trimmed : "",
      source: "quick_capture",
      status: "inbox",
    })
    setText("")
    onCreated(idea)
  }

  return (
    <form onSubmit={save} aria-label="Quick Capture" className={cn("flex min-w-0 items-center gap-2", className)}>
      <label htmlFor={inputId} className="sr-only">
        {t("capture_idea")}
      </label>
      <InputGroup className="h-8 min-w-0 flex-1">
        <InputGroupAddon>
          <Lightbulb className="size-4" aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={inputId}
          value={text}
          maxLength={MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t("capture_placeholder")}
          onChange={(event) => setText(event.target.value)}
        />
        <InputGroupAddon align="inline-end" className="hidden sm:flex">
          <Kbd title={t("enter_title")}>
            <CornerDownLeft aria-hidden />
            <span className="sr-only">{t("enter_saves")}</span>
          </Kbd>
        </InputGroupAddon>
      </InputGroup>
      <Button type="submit" size="sm" disabled={!trimmed}>
        {c("save")}
      </Button>
      <AiButton
        type="button"
        size="sm"
        title={t("transform_title")}
        onClick={() => uiActions.openDialog({ type: "quick-capture", initialText: trimmed || undefined })}
      >
        <span className="hidden sm:inline">{t("transform")}</span>
        <span className="sm:hidden">AI</span>
      </AiButton>
    </form>
  )
}

/** Counts per status; each chip narrows the list to that status (click again for all active ideas). */
export function IdeaStatusStrip({
  counts,
  value,
  onSelect,
  className,
}: {
  counts: Record<IdeaStatus, number>
  value: IdeaStatus[]
  onSelect: (status: IdeaStatus) => void
  className?: string
}) {
  const t = useT(ideaBankMessages)
  const only = value.length === 1 ? value[0] : null
  return (
    <div role="group" aria-label={t("by_status")} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {IDEA_STATUSES.map((status) => {
        const Icon = IDEA_STATUS_ICONS[status.id]
        const pressed = only === status.id
        return (
          <button
            key={status.id}
            type="button"
            aria-pressed={pressed}
            title={`${status.label} — ${status.description}`}
            onClick={() => onSelect(status.id)}
            className={cn(chipVariants({ size: "sm", selected: pressed }), "gap-1.5 px-2")}
          >
            <Icon className="size-3.5" aria-hidden />
            <span>{SHORT_STATUS_LABEL[status.id]}</span>
            <span className="font-semibold text-foreground num">{formatNumber(counts[status.id] ?? 0)}</span>
          </button>
        )
      })}
    </div>
  )
}
