"use client"

import { ArrowLeft, Circle, CircleAlert, CircleCheck, RotateCcw } from "lucide-react"
import { useEffect, useRef } from "react"
import { OrbiLogo } from "@/components/app-shell/orbi-logo"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useCopy } from "./copy"
import { TAP } from "./wizard-chrome"

export const BUILD_ITEMS = ["brand", "pillars", "schedule", "goals", "ideas"] as const
export type BuildItem = (typeof BUILD_ITEMS)[number]

export interface BuildState {
  /** Finished items, with a short result ("5 pillars"). */
  done: Partial<Record<BuildItem, string>>
  /** Items whose work is running now. */
  running: BuildItem[]
  error: string | null
}

/**
 * After screen 4 (not a step): what Orbi is creating, each item ticked when its real work finishes —
 * no timers, no animation beyond the spinner. On failure the error stays with "Try again"; answers are kept.
 */
export function BuildingScreen({ state, onRetry, onBack }: { state: BuildState; onRetry: () => void; onBack: () => void }) {
  const copy = useCopy()
  const t = copy.quick
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    titleRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <section aria-labelledby="ob-building-title" aria-busy={!state.error || undefined} className="w-full max-w-sm">
        <OrbiLogo className="mx-auto h-7" />
        <div className="mt-6 rounded-lg border bg-card p-5 text-card-foreground shadow-xs">
          <h1 ref={titleRef} id="ob-building-title" tabIndex={-1} className="text-lg font-semibold outline-none">
            {t.building}
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t.buildingText}</p>
          <ul className="mt-4 flex flex-col gap-2.5" aria-live="polite">
            {BUILD_ITEMS.map((item) => {
              const done = state.done[item]
              const running = !done && state.running.includes(item) && !state.error
              return (
                <li key={item} className="flex items-center gap-2.5 text-sm">
                  {done !== undefined ? (
                    <CircleCheck className="size-4 shrink-0 text-good-fg" aria-hidden />
                  ) : running ? (
                    <Spinner className="size-4 shrink-0 text-brand" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={done !== undefined || running ? "text-foreground" : "text-muted-foreground"}>{t.items[item]}</span>
                  {done ? <span className="ml-auto truncate text-xs text-muted-foreground num">{done}</span> : null}
                </li>
              )
            })}
          </ul>
          {state.error ? (
            <div role="alert" className="mt-4 border-t pt-4">
              <p className="flex items-start gap-2 text-sm font-medium">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
                {t.failed}
              </p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">{state.error}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.failedHint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={onRetry} className={TAP}>
                  <RotateCcw aria-hidden />
                  {t.tryAgain}
                </Button>
                <Button type="button" variant="ghost" onClick={onBack} className={TAP}>
                  <ArrowLeft aria-hidden />
                  {t.backToAnswers}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
