"use client"

import { Check, Handshake, Megaphone, Mic, Package, TrendingUp, Users, type LucideIcon } from "lucide-react"
import { ChipToggleGroup, NumberField } from "@/components/common"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { NicheAim } from "@/lib/ai"
import { GOAL_CATEGORIES, GOAL_METRIC_MAP, GOAL_PERIODS } from "@/lib/constants"
import type { GoalCategory, GoalPeriod } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCopy } from "./copy"
import { AIM_IDS, aimGoals, chosenGoals, goalsFromAims, goalTargetFor, LIMITS } from "./onboarding-model"
import { fid, type StepProps } from "./steps-profile"
import { StepSection } from "./wizard-chrome"

const AIM_ICONS: Record<NicheAim, LucideIcon> = {
  clients: Handshake,
  career: TrendingUp,
  audience: Megaphone,
  products: Package,
  speaking: Mic,
  community: Users,
}

/** "Para saan": what the brand should do for the creator → goals and targets. */
export function ParaSaanStep({ answers: a, update, errors }: StepProps) {
  const copy = useCopy()
  const t = copy.paraSaan
  const full = a.aims.length >= LIMITS.aimsMax
  const categories = aimGoals(a.aims)
  const goals = chosenGoals(a)

  const toggle = (aim: NicheAim) => {
    const on = a.aims.includes(aim)
    if (!on && full) return
    const aims = on ? a.aims.filter((x) => x !== aim) : [...a.aims, aim]
    update({ aims, ...goalsFromAims(aims, a) })
  }
  const setTarget = (category: GoalCategory, patch: { value?: number | null; period?: GoalPeriod }) =>
    update({ goal_targets: { ...a.goal_targets, [category]: { ...goalTargetFor(a, category), ...patch } } })

  return (
    <div className="flex flex-col gap-6">
      <StepSection title={t.aims} description={t.aimsDescription} action={<span className="text-xs text-muted-foreground num">{a.aims.length}/{LIMITS.aimsMax}</span>}>
        <div id={fid("aims")} tabIndex={-1} role="group" aria-label={t.aims} className="grid gap-2 outline-none sm:grid-cols-2">
          {AIM_IDS.map((aim) => {
            const on = a.aims.includes(aim)
            const Icon = AIM_ICONS[aim]
            return (
              <button
                key={aim}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(aim)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  on ? "border-brand/45 bg-brand-soft" : "bg-card hover:bg-muted/60 dark:bg-input/20"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t.options[aim].title}</span>
                    {on ? <Check className="size-4 text-brand" aria-hidden /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.options[aim].text}</span>
                </span>
              </button>
            )
          })}
        </div>
        {errors.aims ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.aims}
          </p>
        ) : null}
      </StepSection>

      {categories.length > 1 ? (
        <StepSection title={t.primary} description={t.primaryDescription}>
          <ChipToggleGroup
            aria-label={t.primary}
            size="default"
            required
            options={categories.map((c) => ({ value: c, label: copy.goals[c] }))}
            value={a.primary_goal}
            onChange={(primary) => {
              if (primary) update({ primary_goal: primary, secondary_goal: categories.find((c) => c !== primary) ?? null })
            }}
          />
        </StepSection>
      ) : null}

      {goals.length ? (
        <StepSection title={t.targets} description={t.targetsDescription}>
          <ul className="divide-y rounded-lg border bg-card dark:bg-input/20">
            {goals.map((category, index) => {
              const target = goalTargetFor(a, category)
              const metric = GOAL_METRIC_MAP[GOAL_CATEGORIES[category].metric].label
              const label = copy.goals[category]
              const error = errors[`goal_${category}`]
              return (
                <li key={category} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground"> · {index === 0 ? t.primaryTag : t.secondaryTag}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <NumberField
                      id={fid(`goal_${category}`)}
                      value={target.value}
                      onChange={(value) => setTarget(category, { value })}
                      integer
                      min={1}
                      placeholder={t.noTarget}
                      size="sm"
                      className="w-28"
                      aria-label={t.targetAria(label, metric)}
                      aria-invalid={error ? true : undefined}
                    />
                    <span className="text-xs text-muted-foreground">{metric.toLowerCase()}</span>
                    <NativeSelect size="sm" value={target.period} onChange={(event) => setTarget(category, { period: event.target.value as GoalPeriod })} aria-label={t.periodAria(label)}>
                      {GOAL_PERIODS.map((p) => (
                        <NativeSelectOption key={p.id} value={p.id}>
                          {copy.periods[p.id]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </span>
                  {error ? (
                    <p role="alert" className="text-xs text-destructive sm:basis-full">
                      {error}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </StepSection>
      ) : null}
    </div>
  )
}
