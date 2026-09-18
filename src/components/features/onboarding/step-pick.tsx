"use client"

import { ChevronDown, CircleAlert, PenLine } from "lucide-react"
import { useState } from "react"
import { AiButton, ColorDot, ProviderBadge } from "@/components/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { AiError, NicheOption } from "@/lib/ai"
import { CATEGORICAL_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useCopy } from "./copy"
import { editNiche, type NicheResult } from "./niche-model"
import { LIMITS, norm, type WizardMode } from "./onboarding-model"
import { bestMatchIndex, rankedOptions } from "./quick-setup"
import { fid, type StepProps } from "./steps-profile"
import { TAP } from "./wizard-chrome"

export interface PickStepProps extends StepProps {
  result: NicheResult | null
  pending: boolean
  error: AiError | null
  mode: WizardMode
  /** Screens 2–3 hold enough to suggest directions. */
  canSuggest: boolean
  /** Niche-only re-run: also replace the workspace pillars (confirmed on save). */
  replacePillars: boolean
  onReplacePillarsChange: (value: boolean) => void
  onGenerate: () => void
  onChoose: (option: NicheOption) => void
  onWriteOwn: () => void
  /** Leave "Write my own" and go back to screen 2 for suggestions. */
  onFindForMe: () => void
}

const isChosen = (chosen: NicheOption | null, option: NicheOption) =>
  Boolean(chosen && chosen.kind === option.kind && norm(chosen.name) === norm(option.name))

const firstSentence = (text: string) => text.trim().split(/(?<=[.!?])\s+/)[0] ?? ""

/** The round radio mark on a choice card. */
function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", checked ? "border-brand bg-brand" : "border-input bg-background")}>
      {checked ? <span className="size-1.5 rounded-full bg-background" /> : null}
    </span>
  )
}

