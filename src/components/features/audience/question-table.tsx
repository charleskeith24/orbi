"use client"

import { DataTable, PillarBadge, PlatformLabel, PriorityBadge, type DataTableColumn } from "@/components/common"
import { Button } from "@/components/ui/button"
import { PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import type { AudienceQuestion, ContentPillar, ID } from "@/lib/types"
import { cn, formatNumber, truncate } from "@/lib/utils"
import { questionPriority, relativeDayLabel } from "./audience-model"
import { audienceMessages } from "./messages"
import { QuestionActionsMenu, type QuestionActions } from "./question-actions"
import { questionMessages } from "./question-messages"
import { QUESTION_STATUS_ORDER, QuestionStatusBadge, questionStatusLabel } from "./question-status"

/** Question Bank table, sorted by how often each question was asked. Rows open the detail sheet. */
export function QuestionTable({
  questions,
  pillars,
  now,
  actions,
  empty,
}: {
  questions: AudienceQuestion[]
  pillars: Map<ID, ContentPillar>
  now: Date
  actions: QuestionActions
  empty: React.ReactNode
}) {
  const t = useT(questionMessages)
  const a = useT(audienceMessages)
  const lang = useUiLang()
  const pillarOf = (question: AudienceQuestion) => (question.pillar_id ? (pillars.get(question.pillar_id) ?? null) : null)

  const columns: DataTableColumn<AudienceQuestion>[] = [
    {
      id: "question",
      header: t("question"),
      sortValue: (q) => q.question.toLowerCase(),
      // Plain wrapping text (no nowrap/truncate) keeps the column's min-content small, so the
      // table fits a 360px screen with the count and +1 visible.
      className: "min-w-40 whitespace-normal sm:min-w-52",
      cell: (q) => (
        <div className="min-w-0">
          <p className={cn("line-clamp-2 text-sm leading-snug", q.status === "dismissed" && "text-muted-foreground")}>
            {q.question || t("untitled")}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {q.topic ? <span className="font-medium text-foreground/75">{q.topic}</span> : null}
            {q.topic && q.source_person ? " · " : null}
            {q.source_person}
            <span className="sm:hidden">
              {q.topic || q.source_person ? " · " : ""}
              {questionStatusLabel(q.status)}
            </span>
          </p>
        </div>
      ),
    },
    {
      id: "frequency",
      header: t("asked"),
      align: "right",
      sortValue: (q) => q.frequency,
      cell: (q) => <span className="font-medium">{formatNumber(q.frequency)}×</span>,
    },
    {
      id: "priority",
      header: t("priority"),
      hideBelow: "md",
      sortValue: (q) => q.frequency,
      cell: (q) => <PriorityBadge priority={questionPriority(q.frequency)} />,
    },
    {
      id: "platform",
      header: a("platform"),
      hideBelow: "md",
      sortValue: (q) => (q.platform ? PLATFORMS[q.platform].label : null),
      cell: (q) =>
        q.platform ? (
          <PlatformLabel platform={q.platform} className="text-xs text-muted-foreground" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "pillar",
      header: a("pillar"),
      hideBelow: "lg",
      sortValue: (q) => pillarOf(q)?.name ?? null,
      cell: (q) => <PillarBadge pillar={pillarOf(q)} variant="plain" />,
    },
    {
      id: "last_asked_at",
      header: t("last_asked"),
      hideBelow: "lg",
      sortValue: (q) => q.last_asked_at || null,
      cell: (q) => (
        <span className="text-xs text-muted-foreground" title={formatDate(q.last_asked_at)}>
          {q.last_asked_at ? relativeDayLabel(q.last_asked_at, now, lang) : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: t("converted"),
      hideBelow: "sm",
      sortValue: (q) => QUESTION_STATUS_ORDER[q.status],
      cell: (q) => <QuestionStatusBadge status={q.status} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      align: "right",
      className: "w-px",
      cell: (q) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            title={t("asked_again_title")}
            className="text-muted-foreground"
            onClick={() => actions.askedAgain(q)}
          >
            +1<span className="sr-only"> {t("asked_again_sr", { text: truncate(q.question, 50) })}</span>
          </Button>
          <QuestionActionsMenu question={q} actions={actions} />
        </div>
      ),
    },
  ]

  return (
    <DataTable
      rows={questions}
      columns={columns}
      getRowId={(q) => q.id}
      rowLabel={(q) => q.question || t("untitled")}
      onRowClick={(q) => actions.open(q.id)}
      defaultSort={{ id: "frequency", desc: true }}
      pageSize={50}
      empty={empty}
      aria-label="Question Bank"
    />
  )
}
