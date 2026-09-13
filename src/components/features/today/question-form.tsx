"use client"

import { MessageCircleQuestion } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { dataActions } from "@/lib/store"
import type { ISODate, PlatformId } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { normalizeQuestion } from "./engagement-utils"

/**
 * "Collect a question": saves what the audience asked to the Question Bank (a repeat bumps the
 * existing question's count) and calls `onCollected` so the tracker counts it.
 */
export function QuestionForm({ day, onCollected }: { day: ISODate; onCollected: () => void }) {
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
      setError("Write down what they asked.")
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
      toast.success(`Asked again — now ${frequency}×`, {
        description: truncate(existing.question, 70),
        action: { label: "Open", onClick: () => router.push(`/audience/questions?open=${existing.id}`) },
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
      toast.success("Question saved to the Question Bank", {
        description: truncate(text, 70),
        action: { label: "Open", onClick: () => router.push(`/audience/questions?open=${row.id}`) },
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
        Collect a question
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border bg-muted/25 p-3 dark:bg-muted/10" aria-label="Collect a question">
      <label htmlFor={`${id}-question`} className="text-xs font-medium">
        What did they ask?
      </label>
      <Input
        ref={inputRef}
        id={`${id}-question`}
        autoFocus
        value={question}
        maxLength={300}
        placeholder="e.g. How much should I spend on ads in my first month?"
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
          aria-label="Who asked (optional)"
          value={person}
          maxLength={80}
          placeholder="Who asked (optional)"
          onChange={(event) => setPerson(event.target.value)}
        />
        <PlatformSelect allowNone noneLabel="No platform" placeholder="Where (optional)" aria-label="Platform" value={platform} onChange={setPlatform} />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" size="sm">
          Save to Question Bank
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Done
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Enter saves · repeats add to the count</span>
      </div>
    </form>
  )
}
