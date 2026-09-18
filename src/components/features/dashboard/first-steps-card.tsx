"use client"

import { ChartColumn, Circle, CircleCheck } from "lucide-react"
import Link from "next/link"
import { EmptyState, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { FirstStep } from "./first-run"
import { dashboardMessages } from "./messages"

function StepButton({ step, primary }: { step: FirstStep; primary: boolean }) {
  const variant = primary ? "default" : "outline"
  if (step.action.kind === "link") {
    return (
      <Button asChild size="sm" variant={variant} className="self-start">
        <Link href={step.action.href}>{step.cta}</Link>
      </Button>
    )
  }
  const dialog = step.action.dialog
  return (
    <Button type="button" size="sm" variant={variant} className="self-start" onClick={() => uiActions.openDialog({ type: dialog })}>
      {step.cta}
    </Button>
  )
}

/** First-run Home: the next best actions for a new workspace, each ticked off from real data. */
export function FirstStepsCard({ steps, className }: { steps: FirstStep[]; className?: string }) {
  const t = useT(dashboardMessages)
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  return (
    <SectionCard
      title={t("first_title")}
      description={t("first_description")}
      action={<span className="text-xs text-muted-foreground num">{t("steps_done", { done, total: steps.length })}</span>}
      className={className}
    >
      <ol className="grid grid-cols-1 gap-2 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {steps.map((step, index) => {
          const isNext = step === next
          return (
            <li
              key={step.key}
              className={cn(
                "flex min-w-0 gap-2.5 rounded-lg border p-3",
                isNext ? "border-brand/40 bg-brand-soft" : "bg-card",
                step.done && "bg-muted/30 dark:bg-muted/20"
              )}
            >
              {step.done ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-good-fg" aria-hidden />
              ) : (
                <Circle className={cn("mt-0.5 size-4 shrink-0", isNext ? "text-brand" : "text-muted-foreground")} aria-hidden />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium text-pretty", step.done && "text-muted-foreground")}>
                    <span className="sr-only">{t("step_sr", { n: index + 1 })}</span>
                    {step.label}
                    {step.done ? <span className="sr-only">{t("done_sr")}</span> : null}
                  </p>
                  <p className="text-xs text-pretty text-muted-foreground">{step.done ? t("done") : step.detail}</p>
                </div>
                {step.done ? null : <StepButton step={step} primary={isNext} />}
              </div>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

/** Stands in for the four performance cards until something has been published. */
export function PerformancePlaceholder({ className }: { className?: string }) {
  const t = useT(dashboardMessages)
  return (
    <SectionCard title={t("performance_title")} description={t("performance_description")} className={className}>
      <EmptyState
        compact
        icon={ChartColumn}
        title={t("performance_empty_title")}
        description={t("performance_empty_description")}
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
            {t("log_published")}
          </Button>
        }
      />
    </SectionCard>
  )
}
