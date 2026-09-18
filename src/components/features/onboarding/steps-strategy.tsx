"use client"

import { Check, CircleAlert, CircleCheck, Plus, Sparkles, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { NicheOption } from "@/lib/ai"
import { LANGUAGES, PERSONALITY_TRAITS, PLATFORM_IDS, PLATFORMS, TONES } from "@/lib/constants"
import type { ContentPillar, PlatformId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCopy } from "./copy"
import { pillarsFromOption, pillarsMatchOption } from "./niche-model"
import {
  distributeTotal,
  evenPillars,
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
  type PillarDraft,
  type ScheduleDay,
} from "./onboarding-model"
import { fid, TextField, type StepProps } from "./steps-profile"
import { StepSection } from "./wizard-chrome"

/** Keep the most recent picks when a capped multi-select overflows. */
function capped<T extends string>(previous: T[], next: T[], max: number): T[] {
  const added = next.filter((x) => !previous.includes(x))
  const kept = previous.filter((x) => next.includes(x))
  return [...kept, ...added].slice(-max)
}

/* --------------------------------- Pillars --------------------------------- */

function badgeFor(p: PillarDraft, copy: ReturnType<typeof useCopy>): string | null {
  if (p.key.startsWith("niche:")) return copy.pillars.nicheBadge
  if (p.key.startsWith("custom:")) return copy.pillars.customBadge
  return null
}

export function PillarsStep({
  answers: a,
  update,
  errors,
  existing,
  nicheOption,
}: StepProps & { existing: Pick<ContentPillar, "name" | "color">[]; nicheOption: NicheOption | null }) {
  const copy = useCopy()
  const t = copy.pillars
  const colors = useMemo(() => pillarColors(a.pillars, existing), [a.pillars, existing])
  const selected = a.pillars.filter((p) => p.selected)
  const total = pillarTotal(a.pillars)
  const atMax = selected.length >= LIMITS.pillarsMax
  const listed = a.pillars.filter((p) => p.selected || !p.preset)
  const general = a.pillars.filter((p) => !p.selected && p.preset)
  const offerNiche = nicheOption && nicheOption.pillars.length >= LIMITS.pillarsMin && !pillarsMatchOption(a, nicheOption) ? nicheOption : null
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  const setPillar = (key: string, patch: Partial<PillarDraft>) => update({ pillars: a.pillars.map((p) => (p.key === key ? { ...p, ...patch } : p)) })

  function addPillar() {
    const clean = name.trim()
    if (!clean) return setAddError(t.nameMissing)
    if (a.pillars.some((p) => norm(p.name) === norm(clean))) return setAddError(t.nameTaken)
    if (atMax) return setAddError(t.tooMany(LIMITS.pillarsMax))
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
      {offerNiche ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-brand" aria-hidden />
              {t.fromNiche}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                update({ pillars: pillarsFromOption(offerNiche, a.pillars) })
                toast.success(t.applied)
              }}
            >
              {t.useNiche}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.fromNicheText} {offerNiche.pillars.map((p) => `${p.name} ${p.target_percentage}%`).join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 dark:bg-input/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm">
            {total === 100 ? <CircleCheck className="size-4 text-good-fg" aria-hidden /> : <CircleAlert className="size-4 text-warning-fg" aria-hidden />}
            <span className="font-medium num">{t.total(total)}</span>
            <span className="text-muted-foreground">
              · {t.count(selected.length)}
              {total !== 100 ? ` · ${total < 100 ? t.left(100 - total) : t.over(total - 100)}` : ""}
            </span>
          </p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={total === 100 || !selected.length} onClick={() => update({ pillars: rebalancePillars(a.pillars) })}>
              {t.rebalance}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!selected.length} onClick={() => update({ pillars: evenPillars(a.pillars) })}>
              {t.even}
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

      <ul id={fid("pillars")} data-ob-required tabIndex={-1} className="divide-y rounded-lg border bg-card outline-none dark:bg-input/20" aria-label={t.listAria}>
        {listed.map((p) => {
          const checkboxId = `ob-pillar-${p.key.replace(/[^a-z0-9]+/gi, "-")}`
          const badge = badgeFor(p, copy)
          const removable = p.key.startsWith("niche:") || p.key.startsWith("custom:")
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
                  {badge ? (
                    <Badge variant="outline" className="font-normal">
                      {badge}
                    </Badge>
                  ) : null}
                </label>
                <p className="text-xs text-pretty text-muted-foreground">
                  {p.description || t.noDescription}
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
                  aria-label={t.targetAria(p.name)}
                />
              ) : null}
              {removable ? (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={copy.common.remove(p.name)} onClick={() => update({ pillars: a.pillars.filter((x) => x.key !== p.key) })}>
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

      {general.length ? (
        <StepSection title={t.general}>
          <div className="flex flex-wrap gap-1.5">
            {general.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={atMax}
                title={p.description}
                onClick={() => setPillar(p.key, { selected: true, target: p.target < 1 ? 10 : p.target })}
                className={chipVariants({ size: "default", selected: false })}
              >
                <Plus aria-hidden />
                {p.name}
              </button>
            ))}
          </div>
        </StepSection>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 dark:bg-input/20">
          <FormRow>
            <FormField label={t.name} htmlFor="ob-new-pillar" required error={addError ?? undefined}>
              <Input
                id="ob-new-pillar"
                autoFocus
                value={name}
                maxLength={LIMITS.pillarName}
                placeholder={t.namePlaceholder}
                aria-invalid={addError ? true : undefined}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={onAddKey}
              />
            </FormField>
            <FormField label={t.description} htmlFor="ob-new-pillar-description">
              <Input
                id="ob-new-pillar-description"
                value={description}
                maxLength={LIMITS.pillarDescription}
                placeholder={t.descriptionPlaceholder}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={onAddKey}
              />
            </FormField>
          </FormRow>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {copy.common.cancel}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addPillar}>
              <Plus aria-hidden />
              {t.addPillar}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={atMax} onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t.addCustom}
        </Button>
      )}
    </div>
  )
}

