"use client"

import { addWeeks } from "date-fns"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Meter, SectionCard, StatusPill, ViewToggle } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatDate, parseDate, toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { weekLabel } from "./calendar-model"
import { plannerMessages } from "./planner-messages"
import { PLANNER_STEPS, type PlanDocument } from "./planner-model"
import { planTotals } from "./weekly-plan-document"

/** A week key ('YYYY-MM-DD') as a local date. */
export const weekDate = (key: string) => parseDate(key) ?? new Date(0)

/** This week / next week, or step week by week (never into the past). */
export function WeekSwitcher({ weekKey, thisKey, onChange }: { weekKey: string; thisKey: string; onChange: (key: string) => void }) {
  const t = useT(plannerMessages)
  const start = weekDate(weekKey)
  const nextKey = toISODate(addWeeks(weekDate(thisKey), 1))
  const choice = weekKey === thisKey ? "this" : weekKey === nextKey ? "next" : "later"
  return (
    <div className="flex flex-wrap items-center gap-1">
      <ViewToggle
        value={choice}
        onChange={(value) => onChange(value === "this" ? thisKey : nextKey)}
        options={[
          { value: "this", label: t("this_week") },
          { value: "next", label: t("next_week") },
        ]}
        aria-label={t("week_to_plan")}
      />
      <Button type="button" size="icon-sm" variant="ghost" aria-label={t("previous_week")} disabled={weekKey <= thisKey} onClick={() => onChange(toISODate(addWeeks(start, -1)))}>
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium num">{weekLabel(start)}</span>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={t("next_week")} onClick={() => onChange(toISODate(addWeeks(start, 1)))}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )
}

/** The seven steps; done steps show a check, every step is one click away. */
export function PlannerStepper({ step, done, onStep }: { step: number; done: boolean[]; onStep: (step: number) => void }) {
  const t = useT(plannerMessages)
  return (
    <nav aria-label={t("steps_nav")} className="min-w-0">
      <ol className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin md:grid md:grid-cols-7 md:overflow-visible md:pb-0">
        {PLANNER_STEPS.map((s, index) => {
          const current = index === step
          const complete = done[index] && !current
          const title = t(`step_${s.id}_title`)
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold num",
                  complete ? "border-transparent bg-good/15 text-good-fg" : current ? "border-brand/60 text-brand" : "text-muted-foreground"
                )}
              >
                {complete ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="min-w-0 truncate text-xs font-medium">{t(`step_${s.id}_short`)}</span>
            </>
          )
          const base = "flex w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left"
          return (
            <li key={s.id} className="min-w-0 shrink-0 md:shrink">
              {current ? (
                // The current step is where you are, not a control.
                <div aria-current="step" className={cn(base, "border-brand/50 bg-brand-soft")}>
                  {body}
                  <span className="sr-only">{t("step_current_sr", { step: index + 1, title })}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStep(index)}
                  aria-label={t(done[index] ? "step_aria_done" : "step_aria", { step: index + 1, title })}
                  className={cn(base, "bg-card outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50")}
                >
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Focus, posts planned vs the weekly target, posting slots filled, and whether the plan is saved. */
export function SummaryCard({ weekText, focus, doc, target, planSaved }: { weekText: string; focus: string; doc: PlanDocument; target: number; planSaved: string | null }) {
  const t = useT(plannerMessages)
  const { planned, notCreated } = planTotals(doc)
  return (
    <SectionCard title={t("at_a_glance")} description={weekText}>
      <dl className="grid min-w-0 gap-3 text-sm">
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">{t("focus")}</dt>
          <dd className="text-pretty">{focus.trim() || <span className="text-muted-foreground">{t("not_set_yet")}</span>}</dd>
        </div>
        <div className="grid gap-1.5">
          <dt className="text-xs text-muted-foreground">{t("posts_planned")}</dt>
          <dd>
            <span className="font-semibold num">{planned}</span> <span className="text-muted-foreground">{t("of_target", { target })}</span>
            {notCreated ? <span className="text-xs text-muted-foreground">{t("not_created_suffix", { count: notCreated })}</span> : null}
          </dd>
          <Meter
            size="sm"
            value={planned}
            max={Math.max(target, planned, 1)}
            target={target || undefined}
            tone={planned >= target ? "good" : "brand"}
            aria-label={t("meter_label")}
            valueText={t("meter_value", { count: planned, target })}
          />
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">{t("slots_filled")}</dt>
          <dd className="num">{t("count_of", { count: doc.slotsFilled, total: doc.slotsTotal })}</dd>
        </div>
      </dl>
      {planSaved ? (
        <StatusPill tone="good" className="mt-3">
          {t("plan_saved_at", { date: formatDate(planSaved, "MMM d, h:mm a") })}
        </StatusPill>
      ) : null}
    </SectionCard>
  )
}
