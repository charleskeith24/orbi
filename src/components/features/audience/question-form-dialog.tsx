"use client"

import { useId, useMemo, useState } from "react"
import { DatePicker, FormField, FormRow, NumberField, PersonaSelect, PillarSelect, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toISODate } from "@/lib/dates"
import { dataActions, useTable } from "@/lib/store"
import type { AudienceQuestion, ID, ISODate, PlatformId } from "@/lib/types"
import { findDuplicateQuestion } from "./audience-model"
import type { QuestionDefaults } from "./question-quick-add"

/** Add a question with every field. ⌘/Ctrl+Enter submits from the question box. */
export function QuestionFormDialog({
  open,
  defaults,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  defaults: QuestionDefaults
  onOpenChange: (open: boolean) => void
  onCreated: (question: AudienceQuestion) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <QuestionForm defaults={defaults} onCancel={() => onOpenChange(false)} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function QuestionForm({
  defaults,
  onCancel,
  onCreated,
}: {
  defaults: QuestionDefaults
  onCancel: () => void
  onCreated: (question: AudienceQuestion) => void
}) {
  const id = useId()
  const questions = useTable("audience_questions")
  const [today] = useState(() => toISODate(new Date()))
  const [question, setQuestion] = useState("")
  const [source, setSource] = useState("")
  const [platform, setPlatform] = useState<PlatformId | null>(defaults.platform)
  const [topic, setTopic] = useState("")
  const [frequency, setFrequency] = useState<number | null>(1)
  const [lastAsked, setLastAsked] = useState<ISODate | null>(today)
  const [personaId, setPersonaId] = useState<ID | null>(defaults.persona_id)
  const [pillarId, setPillarId] = useState<ID | null>(defaults.pillar_id)
  const [touched, setTouched] = useState(false)

  const clean = question.replace(/\s+/g, " ").trim()
  const duplicate = useMemo(() => findDuplicateQuestion(questions, clean), [questions, clean])
  const error = duplicate
    ? "Already in the Question Bank — use +1 on it instead."
    : touched && !clean
      ? "Write down what they asked."
      : null
  const frequencyError = frequency === null || frequency < 1 ? "Enter how many times it was asked (at least 1)." : null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!clean || duplicate || frequencyError) return
    const row = dataActions.insert("audience_questions", {
      question: clean,
      source_person: source.replace(/\s+/g, " ").trim(),
      platform,
      topic: topic.replace(/\s+/g, " ").trim(),
      frequency: Math.max(1, Math.round(frequency ?? 1)),
      last_asked_at: lastAsked ?? today,
      persona_id: personaId,
      pillar_id: pillarId,
      status: "new",
    })
    onCreated(row)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add a question</DialogTitle>
        <DialogDescription>What your audience asked, where, and how often. Repeated questions rise to the top.</DialogDescription>
      </DialogHeader>
      <FormField label="Question" htmlFor={`${id}-question`} required error={error}>
        <Textarea
          id={`${id}-question`}
          autoFocus
          rows={2}
          maxLength={300}
          value={question}
          placeholder="e.g. How much should I spend on ads in my first month?"
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => {
            setQuestion(event.target.value)
            setTouched(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
      </FormField>
      <FormField label="Topic" htmlFor={`${id}-topic`}>
        <Input
          id={`${id}-topic`}
          value={topic}
          maxLength={80}
          placeholder="e.g. Scaling, Pricing, Hiring"
          onChange={(event) => setTopic(event.target.value)}
        />
      </FormField>
      <FormRow>
        <FormField label="Who asked" htmlFor={`${id}-source`}>
          <Input
            id={`${id}-source`}
            value={source}
            maxLength={120}
            placeholder="A name, or e.g. TikTok comments"
            onChange={(event) => setSource(event.target.value)}
          />
        </FormField>
        <FormField label="Platform" htmlFor={`${id}-platform`}>
          <PlatformSelect id={`${id}-platform`} allowNone value={platform} onChange={setPlatform} />
        </FormField>
        <FormField label="Times asked" htmlFor={`${id}-frequency`} error={frequencyError}>
          <NumberField
            id={`${id}-frequency`}
            integer
            min={1}
            value={frequency}
            onChange={setFrequency}
            aria-invalid={Boolean(frequencyError) || undefined}
          />
        </FormField>
        <FormField label="Last asked" htmlFor={`${id}-last`}>
          <DatePicker id={`${id}-last`} value={lastAsked} onChange={setLastAsked} maxDate={today} clearable={false} />
        </FormField>
        <FormField label="Persona" htmlFor={`${id}-persona`}>
          <PersonaSelect id={`${id}-persona`} allowNone value={personaId} onChange={setPersonaId} />
        </FormField>
        <FormField label="Pillar" htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={pillarId} onChange={setPillarId} />
        </FormField>
      </FormRow>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!clean || Boolean(duplicate) || Boolean(frequencyError)}>
          Add question
        </Button>
      </DialogFooter>
    </form>
  )
}
