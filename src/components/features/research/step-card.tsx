import { Check } from "lucide-react"
import { useId } from "react"
import { cn } from "@/lib/utils"

export type StepState = "done" | "current" | "locked"

/** A numbered step of the Inspiration → Original flow. */
export function StepCard({
  step,
  title,
  description,
  state,
  action,
  children,
}: {
  step: number
  title: string
  description?: string
  state: StepState
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 pt-3.5">
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold num",
            state === "done" && "bg-foreground text-background",
            state === "current" && "border border-brand text-brand",
            state === "locked" && "border text-muted-foreground"
          )}
        >
          {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : step}
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={headingId} className="text-sm leading-6 font-medium">
            <span className="sr-only">Step {step}: </span>
            {title}
          </h2>
          {description ? <p className="text-xs text-pretty text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={cn("min-w-0 px-4 pt-3 pb-4", state === "locked" && "text-sm text-muted-foreground")}>{children}</div>
    </section>
  )
}
