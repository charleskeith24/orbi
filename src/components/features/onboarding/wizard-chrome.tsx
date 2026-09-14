"use client"

import { ArrowLeft, X } from "lucide-react"
import Link from "next/link"
import { OrbiLogo } from "@/components/app-shell/orbi-logo"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"
import { ONBOARDING_LANGS, useCopy, type OnboardingLang } from "./copy"
import { countedSteps, DISCOVERY_STEPS, stepNumber, type StepKey } from "./onboarding-model"

export type WizardWidth = "narrow" | "wide"
export const WIDTH_CLASS: Record<WizardWidth, string> = { narrow: "max-w-2xl", wide: "max-w-6xl" }

/** English / Taglish switch, available on every step. */
export function LanguageToggle({ lang, onChange, className }: { lang: OnboardingLang; onChange: (lang: OnboardingLang) => void; className?: string }) {
  const copy = useCopy()
  return (
    <div role="group" aria-label={copy.lang.label} className={cn("flex items-center rounded-md border bg-card p-0.5 dark:bg-input/30", className)}>
      {ONBOARDING_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={cn(
            "h-6 rounded-sm px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            lang === l ? "bg-brand-soft text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l === "english" ? "EN" : copy.lang.taglish}
        </button>
      ))}
    </div>
  )
}

/** Sticky top bar: mark, step counter, language, theme, optional exit and the progress, grouped by phase. */
export function WizardHeader({
  flow,
  step,
  maxStep,
  onStepSelect,
  subtitle,
  exitHref,
  lang,
  onLangChange,
}: {
  flow: readonly StepKey[]
  step: number
  maxStep: number
  onStepSelect: (index: number) => void
  subtitle: string
  /** Shown when leaving is possible (re-running setup on a finished workspace). */
  exitHref?: string | null
  lang: OnboardingLang
  onLangChange: (lang: OnboardingLang) => void
}) {
  const copy = useCopy()
  const counted = countedSteps(flow)
  const number = stepNumber(flow, step)
  const groups = [
    { label: copy.phases.discovery, keys: counted.filter((k) => DISCOVERY_STEPS.has(k)) },
    { label: copy.phases.setup, keys: counted.filter((k) => !DISCOVERY_STEPS.has(k)) },
  ].filter((g) => g.keys.length)

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3 md:px-6">
        <OrbiLogo className="h-6" />
        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
        <p className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</p>
        <div className="ml-auto flex items-center gap-1">
          {number ? <span className="mr-1 hidden text-xs text-muted-foreground sm:inline num">{copy.common.stepOf(number, counted.length)}</span> : null}
          <LanguageToggle lang={lang} onChange={onLangChange} />
          <ThemeToggle />
          {exitHref ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={exitHref}>{copy.common.exitSetup}</Link>
              </Button>
              {/* Phones: the same exit as an icon, so a re-run is never a dead end. */}
              <Button asChild variant="ghost" size="icon-sm" className="sm:hidden">
                <Link href={exitHref} aria-label={copy.common.exitSetup}>
                  <X aria-hidden />
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {number ? (
        <nav aria-label={copy.common.progress} className="mx-auto flex w-full max-w-6xl gap-3 px-4 pb-2 md:px-6">
          {groups.map((group) => (
            <div key={group.label} className="min-w-0" style={{ flex: group.keys.length }}>
              {groups.length > 1 ? <p className="mb-0.5 hidden truncate text-[11px] leading-4 font-medium text-muted-foreground md:block">{group.label}</p> : null}
              <ol className="flex gap-1">
                {group.keys.map((key) => {
                  const index = flow.indexOf(key)
                  const current = index === step
                  const done = index < step
                  const reachable = index <= maxStep && !current
                  const label = copy.steps[key].short
                  return (
                    <li key={key} className="min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!reachable}
                        onClick={() => onStepSelect(index)}
                        aria-current={current ? "step" : undefined}
                        aria-label={copy.common.stepAria(stepNumber(flow, index), label, done ? "done" : current ? "current" : "")}
                        title={copy.steps[key].title}
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
                          className={cn("hidden truncate text-[11px] leading-4 md:block", current ? "font-medium text-foreground" : "text-muted-foreground")}
                        >
                          {label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </nav>
      ) : null}
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
  const copy = useCopy()
  return (
    <footer className="sticky bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className={cn("mx-auto flex min-h-16 w-full items-center gap-2 px-4 py-3 md:px-6", WIDTH_CLASS[width])}>
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={backDisabled}>
            <ArrowLeft aria-hidden />
            {copy.common.back}
          </Button>
        ) : null}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <KbdGroup>
              <Kbd>{IS_MAC ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>Enter</Kbd>
            </KbdGroup>
            {copy.common.toContinue}
          </span>
          {children}
        </div>
      </div>
    </footer>
  )
}

/** Eyebrow, title and description of a step. The title takes focus when the step changes. */
export function StepHeading({
  eyebrow,
  title,
  description,
  headingRef,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  headingRef?: React.Ref<HTMLHeadingElement>
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="text-xs font-medium text-muted-foreground num">{eyebrow}</p> : null}
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
