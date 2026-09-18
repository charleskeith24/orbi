"use client"

import { useId, useMemo, useState } from "react"
import { DatePicker, FormField, FormRow, NumberField, PersonaSelect, PillarSelect, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { AudienceQuestion, ID, ISODate, PlatformId } from "@/lib/types"
import { findDuplicateQuestion } from "./audience-model"
import { audienceMessages } from "./messages"
import { questionMessages } from "./question-messages"
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
  const t = useT(questionMessages)
  const a = useT(audienceMessages)
  const c = useT(commonMessages)
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
  const error = duplicate ? t("duplicate") : touched && !clean ? t("what_they_asked") : null
  const frequencyError = frequency === null || frequency < 1 ? t("frequency_error") : null

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
        <DialogTitle>{t("add_title")}</DialogTitle>
        <DialogDescription>{t("add_description")}</DialogDescription>
      </DialogHeader>
      <FormField label={t("question")} htmlFor={`${id}-question`} required error={error}>
        <Textarea
          id={`${id}-question`}
          autoFocus
          rows={2}
          maxLength={300}
          value={question}
          placeholder={t("question_placeholder")}
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
      <FormField label={t("topic")} htmlFor={`${id}-topic`}>
        <Input
          id={`${id}-topic`}
          value={topic}
          maxLength={80}
          placeholder={t("topics_placeholder")}
          onChange={(event) => setTopic(event.target.value)}
        />
      </FormField>
      <FormRow>
        <FormField label={t("who_asked")} htmlFor={`${id}-source`}>
          <Input
            id={`${id}-source`}
            value={source}
            maxLength={120}
            placeholder={t("who_asked_placeholder")}
            onChange={(event) => setSource(event.target.value)}
          />
        </FormField>
        <FormField label={a("platform")} htmlFor={`${id}-platform`}>
          <PlatformSelect id={`${id}-platform`} allowNone value={platform} onChange={setPlatform} />
        </FormField>
        <FormField label={t("times_asked")} htmlFor={`${id}-frequency`} error={frequencyError}>
          <NumberField
            id={`${id}-frequency`}
            integer
            min={1}
            value={frequency}
            onChange={setFrequency}
            aria-invalid={Boolean(frequencyError) || undefined}
          />
        </FormField>
        <FormField label={t("last_asked")} htmlFor={`${id}-last`}>
          <DatePicker id={`${id}-last`} value={lastAsked} onChange={setLastAsked} maxDate={today} clearable={false} />
        </FormField>
        <FormField label={a("persona")} htmlFor={`${id}-persona`}>
          <PersonaSelect id={`${id}-persona`} allowNone value={personaId} onChange={setPersonaId} />
        </FormField>
        <FormField label={a("pillar")} htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={pillarId} onChange={setPillarId} />
        </FormField>
      </FormRow>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!clean || Boolean(duplicate) || Boolean(frequencyError)}>
          {t("add_question")}
        </Button>
      </DialogFooter>
    </form>
  )
}