/** One direction: title, one "why it fits" sentence; pillars, watch-out, posts and money on demand. */
function DirectionCard({
  option,
  index,
  best,
  checked,
  focusable,
  onChoose,
  onKeyDown,
}: {
  option: NicheOption
  index: number
  best: boolean
  checked: boolean
  focusable: boolean
  onChoose: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
}) {
  const copy = useCopy()
  const t = copy.quick
  const n = copy.niche
  const [open, setOpen] = useState(false)
  const detailsId = `ob-niche-details-${index}`
  return (
    <div className={cn("rounded-lg border bg-card transition-colors dark:bg-input/20", checked && "border-brand/60 bg-brand-soft/60 ring-1 ring-brand/30 dark:bg-brand-soft/40")}>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        tabIndex={focusable ? 0 : -1}
        data-niche-choice={index}
        onClick={onChoose}
        onKeyDown={onKeyDown}
        className="flex w-full items-start gap-3 rounded-lg px-4 pt-3.5 pb-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <RadioMark checked={checked} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-balance">{option.name}</span>
            {best ? (
              <Badge variant="secondary" className="font-medium">
                {t.bestMatch}
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block text-sm text-pretty text-muted-foreground">{firstSentence(option.why_it_fits)}</span>
        </span>
      </button>
      <div className="px-4 pb-2 pl-11">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((o) => !o)}
          className={cn("-ml-2 text-muted-foreground", "max-sm:h-9")}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
          {open ? t.hideDetails : t.seeDetails}
        </Button>
      </div>
      {open ? (
        <div id={detailsId} className="flex flex-col gap-3 border-t px-4 py-3 text-xs sm:pl-11">
          <p className="text-muted-foreground">
            {n.kinds[option.kind]} · {n.kindHints[option.kind]}
          </p>
          <div>
            <p className="font-medium">{n.pillars}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {option.pillars.map((p, i) => (
                <li key={p.name} className="flex items-center gap-2">
                  <ColorDot color={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-muted-foreground num">{p.target_percentage}%</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-pretty">
            <span className="font-medium">{n.risk}: </span>
            <span className="text-muted-foreground">{option.risk}</span>
          </p>
          {option.sample_posts.length ? (
            <div>
              <p className="font-medium">{n.posts}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-pretty text-muted-foreground">
                {option.sample_posts.slice(0, 3).map((post) => (
                  <li key={post.title}>{post.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {option.monetization.length ? (
            <div>
              <p className="font-medium">{n.money}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                {option.monetization.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Screen 4: tap one of three directions (the best match is badged) or write your own. */
export function PickStep({
  answers: a,
  update,
  errors,
  result,
  pending,
  error,
  mode,
  canSuggest,
  replacePillars,
  onReplacePillarsChange,
  onGenerate,
  onChoose,
  onWriteOwn,
  onFindForMe,
}: PickStepProps) {
  const copy = useCopy()
  const t = copy.quick
  const n = copy.niche
  const options = result && canSuggest ? rankedOptions(result.options) : []
  const best = options.length ? bestMatchIndex(options) : -1
  const chosen = a.own_niche ? null : a.niche_option
  const checkedIndex = a.own_niche ? options.length : options.findIndex((o) => isChosen(chosen, o))
  const focusIndex = checkedIndex === -1 ? 0 : checkedIndex
  const count = options.length + 1

  const select = (index: number) => (index === options.length ? onWriteOwn() : onChoose(options[index]))
  /** Radio keys: arrows move and select, Home/End jump. */
  const onKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0
    const target = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : delta ? (index + delta + count) % count : -1
    if (target === -1) return
    event.preventDefault()
    const group = event.currentTarget.closest("[role=radiogroup]")
    select(target)
    requestAnimationFrame(() => group?.querySelector<HTMLElement>(`[data-niche-choice="${target}"]`)?.focus())
  }

  const loading = canSuggest && !result && !error

  return (
    <div className="flex flex-col gap-4">
      {canSuggest && result ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ProviderBadge provider={result.provider} model={result.model} />
          <AiButton type="button" size="xs" variant="ghost" pending={pending} pendingLabel={n.regenerating} onClick={onGenerate} className="text-muted-foreground">
            {n.regenerate}
          </AiButton>
        </div>
      ) : null}

      {canSuggest && error && !pending ? (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3 dark:bg-input/20">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{n.errorTitle}</p>
            <p className="text-xs text-pretty text-muted-foreground">{error.message}</p>
          </div>
          <AiButton type="button" size="sm" onClick={onGenerate}>
            {n.tryAgain}
          </AiButton>
        </div>
      ) : null}

      {loading ? (
        <section aria-live="polite" aria-busy="true" className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="text-brand" />
            {n.generating}
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border bg-card p-4 dark:bg-input/20">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </section>
      ) : null}

      {!canSuggest ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-dashed px-3 py-2.5 sm:px-4">
          <p className="min-w-0 text-xs text-pretty text-muted-foreground">{t.needMore}</p>
          <Button type="button" variant="link" size="sm" className={cn("px-0", TAP)} onClick={onFindForMe}>
            {t.findForMe}
          </Button>
        </div>
      ) : null}

      <div
        id={a.own_niche ? "ob-niche-choices" : fid("niche")}
        role="radiogroup"
        aria-label={t.choicesAria}
        aria-required
        aria-invalid={errors.niche ? true : undefined}
        data-ob-required
        className={cn("flex flex-col gap-2", pending && "opacity-70")}
        aria-busy={pending || undefined}
      >
        {options.map((option, index) => (
          <DirectionCard
            key={`${option.kind}-${option.name}`}
            option={option}
            index={index}
            best={index === best}
            checked={index === checkedIndex}
            focusable={index === focusIndex}
            onChoose={() => onChoose(option)}
            onKeyDown={onKeyDown(index)}
          />
        ))}

        <div className={cn("rounded-lg border border-dashed bg-card transition-colors dark:bg-input/20", a.own_niche && "border-solid border-brand/60 bg-brand-soft/60 ring-1 ring-brand/30 dark:bg-brand-soft/40")}>
          <button
            type="button"
            role="radio"
            aria-checked={a.own_niche}
            tabIndex={focusIndex === options.length ? 0 : -1}
            data-niche-choice={options.length}
            onClick={onWriteOwn}
            onKeyDown={onKeyDown(options.length)}
            className="flex w-full items-start gap-3 rounded-lg px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RadioMark checked={a.own_niche} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <PenLine className="size-3.5 text-muted-foreground" aria-hidden />
                {t.ownTitle}
              </span>
              <span className="mt-1 block text-sm text-pretty text-muted-foreground">{t.ownText}</span>
            </span>
          </button>
          {a.own_niche ? (
            <div className="flex flex-col gap-1.5 px-4 pb-4 sm:pl-11">
              <label htmlFor={fid("niche")} className="text-sm font-medium">
                {t.ownLabel}
                <span className="sr-only"> (required)</span>
              </label>
              <Textarea
                id={fid("niche")}
                value={a.niche}
                rows={2}
                maxLength={LIMITS.niche}
                placeholder={t.ownPlaceholder}
                aria-invalid={errors.niche ? true : undefined}
                aria-describedby="ob-own-hint"
                onChange={(event) => update(editNiche(a, event.target.value))}
                className="min-h-16 bg-background"
              />
              <p id="ob-own-hint" className="text-xs text-muted-foreground">
                {t.ownHint}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {errors.niche ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.niche}
        </p>
      ) : null}

      {mode === "niche" && chosen?.pillars.length ? (
        <label htmlFor="ob-replace-pillars" className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-card px-3 py-2.5 dark:bg-input/20">
          <Checkbox id="ob-replace-pillars" checked={replacePillars} onCheckedChange={(value) => onReplacePillarsChange(value === true)} className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-sm">{n.replacePillars(chosen.pillars.length)}</span>
            <span className="block text-xs text-muted-foreground">{n.replacePillarsHint}</span>
          </span>
        </label>
      ) : null}

      {mode === "niche" ? (
        chosen && !replacePillars ? <p className="text-xs text-pretty text-muted-foreground">{n.appliedRerun}</p> : null
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">{t.editLater}</p>
      )}
    </div>
  )
}
