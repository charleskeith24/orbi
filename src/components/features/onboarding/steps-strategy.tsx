"use client"

import { Check, CircleAlert, CircleCheck, Plus, X } from "lucide-react"
import { useMemo, useState } from "react"
import {
  catVar,
  chipVariants,
  ChipToggleGroup,
  ColorDot,
  FormField,
  FormRow,
  NumberField,
  PlatformIcon,
  PlatformLabel,
  TimeInput,
} from "@/components/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  DAYS_OF_WEEK,
  GOAL_CATEGORIES,
  GOAL_CATEGORY_IDS,
  GOAL_METRIC_MAP,
  GOAL_PERIODS,
  LANGUAGES,
  PERSONALITY_TRAITS,
  PLATFORM_IDS,
  PLATFORMS,
  TONES,
} from "@/lib/constants"
import { PLATFORM_STRATEGIES } from "@/lib/data/seed/starter-data"
import type { ContentPillar, GoalCategory, GoalPeriod, PlatformId } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  chosenGoals,
  CTA_PRESETS,
  distributeTotal,
  evenPillars,
  goalTargetFor,
  LANGUAGE_NOTES,
  LIMITS,
  normalizeSchedule,
  normalizeSplit,
  norm,
  pillarColors,
  pillarTotal,
  platformSplit,
  platformsInOrder,
  rebalancePillars,
  recommendedSchedule,
  schedulePosts,
  weekOrder,
  weeklyTotal,
  type ScheduleDay,
} from "./onboarding-model"
import { fid, TextField, type StepProps } from "./steps-profile"
import { StepSection } from "./wizard-chrome"

const dayLabel = (day: number) => DAYS_OF_WEEK.find((d) => d.value === day)?.short ?? ""

/** Keep the most recent picks when a capped multi-select overflows. */
function capped<T extends string>(previous: T[], next: T[], max: number): T[] {
  const added = next.filter((x) => !previous.includes(x))
  const kept = previous.filter((x) => next.includes(x))
  return [...kept, ...added].slice(-max)
}

/* ------------------------------- 5 · Pillars ------------------------------- */

