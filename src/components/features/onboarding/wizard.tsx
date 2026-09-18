"use client"

import { ArrowRight, Check, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { isAiError, runAiTask, useAiTask, type NicheOption } from "@/lib/ai"
import { updateSettings, useDataStore, useSettings, useTable } from "@/lib/store"
import { trackOnboardingStep, trackUsage } from "@/lib/telemetry"
import { cn } from "@/lib/utils"
import { applyOnboardingPlan, ensureStarterLibrary } from "./apply-onboarding"
import { COPY, CopyContext, type OnboardingLang } from "./copy"
import { BuildingScreen, type BuildState } from "./building"
import { applyNicheOption, nicheInput, nicheKey, pillarsFromOption, startOwnNiche, writtenNicheInput } from "./niche-model"
import { clearDraft, saveDraft, type OnboardingDraft, type StrategyResult } from "./onboarding-draft"
import { effectivePillars, toIdeaDrafts } from "./onboarding-ideas"
import {
  chosenGoals,
  countedSteps,
  DISCOVERY_STEPS,
  firstInvalidStep,
  firstName,
  flowFor,
  GENERATE_KEY,
  goalsFromAims,
  hasErrors,
  isQuickMode,
  normalizeSplit,
  platformsInOrder,
  selectedPillars,
  stepIndex,
  stepNumber,
  strategyInput,
  strategyKey,
  validateStep,
  weeklyTotal,
  type OnboardingAnswers,
  type StepErrors,
  type StepKey,
} from "./onboarding-model"
import { planNicheUpdate, planOnboarding } from "./onboarding-plan"
import { canSuggestNiches, optionForWrittenNiche, quickAims, quickSetupAnswers } from "./quick-setup"
import { StrategyStep } from "./step-generate"
import { NicheStep } from "./step-niche"
import { ParaSaanStep } from "./step-para-saan"
import { PickStep } from "./step-pick"
import { WelcomeStep } from "./step-welcome"
import { GalingStep, HiligStep, KaninoStep } from "./steps-discovery"
import { IdentityStep } from "./steps-profile"
import { AboutStep, StartStep, WhoStep } from "./steps-quick"
import { PillarsStep, PlatformsStep, VoiceStep } from "./steps-strategy"
import { StepHeading, TAP, WIDTH_CLASS, WizardFooter, WizardHeader } from "./wizard-chrome"

/** Steps that open with the cursor in their first text field (on devices with a keyboard). */
const TEXT_FIRST = new Set<StepKey>(["start", "about", "who", "hilig", "galing", "kanino", "identity"])
const WIDE = new Set<StepKey>(["niche", "strategy"])

/**
 * The setup wizard. A new workspace gets Quick setup (4 screens, then the Building screen); a re-run from
 * Brand HQ the detailed setup; `?step=niche` Niche Discovery alone on Quick setup screens 2–4.
 * Every path writes through `planOnboarding` / `planNicheUpdate` → `applyOnboardingPlan`.
 */
export function Wizard({
  draft,
  setDraft,
  userId,
}: {
  draft: OnboardingDraft
  setDraft: React.Dispatch<React.SetStateAction<OnboardingDraft | null>>
  userId: string
}) {
  const router = useRouter()
  const settings = useSettings()
  const existingPillars = useTable("content_pillars")
  const { run: runStrategy, isPending: strategyPending, error: strategyError } = useAiTask("onboarding_strategy")
  const { run: runNiche, isPending: nichePending, error: nicheError } = useAiTask("niche_discovery")
  const [confirm, confirmDialog] = useConfirm()
  const [attempted, setAttempted] = useState<Record<number, boolean>>({})
  const [finishing, setFinishing] = useState(false)
  const [building, setBuilding] = useState<BuildState | null>(null)
  const [replacePillars, setReplacePillars] = useState(false)
  /** Work the Building screen already finished, so "Try again" only redoes what failed. */
  const prepared = useRef<{ niche?: { key: string; option: NicheOption }; ideas?: { key: string; output: { ideas: Parameters<typeof toIdeaDrafts>[0] } } }>({})
  const buildAbort = useRef<AbortController | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const { step, answers, strategy, niche, lang, mode } = draft
  const copy = COPY[lang]
  const flow = flowFor(mode)
  const key = flow[step] ?? flow[0]
  const meta = copy.steps[key]
  const errors = useMemo(() => validateStep(key, answers, copy.errors), [key, answers, copy])
  const shownErrors: StepErrors = attempted[step] ? errors : {}
  const currentKey = useMemo(() => strategyKey(answers), [answers])
  const stale = Boolean(strategy && strategy.key !== currentKey)
  const currentNicheKey = useMemo(() => nicheKey(answers, lang), [answers, lang])
  const nicheStale = Boolean(niche && niche.key !== currentNicheKey)
  const quick = isQuickMode(mode)
  const canSuggest = useMemo(() => canSuggestNiches(answers), [answers])
  const latest = useRef({ answers, lang })
  useEffect(() => {
    latest.current = { answers, lang }
  }, [answers, lang])

  // Every change is remembered in this browser, so a refresh never loses answers.
  useEffect(() => {
    if (!finishing) saveDraft(userId, draft)
  }, [draft, userId, finishing])

  const patchDraft = useCallback(
    (patch: Partial<OnboardingDraft> | ((d: OnboardingDraft) => Partial<OnboardingDraft>)) =>
      setDraft((d) => (d ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)),
    [setDraft]
  )
  const update = useCallback((patch: Partial<OnboardingAnswers>) => patchDraft((d) => ({ answers: { ...d.answers, ...patch } })), [patchDraft])
  const editStrategy = useCallback(
    (edit: (s: StrategyResult) => StrategyResult) => patchDraft((d) => (d.strategy ? { strategy: { ...edit(d.strategy), edited: true } } : {})),
    [patchDraft]
  )
  /** The UI language; on a first run it is also the language the brand writes in. */
  const setLang = useCallback(
    (next: OnboardingLang) => patchDraft((d) => ({ lang: next, answers: d.mode === "first" ? { ...d.answers, language: next } : d.answers })),
    [patchDraft]
  )

  // A first run shows shared controls (chip inputs, AI badges) in the chosen language too: the app language follows.
  useEffect(() => {
    if (mode !== "first") return
    const want = lang === "english" ? "en" : "tl"
    if (useDataStore.getState().db.app_settings[0]?.ui_language !== want) updateSettings({ ui_language: want })
  }, [lang, mode])

  useEffect(() => () => buildAbort.current?.abort(), [])

  const generate = useCallback(
    async (source: OnboardingAnswers) => {
      // Formats and angles must exist for the ideas to map onto them (new Supabase users start empty).
      try {
        ensureStarterLibrary()
      } catch {
        // Generation still works without the library; Finish setup retries the insert.
      }
      const input = strategyInput(source)
      const result = await runStrategy(input)
      if (!result) return
      const out = result.output
      patchDraft((d) => ({
        strategy: {
          key: strategyKey(source),
          provider: result.provider,
          model: result.model,
          positioning_statement: out.positioning_statement,
          known_for: out.known_for,
          point_of_view: out.point_of_view,
          pillar_suggestions: out.pillar_suggestions,
          ideas: toIdeaDrafts(out.ideas),
          edited: false,
        },
        // An empty point of view takes the suggested one; anything the creator wrote stays.
        answers: d.answers.point_of_view.trim() ? d.answers : { ...d.answers, point_of_view: out.point_of_view },
      }))
    },
    [runStrategy, patchDraft]
  )

  const generateNiche = useCallback(
    async (source: OnboardingAnswers, language: OnboardingLang) => {
      const input = nicheInput(source, language)
      const result = await runNiche(input)
      if (!result) return
      patchDraft({ niche: { key: JSON.stringify(input), provider: result.provider, model: result.model, options: result.output.options, notes: result.output.notes } })
    },
    [runNiche, patchDraft]
  )

  // Arriving on the strategy step without a strategy (e.g. after a refresh) generates one.
  // Deferred so React's dev double-mount cancels the first attempt instead of aborting it mid-flight.
  useEffect(() => {
    if (key !== "strategy" || strategy || strategyError) return
    const timer = window.setTimeout(() => void generate(latest.current.answers), 0)
    return () => window.clearTimeout(timer)
  }, [key, strategy, strategyError, generate])

  // Arriving on the niche step without suggestions — or with suggestions for older answers or another language — finds them.
  // Quick setup only suggests once screens 2–3 have something to build on (the shortcut may skip them).
  const onNicheStep = key === "niche" || (key === "pick" && canSuggest)
  useEffect(() => {
    if (!onNicheStep || nichePending || nicheError || (niche && !nicheStale)) return
    const timer = window.setTimeout(() => void generateNiche(latest.current.answers, latest.current.lang), 0)
    return () => window.clearTimeout(timer)
  }, [onNicheStep, niche, nicheStale, nichePending, nicheError, generateNiche])

  // Each step starts at the top with focus on its first field (keyboard devices) or its question.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const coarse = window.matchMedia("(pointer: coarse)").matches
    const field = contentRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled])")
    // "I already know my niche" lands in the sentence field.
    const own = flow[step] === "pick" && latest.current.answers.own_niche ? document.getElementById("ob-niche") : null
    if (!coarse && own) own.focus({ preventScroll: true })
    else if (!coarse && field && TEXT_FIRST.has(flow[step])) field.focus({ preventScroll: true })
    else headingRef.current?.focus({ preventScroll: true })
  }, [step, flow])

  // Opt-in usage analytics (online version only, src/lib/telemetry): which setup steps are seen.
  useEffect(() => {
    trackOnboardingStep("viewed", { step: key, index: step, mode, lang: latest.current.lang })
  }, [key, step, mode])

  function focusFirstError(errs: StepErrors) {
    const first = Object.keys(errs)[0]
    if (!first) return
    requestAnimationFrame(() => {
      const el = document.getElementById(`ob-${first}`)
      if (!el) return
      const target = el.matches("input, textarea, select, button, [tabindex]") ? el : el.querySelector<HTMLElement>("input, textarea, select, button, [role=radio], [tabindex]")
      el.scrollIntoView({ block: "center" })
      target?.focus({ preventScroll: true })
    })
  }

  function goTo(index: number) {
    const target = Math.max(0, Math.min(flow.length - 1, index))
    if (target > step) {
      // Jumping forward still requires every step on the way to be complete.
      const invalid = firstInvalidStep(answers, flow, target, copy.errors)
      if (invalid !== -1) {
        setAttempted((a) => ({ ...a, [invalid]: true }))
        patchDraft({ step: invalid })
        return
      }
    }
    patchDraft((d) => ({ step: target, maxStep: Math.max(d.maxStep, target) }))
  }
  const goToKey = (target: StepKey) => goTo(stepIndex(flow, target))

  async function next() {
    if (finishing) return
    if (hasErrors(errors)) {
      setAttempted((a) => ({ ...a, [step]: true }))
      focusFirstError(errors)
      return
    }
    trackOnboardingStep("completed", { step: key, index: step, mode, lang })
    if (key === "strategy") return finish()
    if (key === "pick") return mode === "niche" ? finishNiche() : build()

    const patch: Partial<OnboardingAnswers> = {}
    if (key === "identity" && !answers.platforms.length && answers.persona_platforms.length) {
      const platforms = platformsInOrder(answers.persona_platforms)
      patch.platforms = platforms
      patch.split = normalizeSplit(answers.split, platforms)
    }
    const nextAnswers = { ...answers, ...patch }
    patchDraft((d) => ({ answers: { ...d.answers, ...patch }, step: step + 1, maxStep: Math.max(d.maxStep, step + 1) }))

    if (key === GENERATE_KEY && strategy && strategy.key !== strategyKey(nextAnswers)) {
      const replace =
        !strategy.edited ||
        (await confirm({
          title: copy.strategy.regenerateConfirm.title,
          description: copy.strategy.regenerateConfirm.changed,
          confirmLabel: copy.strategy.regenerateConfirm.confirm,
          cancelLabel: copy.common.cancel,
          destructive: false,
        }))
      if (replace) void generate(nextAnswers)
    }
  }

  async function regenerate() {
    if (
      strategy?.edited &&
      !(await confirm({
        title: copy.strategy.regenerateConfirm.title,
        description: copy.strategy.regenerateConfirm.manual,
        confirmLabel: copy.strategy.regenerateConfirm.confirm,
        cancelLabel: copy.common.cancel,
        destructive: false,
      }))
    ) {
      return
    }
    void generate(answers)
  }

  /** Stop on the first step that needs attention. True when everything is valid. */
  function checkAll(): boolean {
    const invalid = firstInvalidStep(answers, flow, flow.length, copy.errors)
    if (invalid === -1) return true
    setAttempted((a) => ({ ...a, [invalid]: true }))
    patchDraft({ step: invalid })
    toast.error(copy.finish.attention, { description: copy.steps[flow[invalid]].title })
    return false
  }

  function finish() {
    if (!checkAll()) return
    setFinishing(true)
    try {
      const targets = selectedPillars(answers).map((p) => ({ name: p.name, description: p.description, examples: p.examples, target: p.target }))
      const names = strategy ? effectivePillars(strategy.ideas, targets) : []
      const ideas = (strategy?.ideas ?? []).map((idea, index) => ({ idea, title: idea.title, pillar: names[index] ?? null })).filter((x) => x.idea.selected)
      const plan = planOnboarding(useDataStore.getState().db, { answers, ideas, lang, now: new Date() })
      applyOnboardingPlan(plan)
      trackUsage("onboarding_completed", { mode, lang, pillars: plan.summary.pillars, ideas: plan.summary.ideas })
      clearDraft(userId)
      toast.success(copy.finish.welcome(firstName(answers.name)), {
        description: copy.finish.summary(plan.summary.pillars, plan.summary.ideas, plan.summary.weeklyTarget),
      })
      router.push("/")
    } catch (err) {
      setFinishing(false)
      toast.error(copy.finish.failed, { description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function finishNiche() {
    if (!checkAll()) return
    const option = answers.own_niche ? null : answers.niche_option
    const replace = Boolean(option && replacePillars && option.pillars.length)
    if (
      replace &&
      option &&
      !(await confirm({
        title: copy.finish.replaceConfirm.title,
        description: copy.finish.replaceConfirm.description(option.pillars.length),
        confirmLabel: copy.finish.replaceConfirm.confirm,
        cancelLabel: copy.common.cancel,
        destructive: true,
      }))
    ) {
      return
    }
    setFinishing(true)
    try {
      // No aim picked: the brand keeps growing an audience (the Quick setup default) instead of losing its goal.
      const aims = answers.aims.length ? {} : { aims: quickAims([]), ...goalsFromAims(quickAims([]), answers) }
      const base = { ...answers, ...aims }
      const source = replace && option ? { ...base, pillars: pillarsFromOption(option, base.pillars) } : base
      const plan = planNicheUpdate(useDataStore.getState().db, { answers: source, replacePillars: replace, now: new Date() })
      applyOnboardingPlan(plan)
      trackUsage("onboarding_completed", { mode, lang })
      clearDraft(userId)
      toast.success(copy.finish.nicheSaved, { description: copy.finish.nicheSavedText(replace) })
      router.push("/strategy")
    } catch (err) {
      setFinishing(false)
      toast.error(copy.finish.failed, { description: err instanceof Error ? err.message : String(err) })
    }
  }

  const choose = (option: NicheOption) => update({ ...applyNicheOption(answers, option, { replacePillars: mode === "first", copy }), own_niche: false })
  const focusOwn = () =>
    requestAnimationFrame(() => {
      const el = document.getElementById("ob-niche")
      el?.scrollIntoView({ block: "center" })
      el?.focus({ preventScroll: true })
    })
  const writeOwn = () => {
    if (!answers.own_niche) update({ ...startOwnNiche(answers, copy), own_niche: true })
    focusOwn()
  }

  /** "I already know my niche": straight to screen 4 with "Write my own" open (screen 1 is still required). */
  function knowNiche() {
    const next: OnboardingAnswers = { ...answers, ...startOwnNiche(answers, copy), own_niche: true }
    const target = stepIndex(flow, "pick")
    const invalid = firstInvalidStep(next, flow, target, copy.errors)
    trackOnboardingStep("completed", { step: key, index: step, mode, lang })
    if (invalid !== -1) {
      setAttempted((a) => ({ ...a, [invalid]: true }))
      patchDraft({ answers: next, step: invalid })
      return
    }
    patchDraft((d) => ({ answers: next, step: target, maxStep: Math.max(d.maxStep, target) }))
  }

  /** Back from "Write my own" to screen 2, so Orbi can suggest directions. */
  function findForMe() {
    patchDraft((d) => ({ answers: { ...d.answers, own_niche: false }, step: Math.max(0, stepIndex(flow, "about")) }))
  }

  /**
   * Finish Quick setup: the niche (a chosen direction, or directions built for the written niche) → the
   * full answers → first ideas → the same plan and apply as every setup. Each Building item ticks when
   * its work is done; a failure keeps the answers and offers Try again.
   */
  async function build() {
    if (!checkAll()) return
    const source = answers
    const t = copy.quick
    const written = source.own_niche ? source.niche.trim() : ""
    buildAbort.current?.abort()
    const abort = new AbortController()
    buildAbort.current = abort
    setBuilding({ done: {}, running: ["brand", "pillars", "schedule", "goals"], error: null })
    try {
      // Formats and angles must exist for the ideas to map onto them (new Supabase users start empty).
      try {
        ensureStarterLibrary()
      } catch {
        // Ideas still generate without the library; the plan inserts what's missing.
      }
      let option = source.own_niche ? null : source.niche_option
      if (!option) {
        const input = writtenNicheInput(source, lang, written)
        const nicheCacheKey = JSON.stringify(input)
        option = prepared.current.niche?.key === nicheCacheKey ? prepared.current.niche.option : null
        if (!option) {
          const res = await runAiTask("niche_discovery", input, { signal: abort.signal })
          option = optionForWrittenNiche(res.output.options, written)
          if (!option) throw new Error(copy.niche.errorTitle)
          prepared.current.niche = { key: nicheCacheKey, option }
        }
      }
      const full = quickSetupAnswers(source, { option, written: written || undefined }, lang)
      const pillars = selectedPillars(full)
      setBuilding({
        done: {
          brand: "",
          pillars: t.pillarsDone(pillars.length),
          schedule: t.scheduleDone(weeklyTotal(full)),
          goals: chosenGoals(full)
            .map((g) => copy.goals[g])
            .join(" · "),
        },
        running: ["ideas"],
        error: null,
      })

      const ideasKey = strategyKey(full)
      let output = prepared.current.ideas?.key === ideasKey ? prepared.current.ideas.output : null
      if (!output) {
        output = (await runAiTask("onboarding_strategy", strategyInput(full), { signal: abort.signal })).output
        prepared.current.ideas = { key: ideasKey, output }
      }
      const drafts = toIdeaDrafts(output.ideas)
      const names = effectivePillars(
        drafts,
        pillars.map((p) => ({ name: p.name, description: p.description, examples: p.examples, target: p.target }))
      )
      const ideas = drafts.map((idea, index) => ({ idea, title: idea.title, pillar: names[index] ?? null }))
      setBuilding((s) => (s ? { ...s, done: { ...s.done, ideas: t.ideasDone(ideas.length) }, running: [] } : s))

      const plan = planOnboarding(useDataStore.getState().db, { answers: full, ideas, lang, now: new Date() })
      applyOnboardingPlan(plan)
      trackUsage("onboarding_completed", { mode, lang, pillars: plan.summary.pillars, ideas: plan.summary.ideas })
      setFinishing(true)
      clearDraft(userId)
      toast.success(copy.finish.welcome(firstName(full.name)), {
        description: copy.finish.summary(plan.summary.pillars, plan.summary.ideas, plan.summary.weeklyTarget),
      })
      router.push("/")
    } catch (err) {
      if (abort.signal.aborted) return
      const message = isAiError(err) || err instanceof Error ? err.message : String(err)
      setBuilding((s) => ({ done: s?.done ?? {}, running: [], error: message }))
    }
  }

  if (building) {
    return (
      <CopyContext.Provider value={copy}>
        <div lang={lang === "english" ? "en" : "fil"}>
          <BuildingScreen state={building} onRetry={() => void build()} onBack={() => setBuilding(null)} />
        </div>
      </CopyContext.Provider>
    )
  }

  if (finishing) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6" aria-live="polite" aria-busy="true">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="text-brand" />
          {mode === "niche" ? copy.finish.savingNiche : copy.finish.settingUp}
        </p>
      </main>
    )
  }

  const width = WIDE.has(key) ? "wide" : "narrow"
  const stepProps = { answers, update, errors: shownErrors }
  const ideaCount = strategy?.ideas.filter((i) => i.selected).length ?? 0
  const forward = <ArrowRight data-icon="inline-end" aria-hidden />
  const sparkle = <Sparkles data-icon="inline-end" aria-hidden />
  const check = <Check data-icon="inline-end" aria-hidden />
  const showNiches = (key === "para_saan" || (key === "who" && canSuggest)) && (!niche || nicheStale)
  const primary =
    key === "welcome"
      ? { label: copy.welcome.start, icon: forward }
      : showNiches
        ? { label: copy.finish.showNiches, icon: sparkle }
        : key === "pick"
          ? { label: mode === "niche" ? copy.finish.saveNiche : copy.finish.finish, icon: check }
          : key === GENERATE_KEY
            ? { label: !strategy ? copy.finish.generate : stale ? copy.finish.regenerate : copy.finish.review, icon: !strategy || stale ? sparkle : forward }
            : key === "strategy"
              ? { label: copy.finish.finish, icon: check }
              : { label: copy.common.continue, icon: forward }

  let body: React.ReactNode
  switch (key) {
    case "start":
      body = <StartStep {...stepProps} lang={lang} onLang={setLang} />
      break
    case "about":
      body = <AboutStep {...stepProps} onKnowNiche={knowNiche} />
      break
    case "who":
      body = <WhoStep {...stepProps} lang={lang} />
      break
    case "pick":
      body = (
        <PickStep
          {...stepProps}
          result={niche}
          pending={nichePending}
          error={nicheError}
          mode={mode}
          canSuggest={canSuggest}
          replacePillars={replacePillars}
          onReplacePillarsChange={setReplacePillars}
          onGenerate={() => void generateNiche(answers, lang)}
          onChoose={choose}
          onWriteOwn={writeOwn}
          onFindForMe={findForMe}
        />
      )
      break
    case "welcome":
      body = <WelcomeStep lang={lang} onLang={setLang} />
      break
    case "hilig":
      body = <HiligStep {...stepProps} />
      break
    case "galing":
      body = <GalingStep {...stepProps} />
      break
    case "kanino":
      body = <KaninoStep {...stepProps} />
      break
    case "para_saan":
      body = <ParaSaanStep {...stepProps} />
      break
    case "niche":
      body = (
        <NicheStep
          {...stepProps}
          result={niche}
          pending={nichePending}
          error={nicheError}
          mode={mode}
          replacePillars={replacePillars}
          onReplacePillarsChange={setReplacePillars}
          onGenerate={() => void generateNiche(answers, lang)}
          onChoose={choose}
          onWriteOwn={writeOwn}
          onFix={goToKey}
        />
      )
      break
    case "identity":
      body = <IdentityStep {...stepProps} onEditNiche={() => goToKey("niche")} />
      break
    case "platforms":
      body = <PlatformsStep {...stepProps} weekStartsOn={settings.week_starts_on} />
      break
    case "voice":
      body = <VoiceStep {...stepProps} />
      break
    case "pillars":
      body = <PillarsStep {...stepProps} existing={existingPillars} nicheOption={answers.niche_option} />
      break
    case "strategy":
      body = (
        <StrategyStep
          answers={answers}
          update={update}
          strategy={strategy}
          editStrategy={editStrategy}
          stale={stale}
          pending={strategyPending}
          error={strategyError}
          onGenerate={() => void regenerate()}
          onEdit={goToKey}
          existingPillars={existingPillars}
        />
      )
      break
  }

  const number = stepNumber(flow, step)
  const total = countedSteps(flow).length
  // Quick setup shows its place in the progress bar; the detailed setup keeps the phase eyebrow.
  const eyebrow = number && !quick ? `${DISCOVERY_STEPS.has(key) ? copy.phases.discovery : copy.phases.setup} · ${copy.common.stepOf(number, total)}` : undefined

  return (
    <CopyContext.Provider value={copy}>
      <div className="flex min-h-svh flex-col" lang={lang === "english" ? "en" : "fil"}>
        <WizardHeader
          flow={flow}
          step={step}
          maxStep={draft.maxStep}
          onStepSelect={goTo}
          subtitle={mode === "niche" ? copy.common.nicheSetup : mode === "rerun" ? copy.common.detailedSetup : copy.common.quickSetup}
          exitHref={mode === "rerun" ? "/" : mode === "niche" ? "/strategy" : null}
          lang={lang}
          onLangChange={setLang}
          progress={quick ? "bar" : "steps"}
          showLanguage={key !== "start"}
        />
        <form
          id="ob-step-form"
          noValidate
          className="flex flex-1 flex-col"
          aria-labelledby="ob-step-title"
          onSubmit={(event) => {
            event.preventDefault()
            void next()
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void next()
            }
          }}
        >
          <main className="flex-1">
            <div ref={contentRef} className={cn("mx-auto w-full px-4 py-8 md:px-6 md:py-10", WIDTH_CLASS[width])}>
              <div id="ob-step-title">
                <StepHeading
                  eyebrow={eyebrow}
                  title={meta.title}
                  description={key === "pick" && !canSuggest ? copy.quick.ownDescription : meta.description}
                  headingRef={headingRef}
                />
              </div>
              <div className="mt-6">{body}</div>
            </div>
          </main>
          <WizardFooter width={width} onBack={step > 0 ? () => goTo(step - 1) : null}>
            {key === "strategy" && strategy ? <span className="hidden text-xs text-muted-foreground sm:inline num">{copy.strategy.willAdd(ideaCount)}</span> : null}
            <Button type="submit" size="lg" disabled={key === "strategy" && strategyPending} className={TAP}>
              {primary.label}
              {primary.icon}
            </Button>
          </WizardFooter>
        </form>
        <p className="sr-only" aria-live="polite">
          {number ? copy.common.srStep(number, total, meta.title) : meta.title}
        </p>
        {confirmDialog}
      </div>
    </CopyContext.Provider>
  )
}
