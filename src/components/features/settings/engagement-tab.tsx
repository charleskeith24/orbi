"use client"

import { addDays } from "date-fns"
import { ArrowDown, ArrowUp, MessagesSquare, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, NumberField, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toISODate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { updateSettings, useTable } from "@/lib/store"
import { cn, uid } from "@/lib/utils"
import { engagementMessages } from "./engagement-messages"
import { SaveBar } from "./save-bar"
import {
  ENGAGEMENT_DEFAULTS,
  engagementPatch,
  engagementValid,
  LIMITS,
  validateEngagement,
  type EngagementTaskDraft,
  type EngagementValues,
} from "./sections"
import { sameValues, type SettingsDraft } from "./use-settings-draft"

const HISTORY_DAYS = 7
const ROW_GRID = "md:grid-cols-[1.25rem_minmax(0,1fr)_8.5rem_6.5rem_5.75rem]"

export function EngagementTab({ draft, now }: { draft: SettingsDraft<EngagementValues>; now: Date }) {
  const tasks = draft.values.tasks
  const lang = useUiLang()
  const t = useT(engagementMessages)
  const errors = validateEngagement(draft.values, lang)
  const valid = engagementValid(errors)
  const [focusRid, setFocusRid] = useState<string | null>(null)
  const logs = useTable("engagement_logs")

  // Days each task was ticked off in the last week (history is stored by task key).
  const doneDays = useMemo(() => {
    const from = toISODate(addDays(now, -(HISTORY_DAYS - 1)))
    const to = toISODate(now)
    const counts = new Map<string, number>()
    for (const log of logs) {
      if (log.date < from || log.date > to) continue
      for (const key of new Set(log.completed_tasks)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [logs, now])

  const setTasks = (next: EngagementTaskDraft[]) => draft.set("tasks", next)
  const update = (rid: string, patch: Partial<EngagementTaskDraft>) =>
    setTasks(tasks.map((task) => (task.rid === rid ? { ...task, ...patch } : task)))
  const move = (index: number, delta: number) => {
    const next = [...tasks]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    setTasks(next)
  }
  function add() {
    const rid = `new-${uid()}`
    setTasks([...tasks, { rid, key: "", label: "", target: 1 }])
    setFocusRid(rid)
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.dirty || !valid) return
    updateSettings(engagementPatch(draft.values))
    draft.discard()
    toast.success(t("saved"))
  }

  return (
    <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
      <SectionCard
        title={t("title")}
        info={t("info")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/today">Engagement Tracker</Link>
          </Button>
        }
        contentClassName={tasks.length ? "px-0 pt-3 pb-0" : undefined}
        footer={
          tasks.length ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={add} disabled={tasks.length >= LIMITS.maxTasks}>
                <Plus aria-hidden />
                {t("add_task")}
              </Button>
              <span className="min-w-0">
                {errors.list ?? t("footer", { count: tasks.length, max: LIMITS.maxTasks })}
              </span>
            </>
          ) : undefined
        }
      >
        {tasks.length ? (
          <div className="min-w-0">
            <div
              className={cn(
                "hidden items-center gap-3 border-b px-4 pb-2 text-xs font-medium text-muted-foreground md:grid",
                ROW_GRID
              )}
            >
              <span aria-hidden>#</span>
              <span>{t("col_task")}</span>
              <span>{t("col_target")}</span>
              <span>{t("col_history", { days: HISTORY_DAYS })}</span>
              <span className="sr-only">{t("col_actions")}</span>
            </div>
            <ol className="divide-y">
              {tasks.map((task, index) => {
                const rowErrors = errors.rows[task.rid]
                const done = task.key ? (doneDays.get(task.key) ?? 0) : null
                return (
                  <li
                    key={task.rid}
                    className={cn("grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 md:items-center", ROW_GRID)}
                  >
                    <span className="pt-1.5 text-xs text-muted-foreground num md:pt-0">{index + 1}</span>
                    <div className="min-w-0">
                      <Input
                        value={task.label}
                        maxLength={LIMITS.taskLabelLength + 20}
                        placeholder={t("task_placeholder")}
                        autoFocus={task.rid === focusRid}
                        aria-label={t("task_aria", { index: index + 1 })}
                        aria-invalid={Boolean(rowErrors?.label) || undefined}
                        onChange={(event) => update(task.rid, { label: event.target.value })}
                      />
                      {rowErrors?.label ? <p className="mt-1 text-xs text-destructive">{rowErrors.label}</p> : null}
                    </div>
                    <div className="col-start-2 min-w-0 md:col-start-auto">
                      <NumberField
                        integer
                        min={0}
                        max={LIMITS.taskTarget.max}
                        value={task.target}
                        onChange={(next) => update(task.rid, { target: next })}
                        suffix={t("per_day")}
                        className="w-32"
                        aria-label={t("target_aria", { index: index + 1 })}
                        aria-invalid={Boolean(rowErrors?.target) || undefined}
                      />
                      {rowErrors?.target ? <p className="mt-1 text-xs text-destructive">{rowErrors.target}</p> : null}
                    </div>
                    <div className="col-start-2 text-xs text-muted-foreground md:col-start-auto">
                      {done === null ? (
                        t("new_task")
                      ) : (
                        <span>
                          <span className="font-medium text-foreground num">{done}</span>
                          <span className="num"> {t("of_days", { days: HISTORY_DAYS })}</span>
                        </span>
                      )}
                    </div>
                    <div className="col-start-3 row-start-1 flex items-center justify-end gap-0.5 md:col-start-auto md:row-start-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("move_up_aria", { index: index + 1 })}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("move_down_aria", { index: index + 1 })}
                        disabled={index === tasks.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("remove_aria", { index: index + 1 })}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setTasks(tasks.filter((t) => t.rid !== task.rid))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ) : (
          <EmptyState
            compact
            icon={MessagesSquare}
            title={t("empty_title")}
            description={t("empty_description")}
            action={
              <Button type="button" size="sm" onClick={add}>
                <Plus aria-hidden />
                {t("add_task")}
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" onClick={() => draft.replace(ENGAGEMENT_DEFAULTS)}>
                {t("use_recommended")}
              </Button>
            }
          />
        )}
      </SectionCard>

      <SaveBar
        dirty={draft.dirty}
        valid={valid}
        invalidMessage={errors.list ?? t("fix_tasks")}
        onDiscard={draft.discard}
        onReset={() => draft.replace(ENGAGEMENT_DEFAULTS)}
        resetDisabled={sameValues(draft.values, ENGAGEMENT_DEFAULTS)}
      />
    </form>
  )
}
