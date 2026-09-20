"use client"

import { Circle, CircleCheck } from "lucide-react"
import { SectionHeader } from "@/components/common"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import { todayMessages } from "./messages"
import type { RhythmKey, RhythmStep } from "./today-utils"

/** Where each habit happens on this page (Capture opens Quick Capture instead). */
const ANCHORS: Record<Exclude<RhythmKey, "capture">, string> = {
  create: "#to-record",
  review: "#to-review",
  publish: "#to-post",
  engage: "#engagement",
}

const ITEM =
  "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 @xl:flex-row @xl:justify-center @xl:gap-1.5 @xl:px-2.5"

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
  const t = useT(todayMessages)
  const Icon = step.done ? CircleCheck : Circle
  const body = (
    <>
      <Icon className={cn("size-4 shrink-0", step.done ? "text-good-fg" : "text-muted-foreground/60")} aria-hidden />
      <span className="max-w-full truncate text-[11px] font-medium @xl:text-sm">{step.label}</span>
      <span className="text-xs text-muted-foreground num" aria-hidden>
        {step.count}
      </span>
      {/* The number in words, for screen readers; hover shows it with the habit's description. */}
      <span className="sr-only">
        {step.done ? t("rhythm_sr_done") : t("rhythm_sr_not_yet")}
        {step.detail}
      </span>
    </>
  )
  const title = `${step.description} — ${step.detail}`
  const className = cn(ITEM, "bg-muted/40 hover:bg-muted dark:bg-muted/25")
  if (step.key === "capture") {
    return (
      <button type="button" title={title} className={className} onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
        {body}
      </button>
    )
  }
  const hash = ANCHORS[step.key]
  return (
    <a href={hash} title={title} className={className} onClick={(event) => jumpTo(event, hash)}>
      {body}
    </a>
  )
}

/**
 * Capture · Create · Review · Publish · Engage — each ticked when today's activity proves it (spec §52). Calm UI:
 * one quiet row of numbers; what each number means is in its tooltip, the screen-reader text and the ⓘ.
 */
export function RhythmStrip({ steps, className }: { steps: RhythmStep[]; className?: string }) {
  const t = useT(todayMessages)
  const done = steps.filter((step) => step.done).length
  return (
    <section aria-labelledby="daily-rhythm" className={cn("flex min-w-0 flex-col gap-2 @3xl:flex-row @3xl:items-center @3xl:gap-4", className)}>
      <SectionHeader
        id="daily-rhythm"
        title={
          <>
            {t("rhythm_title")}
            <span className="ml-1.5 font-normal text-muted-foreground num">{`${done}/${steps.length}`}</span>
          </>
        }
        info={t("rhythm_info")}
        infoTitle={t("rhythm_title")}
        className="shrink-0"
      />
      <ol className="grid min-w-0 flex-1 grid-cols-5 gap-1 @xl:gap-2">
        {steps.map((step) => (
          <li key={step.key} className="min-w-0">
            <RhythmItem step={step} />
          </li>
        ))}
      </ol>
    </section>
  )
}
