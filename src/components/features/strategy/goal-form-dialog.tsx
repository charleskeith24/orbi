"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  ChipToggleGroup,
  chipVariants,
  FormField,
  FormRow,
  ListEditor,
  NumberField,
  OptionSelect,
  type ChipOption,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS, GOAL_METRIC_MAP, GOAL_METRICS } from "@/lib/constants"
import { dataActions } from "@/lib/store"
import type { ContentGoal, GoalCategory, GoalMetric, GoalPeriod } from "@/lib/types"
import {
  CATEGORY_COLORS,
  goalFormValues,
  goalPayload,
  goalTargetText,
  kpisForCategoryChange,
  newGoalValues,
  periodNoun,
  validateGoal,
  type GoalFormValues,
} from "./goals-model"

export interface GoalDialogTarget {
  key: string
  goal: ContentGoal | null
  category: GoalCategory
}

const CATEGORY_OPTIONS: ChipOption<GoalCategory>[] = GOAL_CATEGORY_IDS.map((id) => ({
  value: id,
  label: GOAL_CATEGORIES[id].label,
  color: CATEGORY_COLORS[id],
}))
const METRIC_OPTIONS: SelectOption<GoalMetric>[] = GOAL_METRICS.map((m) => ({ value: m.id, label: m.label }))
const PERIOD_OPTIONS: SelectOption<GoalPeriod>[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
]

/** Create / edit a goal. The form remounts per target so it always starts from saved values. */
export function GoalFormDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: GoalDialogTarget | null
  onSaved?: (goal: ContentGoal, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        {target ? (
          <GoalForm
            key={target.key}
            goal={target.goal}
            category={target.category}
            onCancel={() => onOpenChange(false)}
            onSaved={(goal, created) => {
              onOpenChange(false)
              onSaved?.(goal, created)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function GoalForm({
  goal,
  category,
  onCancel,
  onSaved,
}: {
  goal: ContentGoal | null
  category: GoalCategory
  onCancel: () => void
  onSaved: (goal: ContentGoal, created: boolean) => void
}) {
  const [values, setValues] = useState<GoalFormValues>(() => (goal ? goalFormValues(goal) : newGoalValues(category)))
  const [touched, setTouched] = useState<{ name?: boolean; target_value?: boolean }>({})
  const errors = validateGoal(values)
  const valid = Object.keys(errors).length === 0
  const defaultMetric = GOAL_CATEGORIES[values.category].metric
  const targetText = goalTargetText(values)
  const kpiSuggestions = GOAL_CATEGORIES[values.category].kpis.filter(
    (k) => !values.kpis.some((v) => v.toLowerCase() === k.toLowerCase())
  )

  function set<K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function changeCategory(next: GoalCategory) {
    setValues((current) => ({ ...current, category: next, kpis: kpisForCategoryChange(current.kpis, current.category, next) }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ name: true, target_value: true })
    if (!valid) return
    const payload = goalPayload(values)
    if (goal) {
      dataActions.update("content_goals", goal.id, payload)
      toast.success("Goal updated", { description: payload.name })
      onSaved({ ...goal, ...payload }, false)
    } else {
      const row = dataActions.insert("content_goals", payload)
      toast.success("Goal created", { description: row.name })
      onSaved(row, true)
    }
  }

  const nameError = touched.name ? errors.name : undefined
  const targetError = touched.target_value ? errors.target_value : undefined

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
        <DialogDescription className="text-xs">
          A clear outcome with a target and a period. Content items point at goals so you can see what serves each one.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Category" description={GOAL_CATEGORIES[values.category].description}>
            <ChipToggleGroup
              options={CATEGORY_OPTIONS}
              value={values.category}
              required
              onChange={(next) => next && changeCategory(next)}
              aria-label="Goal category"
            />
          </FormField>

          <FormField label="Name" htmlFor="goal-name" required error={nameError}>
            <Input
              id="goal-name"
              value={values.name}
              autoFocus
              maxLength={100}
              placeholder="e.g. Generate qualified inquiries"
              aria-invalid={Boolean(nameError) || undefined}
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
          </FormField>

          <FormField label="Description" htmlFor="goal-description">
            <Textarea
              id="goal-description"
              rows={2}
              className="min-h-14"
              value={values.description}
              placeholder="What success looks like and why it matters now."
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>

          <FormRow columns={3}>
            <FormField label="Target" htmlFor="goal-target" error={targetError}>
              <NumberField
                id="goal-target"
                integer
                min={1}
                max={1_000_000_000}
                value={values.target_value}
                placeholder="e.g. 40"
                aria-invalid={Boolean(targetError) || undefined}
                onChange={(next) => {
                  set("target_value", next)
                  setTouched((t) => ({ ...t, target_value: true }))
                }}
              />
            </FormField>
            <FormField label="Metric" htmlFor="goal-metric">
              <OptionSelect
                id="goal-metric"
                value={values.target_metric}
                options={METRIC_OPTIONS}
                allowNone
                noneLabel={`Category default (${GOAL_METRIC_MAP[defaultMetric].label})`}
                onChange={(next) => set("target_metric", next)}
              />
            </FormField>
            <FormField label="Period" htmlFor="goal-period">
              <OptionSelect
                id="goal-period"
                value={values.period}
                options={PERIOD_OPTIONS}
                onChange={(next) => next && set("period", next)}
              />
            </FormField>
          </FormRow>
          <p className="-mt-2 text-xs text-muted-foreground">
            {targetText
              ? `Target: ${targetText}. Progress counts content published this ${periodNoun(values.period)}.`
              : "No target — the goal still shows what it earned this period."}
          </p>

          <FormField label="KPIs" htmlFor="goal-kpis" description="How you'll judge this goal beyond the target metric.">
            <ListEditor
              id="goal-kpis"
              value={values.kpis}
              maxItems={8}
              placeholder="Type a KPI and press Enter"
              aria-label="KPIs"
              onChange={(next) => set("kpis", next)}
            />
          </FormField>
          {kpiSuggestions.length && values.kpis.length < 8 ? (
            <div className="-mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Suggested:</span>
              {kpiSuggestions.map((kpi) => (
                <button
                  key={kpi}
                  type="button"
                  className={chipVariants({ size: "xs" })}
                  aria-label={`Add KPI ${kpi}`}
                  onClick={() => set("kpis", [...values.kpis, kpi])}
                >
                  <Plus aria-hidden />
                  {kpi}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="min-w-0">
              <label htmlFor="goal-active" className="text-sm font-medium">
                Active
              </label>
              <p className="text-xs text-pretty text-muted-foreground">
                Inactive goals are hidden from goal pickers and left out of the AI&apos;s Brand Context.
              </p>
            </div>
            <Switch id="goal-active" checked={values.is_active} onCheckedChange={(checked) => set("is_active", checked)} />
          </div>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {goal ? "Save changes" : "Create goal"}
        </Button>
      </DialogFooter>
    </form>
  )
}
