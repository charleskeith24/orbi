"use client"

import { MessagesSquare, Minus, Plus, Settings2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Meter, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { toISODate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { EngagementLog, EngagementTaskConfig, UpdateRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EngagementHistory } from "./engagement-history"
import {
  allTasksDone,
  counterPatch,
  engagementHistory,
  logForDay,
  toggleTaskPatch,
  trackerRows,
  type CounterKey,
  type TrackerRow,
} from "./engagement-utils"
import { todayMessages } from "./messages"
import { QuestionForm } from "./question-form"
import { JUMP_TARGET } from "./work-section"

function Stepper({ row, onStep }: { row: TrackerRow; onStep: (delta: number) => void }) {
  const t = useT(todayMessages)
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={t("one_less", { label: row.label })}
        disabled={row.count <= 0}
        onClick={() => onStep(-1)}
      >
        <Minus aria-hidden />
      </Button>
      <span className="min-w-12 text-center text-sm font-medium num" aria-live="polite" aria-label={t("count_aria", { label: row.label, count: row.count })}>
        {row.count}
        {row.target > 0 ? <span className="font-normal text-muted-foreground">/{row.target}</span> : null}
      </span>
      <Button type="button" variant="outline" size="icon-sm" aria-label={t("one_more", { label: row.label })} onClick={() => onStep(1)}>
        <Plus aria-hidden />
      </Button>
    </div>
  )
}

function TrackerLine({
  row,
  onToggle,
  onStep,
}: {
  row: TrackerRow
  onToggle: (done: boolean) => void
  onStep: (delta: number) => void
}) {
  const t = useT(todayMessages)
  const id = useId()
  const reached = row.target > 0 && row.count >= row.target
  return (
    <li className="flex min-w-0 items-center gap-3 py-2">
      {row.kind === "task" ? (
        <Checkbox id={id} checked={row.done} onCheckedChange={(value) => onToggle(value === true)} aria-label={t("task_done_aria", { label: row.label })} />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        {/* The row's hint ("Replies on your own posts") is its tooltip (Calm UI: no help line under data). */}
        <label
          htmlFor={row.kind === "task" ? id : undefined}
          title={row.hint || undefined}
          className={cn("block text-sm leading-snug text-pretty", row.done && "text-muted-foreground")}
        >
          {row.label}
        </label>
        {row.counter && row.target > 0 ? (
          <Meter
            value={row.count}
            max={row.target}
            size="sm"
            tone={reached ? "good" : "brand"}
            className="mt-1.5 max-w-44"
            aria-label={t("progress_aria", { label: row.label })}
            valueText={t("of_target", { count: row.count, target: row.target })}
          />
        ) : null}
      </div>
      {row.counter ? (
        <Stepper row={row} onStep={onStep} />
      ) : row.target > 0 ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("goal")} <span className="num">{row.target}</span>
        </span>
      ) : null}
    </li>
  )
}

/** Notes for the day — saved as you pause typing and on blur (the day's row is created on first save). */
function NotesField({ value, onSave }: { value: string; onSave: (notes: string) => void }) {
  const t = useT(todayMessages)
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Adopt outside changes (another tab, the day rolling over) while not typing.
  if (!focused && value !== synced) {
    setSynced(value)
    setDraft(value)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  function save(next: string) {
    clearTimeout(timer.current)
    if (next !== synced) {
      setSynced(next)
      onSave(next)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {t("notes")}
      </label>
      <Textarea
        id={id}
        rows={2}
        className="min-h-14"
        value={draft}
        maxLength={2000}
        placeholder={t("notes_placeholder")}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          save(draft)
        }}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => save(next), 900)
        }}
      />
    </div>
  )
}

/**
 * Engagement Tracker (spec §53): today's tasks with +/− counters toward their targets and checkboxes,
 * other counters, "Collect a question", notes and the last 7 days. Stored in today's engagement_logs row.
 */
export function EngagementTracker({
  log,
  logs,
  tasks,
  now,
  className,
}: {
  log: EngagementLog | null
  logs: EngagementLog[]
  tasks: EngagementTaskConfig[]
  now: Date
  className?: string
}) {
  const t = useT(todayMessages)
  const lang = useUiLang()
  const day = toISODate(now)
  const rows = useMemo(() => trackerRows(tasks, log, lang), [tasks, log, lang])
  const history = useMemo(() => engagementHistory(logs, tasks, now), [logs, tasks, now])
  const completed = new Set(log?.completed_tasks ?? [])
  const done = tasks.filter((task) => completed.has(task.key)).length

  /** Patch today's row — created on the first change. */
  function write(patch: UpdateRow<"engagement_logs">) {
    const current = logForDay(dataActions.getDb().engagement_logs, day)
    if (current) dataActions.update("engagement_logs", current.id, patch)
    else dataActions.insert("engagement_logs", { date: day, ...patch })
    const wasDone = allTasksDone(current?.completed_tasks, tasks)
    if (!wasDone && patch.completed_tasks && allTasksDone(patch.completed_tasks, tasks)) {
      toast.success(t("all_done"), { description: t("all_done_description") })
    }
  }

  const current = () => logForDay(dataActions.getDb().engagement_logs, day)
  const step = (key: CounterKey, delta: number) => write(counterPatch(current(), tasks, key, delta))
  const toggle = (key: string, value: boolean) => write(toggleTaskPatch(current(), tasks, key, value))

  return (
    <div id="engagement" tabIndex={-1} className={cn("min-w-0 scroll-mt-16", JUMP_TARGET, className)}>
      <SectionCard
        title={t("tracker_title")}
        icon={MessagesSquare}
        info={t("tracker_info")}
        action={
          <>
            {tasks.length ? (
              <span className="px-1 text-xs text-muted-foreground num" title={t("tracker_tasks_aria", { done, total: tasks.length })}>
                <span className="sr-only">{t("tracker_tasks_aria", { done, total: tasks.length })}</span>
                <span aria-hidden>{`${done}/${tasks.length}`}</span>
              </span>
            ) : null}
            <Button asChild variant="ghost" size="icon-xs" className="text-muted-foreground" title={t("edit_tasks")}>
              <Link href="/settings?tab=engagement" aria-label={t("edit_tasks")}>
                <Settings2 aria-hidden />
              </Link>
            </Button>
          </>
        }
        className="h-full"
        contentClassName="flex flex-col gap-4"
      >
        <ul className="-my-2 flex flex-col divide-y">
          {rows.map((row) => (
            <TrackerLine
              key={row.key}
              row={row}
              onToggle={(value) => toggle(row.key, value)}
              onStep={(delta) => {
                if (row.counter) step(row.counter, delta)
              }}
            />
          ))}
        </ul>
        <QuestionForm day={day} onCollected={() => step("questions_collected", 1)} />
        <NotesField value={log?.notes ?? ""} onSave={(notes) => write({ notes })} />
        <EngagementHistory days={history} className="border-t pt-2" />
      </SectionCard>
    </div>
  )
}
