"use client"

import { CircleCheck, CircleMinus, Lightbulb, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import {
  ContentCard,
  DatePicker,
  DetailSheet,
  FormField,
  FormRow,
  IdeaStatusBadge,
  NumberField,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  PriorityBadge,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toISODate } from "@/lib/dates"
import { useT, useUiLang, type Translator, type UiLang } from "@/lib/i18n"
import { dataActions, useRow } from "@/lib/store"
import type { AudienceQuestion, UpdateRow } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { questionPriority, relativeDayLabel } from "./audience-model"
import { AutosaveInput, AutosaveTextarea } from "./autosave-field"
import { audienceMessages } from "./messages"
import { QuestionActionsMenu, type QuestionActions } from "./question-actions"
import { questionMessages } from "./question-messages"
import { QuestionStatusBadge, questionStatusLabel } from "./question-status"

function lastAskedPhrase(value: string, now: Date, t: Translator<(typeof questionMessages)["en"]>, lang: UiLang): string {
  if (!value) return t("never_logged")
  return t("last_asked_when", { when: relativeDayLabel(value, now, lang, true) })
}

/** `/audience/questions?open=<id>` — edit the question, count repeats, see the idea and the answer. */
export function QuestionSheet({
  question,
  open,
  actions,
  onOpenChange,
}: {
  question: AudienceQuestion | null
  open: boolean
  actions: QuestionActions
  onOpenChange: (open: boolean) => void
}) {
  const [now] = useState(() => new Date())
  const t = useT(questionMessages)
  const lang = useUiLang()
  if (!question) return null
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={truncate(question.question || t("untitled"), 160)}
      description={t("sheet_description", {
        status: questionStatusLabel(question.status),
        count: formatNumber(question.frequency),
        last: lastAskedPhrase(question.last_asked_at, now, t, lang),
      })}
      actions={<QuestionActionsMenu question={question} actions={actions} showOpen={false} className="size-7" />}
      footer={<SheetFooter question={question} actions={actions} />}
    >
      <SheetBody key={question.id} question={question} actions={actions} now={now} />
    </DetailSheet>
  )
}

function SheetBody({ question, actions, now }: { question: AudienceQuestion; actions: QuestionActions; now: Date }) {
  const id = useId()
  const t = useT(questionMessages)
  const a = useT(audienceMessages)
  const idea = useRow("content_ideas", question.idea_id)
  const item = useRow("content_items", question.content_item_id)
  const save = (patch: UpdateRow<"audience_questions">) => dataActions.update("audience_questions", question.id, patch)
  const frequency = Math.max(1, Math.round(question.frequency))

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FormField label={t("question")} htmlFor={`${id}-question`} required>
        <AutosaveTextarea
          id={`${id}-question`}
          value={question.question}
          required
          requiredMessage={t("what_they_asked")}
          maxLength={300}
          rows={2}
          onCommit={(text) => save({ question: text })}
        />
      </FormField>

      <FormField label={t("times_asked")} htmlFor={`${id}-frequency`} description={t("times_asked_description")}>
        <div className="flex flex-wrap items-center gap-2">
          <NumberField
            id={`${id}-frequency`}
            integer
            min={1}
            value={frequency}
            className="w-24"
            onChange={(value) => {
              if (value !== null && value >= 1) save({ frequency: Math.round(value) })
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => actions.askedAgain(question)}>
            {t("asked_again_button")}
          </Button>
          <PriorityBadge priority={questionPriority(frequency)} />
        </div>
      </FormField>

      <FormRow>
        <FormField label={t("who_asked")} htmlFor={`${id}-source`}>
          <AutosaveInput
            id={`${id}-source`}
            value={question.source_person}
            maxLength={120}
            placeholder={t("who_asked_placeholder")}
            onCommit={(source_person) => save({ source_person })}
          />
        </FormField>
        <FormField label={a("platform")} htmlFor={`${id}-platform`}>
          <PlatformSelect id={`${id}-platform`} allowNone value={question.platform} onChange={(platform) => save({ platform })} />
        </FormField>
        <FormField label={t("topic")} htmlFor={`${id}-topic`}>
          <AutosaveInput
            id={`${id}-topic`}
            value={question.topic}
            maxLength={80}
            placeholder={t("topic_placeholder")}
            onCommit={(topic) => save({ topic })}
          />
        </FormField>
        <FormField label={t("last_asked")} htmlFor={`${id}-last`}>
          <DatePicker
            id={`${id}-last`}
            value={question.last_asked_at || null}
            clearable={false}
            maxDate={toISODate(now)}
            onChange={(value) => {
              if (value) save({ last_asked_at: value })
            }}
          />
        </FormField>
        <FormField label={a("persona")} htmlFor={`${id}-persona`}>
          <PersonaSelect id={`${id}-persona`} allowNone value={question.persona_id} onChange={(persona_id) => save({ persona_id })} />
        </FormField>
        <FormField label={a("pillar")} htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={question.pillar_id} onChange={(pillar_id) => save({ pillar_id })} />
        </FormField>
      </FormRow>

      <Separator />

      <section className="flex min-w-0 flex-col gap-3" aria-label={t("answer_aria")}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("from_question")}</h3>
          <QuestionStatusBadge status={question.status} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("idea")}</span>
          {idea ? (
            <Link
              href={`/ideas?open=${idea.id}`}
              className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Lightbulb className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={idea.title}>
                {idea.title || a("untitled_idea")}
              </span>
              <IdeaStatusBadge status={idea.status} />
            </Link>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {t("not_an_idea")}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("answered_in")}</span>
          {item ? (
            <ContentCard item={item} compact href={`/studio/${item.id}`} now={now} />
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {t("no_answer")}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function SheetFooter({ question, actions }: { question: AudienceQuestion; actions: QuestionActions }) {
  const t = useT(questionMessages)
  const a = useT(audienceMessages)
  if (question.status === "dismissed") {
    return (
      <Button type="button" size="sm" onClick={() => actions.restore(question)}>
        <RotateCcw aria-hidden />
        {t("restore")}
      </Button>
    )
  }
  const hasIdea = Boolean(question.idea_id)
  const answered = question.status === "answered"
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="mr-auto" onClick={() => actions.dismiss(question)}>
        <CircleMinus aria-hidden />
        {t("dismiss")}
      </Button>
      <Button type="button" variant={hasIdea && !answered ? "default" : "outline"} size="sm" onClick={() => actions.markAnswered(question)}>
        <CircleCheck aria-hidden />
        {answered ? t("change_answer") : t("mark_answered")}
      </Button>
      <Button type="button" variant={hasIdea ? "outline" : "default"} size="sm" onClick={() => actions.convertToIdea(question)}>
        <Lightbulb aria-hidden />
        {hasIdea ? a("open_idea") : t("convert_to_idea")}
      </Button>
    </>
  )
}
