"use client"

import { Plus } from "lucide-react"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions } from "@/lib/store"
import type { ID, PlatformId } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { askedAgainPatch, findDuplicateQuestion } from "./audience-model"
import { audienceMessages } from "./messages"
import { questionMessages } from "./question-messages"

export interface QuestionDefaults {
  persona_id: ID | null
  pillar_id: ID | null
  platform: PlatformId | null
}

/**
 * Inline quick add: Enter saves a new question (asked once, today). A repeat of a question already
 * in the bank counts as "+1 asked again" instead — the same rule the Today page uses.
 */
export function QuestionQuickAdd({ defaults, onOpen }: { defaults: QuestionDefaults; onOpen: (id: ID) => void }) {
  const id = useId()
  const t = useT(questionMessages)
  const a = useT(audienceMessages)
  const c = useT(commonMessages)
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState("")
  const [platform, setPlatform] = useState<PlatformId | null>(defaults.platform)
  const clean = text.replace(/\s+/g, " ").trim()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!clean) return
    const today = toISODate(new Date())
    const existing = findDuplicateQuestion(dataActions.getDb().audience_questions, clean)
    if (existing) {
      const patch = askedAgainPatch(existing, today)
      dataActions.update("audience_questions", existing.id, {
        ...patch,
        ...(existing.platform || !platform ? {} : { platform }),
      })
      toast.success(t("already_in_bank_now", { count: formatNumber(patch.frequency ?? existing.frequency) }), {
        description: truncate(existing.question, 80),
        action: { label: a("open"), onClick: () => onOpen(existing.id) },
      })
    } else {
      const row = dataActions.insert("audience_questions", {
        question: clean,
        platform,
        frequency: 1,
        status: "new",
        last_asked_at: today,
        persona_id: defaults.persona_id,
        pillar_id: defaults.pillar_id,
      })
      toast.success(t("added"), {
        description: truncate(clean, 80),
        action: { label: a("open"), onClick: () => onOpen(row.id) },
      })
    }
    setText("")
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={submit} aria-label={t("quick_add_aria")} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor={`${id}-question`} className="sr-only">
        {t("quick_add_label")}
      </label>
      <Input
        ref={inputRef}
        id={`${id}-question`}
        value={text}
        maxLength={300}
        enterKeyHint="done"
        placeholder={t("quick_add_placeholder")}
        className="min-w-0 flex-1"
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <PlatformSelect
          allowNone
          noneLabel={a("no_platform")}
          placeholder={a("platform")}
          aria-label={t("where_asked")}
          value={platform}
          onChange={setPlatform}
          className="w-full sm:w-40"
        />
        <Button type="submit" disabled={!clean}>
          <Plus aria-hidden />
          {c("add")}
        </Button>
      </div>
    </form>
  )
}
