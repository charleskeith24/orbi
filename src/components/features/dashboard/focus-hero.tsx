"use client"

import { format } from "date-fns"
import { ChevronRight, Lightbulb, Target } from "lucide-react"
import { Disclosure } from "@/components/common"
import { whatToPostMessages } from "@/components/features/recommendations/messages"
import { CreateButton, HookQuote, ReasonLine, ScoreToken, SuggestionMeta, WhyList } from "@/components/features/recommendations/suggestion-parts"
import { useWhatToPost } from "@/components/features/recommendations/use-what-to-post"
import { Button } from "@/components/ui/button"
import { parseDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { DashboardData } from "./dashboard-data"
import type { FirstStep } from "./first-run"
import { StepActionButton, StepList } from "./first-steps-card"
import { FIRST_WEEK_DAYS, isFirstWeekVisible, type FirstWeek } from "./first-week"
import { FinishStats, HideButton, MissionList, MissionProgress } from "./first-week-card"
import { dashboardMessages, firstWeekMessages } from "./messages"

/**
 * Home's "Your focus today": one next action. In a workspace's first two weeks, the first-week mission; before
 * anything is published, the next first step; otherwise the Content Decision Engine's best content to make next
 * ("Why?" opens its reasons). The full mission and step lists wait behind a disclosure.
 */
export function FocusHero({ data, className }: { data: DashboardData; className?: string }) {
  if (isFirstWeekVisible(data.firstWeek)) {
    return data.firstWeek.state === "finished" ? (
      <FinishFocus plan={data.firstWeek} className={className} />
    ) : (
      <MissionFocus plan={data.firstWeek} className={className} />
    )
  }
  if (!data.hasPublished) return <StepFocus steps={data.steps} className={className} />
  return <SuggestionFocus className={className} />
}

/** The hero's frame: "Your focus today" (+ context) and an optional control on the right, then the action. */
function FocusFrame({
  context,
  aside,
  children,
  className,
}: {
  context?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const t = useT(dashboardMessages)
  return (
    <section
      aria-labelledby="home-focus"
      data-slot="focus-hero"
      className={cn("flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground @xl:p-5", className)}
    >
      <div className="flex min-h-6 min-w-0 items-center justify-between gap-3">
        <h2 id="home-focus" className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <Target className="size-3.5 shrink-0 text-brand" aria-hidden />
          <span className="shrink-0 text-brand">{t("focus_title")}</span>
          {context ? <span className="truncate font-normal text-muted-foreground">· {context}</span> : null}
        </h2>
        {aside ? <div className="-my-1 flex shrink-0 items-center gap-1">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

const TITLE = "text-lg leading-snug font-semibold tracking-tight text-pretty"

function SuggestionFocus({ className }: { className?: string }) {
  const t = useT(dashboardMessages)
  const w = useT(whatToPostMessages)
  const state = useWhatToPost()
  const s = state.current
  const total = state.list.length

  if (!s) {
    return (
      <FocusFrame className={className}>
        <p className={TITLE}>{w("nothing_to_rank")}</p>
        <p className="text-sm text-pretty text-muted-foreground">{t("focus_empty")}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
            <Lightbulb aria-hidden />
            {w("capture_idea")}
          </Button>
        </div>
      </FocusFrame>
    )
  }

  return (
    <FocusFrame
      className={className}
      context={s.kind === "item" ? t("focus_in_pipeline") : null}
      aside={
        total > 1 ? (
          <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={state.next} aria-label={w("next_suggestion")}>
            <span className="num">{`${state.position + 1}/${total}`}</span>
            <ChevronRight aria-hidden />
          </Button>
        ) : null
      }
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className={TITLE}>{s.title}</h3>
        <SuggestionMeta s={s} />
      </div>
      {s.hook ? <HookQuote text={s.hook} className="max-w-prose" /> : null}
      {/* The one-line reason; on phones it waits under "Why this?" with the others. */}
      <div className="@max-xl:hidden">
        <ReasonLine text={s.reasons.topic} />
      </div>
      <div className="mt-auto flex min-w-0 flex-col gap-3 pt-1">
        <Disclosure label={t("why")} contentClassName="flex flex-col items-start gap-2">
          <ScoreToken s={s} />
          <WhyList s={s} />
        </Disclosure>
        <div className="flex flex-wrap items-center gap-2">
          <CreateButton s={s} onCreate={() => state.create(s)} />
        </div>
      </div>
    </FocusFrame>
  )
}

function MissionFocus({ plan, className }: { plan: FirstWeek; className?: string }) {
  const t = useT(firstWeekMessages)
  const mission = plan.focus
  if (!mission) return null
  const context =
    plan.focusReason === "today"
      ? t("day_of", { day: plan.day, total: FIRST_WEEK_DAYS })
      : plan.focusReason === "catch_up"
        ? `${t("day_short", { day: mission.day ?? plan.day })} · ${t("badge_catch_up")}`
        : `${t("day_short", { day: mission.day ?? plan.day })} · ${t("focus_ahead_short")}`
  const until = parseDate(plan.lastDayKey)
  return (
    <FocusFrame
      className={className}
      context={context}
      aside={
        <>
          <span className="text-xs whitespace-nowrap text-muted-foreground num">{t("done_count", { done: plan.doneCount, total: FIRST_WEEK_DAYS })}</span>
          <HideButton />
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className={TITLE}>{mission.label}</h3>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">{mission.detail}</p>
      </div>
      <MissionProgress mission={mission} t={t} />
      <div className="mt-auto flex min-w-0 flex-col gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StepActionButton action={mission.action}>{mission.cta}</StepActionButton>
          {plan.day > FIRST_WEEK_DAYS && until ? (
            <span className="text-xs text-muted-foreground">{t("open_until", { date: format(until, "MMM d") })}</span>
          ) : null}
        </div>
        <Disclosure label={t("all_missions")} meta={`${plan.doneCount}/${FIRST_WEEK_DAYS}`}>
          <MissionList plan={plan} />
        </Disclosure>
      </div>
    </FocusFrame>
  )
}

function FinishFocus({ plan, className }: { plan: FirstWeek; className?: string }) {
  const t = useT(firstWeekMessages)
  return (
    <FocusFrame className={className} aside={<HideButton />}>
      <h3 className={TITLE}>{t("finish_title")}</h3>
      <FinishStats plan={plan} />
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <StepActionButton action={plan.next.action}>{plan.next.cta}</StepActionButton>
        {plan.bonus.done ? null : (
          <StepActionButton action={plan.bonus.action} variant="outline">
            {`${t("badge_bonus")}: ${plan.bonus.label}`}
          </StepActionButton>
        )}
      </div>
    </FocusFrame>
  )
}

function StepFocus({ steps, className }: { steps: FirstStep[]; className?: string }) {
  const t = useT(dashboardMessages)
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  return (
    <FocusFrame className={className} context={t("steps_done", { done, total: steps.length })}>
      {next ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className={TITLE}>{next.label}</h3>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">{next.detail}</p>
        </div>
      ) : null}
      <div className="mt-auto flex min-w-0 flex-col gap-3 pt-1">
        {next ? (
          <div className="flex flex-wrap gap-2">
            <StepActionButton action={next.action}>{next.cta}</StepActionButton>
          </div>
        ) : null}
        <Disclosure label={t("all_steps")} meta={`${done}/${steps.length}`}>
          <StepList steps={steps} />
        </Disclosure>
      </div>
    </FocusFrame>
  )
}
