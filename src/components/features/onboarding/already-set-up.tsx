"use client"

import { ArrowRight, CircleCheck, Compass, RotateCcw } from "lucide-react"
import Link from "next/link"
import { OrbiLogo } from "@/components/app-shell/orbi-logo"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils"
import { useCopy } from "./copy"

/** Shown on /onboarding when the workspace finished setup: re-run setup, re-run Niche Discovery, or go back. */
export function AlreadySetUp({
  brandName,
  stats,
  hasDraft,
  onRerun,
  onResume,
}: {
  brandName: string
  stats: { pillars: number; personas: number; ideas: number }
  /** A re-run was started earlier in this browser. */
  hasDraft: boolean
  onRerun: () => void
  onResume: () => void
}) {
  const copy = useCopy()
  const t = copy.done
  const rows = [
    { label: t.stats.pillars, value: stats.pillars },
    { label: t.stats.personas, value: stats.personas },
    { label: t.stats.ideas, value: stats.ideas },
  ]
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <OrbiLogo className="h-9" />
          <p className="mt-2 text-xs text-muted-foreground">Strategy → Create → Publish → Analyze → Improve</p>
        </div>
        <section aria-labelledby="ob-done-title" className="mt-6 rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-medium text-good-fg">
            <CircleCheck className="size-4" aria-hidden />
            {t.complete}
            {brandName ? ` · ${brandName}` : ""}
          </p>
          <h1 id="ob-done-title" className="mt-2 text-lg font-semibold">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t.text}</p>
          <dl className="mt-4 grid grid-cols-3 divide-x rounded-md border bg-muted/40 text-center">
            {rows.map((stat) => (
              <div key={stat.label} className="px-2 py-2.5">
                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="text-sm font-semibold num">{formatNumber(stat.value)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-col gap-2">
            {hasDraft ? (
              <>
                <Button type="button" size="lg" onClick={onResume}>
                  {t.resume}
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
                <Button type="button" variant="outline" onClick={onRerun}>
                  <RotateCcw aria-hidden />
                  {t.startOver}
                </Button>
              </>
            ) : (
              <Button type="button" size="lg" onClick={onRerun}>
                <RotateCcw aria-hidden />
                {t.rerun}
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link href="/">{t.back}</Link>
            </Button>
          </div>
          <div className="mt-5 border-t pt-4">
            <p className="text-sm font-medium">{t.rerunNiche}</p>
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{t.rerunNicheText}</p>
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href="/onboarding?step=niche">
                <Compass aria-hidden />
                {t.rerunNiche}
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
