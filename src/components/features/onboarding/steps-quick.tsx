"use client"

import { ArrowRight, Check, ChevronDown, Clock, Plus } from "lucide-react"
import { useState } from "react"
import { chipVariants, FormField, ListEditor, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { NicheAim } from "@/lib/ai"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import type { PlatformId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ONBOARDING_LANGS, useCopy, type OnboardingLang } from "./copy"
import { GALING_GROUPS, HILIG_GROUPS, KANINO_CHIPS, problemSuggestions } from "./niche-model"
import { AIM_IDS, goalsFromAims, LIMITS, normalizeSplit, norm, platformsInOrder } from "./onboarding-model"
import { AIM_ICONS } from "./step-para-saan"
import { SuggestionChips } from "./steps-discovery"
import { fid, type StepProps } from "./steps-profile"
import { TAP } from "./wizard-chrome"

/** Chips grow to 44px tap targets on phones. */
const CHIP_TAP = "max-sm:h-11 max-sm:px-3.5 max-sm:text-sm"
const cap = (list: string[], each: number) => list.map((x) => x.slice(0, each))

/** A required label that keeps its asterisk after the last word when a long question wraps. */
function Required({ children }: { children: React.ReactNode }) {
  const copy = useCopy()
  return (
    <span>
      {children}
      <span aria-hidden className="ml-0.5 text-muted-foreground">
        *
      </span>
      <span className="sr-only"> ({copy.common.required})</span>
    </span>
  )
}

function Optional() {
  const copy = useCopy()
  return <span className="font-normal text-muted-foreground"> · {copy.common.optional}</span>
}

/** Suggestion groups, collapsed to the first `visible` with "Show more". Picks stay visible in the field above. */
function Suggestions({
  groups,
  value,
  onChange,
  max,
  visible = 2,
}: {
  groups: { id: string; label: string | null; items: string[] }[]
  value: string[]
  onChange: (value: string[]) => void
  max: number
  visible?: number
}) {
  const copy = useCopy()
  const [open, setOpen] = useState(false)
  const shown = open ? groups : groups.slice(0, visible)
  return (
    <div className="flex flex-col gap-2">
      <SuggestionChips groups={shown} value={value} onChange={onChange} max={max} chipClassName={CHIP_TAP} />
      {groups.length > visible ? (
        <Button type="button" variant="ghost" size="sm" className={cn("self-start text-muted-foreground", TAP)} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
          {open ? copy.quick.showLess : copy.quick.showMore}
        </Button>
      ) : null}
    </div>
  )
}

/* ---------------------------------- Start --------------------------------- */

/** Screen 1: language, name and where you post. */
export function StartStep({ answers: a, update, errors, lang, onLang }: StepProps & { lang: OnboardingLang; onLang: (lang: OnboardingLang) => void }) {
  const copy = useCopy()
  const t = copy.quick
  const toggle = (p: PlatformId) => {
    const platforms = platformsInOrder(a.platforms.includes(p) ? a.platforms.filter((x) => x !== p) : [...a.platforms, p])
    update({ platforms, split: normalizeSplit(a.split, platforms) })
  }
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="ob-lang-title" className="flex flex-col gap-2">
        <h2 id="ob-lang-title" className="text-sm font-medium">
          {t.language}
        </h2>
        <RadioGroup
          value={lang}
          onValueChange={(value) => {
            if (value === "english" || value === "taglish") onLang(value)
          }}
          className="grid grid-cols-2 gap-2"
          aria-labelledby="ob-lang-title"
        >
          {ONBOARDING_LANGS.map((l) => (
            <label
              key={l}
              htmlFor={`ob-lang-${l}`}
              className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 has-data-checked:border-brand/45 has-data-checked:bg-brand-soft dark:bg-input/20"
            >
              <RadioGroupItem id={`ob-lang-${l}`} value={l} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{copy.lang[l]}</span>
                <span className="block text-xs text-pretty text-muted-foreground">{l === "english" ? copy.welcome.englishHint : copy.welcome.taglishHint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </section>

      <FormField label={t.name} required htmlFor={fid("name")} error={errors.name}>
        <Input
          id={fid("name")}
          name="name"
          data-ob-required
          value={a.name}
          maxLength={LIMITS.name}
          placeholder={t.namePlaceholder}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          aria-required
          onChange={(event) => update({ name: event.target.value })}
          className={TAP}
        />
      </FormField>

      <section aria-labelledby="ob-platforms-title" className="flex flex-col gap-2" data-ob-required>
        <div className="space-y-0.5">
          <h2 id="ob-platforms-title" className="text-sm font-medium">
            <Required>{t.platforms}</Required>
          </h2>
          <p className="text-xs text-pretty text-muted-foreground">{t.platformsHint}</p>
        </div>
        <div role="group" aria-labelledby="ob-platforms-title" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on ? "border-brand/45 bg-brand-soft" : "bg-card hover:bg-muted/60 dark:bg-input/20"
                )}
              >
                <PlatformIcon platform={p} colored={on} className="size-4.5" />
                <span className="min-w-0 flex-1 truncate">{PLATFORMS[p].label}</span>
                {on ? <Check className="size-4 shrink-0 text-brand" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
        {errors.platforms ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.platforms}
          </p>
        ) : null}
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" aria-hidden />
        {t.time}
      </p>
    </div>
  )
}

/* ---------------------------------- About --------------------------------- */

/** Screen 2: interests (≥ 2) and skills (optional), plus the "I already know my niche" shortcut. */
export function AboutStep({ answers: a, update, errors, onKnowNiche }: StepProps & { onKnowNiche: () => void }) {
  const copy = useCopy()
  const t = copy.quick
  const count = a.interests.filter((x) => x.trim()).length
  const setInterests = (interests: string[]) => update({ interests: cap(interests, LIMITS.interest) })
  const setSkills = (expertise_areas: string[]) => update({ expertise_areas: cap(expertise_areas, LIMITS.expertise) })
  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {t.knowNicheText}
        <Button type="button" variant="link" size="sm" className={cn("h-auto px-0 py-1 text-xs", "max-sm:h-11")} onClick={onKnowNiche}>
          {t.knowNiche}
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </p>
      <div className="flex flex-col gap-3">
        <div data-ob-required={a.own_niche ? undefined : true}>
          <FormField
            label={a.own_niche ? t.interests : <Required>{t.interests}</Required>}
            htmlFor={fid("interests")}
            error={errors.interests}
            description={t.interestsHint}
            labelAction={<span className="text-xs text-muted-foreground num">{t.interestsCount(count)}</span>}
          >
            <ListEditor
              variant="chips"
              id={fid("interests")}
              value={a.interests}
              onChange={setInterests}
              maxItems={LIMITS.interestsMax}
              placeholder={t.interestsPlaceholder}
              aria-label={t.interests}
              className="max-sm:min-h-11"
            />
          </FormField>
        </div>
        <Suggestions
          groups={HILIG_GROUPS.map((g) => ({ id: g.id, label: copy.hilig.groups[g.id], items: g.items }))}
          value={a.interests}
          onChange={setInterests}
          max={LIMITS.interestsMax}
        />
      </div>

      <div className="flex flex-col gap-3">
        <FormField
          label={
            <>
              {t.skills}
              <Optional />
            </>
          }
          htmlFor={fid("expertise_areas")}
          description={t.skillsHint}
        >
          <ListEditor
            variant="chips"
            id={fid("expertise_areas")}
            value={a.expertise_areas}
            onChange={setSkills}
            maxItems={LIMITS.expertiseMax}
            placeholder={t.skillsPlaceholder}
            aria-label={t.skills}
            className="max-sm:min-h-11"
          />
        </FormField>
        <Suggestions
          groups={GALING_GROUPS.map((g) => ({ id: g.id, label: copy.galing.groups[g.id], items: g.items }))}
          value={a.expertise_areas}
          onChange={setSkills}
          max={LIMITS.expertiseMax}
        />
      </div>

    </div>
  )
}

