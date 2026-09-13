"use client"

import { ArrowRight, Check, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAiTask } from "@/lib/ai"
import { useBrand, useDataStore, useSettings, useTable } from "@/lib/store"
import { cn } from "@/lib/utils"
import { AlreadySetUp } from "./already-set-up"
import { applyOnboardingPlan, ensureStarterLibrary } from "./apply-onboarding"
import { clearDraft, createDraft, loadDraft, saveDraft, workspaceKey, type OnboardingDraft, type StrategyResult } from "./onboarding-draft"
import { effectivePillars, toIdeaDrafts } from "./onboarding-ideas"
import {
  answersFromWorkspace,
  firstInvalidStep,
  firstName,
  GENERATE_STEP,
  hasErrors,
  LAST_STEP,
  normalizeSplit,
  platformsInOrder,
  selectedPillars,
  STEP_COUNT,
  STEPS,
  strategyInput,
  strategyKey,
  validateStep,
  type OnboardingAnswers,
  type StepErrors,
  type StepKey,
} from "./onboarding-model"
import { planOnboarding, type PlanSummary } from "./onboarding-plan"
import { StrategyStep } from "./step-generate"
import { AudienceStep, ExpertiseStep, IdentityStep, PositioningStep } from "./steps-profile"
import { GoalsStep, PillarsStep, PlatformsStep, PostingStep, VoiceStep } from "./steps-strategy"
import { StepHeading, WIDTH_CLASS, WizardFooter, WizardHeader } from "./wizard-chrome"

/** Steps that open with the cursor in their first text field (on devices with a keyboard). */
const TEXT_FIRST = new Set<StepKey>(["identity", "positioning", "audience", "expertise"])

const upperFirst = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