/* ------------------------------ Platforms & posting ----------------------------- */

function SchedulePreview({ days }: { days: ScheduleDay[] }) {
  const copy = useCopy()
  return (
    <ul className="divide-y rounded-lg border bg-card dark:bg-input/20" aria-label={copy.posting.recommendedAria}>
      {days.map((d) => (
        <li key={d.day} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4">
          <span className="text-xs font-medium text-muted-foreground">{copy.days.short[d.day]}</span>
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

function CustomSchedule({ days, platforms, onChange }: { days: ScheduleDay[]; platforms: PlatformId[]; onChange: (day: number, patch: Partial<ScheduleDay>) => void }) {
  const copy = useCopy()
  const t = copy.posting
  return (
    <ul className="divide-y rounded-lg border bg-card dark:bg-input/20" aria-label={t.customAria}>
      {days.map((d) => {
        const name = copy.days.long[d.day]
        return (
          <li key={d.day} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2 text-sm">
              <Switch checked={d.enabled} onCheckedChange={(enabled) => onChange(d.day, { enabled })} aria-label={t.postOn(name)} />
              <span className={cn(!d.enabled && "text-muted-foreground")}>{name}</span>
            </label>
            {d.enabled ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Input
                  value={d.label}
                  maxLength={LIMITS.label}
                  placeholder={t.themePlaceholder}
                  aria-label={t.themeAria(name)}
                  onChange={(event) => onChange(d.day, { label: event.target.value })}
                  className="h-7 min-w-32 flex-1"
                />
                <div role="group" aria-label={t.platformsAria(name)} className="flex flex-wrap gap-1">
                  {platforms.map((p) => {
                    const on = d.platforms.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        title={PLATFORMS[p].label}
                        onClick={() => onChange(d.day, { platforms: platformsInOrder(on ? d.platforms.filter((x) => x !== p) : [...d.platforms, p]) })}
                        className={cn(chipVariants({ size: "sm", selected: on }), "aspect-square justify-center px-0")}
                      >
                        <PlatformIcon platform={p} colored={on} />
                        <span className="sr-only">{PLATFORMS[p].label}</span>
                      </button>
                    )
                  })}
                </div>
                <TimeInput value={d.time} onChange={(time) => onChange(d.day, { time })} size="sm" aria-label={t.timeAria(name)} />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{t.noPost}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function PostingSection({ answers: a, update, errors, weekStartsOn }: StepProps & { weekStartsOn: 0 | 1 }) {
  const copy = useCopy()
  const t = copy.posting
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
    <>
      <StepSection title={t.weekly} description={t.weeklyDescription}>
        <div className="rounded-lg border bg-card dark:bg-input/20">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
            <label htmlFor={fid("weekly")} className="text-sm font-medium">
              {t.perWeekLabel}
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
          <ul className="divide-y" aria-label={t.perWeekLabel}>
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
                  suffix={t.perWeekSuffix}
                  className="w-28"
                  aria-label={t.perPlatformAria(PLATFORMS[p].label)}
                />
              </li>
            ))}
          </ul>
        </div>
        {total > 14 ? (
          <p className="flex items-start gap-1.5 text-xs text-warning-fg">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{t.tooMany}</span>
          </p>
        ) : null}
      </StepSection>

      <StepSection title={t.schedule} description={t.scheduleDescription} action={<span className="text-xs text-muted-foreground num">{t.postsPerWeek(posts)}</span>}>
        <RadioGroup value={a.schedule_mode} onValueChange={setMode} className="grid gap-2 sm:grid-cols-2" aria-label={t.typeAria}>
          {(["recommended", "custom"] as const).map((value) => (
            <label
              key={value}
              htmlFor={`ob-schedule-${value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 has-data-checked:border-brand/45 has-data-checked:bg-brand-soft dark:bg-input/20"
            >
              <RadioGroupItem id={`ob-schedule-${value}`} value={value} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.modes[value].title}</span>
                <span className="block text-xs text-muted-foreground">{t.modes[value].text}</span>
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
    </>
  )
}

/** Platforms, then the weekly target and schedule for them. */
export function PlatformsStep(props: StepProps & { weekStartsOn: 0 | 1 }) {
  const { answers: a, update, errors } = props
  const copy = useCopy()
  const t = copy.platforms
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {personaMatches.length && !sameAsPersona ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm dark:bg-input/20">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              {t.audienceUses}
              <span className="flex items-center gap-1">
                {personaMatches.map((p) => (
                  <PlatformIcon key={p} platform={p} colored label />
                ))}
              </span>
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPlatforms(personaMatches)}>
              {t.useThese}
            </Button>
          </div>
        ) : null}
        <div role="group" aria-label={t.group} data-ob-required className="grid gap-2 sm:grid-cols-2">
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
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{t.hints[p]}</span>
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
          <p className="text-xs text-muted-foreground">{t.note}</p>
        )}
      </div>
      {a.platforms.length ? <PostingSection {...props} /> : null}
    </div>
  )
}

/* ---------------------------------- Voice ---------------------------------- */

export function VoiceStep({ answers: a, update, errors }: StepProps) {
  const copy = useCopy()
  const t = copy.voice
  return (
    <div className="flex flex-col gap-6">
      <StepSection title={t.language}>
        <ChipToggleGroup
          aria-label={t.language}
          size="default"
          required
          options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
          value={a.language}
          onChange={(language) => {
            if (language) update({ language })
          }}
        />
        <p className="text-xs text-muted-foreground">{t.languageNotes[a.language]}</p>
      </StepSection>

      <StepSection title={t.tone} description={t.toneDescription(LIMITS.tonesMax)} action={<span className="text-xs text-muted-foreground num">{a.tones.length}/{LIMITS.tonesMax}</span>}>
        <div id={fid("tones")} data-ob-required tabIndex={-1} className="outline-none">
          <ChipToggleGroup
            multiple
            aria-label={t.tone}
            size="default"
            options={TONES.map((x) => ({ value: x.id, label: x.label }))}
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
        title={t.personality}
        description={t.personalityDescription(LIMITS.traitsMax)}
        action={<span className="text-xs text-muted-foreground num">{a.personality.length}/{LIMITS.traitsMax}</span>}
      >
        <div id={fid("personality")} data-ob-required tabIndex={-1} className="outline-none">
          <ChipToggleGroup
            multiple
            aria-label={t.personality}
            size="default"
            options={PERSONALITY_TRAITS.map((x) => ({ value: x.id, label: x.label }))}
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

      <StepSection title={t.cta} description={t.ctaDescription}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.ctaPresetsAria}>
          {t.ctaPresets.map((preset) => (
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
          aria-label={t.cta}
          value={a.cta_style}
          maxLength={LIMITS.longText}
          rows={2}
          placeholder={t.ctaPlaceholder}
          onChange={(event) => update({ cta_style: event.target.value })}
          className="min-h-16"
        />
      </StepSection>

      <StepSection title={t.rules} description={t.rulesDescription}>
        <FormRow>
          <TextField
            multiline
            rows={2}
            field="always_do"
            label={t.always}
            value={a.always_do}
            onChange={(always_do) => update({ always_do })}
            placeholder={t.alwaysPlaceholder}
            maxLength={LIMITS.longText}
          />
          <TextField
            multiline
            rows={2}
            field="never_do"
            label={t.never}
            value={a.never_do}
            onChange={(never_do) => update({ never_do })}
            placeholder={t.neverPlaceholder}
            maxLength={LIMITS.longText}
          />
        </FormRow>
      </StepSection>
    </div>
  )
}
