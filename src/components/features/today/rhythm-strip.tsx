"use client"

import { Circle, CircleCheck } from "lucide-react"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { RhythmKey, RhythmStep } from "./today-utils"

/** Where each habit happens on this page (Capture opens Quick Capture instead). */
const ANCHORS: Record<Exclude<RhythmKey, "capture">, string> = {
  create: "#to-record",
  review: "#to-review",
  publish: "#to-post",
  engage: "#engagement",
}

const ITEM =
  "flex w-full min-w-0 flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 @xl:px-2"

/** Scroll to the section, move focus there for keyboard users and ring it briefly so the eye lands on it. */
function jumpTo(event: React.MouseEvent<HTMLAnchorElement>, hash: string) {
  const target = document.getElementById(hash.slice(1))
  if (!target) return
  event.preventDefault()
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  target.focus({ preventScroll: true })
  target.dataset.flash = "true"
  window.setTimeout(() => {
    delete target.dataset.flash
  }, 1400)
  window.history.replaceState(window.history.state, "", hash)
}

function RhythmItem({ step }: { step: RhythmStep }) {
  const Icon = step.done ? CircleCheck : Circle
  const body = (
    <>
      <span className="flex min-w-0 flex-col items-center gap-1 @xl:flex-row @xl:gap-1.5">
        <Icon className={cn("size-4 shrink-0", step.done ? "text-good-fg" : "text-muted-foreground/60")} aria-hidden />
        <span className="max-w-full truncate text-[11px] font-medium @xl:text-sm">{step.label}</span>
        <span className="sr-only">{step.done ? " — done: " : " — not yet: "}</span>
      </span>
      <span className="hidden truncate text-xs text-muted-foreground @xl:block @xl:pl-5.5">{step.detail}</span>
      <span className="sr-only @xl:hidden">{step.detail}</span>
    </>
  )
  const title = `${step.description} — ${step.detail}`
  if (step.key === "capture") {
    return (
      <button type="button" title={title} className={ITEM} onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
        {body}
      </button>
    )
  }
  const hash = ANCHORS[step.key]
  return (
    <a href={hash} title={title} className={ITEM} onClick={(event) => jumpTo(event, hash)}>
      {body}
    </a>
  )
}

/** Capture · Create · Review · Publish · Engage — each ticked when today's activity proves it (spec §52). */
export function RhythmStrip({ steps, className }: { steps: RhythmStep[]; className?: string }) {
  const done = steps.filter((step) => step.done).length
  return (
    <section
      aria-labelledby="daily-rhythm"
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-3 py-3 @3xl:flex-row @3xl:items-center @3xl:gap-4 @3xl:px-4",
        className
      )}
    >
      <div className="flex shrink-0 items-baseline justify-between gap-2 px-1 @3xl:w-36 @3xl:flex-col @3xl:items-start @3xl:justify-start @3xl:gap-0">
        <h2 id="daily-rhythm" className="text-sm font-medium">
          Daily rhythm
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="num">{done}</span> of {steps.length} done today
        </p>
      </div>
      <ol className="grid min-w-0 flex-1 grid-cols-5 gap-1">
        {steps.map((step) => (
          <li key={step.key} className="min-w-0">
            <RhythmItem step={step} />
          </li>
        ))}
      </ol>
    </section>
  )
}
