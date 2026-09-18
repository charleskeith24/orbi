"use client"

import { MessageCircleQuestion } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { ISODate, PlatformId } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { normalizeQuestion } from "./engagement-utils"
import { todayMessages } from "./messages"

/**
 * "Collect a question": saves what the audience asked to the Question Bank (a repeat bumps the
 * existing question's count) and calls `onCollected` so the tracker counts it.
 */
export function QuestionForm({ day, onCollected }: { day: ISODate; onCollected: () => void }) {
  const t = useT(todayMessages)
  const router = useRouter()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [person, setPerson] = useState("")
  const [platform, setPlatform] = useState<PlatformId | null>(null)
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = question.replace(/\s+/g, " ").trim()
    if (!text) {
      setError(t("question_error"))
      inputRef.current?.focus()
      return
    }
    const who = person.trim()
    const key = normalizeQuestion(text)
    const existing = dataActions.getDb().audience_questions.find((q) => normalizeQuestion(q.question) === key)
    if (existing) {
      const frequency = Math.max(1, Math.round(existing.frequency)) + 1
      dataActions.update("audience_questions", existing.id, {
        frequency,
        last_asked_at: day,
        ...(existing.platform || !platform ? {} : { platform }),
        ...(existing.source_person || !who ? {} : { source_person: who }),
        ...(existing.status === "dismissed" ? { status: "new" as const } : {}),
      })
      toast.success(t("asked_again", { count: frequency }), {
        description: truncate(existing.question, 70),
        action: { label: t("open"), onClick: () => router.push(`/audience/questions?open=${existing.id}`) },
      })
    } else {
      const row = dataActions.insert("audience_questions", {
        question: text,
        source_person: who,
        platform,
        frequency: 1,
        status: "new",
        last_asked_at: day,
      })
      toast.success(t("question_saved"), {
        description: truncate(text, 70),
        action: { label: t("open"), onClick: () => router.push(`/audience/questions?open=${row.id}`) },
      })
    }
    onCollected()
    setQuestion("")
    setPerson("")
    setError(null)
    inputRef.current?.focus()
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <MessageCircleQuestion aria-hidden />
        {t("collect_question")}
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border bg-muted/25 p-3 dark:bg-muted/10" aria-label={t("collect_question")}>
      <label htmlFor={`${id}-question`} className="text-xs font-medium">
        {t("what_asked")}
      </label>
      <Input
        ref={inputRef}
        id={`${id}-question`}
        autoFocus
        value={question}
        maxLength={300}
        placeholder={t("question_placeholder")}
        aria-invalid={Boolean(error) || undefined}
        enterKeyHint="done"
        onChange={(event) => {
          setQuestion(event.target.value)
          if (error) setError(null)
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label={t("who_asked")}
          value={person}
          maxLength={80}
          placeholder={t("who_asked")}
          onChange={(event) => setPerson(event.target.value)}
        />
        <PlatformSelect
          allowNone
          noneLabel={t("no_platform")}
          placeholder={t("where")}
          aria-label={t("platform")}
          value={platform}
          onChange={setPlatform}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" size="sm">
          {t("save_question")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("done")}
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{t("question_hint")}</span>
      </div>
    </form>
  )
}
