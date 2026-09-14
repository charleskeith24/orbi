"use client"

import { ChartColumn, Circle, CircleCheck } from "lucide-react"
import Link from "next/link"
import { EmptyState, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { FirstStep } from "./first-run"

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
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  return (
    <SectionCard
      title="Get your content system running"
      description="Home fills in as you work — every number here comes from your own ideas, posts and analytics."
      action={
        <span className="text-xs text-muted-foreground num">
          {done} of {steps.length} done
        </span>
      }
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
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.label}
                    {step.done ? <span className="sr-only"> (done)</span> : null}
                  </p>
                  <p className="text-xs text-pretty text-muted-foreground">{step.done ? "Done" : step.detail}</p>
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
  return (
    <SectionCard title="Performance" description="Top content, platform growth and pillar performance" className={className}>
      <EmptyState
        compact
        icon={ChartColumn}
        title="Performance starts with your first published post"
        description="Log a post and its analytics — top content, platform growth and pillar performance are all computed from your own numbers."
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "log-post" })}>
            Log a published post
          </Button>
        }
      />
    </SectionCard>
  )
}
