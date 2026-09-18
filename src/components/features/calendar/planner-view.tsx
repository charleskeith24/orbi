"use client"

import { addDays, addWeeks } from "date-fns"
import { ChevronLeft, ChevronRight, CircleAlert, ListChecks } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AiButton, PageContainer, PageHeader, ProviderBadge, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  bestGroup,
  groupByFormat,
  groupByHookCategory,
  groupByPillar,
  groupByPlatform,
  groupByTopic,
  recommendNextContent,
  scopedRows,
  strategicInsights,
  topPerformers,
  weeklyReport,
  type ContentRecommendation,
} from "@/lib/analytics"
import { buildWeeklyPlanInput, useAiTask } from "@/lib/ai"
import { PLATFORM_IDS } from "@/lib/constants"
import { parseDate, startOfWeek, toISODate } from "@/lib/dates"
import { dataActions, useDb, useLookup, useSettings } from "@/lib/store"
import type { ContentIdea, ContentItem, ID, PlatformId } from "@/lib/types"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { formatNumber } from "@/lib/utils"
import { weekLabel } from "./calendar-model"
import { IdeaBankPicker } from "./idea-bank-picker"
import { createPlannedContent, savePlanReview } from "./planner-actions"
import { BriefsStep } from "./planner-briefs-step"
import { PlannerStepper, SummaryCard, weekDate, WeekSwitcher } from "./planner-chrome"
import {
  autoFillPlan,
  dueBefore,
  isPickValid,
  pickFromIdea,
  pickFromItem,
  picksFromAiPlan,
  planDocument,
  plannedPostCount,
  PLANNER_STEPS,
  withPlatforms,
  type FillInput,
  type PlanEntry,
  type PlanPick,
} from "./planner-model"
import { plannerMessages } from "./planner-messages"
import { DeadlinesStep, deadlinesReady, IdeasStep, PlatformsStep } from "./planner-pick-steps"
import { FOCUS_MAX, FocusStep, ReviewStep, WinnersStep, type Leaders } from "./planner-review-steps"
import { buildPlanStats } from "./planner-stats"
import { printPlan } from "./print-plan"
import { useReplaceParams } from "./use-calendar-nav"
import { useNow } from "./use-now"
import { emptyDraft, usePlannerDraft } from "./use-planner-draft"
import { planTotals, WeeklyPlanDocument } from "./weekly-plan-document"


const LEAD_DAYS = 2
const LAST_STEP = PLANNER_STEPS.length - 1

/** `?week=` (any day of that week) → its week start; past weeks and a missing value fall back to this / next week. */
function resolveWeek(param: string | null, thisKey: string, weekStartsOn: 0 | 1): string {
  const requested = param ? parseDate(param) : null
  if (!requested) return toISODate(addWeeks(weekDate(thisKey), 1))
  const key = toISODate(startOfWeek(requested, weekStartsOn))
  return key < thisKey ? thisKey : key
}

/**
 * Weekly Planner (spec §20): a seven-step guided plan for a week (default: next week, `?week=YYYY-MM-DD`),
 * a live Weekly Content Plan below it (printable) and a `weekly_reviews` row saved on step 7.
 */
export function PlannerView() {
  const now = useNow()
  const settings = useSettings()
  const searchParams = useSearchParams()
  const replaceParams = useReplaceParams()
  const thisKey = toISODate(startOfWeek(now, settings.week_starts_on))
  const weekKey = resolveWeek(searchParams.get("week"), thisKey, settings.week_starts_on)
  return (
    <PlannerWorkspace
      key={weekKey}
      weekKey={weekKey}
      thisKey={thisKey}
      liveNow={now}
      onWeekChange={(key) => replaceParams((params) => params.set("week", key))}
    />
  )
}