export function PillarsStep({
  answers: a,
  update,
  errors,
  existing,
}: StepProps & { existing: Pick<ContentPillar, "name" | "color">[] }) {
  const colors = useMemo(() => pillarColors(a.pillars, existing), [a.pillars, existing])
  const selected = a.pillars.filter((p) => p.selected)
  const total = pillarTotal(a.pillars)
  const atMax = selected.length >= LIMITS.pillarsMax
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  const setPillar = (key: string, patch: Partial<(typeof a.pillars)[number]>) =>
    update({ pillars: a.pillars.map((p) => (p.key === key ? { ...p, ...patch } : p)) })

  function addPillar() {
    const clean = name.trim()
    if (!clean) return setAddError("Name the pillar.")
    if (a.pillars.some((p) => norm(p.name) === norm(clean))) return setAddError("You already have a pillar with that name.")
    if (atMax) return setAddError(`You can choose up to ${LIMITS.pillarsMax} pillars.`)
    update({
      pillars: [
        ...a.pillars,
        {
          key: `custom:${Date.now().toString(36)}`,
          name: clean.slice(0, LIMITS.pillarName),
          description: description.trim().slice(0, LIMITS.pillarDescription),
          icon: "Layers",
          examples: [],
          target: 10,
          selected: true,
          preset: false,
        },
      ],
    })
    setName("")
    setDescription("")
    setAddError(null)
    setAdding(false)
  }

  const onAddKey = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      addPillar()
    } else if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 dark:bg-input/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm">
            {total === 100 ? (
              <CircleCheck className="size-4 text-good-fg" aria-hidden />
            ) : (
              <CircleAlert className="size-4 text-warning-fg" aria-hidden />
            )}
            <span className="font-medium num">Total {total}%</span>
            <span className="text-muted-foreground">
              · {selected.length} {selected.length === 1 ? "pillar" : "pillars"}
              {total !== 100 ? ` · ${total < 100 ? `${100 - total}% left to assign` : `${total - 100}% over`}` : ""}
            </span>
          </p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={total === 100 || !selected.length} onClick={() => update({ pillars: rebalancePillars(a.pillars) })}>
              Rebalance to 100%
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!selected.length} onClick={() => update({ pillars: evenPillars(a.pillars) })}>
              Split evenly
            </Button>
          </div>
        </div>
        <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {selected.map((p) => (
            <span
              key={p.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${Math.max(0, Math.min(100, p.target))}%`, backgroundColor: catVar(colors.get(p.key)) }}
            />
          ))}
        </div>
      </div>

      <ul id={fid("pillars")} tabIndex={-1} className="divide-y rounded-lg border bg-card outline-none dark:bg-input/20" aria-label="Content pillars">
        {a.pillars.map((p, index) => {
          const checkboxId = `ob-pillar-${index}`
          return (
            <li key={p.key} className={cn("flex items-start gap-3 px-3 py-3 sm:px-4", !p.selected && "text-muted-foreground")}>
              <Checkbox
                id={checkboxId}
                checked={p.selected}
                disabled={!p.selected && atMax}
                onCheckedChange={(value) => setPillar(p.key, { selected: value === true, target: value === true && p.target < 1 ? 10 : p.target })}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                  <ColorDot color={p.selected ? colors.get(p.key) : null} />
                  <span className="truncate">{p.name}</span>
                  {!p.preset ? (
                    <Badge variant="outline" className="font-normal">
                      Custom
                    </Badge>
                  ) : null}
                </label>
                <p className="text-xs text-pretty text-muted-foreground">
                  {p.description || "No description"}
                  {p.examples.length ? <span className="hidden sm:inline"> · {p.examples.slice(0, 4).join(", ")}</span> : null}
                </p>
              </div>
              {p.selected ? (
                <NumberField
                  value={p.target}
                  onChange={(value) => setPillar(p.key, { target: value ?? 0 })}
                  min={0}
                  max={100}
                  integer
                  suffix="%"
                  size="sm"
                  className="w-20 shrink-0"
                  aria-label={`${p.name} target percentage`}
                />
              ) : null}
              {!p.preset ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => update({ pillars: a.pillars.filter((x) => x.key !== p.key) })}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {errors.pillars ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.pillars}
        </p>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 dark:bg-input/20">
          <FormRow>
            <FormField label="Pillar name" htmlFor="ob-new-pillar" required error={addError ?? undefined}>
              <Input
                id="ob-new-pillar"
                autoFocus
                value={name}
                maxLength={LIMITS.pillarName}
                placeholder="e.g. AI for operators"
                aria-invalid={addError ? true : undefined}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={onAddKey}
              />
            </FormField>
            <FormField label="Description" htmlFor="ob-new-pillar-description">
              <Input
                id="ob-new-pillar-description"
                value={description}
                maxLength={LIMITS.pillarDescription}
                placeholder="e.g. Practical AI workflows for small teams"
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={onAddKey}
              />
            </FormField>
          </FormRow>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addPillar}>
              <Plus aria-hidden />
              Add pillar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={atMax} onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Add a custom pillar
        </Button>
      )}
    </div>
  )
}

/* ------------------------------ 6 · Platforms ------------------------------ */

export function PlatformsStep({ answers: a, update, errors }: StepProps) {
  const setPlatforms = (next: PlatformId[]) => {
    const platforms = platformsInOrder(next)
    update({
      platforms,
      split: normalizeSplit(a.split, platforms),
      custom_schedule: a.custom_schedule.length ? normalizeSchedule(a.custom_schedule, platforms) : a.custom_schedule,
    })
  }
  const toggle = (p: PlatformId) => setPlatforms(a.platforms.includes(p) ? a.platforms.filter((x) => x !== p) : [...a.platforms, p])
  const personaMatches = platformsInOrder(a.persona_platforms)
  const sameAsPersona = personaMatches.length > 0 && personaMatches.join() === platformsInOrder(a.platforms).join()

  return (
    <div className="flex flex-col gap-4">
      {personaMatches.length && !sameAsPersona ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm dark:bg-input/20">
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            Your persona spends time on
            <span className="flex items-center gap-1">
              {personaMatches.map((p) => (
                <PlatformIcon key={p} platform={p} colored label />
              ))}
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPlatforms(personaMatches)}>
            Use these
          </Button>
        </div>
      ) : null}
      <div role="group" aria-label="Main platforms" className="grid gap-2 sm:grid-cols-2">
        {PLATFORM_IDS.map((p, index) => {
          const on = a.platforms.includes(p)
          return (
            <button
              key={p}
              id={index === 0 ? fid("platforms") : undefined}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-brand/45 bg-brand-soft" : "bg-card hover:bg-muted/60 dark:bg-input/20"
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                <PlatformIcon platform={p} colored={on} className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{PLATFORMS[p].label}</span>
                  {on ? <Check className="size-4 text-brand" aria-hidden /> : null}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{PLATFORM_STRATEGIES[p].audience}</span>
              </span>
            </button>
          )
        })}
      </div>
      {errors.platforms ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.platforms}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Chosen platforms get an active platform strategy; the rest are switched off until you turn them on in Strategy → Platforms.
        </p>
      )}
    </div>
  )
}

/* ------------------------------- 7 · Posting ------------------------------- */

function SchedulePreview({ days }: { days: ScheduleDay[] }) {
  return (
    <ul className="divide-y rounded-lg border bg-card dark:bg-input/20" aria-label="Recommended weekly schedule">
      {days.map((d) => (
        <li key={d.day} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4">
          <span className="text-xs font-medium text-muted-foreground">{dayLabel(d.day)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm">{d.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {d.format}
              {d.time ? ` · ${d.time}` : ""}
            </span>
          </span>
          <span className="flex items-center gap-1">
            {d.platforms.map((p) => (
              <PlatformIcon key={p} platform={p} label className="size-3.5" />
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function CustomSchedule({
  days,
  platforms,
  onChange,
}: {
  days: ScheduleDay[]
  platforms: PlatformId[]
  onChange: (day: number, patch: Partial<ScheduleDay>) => void
}) {
  return (
    <ul className="divide-y rounded-lg border bg-card dark:bg-input/20" aria-label="Custom weekly schedule">
      {days.map((d) => {
        const name = DAYS_OF_WEEK.find((x) => x.value === d.day)?.label ?? ""
        return (
          <li key={d.day} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-sm">
              <Switch checked={d.enabled} onCheckedChange={(enabled) => onChange(d.day, { enabled })} aria-label={`Post on ${name}`} />
              <span className={cn(!d.enabled && "text-muted-foreground")}>{name}</span>
            </label>
            {d.enabled ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Input
                  value={d.label}
                  maxLength={LIMITS.label}
                  placeholder="Theme, e.g. Tutorial"
                  aria-label={`${name} theme`}
                  onChange={(event) => onChange(d.day, { label: event.target.value })}
                  className="h-7 min-w-32 flex-1"
                />
                <div role="group" aria-label={`${name} platforms`} className="flex flex-wrap gap-1">
                  {platforms.map((p) => {
                    const on = d.platforms.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        title={PLATFORMS[p].label}
                        onClick={() =>
                          onChange(d.day, { platforms: platformsInOrder(on ? d.platforms.filter((x) => x !== p) : [...d.platforms, p]) })
                        }
                        className={cn(chipVariants({ size: "sm", selected: on }), "aspect-square justify-center px-0")}
                      >
                        <PlatformIcon platform={p} colored={on} />
                        <span className="sr-only">{PLATFORMS[p].label}</span>
                      </button>
                    )
                  })}
                </div>
                <TimeInput value={d.time} onChange={(time) => onChange(d.day, { time })} size="sm" aria-label={`${name} time`} />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No post</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function PostingStep({ answers: a, update, errors, weekStartsOn }: StepProps & { weekStartsOn: 0 | 1 }) {
  const platforms = platformsInOrder(a.platforms)
  const split = platformSplit(a)
  const total = weeklyTotal(a)
  const order = weekOrder(weekStartsOn)
  const sortDays = (days: ScheduleDay[]) => order.map((day) => days.find((d) => d.day === day)).filter((d): d is ScheduleDay => Boolean(d))
  const recommended = sortDays(recommendedSchedule(platforms))
  const custom = sortDays(normalizeSchedule(a.custom_schedule, platforms))
  const days = a.schedule_mode === "custom" ? custom : recommended
  const posts = schedulePosts(days)

  const setMode = (mode: string) => {
    if (mode !== "recommended" && mode !== "custom") return
    update({ schedule_mode: mode, custom_schedule: mode === "custom" && !a.custom_schedule.length ? recommendedSchedule(platforms) : a.custom_schedule })
  }
  const setDay = (day: number, patch: Partial<ScheduleDay>) =>
    update({ custom_schedule: normalizeSchedule(a.custom_schedule, platforms).map((d) => (d.day === day ? { ...d, ...patch } : d)) })

  return (
    <div className="flex flex-col gap-6">
      <StepSection title="Weekly post target" description="One post on one platform counts as one. Change the total or the split — they stay in sync.">
        <div className="rounded-lg border bg-card dark:bg-input/20">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
            <label htmlFor={fid("weekly")} className="text-sm font-medium">
              Posts per week
            </label>
            <NumberField
              id={fid("weekly")}
              value={total}
              onChange={(value) => {
                if (value !== null) update({ split: distributeTotal(value, a) })
              }}
              integer
              min={Math.max(1, platforms.length)}
              max={Math.min(LIMITS.weeklyMax, LIMITS.platformMax * Math.max(1, platforms.length))}
              className="w-24"
            />
          </div>
          <ul className="divide-y" aria-label="Posts per week by platform">
            {platforms.map((p) => (
              <li key={p} className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
                <PlatformLabel platform={p} colored />
                <NumberField
                  value={split[p]}
                  onChange={(value) => {
                    if (value !== null) update({ split: { ...split, [p]: value } })
                  }}
                  integer
                  min={1}
                  max={LIMITS.platformMax}
                  size="sm"
                  suffix="/ wk"
                  className="w-24"
                  aria-label={`${PLATFORMS[p].label} posts per week`}
                />
              </li>
            ))}
          </ul>
        </div>
        {total > 14 ? (
          <p className="flex items-start gap-1.5 text-xs text-warning-fg">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>That&apos;s two or more posts a day. Start lower and raise it once your content buffer keeps up.</span>
          </p>
        ) : null}
      </StepSection>

      <StepSection
        title="Posting schedule"
        description="Recurring weekly slots — your calendar and What-to-post use them."
        action={<span className="text-xs text-muted-foreground num">{posts} posts / week</span>}
      >
        <RadioGroup value={a.schedule_mode} onValueChange={setMode} className="grid gap-2 sm:grid-cols-2" aria-label="Schedule type">
          {(
            [
              { value: "recommended", title: "Recommended weekly strategy", text: "A themed day for each pillar type, adapted to your platforms." },
              { value: "custom", title: "Custom per day", text: "Choose the days, themes, platforms and times yourself." },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              htmlFor={`ob-schedule-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 has-data-checked:border-brand/45 has-data-checked:bg-brand-soft dark:bg-input/20"
            >
              <RadioGroupItem id={`ob-schedule-${option.value}`} value={option.value} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.text}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        {a.schedule_mode === "custom" ? <CustomSchedule days={custom} platforms={platforms} onChange={setDay} /> : <SchedulePreview days={recommended} />}
        {errors.schedule ? (
          <p id={fid("schedule")} role="alert" className="text-xs text-destructive">
            {errors.schedule}
          </p>
        ) : null}
      </StepSection>
    </div>
  )
}

/* -------------------------------- 8 · Goals -------------------------------- */

export function GoalsStep({ answers: a, update, errors }: StepProps) {
  const goals = chosenGoals(a)
  const setTarget = (category: GoalCategory, patch: { value?: number | null; period?: GoalPeriod }) =>
    update({ goal_targets: { ...a.goal_targets, [category]: { ...goalTargetFor(a, category), ...patch } } })

  return (
    <div className="flex flex-col gap-6">
      <StepSection title="Primary goal" description="The one outcome everything else is measured against.">
        <RadioGroup
          id={fid("primary_goal")}
          value={a.primary_goal ?? ""}
          onValueChange={(value) => {
            const primary = value as GoalCategory
            update({ primary_goal: primary, secondary_goal: a.secondary_goal === primary ? null : a.secondary_goal })
          }}
          className="grid gap-2 sm:grid-cols-2"
          aria-label="Primary goal"
        >
          {GOAL_CATEGORY_IDS.map((category) => {
            const meta = GOAL_CATEGORIES[category]
            return (
              <label
                key={category}
                htmlFor={`ob-goal-${category}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 has-data-checked:border-brand/45 has-data-checked:bg-brand-soft dark:bg-input/20"
              >
                <RadioGroupItem id={`ob-goal-${category}`} value={category} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{meta.label}</span>
                  <span className="block text-xs text-pretty text-muted-foreground">{meta.description}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{meta.kpis.slice(0, 3).join(" · ")}</span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
        {errors.primary_goal ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.primary_goal}
          </p>
        ) : null}
      </StepSection>

      <StepSection title="Secondary goal" description="Optional — a supporting outcome.">
        <ChipToggleGroup
          aria-label="Secondary goal"
          size="default"
          options={GOAL_CATEGORY_IDS.filter((c) => c !== a.primary_goal).map((c) => ({ value: c, label: GOAL_CATEGORIES[c].label }))}
          value={a.secondary_goal}
          onChange={(secondary_goal) => update({ secondary_goal })}
        />
      </StepSection>

      {goals.length ? (
        <StepSection title="Targets" description="What success looks like. Refine them any time in Strategy → Goals.">
          <ul className="divide-y rounded-lg border bg-card dark:bg-input/20">
            {goals.map((category, index) => {
              const target = goalTargetFor(a, category)
              const metric = GOAL_METRIC_MAP[GOAL_CATEGORIES[category].metric].label
              const error = errors[`goal_${category}`]
              return (
                <li key={category} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{GOAL_CATEGORIES[category].label}</span>
                    <span className="text-muted-foreground"> · {index === 0 ? "Primary" : "Secondary"}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <NumberField
                      id={fid(`goal_${category}`)}
                      value={target.value}
                      onChange={(value) => setTarget(category, { value })}
                      integer
                      min={1}
                      placeholder="No target"
                      size="sm"
                      className="w-28"
                      aria-label={`${GOAL_CATEGORIES[category].label} target (${metric})`}
                      aria-invalid={error ? true : undefined}
                    />
                    <span className="text-xs text-muted-foreground">{metric.toLowerCase()}</span>
                    <NativeSelect
                      size="sm"
                      value={target.period}
                      onChange={(event) => setTarget(category, { period: event.target.value as GoalPeriod })}
                      aria-label={`${GOAL_CATEGORIES[category].label} period`}
                    >
                      {GOAL_PERIODS.map((p) => (
                        <NativeSelectOption key={p.id} value={p.id}>
                          {p.label}
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

/* -------------------------------- 9 · Voice -------------------------------- */

export function VoiceStep({ answers: a, update, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepSection title="Language">
        <ChipToggleGroup
          aria-label="Language"
          size="default"
          required
          options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
          value={a.language}
          onChange={(language) => {
            if (language) update({ language })
          }}
        />
        <p className="text-xs text-muted-foreground">{LANGUAGE_NOTES[a.language]}</p>
      </StepSection>

      <StepSection
        title="Tone"
        description={`Pick up to ${LIMITS.tonesMax}. Picking another replaces the oldest.`}
        action={<span className="text-xs text-muted-foreground num">{a.tones.length}/{LIMITS.tonesMax}</span>}
      >
        <div id={fid("tones")} tabIndex={-1} className="outline-none">
          <ChipToggleGroup
            multiple
            aria-label="Tone"
            size="default"
            options={TONES.map((t) => ({ value: t.id, label: t.label }))}
            value={a.tones}
            onChange={(tones) => update({ tones: capped(a.tones, tones, LIMITS.tonesMax) })}
          />
        </div>
        {errors.tones ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.tones}
          </p>
        ) : null}
      </StepSection>

      <StepSection
        title="Personality"
        description={`Up to ${LIMITS.traitsMax} traits people should feel in your content.`}
        action={<span className="text-xs text-muted-foreground num">{a.personality.length}/{LIMITS.traitsMax}</span>}
      >
        <div id={fid("personality")} tabIndex={-1} className="outline-none">
          <ChipToggleGroup
            multiple
            aria-label="Personality traits"
            size="default"
            options={PERSONALITY_TRAITS.map((t) => ({ value: t.id, label: t.label }))}
            value={a.personality}
            onChange={(personality) => update({ personality: capped(a.personality, personality, LIMITS.traitsMax) })}
          />
        </div>
        {errors.personality ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.personality}
          </p>
        ) : null}
      </StepSection>

      <StepSection title="Call-to-action style" description="How you usually ask for action at the end of a post.">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="CTA style presets">
          {CTA_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={a.cta_style === preset.text}
              onClick={() => update({ cta_style: preset.text })}
              className={chipVariants({ size: "sm", selected: a.cta_style === preset.text })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Textarea
          id={fid("cta_style")}
          aria-label="Call-to-action style"
          value={a.cta_style}
          maxLength={LIMITS.longText}
          rows={2}
          placeholder="Or write your own — e.g. Comment GUIDE and I'll send you the template."
          onChange={(event) => update({ cta_style: event.target.value })}
          className="min-h-16"
        />
      </StepSection>

      <StepSection title="Brand rules" description="Optional guardrails every draft follows.">
        <FormRow>
          <TextField
            multiline
            rows={2}
            field="always_do"
            label="Always"
            value={a.always_do}
            onChange={(always_do) => update({ always_do })}
            placeholder="e.g. Use real numbers. Admit what I got wrong."
            maxLength={LIMITS.longText}
          />
          <TextField
            multiline
            rows={2}
            field="never_do"
            label="Never"
            value={a.never_do}
            onChange={(never_do) => update({ never_do })}
            placeholder="e.g. Promise overnight results. Name clients."
            maxLength={LIMITS.longText}
          />
        </FormRow>
      </StepSection>
    </div>
  )
}