function summaryLine(summary: PlanSummary): string {
  const parts = [
    `${summary.pillars} pillars`,
    summary.ideas ? `${summary.ideas} ideas in your Idea Bank` : null,
    `a ${summary.weeklyTarget}-post weekly plan`,
  ].filter(Boolean)
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} are ready.`
}

/* ---------------------------------- Gate ---------------------------------- */

/** /onboarding: the setup wizard for new workspaces, or a notice (re-run / back) once setup is done. */
export function OnboardingView() {
  const brand = useBrand()
  const userId = useDataStore((s) => s.userId)
  const pillars = useTable("content_pillars")
  const personas = useTable("audience_personas")
  const ideas = useTable("content_ideas")
  const workspace = workspaceKey(brand)
  const [draft, setDraft] = useState<OnboardingDraft | null>(() => {
    if (brand.onboarding_completed) return null
    return loadDraft(userId, workspace) ?? createDraft(workspace, "first", answersFromWorkspace(useDataStore.getState().db))
  })
  const [savedDraft] = useState(() => (brand.onboarding_completed ? loadDraft(userId, workspace) : null))

  if (!draft) {
    return (
      <AlreadySetUp
        brandName={brand.brand_name || brand.name}
        stats={[
          { label: "Pillars", value: pillars.filter((p) => p.is_active).length },
          { label: "Personas", value: personas.length },
          { label: "Ideas", value: ideas.length },
        ]}
        hasDraft={Boolean(savedDraft)}
        onResume={() => savedDraft && setDraft(savedDraft)}
        onRerun={() => {
          clearDraft(userId)
          setDraft(createDraft(workspace, "rerun", answersFromWorkspace(useDataStore.getState().db, { rerun: true })))
        }}
      />
    )
  }
  return <Wizard draft={draft} setDraft={setDraft} userId={userId} />
}

/* --------------------------------- Wizard --------------------------------- */

function Wizard({
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
  const { run: runStrategy, isPending, error: aiError } = useAiTask("onboarding_strategy")
  const [confirm, confirmDialog] = useConfirm()
  const [attempted, setAttempted] = useState<Record<number, boolean>>({})
  const [finishing, setFinishing] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const { step, answers, strategy } = draft
  const meta = STEPS[step]
  const errors = useMemo(() => validateStep(meta.key, answers), [meta.key, answers])
  const shownErrors: StepErrors = attempted[step] ? errors : {}
  const currentKey = useMemo(() => strategyKey(answers), [answers])
  const stale = Boolean(strategy && strategy.key !== currentKey)
  const answersRef = useRef(answers)
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  // Every change is remembered in this browser, so a refresh never loses answers.
  useEffect(() => {
    if (!finishing) saveDraft(userId, draft)
  }, [draft, userId, finishing])

  const patchDraft = useCallback(
    (patch: Partial<OnboardingDraft> | ((d: OnboardingDraft) => Partial<OnboardingDraft>)) =>
      setDraft((d) => (d ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)),
    [setDraft]
  )
  const update = useCallback(
    (patch: Partial<OnboardingAnswers>) => patchDraft((d) => ({ answers: { ...d.answers, ...patch } })),
    [patchDraft]
  )
  const editStrategy = useCallback(
    (edit: (s: StrategyResult) => StrategyResult) => patchDraft((d) => (d.strategy ? { strategy: { ...edit(d.strategy), edited: true } } : {})),
    [patchDraft]
  )

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
          key: JSON.stringify(input),
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

  // Arriving on the strategy step without a strategy (e.g. after a refresh) generates one.
  // Deferred so React's dev double-mount cancels the first attempt instead of aborting it mid-flight.
  useEffect(() => {
    if (meta.key !== "strategy" || strategy || aiError) return
    const timer = window.setTimeout(() => void generate(answersRef.current), 0)
    return () => window.clearTimeout(timer)
  }, [meta.key, strategy, aiError, generate])

  // Each step starts at the top with focus on its first field (keyboard devices) or its question.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const coarse = window.matchMedia("(pointer: coarse)").matches
    const field = contentRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled])")
    if (!coarse && field && TEXT_FIRST.has(STEPS[step].key)) field.focus({ preventScroll: true })
    else headingRef.current?.focus({ preventScroll: true })
  }, [step])

  function focusFirstError(errs: StepErrors) {
    const first = Object.keys(errs)[0]
    if (!first) return
    requestAnimationFrame(() => {
      const el = document.getElementById(`ob-${first}`)
      if (!el) return
      const target = el.matches("input, textarea, select, button, [tabindex]")
        ? el
        : el.querySelector<HTMLElement>("input, textarea, select, button, [role=radio], [tabindex]")
      el.scrollIntoView({ block: "center" })
      target?.focus({ preventScroll: true })
    })
  }

  function goTo(index: number) {
    const target = Math.max(0, Math.min(LAST_STEP, index))
    if (target > step) {
      // Jumping forward still requires every step on the way to be complete.
      const invalid = firstInvalidStep(answers, target)
      if (invalid !== -1) {
        setAttempted((a) => ({ ...a, [invalid]: true }))
        patchDraft({ step: invalid })
        return
      }
    }
    patchDraft((d) => ({ step: target, maxStep: Math.max(d.maxStep, target) }))
  }

  async function next() {
    if (finishing) return
    if (hasErrors(errors)) {
      setAttempted((a) => ({ ...a, [step]: true }))
      focusFirstError(errors)
      return
    }
    if (meta.key === "strategy") return finish()

    const patch: Partial<OnboardingAnswers> = {}
    if (meta.key === "positioning" && !answers.persona_name.trim() && answers.audience.trim()) {
      patch.persona_name = upperFirst(answers.audience.trim()).slice(0, 80)
    }
    if (meta.key === "pillars" && !answers.platforms.length && answers.persona_platforms.length) {
      const platforms = platformsInOrder(answers.persona_platforms)
      patch.platforms = platforms
      patch.split = normalizeSplit(answers.split, platforms)
    }
    const nextAnswers = { ...answers, ...patch }
    patchDraft((d) => ({ answers: { ...d.answers, ...patch }, step: step + 1, maxStep: Math.max(d.maxStep, step + 1) }))

    if (step === GENERATE_STEP && strategy && strategy.key !== strategyKey(nextAnswers)) {
      const replace =
        !strategy.edited ||
        (await confirm({
          title: "Regenerate your strategy?",
          description: "Your answers changed. A new strategy replaces the current ideas, including your title edits, selection and pillar picks.",
          confirmLabel: "Regenerate",
          destructive: false,
        }))
      if (replace) void generate(nextAnswers)
    }
  }

  async function regenerate() {
    if (
      strategy?.edited &&
      !(await confirm({
        title: "Regenerate your strategy?",
        description: "You'll get a new set of 30 ideas. Your title edits, selection and pillar picks on the current ideas are replaced.",
        confirmLabel: "Regenerate",
        destructive: false,
      }))
    ) {
      return
    }
    void generate(answers)
  }

  function finish() {
    const invalid = firstInvalidStep(answers, LAST_STEP)
    if (invalid !== -1) {
      setAttempted((a) => ({ ...a, [invalid]: true }))
      patchDraft({ step: invalid })
      toast.error("A few answers need attention", { description: STEPS[invalid].title })
      return
    }
    setFinishing(true)
    try {
      const targets = selectedPillars(answers).map((p) => ({ name: p.name, description: p.description, examples: p.examples, target: p.target }))
      const names = strategy ? effectivePillars(strategy.ideas, targets) : []
      const ideas = (strategy?.ideas ?? [])
        .map((idea, index) => ({ idea, title: idea.title, pillar: names[index] ?? null }))
        .filter((x) => x.idea.selected)
      const plan = planOnboarding(useDataStore.getState().db, { answers, ideas, now: new Date() })
      applyOnboardingPlan(plan)
      clearDraft(userId)
      toast.success(`Welcome${firstName(answers.name) ? `, ${firstName(answers.name)}` : ""} — your workspace is set up`, {
        description: summaryLine(plan.summary),
      })
      router.push("/")
    } catch (err) {
      setFinishing(false)
      toast.error("Couldn't finish setup", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  if (finishing) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6" aria-live="polite" aria-busy="true">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="text-brand" />
          Setting up your workspace…
        </p>
      </main>
    )
  }

  const width = meta.key === "strategy" ? "wide" : "narrow"
  const stepProps = { answers, update, errors: shownErrors }
  const ideaCount = strategy?.ideas.filter((i) => i.selected).length ?? 0
  const needsGeneration = !strategy || stale
  const primary =
    meta.key === "strategy"
      ? { label: "Finish setup", icon: <Check data-icon="inline-end" aria-hidden /> }
      : step === GENERATE_STEP
        ? {
            label: !strategy ? "Generate my strategy" : stale ? "Regenerate strategy" : "Review strategy",
            icon: needsGeneration ? <Sparkles data-icon="inline-end" aria-hidden /> : <ArrowRight data-icon="inline-end" aria-hidden />,
          }
        : { label: "Continue", icon: <ArrowRight data-icon="inline-end" aria-hidden /> }

  let body: React.ReactNode
  switch (meta.key) {
    case "identity":
      body = <IdentityStep {...stepProps} />
      break
    case "positioning":
      body = <PositioningStep {...stepProps} />
      break
    case "audience":
      body = <AudienceStep {...stepProps} />
      break
    case "expertise":
      body = <ExpertiseStep {...stepProps} />
      break
    case "pillars":
      body = <PillarsStep {...stepProps} existing={existingPillars} />
      break
    case "platforms":
      body = <PlatformsStep {...stepProps} />
      break
    case "posting":
      body = <PostingStep {...stepProps} weekStartsOn={settings.week_starts_on} />
      break
    case "goals":
      body = <GoalsStep {...stepProps} />
      break
    case "voice":
      body = <VoiceStep {...stepProps} />
      break
    case "strategy":
      body = (
        <StrategyStep
          answers={answers}
          update={update}
          strategy={strategy}
          editStrategy={editStrategy}
          stale={stale}
          pending={isPending}
          error={aiError}
          onGenerate={() => void regenerate()}
          onEditStep={goTo}
          existingPillars={existingPillars}
        />
      )
      break
  }

  return (
    <div className="flex min-h-svh flex-col">
      <WizardHeader
        step={step}
        maxStep={draft.maxStep}
        onStepSelect={goTo}
        exitHref={draft.mode === "rerun" ? "/" : null}
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
              <StepHeading index={step} title={meta.title} description={meta.description} headingRef={headingRef} />
            </div>
            <div className="mt-6">{body}</div>
          </div>
        </main>
        <WizardFooter width={width} onBack={step > 0 ? () => goTo(step - 1) : null}>
          {meta.key === "strategy" && strategy ? (
            <span className="hidden text-xs text-muted-foreground sm:inline num">
              {ideaCount} {ideaCount === 1 ? "idea" : "ideas"} will be added
            </span>
          ) : null}
          <Button type="submit" size="lg" disabled={meta.key === "strategy" && isPending}>
            {primary.label}
            {primary.icon}
          </Button>
        </WizardFooter>
      </form>
      <p className="sr-only" aria-live="polite">
        {`Step ${step + 1} of ${STEP_COUNT}: ${meta.title}`}
      </p>
      {confirmDialog}
    </div>
  )
}
