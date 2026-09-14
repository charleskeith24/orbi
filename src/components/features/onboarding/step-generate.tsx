"use client"

import { BookOpen, CalendarDays, CircleAlert, Compass, Layers, Lightbulb, Megaphone, PenLine, Sparkles, Target, UserRound } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"
import { AiButton, catVar, ColorDot, EmptyState, FunnelBadge, InlineText, PlatformIcon, PlatformLabel, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { AiError } from "@/lib/ai"
import { GOAL_CATEGORIES, GOAL_METRIC_MAP, PLATFORMS } from "@/lib/constants"
import type { CategoricalColor, ContentPillar } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { useCopy } from "./copy"
import type { PillarSuggestion, StrategyResult } from "./onboarding-draft"
import { effectivePillars, type IdeaDraft } from "./onboarding-ideas"
import {
  chosenGoals,
  finalSchedule,
  goalTargetFor,
  LIMITS,
  norm,
  parsePositioning,
  personaNameOf,
  pillarColors,
  pillarTotal,
  platformsInOrder,
  positioningOf,
  rebalancePillars,
  weeklyTotal,
  type OnboardingAnswers,
  type PillarDraft,
  type StepKey,
} from "./onboarding-model"
import { PanelTextarea } from "./steps-profile"

export interface StrategyStepProps {
  answers: OnboardingAnswers
  update: (patch: Partial<OnboardingAnswers>) => void
  strategy: StrategyResult | null
  /** Edit the current strategy (idea titles, selection, pillar picks). */
  editStrategy: (edit: (strategy: StrategyResult) => StrategyResult) => void
  /** The answers changed since the strategy was generated. */
  stale: boolean
  pending: boolean
  error: AiError | null
  onGenerate: () => void
  onEdit: (key: StepKey) => void
  existingPillars: Pick<ContentPillar, "name" | "color">[]
}

/** Suggested pillars replace the selection; everything else stays in the list, unselected. */
export function applyPillarSuggestions(current: PillarDraft[], suggestions: PillarSuggestion[]): PillarDraft[] {
  const byName = new Map(current.map((p) => [norm(p.name), p]))
  const suggested = suggestions.slice(0, LIMITS.pillarsMax).map((s, index): PillarDraft => {
    const hit = byName.get(norm(s.name))
    const target = Math.max(1, Math.round(s.target_percentage))
    return hit
      ? { ...hit, description: s.description.trim() || hit.description, target, selected: true }
      : {
          key: `custom:suggested-${index}-${norm(s.name).replace(/\W+/g, "-")}`,
          name: s.name.trim().slice(0, LIMITS.pillarName),
          description: s.description.trim().slice(0, LIMITS.pillarDescription),
          icon: "Layers",
          examples: [],
          target,
          selected: true,
          preset: false,
        }
  })
  const names = new Set(suggested.map((p) => norm(p.name)))
  const rest = current.filter((p) => !names.has(norm(p.name))).map((p) => ({ ...p, selected: false }))
  return rebalancePillars([...suggested, ...rest])
}

function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card p-4 dark:bg-input/20", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  const copy = useCopy()
  return (
    <Button type="button" variant="ghost" size="xs" onClick={onClick} aria-label={copy.summary.editAria(label)}>
      <PenLine aria-hidden />
      {copy.common.edit}
    </Button>
  )
}

