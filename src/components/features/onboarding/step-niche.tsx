"use client"

import { Circle, CircleAlert, CircleCheck, Lightbulb, PenLine } from "lucide-react"
import { AiButton, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { AiError, NicheOption } from "@/lib/ai"
import { cn } from "@/lib/utils"
import { useCopy } from "./copy"
import { NicheCard } from "./niche-card"
import { clarityChecks, editNiche, type ClarityCheck, type NicheResult } from "./niche-model"
import { LIMITS, norm, positioningOf, type StepKey, type WizardMode } from "./onboarding-model"
import { fid, SentenceRow, type StepProps } from "./steps-profile"

export interface NicheStepProps extends StepProps {
  result: NicheResult | null
  pending: boolean
  error: AiError | null
  mode: WizardMode
  /** Niche-only re-run: also replace the workspace pillars (confirmed on save). */
  replacePillars: boolean
  onReplacePillarsChange: (value: boolean) => void
  onGenerate: () => void
  onChoose: (option: NicheOption) => void
  onWriteOwn: () => void
  onFix: (step: StepKey) => void
}

const focusField = (field: string) =>
  requestAnimationFrame(() => {
    const el = document.getElementById(fid(field))
    el?.scrollIntoView({ block: "center" })
    el?.focus({ preventScroll: true })
  })

const isChosen = (chosen: NicheOption | null, option: NicheOption) =>
  Boolean(chosen && chosen.kind === option.kind && norm(chosen.name) === norm(option.name))

/* ------------------------------- Clarity check ----------------------------- */

/** The checks, or — before there's a niche to check — what will be checked. */
function ClarityPanel({ checks, waiting, onFix }: { checks: ClarityCheck[]; waiting: boolean; onFix: (check: ClarityCheck) => void }) {
  const copy = useCopy()
  const t = copy.clarity
  const warnings = waiting ? 0 : checks.filter((c) => !c.ok).length
  return (
    <section aria-labelledby="ob-clarity-title" className="rounded-lg border bg-card p-4 dark:bg-input/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="ob-clarity-title" className="text-sm font-semibold">
            {t.title}
          </h2>
          <p className="text-xs text-muted-foreground">{waiting ? t.waiting : t.description}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground num" aria-live="polite">
          {warnings ? t.toSharpen(warnings) : null}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {checks.map((check) => {
          const item = t.items[check.key]
          const warn = typeof item.warn === "function" ? item.warn(check.count ?? 0) : item.warn
          return (
            <li key={check.key} className="flex items-start gap-2">
              {waiting ? (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : check.ok ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-good-fg" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-fg" aria-hidden />
              )}
              <span className={cn("min-w-0 flex-1 text-sm text-pretty", waiting && "text-muted-foreground")}>{waiting || check.ok ? item.ok : warn}</span>
              {!waiting && !check.ok ? (
                <Button type="button" variant="ghost" size="xs" onClick={() => onFix(check)}>
                  {t.fix}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {!waiting && !warnings ? <p className="mt-3 border-t pt-3 text-xs font-medium text-good-fg">{t.allGood}</p> : null}
    </section>
  )
}

/* ---------------------------------- Step ---------------------------------- */

export function NicheStep({
  answers: a,
  update,
  errors,
  result,
  pending,
  error,
  mode,
  replacePillars,
  onReplacePillarsChange,
  onGenerate,
  onChoose,
  onWriteOwn,
  onFix,
}: NicheStepProps) {
  const copy = useCopy()
  const t = copy.niche
  const checks = clarityChecks(a)
  const statement = positioningOf(a)
  const chosen = a.niche_option

  return (
    <div className="flex flex-col gap-4">
      {result ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ProviderBadge provider={result.provider} model={result.model} />
            <span className="text-xs text-muted-foreground">{result.provider === "offline" ? t.offlineNote : t.aiNote}</span>
          </div>
          <AiButton type="button" size="sm" pending={pending} pendingLabel={t.regenerating} onClick={onGenerate}>
            {t.regenerate}
          </AiButton>
        </div>
      ) : null}

      {error && !pending ? (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-4 dark:bg-input/20">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.errorTitle}</p>
            <p className="text-sm text-pretty text-muted-foreground">{error.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.errorHint}</p>
          </div>
          <AiButton type="button" size="sm" onClick={onGenerate}>
            {t.tryAgain}
          </AiButton>
        </div>
      ) : null}

      {result?.notes.length ? (
        <section aria-labelledby="ob-niche-notes" className="rounded-lg border border-dashed bg-muted/40 px-4 py-3">
          <h2 id="ob-niche-notes" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lightbulb className="size-3.5 text-brand" aria-hidden />
            {t.notesTitle}
          </h2>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-pretty">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result ? (
        <div className={cn("grid gap-3 lg:grid-cols-3", pending && "opacity-70")} aria-busy={pending || undefined}>
          {result.options.map((option, index) => (
            <NicheCard key={`${option.kind}-${option.name}`} option={option} index={index} chosen={isChosen(chosen, option)} onChoose={() => onChoose(option)} />
          ))}
        </div>
      ) : !error ? (
        <section aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Spinner className="text-brand" />
            {t.generating}
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2.5 rounded-lg border bg-card p-4 dark:bg-input/20">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t.ownTitle}</p>
          <p className="text-xs text-muted-foreground">{t.ownText}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onWriteOwn}>
          <PenLine aria-hidden />
          {t.ownButton}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
        <section aria-labelledby="ob-yours-title" className="flex flex-col gap-4 rounded-lg border bg-card p-4 dark:bg-input/20">
          <div>
            <h2 id="ob-yours-title" className="text-sm font-semibold">
              {t.yours}
            </h2>
            <p className="text-xs text-muted-foreground">{t.yoursDescription}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={fid("niche")} className="text-sm font-medium">
              {t.nicheLabel}
              <span className="sr-only"> (required)</span>
            </label>
            <Textarea
              id={fid("niche")}
              data-ob-required
              value={a.niche}
              rows={2}
              maxLength={LIMITS.niche}
              placeholder={t.nichePlaceholder}
              aria-invalid={errors.niche ? true : undefined}
              onChange={(event) => update(editNiche(a, event.target.value))}
              className="min-h-16"
            />
            {errors.niche ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.niche}
              </p>
            ) : !a.niche.trim() ? (
              <p className="text-xs text-muted-foreground">{t.pickFirst}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">{t.positioning}</p>
              <p className="text-xs text-muted-foreground">{t.positioningDescription}</p>
            </div>
            <SentenceRow
              field="audience"
              lead={t.leads.audience}
              hint={t.hints.audience}
              required
              value={a.audience}
              onChange={(audience) => update({ audience })}
              error={errors.audience}
              placeholder={t.placeholders.audience}
            />
            <SentenceRow
              field="result"
              lead={t.leads.result}
              hint={t.hints.result}
              required
              value={a.result}
              onChange={(result) => update({ result })}
              error={errors.result}
              placeholder={t.placeholders.result}
            />
            <SentenceRow
              field="method"
              lead={t.leads.method}
              hint={t.hints.method}
              value={a.method}
              onChange={(method) => update({ method })}
              placeholder={t.placeholders.method}
            />
            <p className="border-t pt-3 text-sm text-pretty" aria-live="polite">
              {statement || <span className="text-muted-foreground">{t.positioningEmpty}</span>}
            </p>
          </div>
          {chosen ? (
            <p className="text-xs text-pretty text-muted-foreground">{mode === "first" ? t.appliedFirst : t.appliedRerun}</p>
          ) : null}
          {mode === "niche" && chosen?.pillars.length ? (
            <label htmlFor="ob-replace-pillars" className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-background px-3 py-2.5">
              <Checkbox id="ob-replace-pillars" checked={replacePillars} onCheckedChange={(value) => onReplacePillarsChange(value === true)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm">{t.replacePillars(chosen.pillars.length)}</span>
                <span className="block text-xs text-muted-foreground">{t.replacePillarsHint}</span>
              </span>
            </label>
          ) : null}
        </section>

        <ClarityPanel
          checks={checks}
          waiting={!a.niche.trim()}
          onFix={(check) => {
            if ("field" in check.fix) focusField(check.fix.field)
            else onFix(check.fix.step)
          }}
        />
      </div>
    </div>
  )
}
