"use client"

import { CornerDownLeft, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useT } from "@/lib/i18n"
import { createIdea, uiActions } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { CardLink } from "./card-link"
import { ideaTitleFromText } from "./dashboard-utils"
import { dashboardMessages } from "./messages"

const MAX_LENGTH = 500

/** Inline capture: Enter saves an inbox idea; "Transform with AI" hands the text to the Quick Capture dialog. */
export function QuickCaptureCard({ capturedToday, className }: { capturedToday: number; className?: string }) {
  const t = useT(dashboardMessages)
  const c = useT(commonMessages)
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
    toast.success(t("idea_saved"), {
      description: idea.title,
      action: { label: c("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  return (
    <SectionCard
      title="Quick Capture"
      description={t("capture_description", {
        status: capturedToday ? t.plural("captured_today", capturedToday, { count: formatNumber(capturedToday) }) : t("nothing_captured"),
      })}
      action={<CardLink href="/ideas">Idea Bank</CardLink>}
      className={className}
    >
      <form onSubmit={save} className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("new_idea")}
        </label>
        <Input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder={t("capture_placeholder")}
          autoComplete="off"
          enterKeyHint="done"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={!trimmed}>
            {t("save_idea")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => uiActions.openDialog({ type: "quick-capture", initialText: trimmed || undefined })}
          >
            <Sparkles className="text-brand" />
            {t("transform_ai")}
          </Button>
          <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <Kbd>
              <CornerDownLeft aria-hidden />
            </Kbd>
            {t("enter_saves")}
          </span>
        </div>
      </form>
    </SectionCard>
  )
}
