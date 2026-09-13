"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"
import { STEP_COUNT, STEPS } from "./onboarding-model"

/** Product mark (same glyph as the sidebar's BrandMark). */
export function OnboardingMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground", className)}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4.5" fill="none">
        <path
          d="M5 19V5h7a4.5 4.5 0 0 1 0 9H5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17.5" cy="18" r="2" fill="currentColor" />
      </svg>
    </span>
  )
}

export type WizardWidth = "narrow" | "wide"
export const WIDTH_CLASS: Record<WizardWidth, string> = { narrow: "max-w-2xl", wide: "max-w-6xl" }

/** Sticky top bar: mark, step counter, theme, optional exit and the 10-segment progress. */
export function WizardHeader({
  step,
  maxStep,
  onStepSelect,
  exitHref,
}: {
  step: number
  maxStep: number
  onStepSelect: (index: number) => void
  /** Shown when leaving is possible (re-running setup on a finished workspace). */
  exitHref?: string | null
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
        <OnboardingMark />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">Personal Brand OS</p>
          <p className="truncate text-xs text-muted-foreground">Setup</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground num">
            Step {step + 1} of {STEP_COUNT}
          </span>
          <ThemeToggle />
          {exitHref ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={exitHref}>Exit setup</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <nav aria-label="Setup progress" className="mx-auto w-full max-w-6xl px-4 pb-2 md:px-6">
        <ol className="flex gap-1">
          {STEPS.map((s, index) => {
            const current = index === step
            const done = index < step
            const reachable = index <= maxStep && !current
            return (
              <li key={s.key} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => onStepSelect(index)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${s.short}${done ? ", done" : current ? ", current" : ""}`}
                  title={s.title}
                  className="group flex w-full flex-col gap-1.5 rounded-sm pt-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1 w-full rounded-full transition-colors",
                      index <= step ? "bg-brand" : index <= maxStep ? "bg-brand/35" : "bg-muted",
                      reachable && "group-hover:opacity-75"
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "hidden truncate text-[11px] leading-4 md:block",
                      current ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.short}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </header>
  )
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent)

/** Sticky bottom bar: Back on the left; keyboard hint, extras and the primary action on the right. */
export function WizardFooter({
  width,
  onBack,
  backDisabled,
  children,
}: {
  width: WizardWidth
  onBack?: (() => void) | null
  backDisabled?: boolean
  /** Right-side actions (the primary button last). */
  children: React.ReactNode
}) {
  return (
    <footer className="sticky bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className={cn("mx-auto flex min-h-16 w-full items-center gap-2 px-4 py-3 md:px-6", WIDTH_CLASS[width])}>
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={backDisabled}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
        ) : null}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <KbdGroup>
              <Kbd>{IS_MAC ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>Enter</Kbd>
            </KbdGroup>
            to continue
          </span>
          {children}
        </div>
      </div>
    </footer>
  )
}

/** Eyebrow, title and description of a step. The title takes focus when the step changes. */
export function StepHeading({
  index,
  title,
  description,
  headingRef,
  actions,
}: {
  index: number
  title: string
  description: string
  headingRef?: React.Ref<HTMLHeadingElement>
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground num">
          Step {index + 1} of {STEP_COUNT}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-balance outline-none">
          {title}
        </h1>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** A titled group of fields inside a step. */
export function StepSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? <p className="text-xs text-pretty text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}