function PlannerWorkspace({ weekKey, thisKey, liveNow, onWeekChange }: { weekKey: string; thisKey: string; liveNow: Date; onWeekChange: (key: string) => void }) {
  const router = useRouter()
  const t = useT(plannerMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const pillars = useLookup("content_pillars")
  // Analytics use the time the week was opened; validation uses the live clock.
  const [now] = useState(() => new Date())
  const weekStart = useMemo(() => weekDate(weekKey), [weekKey])
  const prevKey = toISODate(addDays(weekStart, -7))
  const savedReview = db.weekly_reviews.find((r) => r.week_start === weekKey)
  const planSaved = savedReview?.stats && typeof savedReview.stats === "object" && "plan" in savedReview.stats ? savedReview.updated_at : null
  const previousFocus = db.weekly_reviews.find((r) => r.week_start === prevKey)?.focus.trim() ?? ""
  const [draft, setDraft] = usePlannerDraft(weekKey, () => emptyDraft(weekKey, savedReview?.focus ?? ""))
  const aiPlan = useAiTask("weekly_plan")
  const [bankOpen, setBankOpen] = useState(false)
  const target = Math.max(0, Math.round(settings.weekly_post_target))
  const metric = settings.winner_metric

  const ideasById = useMemo(() => new Map(db.content_ideas.map((i) => [i.id, i])), [db.content_ideas])
  const itemsById = useMemo(() => new Map(db.content_items.map((i) => [i.id, i])), [db.content_items])
  const slotsById = useMemo(() => new Map(db.content_calendar.map((s) => [s.id, s])), [db.content_calendar])
  const picks = useMemo(() => draft.picks.filter((p) => isPickValid(p, ideasById, itemsById)), [draft.picks, ideasById, itemsById])
  const platformChoices = useMemo<PlatformId[]>(() => {
    const active = new Set<PlatformId>([
      ...db.content_platforms.filter((s) => s.is_active).map((s) => s.platform),
      ...(db.brand_profiles[0]?.main_platforms ?? []),
    ])
    const list = PLATFORM_IDS.filter((p) => active.has(p))
    return list.length ? list : PLATFORM_IDS
  }, [db.content_platforms, db.brand_profiles])

  const report = useMemo(() => weeklyReport(db, weekDate(prevKey), settings, now, lang), [db, prevKey, settings, now, lang])
  const recent = useMemo<Leaders>(() => {
    const rows = scopedRows(db, now, { days: 30, settings, lang })
    return {
      topic: bestGroup(groupByTopic(db, rows), metric, lang),
      hook: bestGroup(groupByHookCategory(rows, lang), metric, lang),
      format: bestGroup(groupByFormat(db, rows, lang), metric, lang),
      platform: bestGroup(groupByPlatform(rows), metric, lang),
      pillar: bestGroup(groupByPillar(db, rows, lang), metric, lang),
    }
  }, [db, now, settings, metric, lang])
  const lastWeek: Leaders = { topic: report.bestTopic, hook: report.bestHook, format: report.bestFormat, platform: report.bestPlatform, pillar: report.bestPillar }
  const top = useMemo(() => topPerformers(db, settings, now, { days: 30, limit: 5 }), [db, settings, now])
  const insights = useMemo(() => strategicInsights(db, now, settings, lang), [db, now, settings, lang])
  const recs = useMemo(() => recommendNextContent(db, now, settings, { limit: 12, lang }), [db, now, settings, lang])
  const doc = useMemo(
    () => planDocument({ weekStart, items: db.content_items, slots: db.content_calendar, picks, now: liveNow }),
    [weekStart, db.content_items, db.content_calendar, picks, liveNow]
  )

  /* -------------------------------- Draft edits ------------------------------ */

  const step = draft.step
  const setStep = (next: number) => setDraft((d) => ({ ...d, step: Math.min(LAST_STEP, Math.max(0, next)) }))
  const updatePicks = (fn: (current: PlanPick[]) => PlanPick[]) => setDraft((d) => ({ ...d, picks: fn(d.picks) }))
  const fillInput: FillInput = { weekStart, slots: db.content_calendar, items: db.content_items, now: liveNow, leadDays: LEAD_DAYS }
  const stageOf = (id: ID) => itemsById.get(id)?.stage ?? null
  const autoFill = (replan: boolean) => updatePicks((current) => autoFillPlan(current, { ...fillInput, replan }, stageOf))
  const defaultPlatforms = (idea: ContentIdea, fallback: PlatformId) => {
    const own = idea.platforms.filter((p) => platformChoices.includes(p))
    return own.length ? own : [fallback]
  }

  function addRecommendation(rec: ContentRecommendation) {
    const item = rec.kind === "item" ? itemsById.get(rec.id) : undefined
    const idea = rec.kind === "idea" ? ideasById.get(rec.id) : undefined
    const pick = item
      ? pickFromItem(item, "recommended", rec.reasons.topic)
      : idea
        ? pickFromIdea(idea, defaultPlatforms(idea, rec.platform), "recommended", rec.reasons.topic)
        : null
    if (!pick) return
    updatePicks((current) => (current.some((p) => p.key === pick.key) ? current : [...current, pick]))
  }

  function addFromBank(list: ContentIdea[]) {
    const added = list.map((idea) => pickFromIdea(idea, defaultPlatforms(idea, platformChoices[0] ?? "facebook"), "bank", idea.why_it_matters.trim() || t("picked_from_bank")))
    updatePicks((current) => [...current, ...added.filter((p) => !current.some((c) => c.key === p.key))])
    toast.success(t.plural("bank_added", added.length, { count: formatNumber(added.length) }))
  }

  function setEntry(key: string, platform: PlatformId, patch: Partial<PlanEntry>) {
    updatePicks((current) =>
      current.map((pick) => {
        if (pick.key !== key) return pick
        return {
          ...pick,
          entries: pick.entries.map((entry) => {
            if (entry.platform !== platform) return entry
            const next = { ...entry, ...patch }
            const at = parseDate(next.publishAt)
            // Moving a post earlier than its deadline pulls the deadline along.
            if (patch.publishAt !== undefined && at && next.dueDate && next.dueDate > toISODate(at)) next.dueDate = dueBefore(at, liveNow, LEAD_DAYS)
            return next
          }),
        }
      })
    )
  }

  function goNext() {
    // Entering "Set deadlines" places every post that has no time yet.
    if (step === 4) autoFill(false)
    setStep(step + 1)
  }

  /* -------------------------------- AI draft --------------------------------- */

  async function draftWithAi() {
    const input = buildWeeklyPlanInput(dataActions.getDb(), now, { weekStart, focus: draft.focus.trim().slice(0, FOCUS_MAX) })
    const result = await aiPlan.run(input)
    if (!result) return
    const latest = dataActions.getDb()
    const mapped = picksFromAiPlan(result.output.plan, {
      slots: latest.content_calendar,
      ideas: latest.content_ideas,
      items: latest.content_items,
      formats: latest.content_formats,
      now: liveNow,
    })
    if (!mapped.length) {
      toast.info(t("nothing_to_add"))
      return
    }
    const filled = autoFillPlan(mapped, { ...fillInput, items: latest.content_items, slots: latest.content_calendar }, (id) => latest.content_items.find((i) => i.id === id)?.stage ?? null)
    const previous = draft.picks
    setDraft((d) => ({ ...d, picks: filled, step: 3, aiProvider: result.provider, aiModel: result.model }))
    const drafted = plannedPostCount(filled)
    toast.success(t.plural("ai_drafted", drafted, { count: formatNumber(drafted), week: weekLabel(weekStart) }), {
      description: t("ai_drafted_hint"),
      action: previous.length ? { label: t("undo"), onClick: () => setDraft((d) => ({ ...d, picks: previous, aiProvider: null, aiModel: null })) } : undefined,
    })
  }

  /* ----------------------------- Create & save ------------------------------- */

  function createAndSave() {
    const focus = draft.focus.trim()
    const before = doc
    const run = createPlannedContent(picks, focus)
    const createdIds = run.created.map((i) => i.id)
    const stats = buildPlanStats({ doc: before, weekKey, weekStart, target, created: createdIds.length, aiDrafted: Boolean(draft.aiProvider), pillars, report })
    savePlanReview(weekKey, focus, [...before.existingPostIds, ...createdIds, ...run.scheduledIds], stats)
    setDraft((d) => ({ ...d, picks: [], createdItemIds: [...d.createdItemIds, ...createdIds], step: LAST_STEP }))
    const parts = [
      createdIds.length ? t.plural("items_created", createdIds.length, { count: formatNumber(createdIds.length) }) : "",
      run.scheduledIds.length ? t("scheduled_count", { count: run.scheduledIds.length }) : "",
      t("plan_saved_part"),
    ].filter(Boolean)
    toast.success(parts.join(" · ").replace(/^./, (c) => c.toUpperCase()), {
      description: `${weekLabel(weekStart)}${focus ? ` — ${focus}` : ""}`,
      action: { label: t("open_calendar"), onClick: () => router.push(`/calendar?view=week&date=${weekKey}`) },
    })
  }

  /* -------------------------------- Validation ------------------------------- */

  const focusTooLong = draft.focus.trim().length > FOCUS_MAX
  const missingPlatforms = picks.some((p) => !p.entries.length)
  const timesReady = deadlinesReady(picks, weekStart, liveNow)
  const blockers = [
    focusTooLong ? t("blocker_focus", { max: FOCUS_MAX }) : "",
    missingPlatforms ? t("blocker_platforms") : "",
    picks.length && !missingPlatforms && !timesReady ? t("blocker_times") : "",
  ].filter(Boolean)
  const canNext = step === 2 ? !focusTooLong : step === 4 ? !missingPlatforms : step === 5 ? !picks.length || timesReady : true
  const done = [
    step > 0,
    step > 1,
    Boolean(draft.focus.trim()) && !focusTooLong,
    picks.length > 0 || draft.createdItemIds.length > 0,
    (picks.length > 0 && !missingPlatforms) || draft.createdItemIds.length > 0,
    (picks.length > 0 && timesReady) || draft.createdItemIds.length > 0,
    draft.createdItemIds.length > 0 || Boolean(planSaved),
  ]
  const createdItems = draft.createdItemIds.map((id) => itemsById.get(id)).filter((i): i is ContentItem => Boolean(i))
  const weekText = weekLabel(weekStart)

  const content =
    step === 0 ? (
      <ReviewStep report={report} previousFocus={previousFocus} now={now} />
    ) : step === 1 ? (
      <WinnersStep lastWeek={lastWeek} recent={recent} top={top} />
    ) : step === 2 ? (
      <FocusStep focus={draft.focus} onChange={(focus) => setDraft((d) => ({ ...d, focus }))} insights={insights} previousFocus={previousFocus} />
    ) : step === 3 ? (
      <IdeasStep
        picks={picks}
        recs={recs}
        ideas={ideasById}
        items={itemsById}
        pillars={pillars}
        target={target}
        alreadyScheduled={doc.posts - doc.drafts}
        aiBadge={draft.aiProvider ? <ProviderBadge provider={draft.aiProvider} model={draft.aiModel ?? undefined} /> : null}
        onAddRecommendation={addRecommendation}
        onOpenBank={() => setBankOpen(true)}
        onRemove={(key) => updatePicks((current) => current.filter((p) => p.key !== key))}
      />
    ) : step === 4 ? (
      <PlatformsStep
        picks={picks}
        pillars={pillars}
        platformChoices={platformChoices}
        onChange={(key, platforms) => updatePicks((current) => current.map((p) => (p.key === key ? withPlatforms(p, platforms) : p)))}
        onGoToIdeas={() => setStep(3)}
      />
    ) : step === 5 ? (
      <DeadlinesStep picks={picks} slots={slotsById} weekStart={weekStart} now={liveNow} onEntryChange={setEntry} onAutoFill={autoFill} onGoToIdeas={() => setStep(3)} />
    ) : (
      <BriefsStep
        picks={picks}
        createdItems={createdItems}
        blockers={blockers}
        weekText={weekText}
        saved={Boolean(planSaved)}
        calendarHref={`/calendar?view=week&date=${weekKey}`}
        onCreate={createAndSave}
      />
    )

  return (
    <PageContainer>
      <div className="flex min-w-0 flex-col gap-4 print:hidden">
        <PageHeader
          title="Weekly Planner"
          icon={ListChecks}
          description={t("description")}
          actions={
            <>
              <WeekSwitcher weekKey={weekKey} thisKey={thisKey} onChange={onWeekChange} />
              <AiButton type="button" size="sm" pending={aiPlan.isPending} onClick={() => void draftWithAi()}>
                {t("draft_with_ai")}
              </AiButton>
            </>
          }
        />
        <PlannerStepper step={step} done={done} onStep={setStep} />
        {aiPlan.error ? (
          <div role="alert" className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm">
            <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
            <span className="min-w-0 flex-1 text-pretty">{t("draft_failed", { message: aiPlan.error.message })}</span>
            <Button type="button" size="xs" variant="outline" onClick={() => void draftWithAi()}>
              {t("retry")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem] print:hidden">
        <SectionCard
          title={t("step_of", { step: step + 1, total: PLANNER_STEPS.length, title: t(`step_${PLANNER_STEPS[step].id}_title`) })}
          description={t(`hint_${PLANNER_STEPS[step].id}`)}
          footer={
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <Button type="button" size="sm" variant="outline" className="text-foreground" disabled={step === 0} onClick={() => setStep(step - 1)}>
                <ChevronLeft aria-hidden />
                {c("back")}
              </Button>
              {step < LAST_STEP ? (
                <Button type="button" size="sm" disabled={!canNext} onClick={goNext}>
                  {t("next_step", { step: t(`step_${PLANNER_STEPS[step + 1].id}_short`) })}
                  <ChevronRight aria-hidden />
                </Button>
              ) : (
                <span className="num">{t("posts_planned_of", { planned: planTotals(doc).planned, target })}</span>
              )}
            </div>
          }
        >
          {content}
        </SectionCard>
        <SummaryCard weekText={weekText} focus={draft.focus} doc={doc} target={target} planSaved={planSaved} />
      </div>

      <WeeklyPlanDocument weekStart={weekStart} doc={doc} focus={draft.focus} target={target} pillars={pillars} savedAt={planSaved} onPrint={printPlan} />

      <IdeaBankPicker
        open={bankOpen}
        onOpenChange={setBankOpen}
        excludeIds={new Set(picks.flatMap((p) => (p.source.kind === "idea" ? [p.source.ideaId] : [])))}
        onAdd={addFromBank}
      />
    </PageContainer>
  )
}
