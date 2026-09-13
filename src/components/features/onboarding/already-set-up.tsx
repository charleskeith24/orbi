"use client"

import { ArrowRight, CircleCheck, RotateCcw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils"
import { OnboardingMark } from "./wizard-chrome"

/** Shown on /onboarding when the workspace finished setup (e.g. the demo): re-run or go back. */
export function AlreadySetUp({
  brandName,
  stats,
  hasDraft,
  onRerun,
  onResume,
}: {
  brandName: string
  stats: { label: string; value: number }[]
  /** A re-run was started earlier in this browser. */
  hasDraft: boolean
  onRerun: () => void
  onResume: () => void
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <OnboardingMark className="size-10" />
          <p className="mt-3 text-sm font-semibold">Personal Brand OS</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Strategy → Create → Publish → Analyze → Improve</p>
        </div>
        <section aria-labelledby="ob-done-title" className="mt-6 rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-medium text-good-fg">
            <CircleCheck className="size-4" aria-hidden />
            Setup complete{brandName ? ` · ${brandName}` : ""}
          </p>
          <h1 id="ob-done-title" className="mt-2 text-lg font-semibold">
            Your workspace is already set up
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Re-running setup updates your Brand HQ — positioning, voice, pillars, goals, primary persona, platforms and posting
            schedule. Pillars, goals and personas are matched by name and updated, never duplicated. Your content and analytics
            stay as they are.
          </p>
          {stats.length ? (
            <dl className="mt-4 grid grid-cols-3 divide-x rounded-md border bg-muted/40 text-center">
              {stats.map((stat) => (
                <div key={stat.label} className="px-2 py-2.5">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="text-sm font-semibold num">{formatNumber(stat.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-5 flex flex-col gap-2">
            {hasDraft ? (
              <>
                <Button type="button" size="lg" onClick={onResume}>
                  Resume setup
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
                <Button type="button" variant="outline" onClick={onRerun}>
                  <RotateCcw aria-hidden />
                  Start over from my Brand HQ
                </Button>
              </>
            ) : (
              <Button type="button" size="lg" onClick={onRerun}>
                <RotateCcw aria-hidden />
                Re-run setup
              </Button>
            )}
            <Button asChild variant={hasDraft ? "ghost" : "outline"}>
              <Link href="/">Back to the app</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