/* ----------------------------------- Who ---------------------------------- */

/** Screen 3: who you help (≥ 1), their #1 problem and what the brand is for (both optional). */
export function WhoStep({ answers: a, update, errors, lang }: StepProps & { lang: OnboardingLang }) {
  const copy = useCopy()
  const t = copy.quick
  const setAudiences = (audiences: string[]) => update({ audiences: cap(audiences, LIMITS.audience) })
  const problem = a.persona_problems[0] ?? ""
  // Only the first problem is asked here; any others (a re-run) are kept as they are.
  const setProblem = (value: string) => {
    const rest = a.persona_problems.slice(1)
    update({ persona_problems: value || rest.length ? [value.slice(0, LIMITS.problem), ...rest] : [] })
  }
  const first = a.audiences.find((x) => x.trim()) ?? ""
  const ideas = problemSuggestions(first, lang).filter((p) => norm(p) !== norm(problem))
  const full = a.aims.length >= LIMITS.aimsMax
  const toggleAim = (aim: NicheAim) => {
    const on = a.aims.includes(aim)
    if (!on && full) return
    const aims = on ? a.aims.filter((x) => x !== aim) : [...a.aims, aim]
    update({ aims, ...goalsFromAims(aims, a) })
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div data-ob-required={a.own_niche ? undefined : true}>
          <FormField label={a.own_niche ? t.audience : <Required>{t.audience}</Required>} htmlFor={fid("audiences")} error={errors.audiences} description={t.audienceHint}>
            <ListEditor
              variant="chips"
              id={fid("audiences")}
              value={a.audiences}
              onChange={setAudiences}
              maxItems={LIMITS.audiencesMax}
              placeholder={t.audiencePlaceholder}
              aria-label={t.audience}
              className="max-sm:min-h-11"
            />
          </FormField>
        </div>
        <Suggestions
          groups={[
            { id: "kanino-a", label: null, items: KANINO_CHIPS.slice(0, 8) },
            { id: "kanino-b", label: null, items: KANINO_CHIPS.slice(8) },
          ]}
          value={a.audiences}
          onChange={setAudiences}
          max={LIMITS.audiencesMax}
          visible={1}
        />
      </div>

      <FormField
        label={
          <>
            {t.problem}
            <Optional />
          </>
        }
        htmlFor={fid("persona_problems")}
        description={t.problemHint}
      >
        <Input
          id={fid("persona_problems")}
          name="problem"
          value={problem}
          maxLength={LIMITS.problem}
          placeholder={t.problemPlaceholder}
          onChange={(event) => setProblem(event.target.value)}
          className={TAP}
        />
        {ideas.length ? (
          <div role="group" aria-label={t.problemIdeas(first)} className="flex flex-col gap-1.5 pt-1">
            <p className="text-xs text-muted-foreground">{t.problemIdeas(first)}</p>
            <div className="flex flex-wrap gap-1.5">
              {ideas.map((idea) => (
                <button key={idea} type="button" onClick={() => setProblem(idea)} className={cn(chipVariants({ size: "default", selected: false }), "h-auto min-h-8 max-w-full shrink py-1.5 text-left whitespace-normal", CHIP_TAP, "max-sm:h-auto max-sm:min-h-11")}>
                  <Plus aria-hidden />
                  {idea}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </FormField>

      <section aria-labelledby="ob-aims-title" className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h2 id="ob-aims-title" className="text-sm font-medium">
              {t.aims}
              <Optional />
            </h2>
            <p className="text-xs text-pretty text-muted-foreground">{t.aimsHint}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground num">
            {a.aims.length}/{LIMITS.aimsMax}
          </span>
        </div>
        <div id={fid("aims")} role="group" aria-labelledby="ob-aims-title" className="flex flex-wrap gap-1.5">
          {AIM_IDS.map((aim) => {
            const on = a.aims.includes(aim)
            const Icon = AIM_ICONS[aim]
            return (
              <button
                key={aim}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                title={copy.paraSaan.options[aim].text}
                onClick={() => toggleAim(aim)}
                className={cn(chipVariants({ size: "default", selected: on }), CHIP_TAP)}
              >
                {on ? <Check aria-hidden /> : <Icon aria-hidden />}
                {copy.paraSaan.options[aim].title}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
