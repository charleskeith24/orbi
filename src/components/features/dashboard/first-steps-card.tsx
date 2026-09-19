"use client"

import { ChartColumn, Circle, CircleCheck } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { FirstStep, FirstStepAction } from "./first-run"
import { dashboardMessages } from "./messages"

/** A first-run step's or first-week mission's one action: a link, or one of the app-wide dialogs. */
export function StepActionButton({
  action,
  children,
  variant = "default",
  className,
  "aria-label": ariaLabel,
}: {
  action: FirstStepAction
  children: React.ReactNode
  variant?: "default" | "outline"
  className?: string
  "aria-label"?: string
}) {
  if (action.kind === "link") {
    return (
      <Button asChild size="sm" variant={variant} className={className}>
        <Link href={action.href} aria-label={ariaLabel}>
          {children}
        </Link>
      </Button>
    )
  }
  const open = () => {
    if (action.dialog === "add-metrics") uiActions.openDialog({ type: "add-metrics", itemId: action.itemId })
    else uiActions.openDialog({ type: action.dialog })
  }
  return (
    <Button type="button" size="sm" variant={variant} className={className} aria-label={ariaLabel} onClick={open}>
      {children}
    </Button>
  )
}

/**
 * First-run checklist (behind "All steps" in Home's focus hero): the steps that turn a new workspace into a working
 * system, each ticked off from real data. The next one is the hero itself.
 */
export function StepList({ steps }: { steps: FirstStep[] }) {
  const t = useT(dashboardMessages)
  const next = steps.find((s) => !s.done)
  return (
    <ol className="flex min-w-0 flex-col divide-y">
      {steps.map((step, index) => (
        <li key={step.key} className="flex min-w-0 items-start gap-2.5 py-2 first:pt-0 last:pb-0">
          {step.done ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-good-fg" aria-hidden />
          ) : (
            <Circle className={cn("mt-0.5 size-4 shrink-0", step === next ? "text-brand" : "text-muted-foreground")} aria-hidden />
          )}
          <p className={cn("min-w-0 flex-1 text-sm text-pretty", step.done && "text-muted-foreground")}>
            <span className="sr-only">{t("step_sr", { n: index + 1 })}</span>
            {step.label}
            {step.done ? <span className="sr-only">{t("done_sr")}</span> : null}
          </p>
          {step.done ? null : (
            <StepActionButton action={step.action} variant="outline" className="-my-0.5 shrink-0">
              {step.cta}
            </StepActionButton>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Stands in for the performance cards until something has been published. */
export function PerformancePlaceholder({ className }: { className?: string }) {
  const t = useT(dashboardMessages)
  return (
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
      className={cn("rounded-lg border border-dashed", className)}
    />
  )
}
