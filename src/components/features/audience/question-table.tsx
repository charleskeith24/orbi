"use client"

import { DataTable, PillarBadge, PlatformLabel, PriorityBadge, type DataTableColumn } from "@/components/common"
import { Button } from "@/components/ui/button"
import { PLATFORMS } from "@/lib/constants"
import { formatDate, formatRelativeDay } from "@/lib/dates"
import type { AudienceQuestion, ContentPillar, ID } from "@/lib/types"
import { cn, formatNumber, truncate } from "@/lib/utils"
import { questionPriority } from "./audience-model"
import { QuestionActionsMenu, type QuestionActions } from "./question-actions"
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
  const pillarOf = (question: AudienceQuestion) => (question.pillar_id ? (pillars.get(question.pillar_id) ?? null) : null)

  const columns: DataTableColumn<AudienceQuestion>[] = [
    {
      id: "question",
      header: "Question",
      sortValue: (q) => q.question.toLowerCase(),
      className: "min-w-52 whitespace-normal",
      cell: (q) => (
        <div className="min-w-0">
          <p className={cn("line-clamp-2 text-sm leading-snug", q.status === "dismissed" && "text-muted-foreground")}>
            {q.question || "Untitled question"}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {q.topic ? <span className="shrink-0 font-medium text-foreground/75">{q.topic}</span> : null}
            {q.topic && q.source_person ? <span aria-hidden>·</span> : null}
            {q.source_person ? <span className="min-w-0 truncate">{q.source_person}</span> : null}
            <span className="shrink-0 sm:hidden">
              {q.topic || q.source_person ? "· " : ""}
              {questionStatusLabel(q.status)}
            </span>
          </p>
        </div>
      ),
    },
    {
      id: "frequency",
      header: "Asked",
      align: "right",
      sortValue: (q) => q.frequency,
      cell: (q) => <span className="font-medium">{formatNumber(q.frequency)}×</span>,
    },
    {
      id: "priority",
      header: "Priority",
      hideBelow: "md",
      sortValue: (q) => q.frequency,
      cell: (q) => <PriorityBadge priority={questionPriority(q.frequency)} />,
    },
    {
      id: "platform",
      header: "Platform",
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
      header: "Pillar",
      hideBelow: "lg",
      sortValue: (q) => pillarOf(q)?.name ?? null,
      cell: (q) => <PillarBadge pillar={pillarOf(q)} variant="plain" />,
    },
    {
      id: "last_asked_at",
      header: "Last asked",
      hideBelow: "lg",
      sortValue: (q) => q.last_asked_at || null,
      cell: (q) => (
        <span className="text-xs text-muted-foreground" title={formatDate(q.last_asked_at)}>
          {q.last_asked_at ? formatRelativeDay(q.last_asked_at, now) : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Converted",
      hideBelow: "sm",
      sortValue: (q) => QUESTION_STATUS_ORDER[q.status],
      cell: (q) => <QuestionStatusBadge status={q.status} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      className: "w-px",
      cell: (q) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            title="Asked again"
            className="text-muted-foreground"
            onClick={() => actions.askedAgain(q)}
          >
            +1<span className="sr-only"> asked again: {truncate(q.question, 50)}</span>
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
      rowLabel={(q) => q.question || "Untitled question"}
      onRowClick={(q) => actions.open(q.id)}
      defaultSort={{ id: "frequency", desc: true }}
      pageSize={50}
      empty={empty}
      aria-label="Question Bank"
    />
  )
}