function Suggestion({ text, onUse, note }: { text: string; onUse?: () => void; note?: string }) {
  const copy = useCopy()
  return (
    <div className="mt-3 rounded-md border border-dashed bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-brand" aria-hidden />
        {copy.strategy.suggested}
      </p>
      <p className="mt-1 text-sm whitespace-pre-line text-pretty">{text}</p>
      {onUse ? (
        <Button type="button" variant="outline" size="xs" className="mt-2" onClick={onUse}>
          {copy.strategy.useThis}
        </Button>
      ) : note ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}

function MixBar({ pillars, colors }: { pillars: PillarDraft[]; colors: Map<string, CategoricalColor> }) {
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      {pillars.map((p) => (
        <span
          key={p.key}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${Math.max(0, Math.min(100, p.target))}%`, backgroundColor: catVar(colors.get(p.key)) }}
        />
      ))}
    </div>
  )
}

/* ------------------------------ Setup summary ----------------------------- */

function SetupSummary({ answers: a, ideaCount, onEdit }: { answers: OnboardingAnswers; ideaCount: number; onEdit: (key: StepKey) => void }) {
  const copy = useCopy()
  const t = copy.summary
  const goals = chosenGoals(a)
  const pillars = a.pillars.filter((p) => p.selected)
  const platforms = platformsInOrder(a.platforms)
  const slots = finalSchedule(a).length
  const rows: { icon: typeof UserRound; title: string; detail: React.ReactNode; step: StepKey | null }[] = [
    { icon: Compass, title: t.niche, detail: a.niche.trim() || "—", step: "niche" },
    { icon: UserRound, title: t.brandHq, detail: t.brandHqDetail([a.name.trim(), a.brand_name.trim()].filter(Boolean).join(" · ")), step: "identity" },
    {
      icon: Target,
      title: goals.length > 1 ? t.goals : t.goal,
      detail: goals.length
        ? goals
            .map((category, index) => {
              const target = goalTargetFor(a, category)
              const metric = GOAL_METRIC_MAP[GOAL_CATEGORIES[category].metric].label.toLowerCase()
              return `${index === 0 ? t.primary : t.secondary}: ${copy.goals[category]}${target.value !== null ? ` — ${formatNumber(target.value)} ${metric} · ${copy.periods[target.period].toLowerCase()}` : ""}`
            })
            .join(" · ")
        : t.chooseGoal,
      step: "para_saan",
    },
    { icon: Layers, title: t.pillars, detail: pillars.map((p) => `${p.name} ${p.target}%`).join(" · "), step: "pillars" },
    { icon: UserRound, title: t.persona, detail: t.personaDetail(personaNameOf(a), a.persona_problems.filter((p) => p.trim()).length), step: "kanino" },
    {
      icon: Megaphone,
      title: t.platforms,
      detail: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {platforms.map((p) => (
            <PlatformIcon key={p} platform={p} label className="size-3.5" />
          ))}
          <span>
            {platforms.map((p) => PLATFORMS[p].label).join(", ")} · {t.postsPerWeek(weeklyTotal(a))}
          </span>
        </span>
      ),
      step: "platforms",
    },
    { icon: CalendarDays, title: t.schedule, detail: t.scheduleDetail(slots, a.schedule_mode === "custom"), step: "platforms" },
    { icon: Lightbulb, title: t.ideaBank, detail: t.ideaDetail(ideaCount), step: null },
  ]
  if (a.story.trim()) rows.push({ icon: BookOpen, title: t.storyVault, detail: t.storyDetail, step: "galing" })

  return (
    <Panel title={t.title} description={t.description}>
      <ul className="-my-1 divide-y">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <li key={row.title} className="flex items-start gap-3 py-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.title}</p>
                <div className="text-xs text-pretty text-muted-foreground">{row.detail}</div>
              </div>
              {row.step ? <EditButton label={row.title} onClick={() => onEdit(row.step!)} /> : null}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* ---------------------------------- Ideas --------------------------------- */

function IdeaRow({
  idea,
  pillar,
  pillars,
  colorOf,
  onChange,
}: {
  idea: IdeaDraft
  pillar: string | null
  pillars: PillarDraft[]
  colorOf: (name: string | null) => CategoricalColor | null
  onChange: (patch: Partial<IdeaDraft>) => void
}) {
  const copy = useCopy()
  const t = copy.strategy
  return (
    <li className={cn("flex gap-3 px-4 py-3 transition-opacity", !idea.selected && "opacity-60")}>
      <Checkbox checked={idea.selected} onCheckedChange={(value) => onChange({ selected: value === true })} aria-label={t.keepIdea(idea.title)} className="mt-1" />
      <div className="min-w-0 flex-1 space-y-1">
        <InlineText value={idea.title} onSave={(title) => onChange({ title })} required maxLength={200} aria-label={t.ideaTitle} className="font-medium" />
        {idea.hook ? <p className="line-clamp-2 text-xs text-muted-foreground">“{idea.hook}”</p> : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          <PlatformLabel platform={idea.platform} className="text-xs" />
          {idea.format ? <span>· {idea.format}</span> : null}
          <FunnelBadge stage={idea.funnel_stage} />
          <span className="inline-flex items-center gap-1.5">
            <ColorDot color={colorOf(pillar)} />
            <NativeSelect size="sm" value={pillar ?? ""} onChange={(event) => onChange({ pillar: event.target.value || null })} aria-label={t.ideaPillar(idea.title)} className="max-w-44">
              <NativeSelectOption value="">{t.noPillar}</NativeSelectOption>
              {pillars.map((p) => (
                <NativeSelectOption key={p.key} value={p.name}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </span>
        </div>
      </div>
    </li>
  )
}

function IdeasPanel({
  strategy,
  pillarNames,
  pillars,
  colorOf,
  pending,
  editStrategy,
  onGenerate,
}: {
  strategy: StrategyResult
  pillarNames: (string | null)[]
  pillars: PillarDraft[]
  colorOf: (name: string | null) => CategoricalColor | null
  pending: boolean
  editStrategy: StrategyStepProps["editStrategy"]
  onGenerate: () => void
}) {
  const copy = useCopy()
  const t = copy.strategy
  const ideas = strategy.ideas
  const selected = ideas.filter((i) => i.selected).length
  const setIdea = (key: string, patch: Partial<IdeaDraft>) => editStrategy((s) => ({ ...s, ideas: s.ideas.map((i) => (i.key === key ? { ...i, ...patch } : i)) }))
  const setAll = (value: boolean) => editStrategy((s) => ({ ...s, ideas: s.ideas.map((i) => ({ ...i, selected: value })) }))

  return (
    <section aria-labelledby="ob-ideas-title" className="flex min-w-0 flex-col rounded-lg border bg-card dark:bg-input/20">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 id="ob-ideas-title" className="text-sm font-semibold">
            {t.ideas}
          </h2>
          <p className="text-xs text-muted-foreground num">{t.ideasCount(selected, ideas.length)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" disabled={!ideas.length || selected === ideas.length} onClick={() => setAll(true)}>
            {t.selectAll}
          </Button>
          <Button type="button" variant="ghost" size="xs" disabled={!selected} onClick={() => setAll(false)}>
            {t.clear}
          </Button>
        </div>
      </header>
      {ideas.length ? (
        <ul className={cn("divide-y", pending && "opacity-70")} aria-busy={pending || undefined}>
          {ideas.map((idea, index) => (
            <IdeaRow key={idea.key} idea={idea} pillar={pillarNames[index] ?? null} pillars={pillars} colorOf={colorOf} onChange={(patch) => setIdea(idea.key, patch)} />
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={Lightbulb}
          title={t.noIdeas}
          description={t.noIdeasText}
          action={
            <AiButton type="button" size="sm" pending={pending} onClick={onGenerate}>
              {t.regenerate}
            </AiButton>
          }
        />
      )}
    </section>
  )
}

/* ------------------------------ Strategy step ------------------------------ */

export function StrategyStep({ answers: a, update, strategy, editStrategy, stale, pending, error, onGenerate, onEdit, existingPillars }: StrategyStepProps) {
  const copy = useCopy()
  const t = copy.strategy
  const selected = useMemo(() => a.pillars.filter((p) => p.selected), [a.pillars])
  const colors = useMemo(() => pillarColors(a.pillars, existingPillars), [a.pillars, existingPillars])
  const targets = useMemo(() => selected.map((p) => ({ name: p.name, description: p.description, examples: p.examples, target: p.target })), [selected])
  const ideas = strategy?.ideas
  const pillarNames = useMemo(() => effectivePillars(ideas ?? [], targets), [ideas, targets])
  const colorOf = (name: string | null) => {
    const pillar = name ? selected.find((p) => norm(p.name) === norm(name)) : undefined
    return pillar ? (colors.get(pillar.key) ?? null) : null
  }
  const ideaCount = strategy?.ideas.filter((i) => i.selected).length ?? 0

  function applySuggestion(patch: Partial<OnboardingAnswers>, message: string) {
    const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, a[k as keyof OnboardingAnswers]])) as Partial<OnboardingAnswers>
    update(patch)
    toast.success(message, { action: { label: t.toasts.undo, onClick: () => update(previous) } })
  }

  if (!strategy) {
    return (
      <div className="flex flex-col gap-4">
        {error && !pending ? (
          <Panel title={t.errorTitle}>
            <p className="flex items-start gap-2 text-sm text-pretty">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
              <span>{error.message}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t.errorHint}</p>
            <AiButton type="button" size="sm" className="mt-3" onClick={onGenerate}>
              {t.tryAgain}
            </AiButton>
          </Panel>
        ) : (
          <section aria-live="polite" aria-busy="true" className="rounded-lg border bg-card p-4 dark:bg-input/20">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Spinner className="text-brand" />
              {t.drafting}
            </p>
            <div className="mt-4 space-y-2.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </section>
        )}
        <SetupSummary answers={a} ideaCount={0} onEdit={onEdit} />
      </div>
    )
  }

  const current = positioningOf(a)
  const suggested = strategy.positioning_statement.trim()
  const parsed = parsePositioning(suggested, a.audience)
  const total = pillarTotal(a.pillars)
  const suggestions = strategy.pillar_suggestions
  const sameMix =
    suggestions.length === selected.length &&
    suggestions.every((s) => selected.some((p) => norm(p.name) === norm(s.name) && p.target === Math.round(s.target_percentage)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ProviderBadge provider={strategy.provider} model={strategy.model} />
          <span className="text-xs text-muted-foreground">{strategy.provider === "offline" ? t.offlineNote : t.aiNote}</span>
        </div>
        <AiButton type="button" size="sm" pending={pending} pendingLabel={t.regenerating} onClick={onGenerate}>
          {t.regenerate}
        </AiButton>
      </div>
      {stale && !pending ? (
        <p className="flex items-start gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm dark:bg-input/20">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-fg" aria-hidden />
          <span>
            <span className="font-medium">{t.outOfDate}</span> {t.outOfDateText}
          </span>
        </p>
      ) : null}
      {error && !pending ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error.message} {t.previousDraft}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t.niche} action={<EditButton label={t.niche} onClick={() => onEdit("niche")} />}>
            <p className="text-sm font-medium text-pretty">{a.niche}</p>
          </Panel>

          <Panel title={t.positioning} action={<EditButton label={t.positioning} onClick={() => onEdit("niche")} />}>
            <p className="text-sm text-pretty">{current || t.positioningEmpty}</p>
            {suggested && norm(suggested) !== norm(current) ? (
              <Suggestion text={suggested} onUse={parsed ? () => applySuggestion(parsed, t.toasts.positioning) : undefined} note={parsed ? undefined : t.editToUse} />
            ) : null}
          </Panel>

          <Panel title={t.knownFor}>
            <PanelTextarea label={t.knownFor} value={a.known_for} onChange={(known_for) => update({ known_for })} />
            {strategy.known_for.trim() && norm(strategy.known_for) !== norm(a.known_for) ? (
              <Suggestion text={strategy.known_for} onUse={() => applySuggestion({ known_for: strategy.known_for }, t.toasts.knownFor)} />
            ) : null}
          </Panel>

          <Panel title={t.pov} description={t.povDescription}>
            <PanelTextarea label={t.pov} value={a.point_of_view} rows={3} placeholder={t.povPlaceholder} onChange={(point_of_view) => update({ point_of_view })} />
            {strategy.point_of_view.trim() && norm(strategy.point_of_view) !== norm(a.point_of_view) ? (
              <Suggestion text={strategy.point_of_view} onUse={() => applySuggestion({ point_of_view: strategy.point_of_view }, t.toasts.pov)} />
            ) : null}
          </Panel>

          <Panel title={t.pillars} description={t.pillarsDescription(selected.length, total)} action={<EditButton label={t.pillars} onClick={() => onEdit("pillars")} />}>
            <MixBar pillars={selected} colors={colors} />
            <ul className="mt-3 space-y-1.5">
              {selected.map((p) => (
                <li key={p.key} className="flex items-center gap-2 text-sm">
                  <ColorDot color={colors.get(p.key)} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground num">{p.target}%</span>
                </li>
              ))}
            </ul>
            {suggestions.length && !sameMix ? (
              <div className="mt-3 rounded-md border border-dashed bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5 text-brand" aria-hidden />
                  {t.suggestedMix}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {suggestions.map((s) => (
                    <li key={s.name} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 text-pretty">
                        <span className="font-medium text-foreground">{s.name}</span>
                        {s.description ? <span className="text-muted-foreground"> — {s.description}</span> : null}
                      </span>
                      <span className="shrink-0 text-muted-foreground num">{Math.round(s.target_percentage)}%</span>
                    </li>
                  ))}
                </ul>
                <Button type="button" variant="outline" size="xs" className="mt-2" onClick={() => applySuggestion({ pillars: applyPillarSuggestions(a.pillars, suggestions) }, t.toasts.mix)}>
                  {t.useSuggestedMix}
                </Button>
              </div>
            ) : null}
          </Panel>

          <SetupSummary answers={a} ideaCount={ideaCount} onEdit={onEdit} />
        </div>

        <IdeasPanel strategy={strategy} pillarNames={pillarNames} pillars={selected} colorOf={colorOf} pending={pending} editStrategy={editStrategy} onGenerate={onGenerate} />
      </div>
    </div>
  )
}
