"use client"

import { format } from "date-fns"
import { Circle, CircleCheck, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { SectionCard, StatTile } from "@/components/common"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { parseDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { Translator } from "@/lib/i18n/core"
import { updateSettings } from "@/lib/store"
import { cn, formatNumber } from "@/lib/utils"
import { StepActionButton } from "./first-steps-card"
import { FIRST_WEEK_DAYS, type FirstWeek, type Mission } from "./first-week"
import { firstWeekMessages } from "./messages"

type T = Translator<typeof firstWeekMessages.en>

/** Hide for good (stored on `app_settings`, so it follows the account); the toast offers Undo. */
function HideButton() {
  const t = useT(firstWeekMessages)
  const hide = () => {
    updateSettings({ first_week_dismissed: true })
    toast.success(t("hidden"), {
      description: t("hidden_description"),
      action: { label: t("undo"), onClick: () => updateSettings({ first_week_dismissed: false }) },
    })
  }
  return (
    <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" aria-label={t("hide_aria")} onClick={hide}>
      <EyeOff aria-hidden />
      <span className="hidden @md:inline">{t("hide")}</span>
    </Button>
  )
}

/** Day 1's idea count as three dots, or day 4's two parts, each with its own tick. */
function MissionProgress({ mission, t }: { mission: Mission; t: T }) {
  if (mission.parts.length) {
    return (
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {mission.parts.map((part) => (
          <li key={part.key} className="flex min-w-0 items-center gap-1.5">
            {part.done ? (
              <CircleCheck className="size-3.5 shrink-0 text-good-fg" aria-hidden />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="text-pretty">{part.label}</span>
            <span className="sr-only">({part.done ? t("part_done_sr") : t("part_open_sr")})</span>
          </li>
        ))}
      </ul>
    )
  }
  if (!mission.progress || mission.done) return null
  const { current, target } = mission.progress
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: target }, (_, i) => (
          <span key={i} className={cn("size-2 rounded-full", i < current ? "bg-brand" : "bg-border")} />
        ))}
      </span>
      <span className="num">{t("progress_ideas", { current, target })}</span>
    </div>
  )
}

/** The mission to do now: today's, a gentle catch-up, or a head start. */
function FocusMission({ plan, t }: { plan: FirstWeek; t: T }) {
  const mission = plan.focus
  if (!mission) return null
  const eyebrow =
    plan.focusReason === "today"
      ? `${t("day_of", { day: plan.day, total: FIRST_WEEK_DAYS })} · ${t("focus_today")}`
      : plan.focusReason === "catch_up"
        ? `${t("day_short", { day: mission.day ?? plan.day })} · ${t("focus_catch_up")}`
        : t("focus_ahead")
  const until = parseDate(plan.lastDayKey)
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-brand/40 bg-brand-soft p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-brand">{eyebrow}</p>
        <h4 className="mt-1 text-sm font-semibold text-pretty">
          {plan.focusReason === "ahead" ? (
            <span className="font-normal text-muted-foreground">{t("day_short", { day: mission.day ?? plan.day })} · </span>
          ) : null}
          {mission.label}
        </h4>
        <p className="mt-1 text-xs text-pretty text-muted-foreground">{mission.detail}</p>
      </div>
      <MissionProgress mission={mission} t={t} />
      <StepActionButton action={mission.action} className="self-start">
        {mission.cta}
      </StepActionButton>
      {plan.day > FIRST_WEEK_DAYS && until ? (
        <p className="text-xs text-muted-foreground">{t("open_until", { date: format(until, "MMM d") })}</p>
      ) : null}
    </div>
  )
}

function MissionRow({ mission, t }: { mission: Mission; t: T }) {
  const dayLabel = mission.day === null ? t("badge_bonus") : t("day_short", { day: mission.day })
  const showProgress = !mission.done && (mission.parts.length > 0 || (mission.progress?.current ?? 0) > 0)
  return (
    <li className="flex min-w-0 items-start gap-2.5 py-2 first:pt-0 last:pb-0">
      {mission.done ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-good-fg" aria-hidden />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="mt-px w-12 shrink-0 text-xs leading-5 text-muted-foreground" aria-hidden>
        {dayLabel}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-sm text-pretty", mission.done && "text-muted-foreground")}>
          <span className="sr-only">{mission.day === null ? `${dayLabel}: ` : t("mission_sr", { day: mission.day })}</span>
          {mission.label}
          {mission.done ? <span className="sr-only">{t("done_sr")}</span> : null}
          {mission.timing === "catch_up" ? (
            <Badge variant="outline" className="ml-2 align-[1px] font-normal text-muted-foreground">
              {t("badge_catch_up")}
            </Badge>
          ) : null}
        </p>
        {showProgress ? <MissionProgress mission={mission} t={t} /> : null}
      </div>
      {mission.done ? null : (
        <StepActionButton action={mission.action} variant="outline" className="-my-0.5 shrink-0" aria-label={t("start_aria", { mission: mission.label })}>
          {t("start")}
        </StepActionButton>
      )}
    </li>
  )
}

function FinishCard({ plan, className }: { plan: FirstWeek; className?: string }) {
  const t = useT(firstWeekMessages)
  const stats = [
    { key: "ideas", label: t("stat_ideas"), value: plan.totals.ideas },
    { key: "content", label: t("stat_content"), value: plan.totals.content },
    { key: "posts", label: t("stat_posts"), value: plan.totals.posts },
    { key: "views", label: t("stat_views"), value: plan.totals.views },
  ]
  return (
    <SectionCard title={t("finish_title")} description={t("finish_description")} action={<HideButton />} className={className}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-4">
          {stats.map((stat) => (
            <StatTile key={stat.key} label={stat.label} value={<span className="num">{formatNumber(stat.value)}</span>} className="p-3" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StepActionButton action={plan.next.action}>{plan.next.cta}</StepActionButton>
          {plan.bonus.done ? null : (
            <StepActionButton action={plan.bonus.action} variant="outline">
              {`${t("badge_bonus")}: ${plan.bonus.label}`}
            </StepActionButton>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

/**
 * Home's "Your first week" card: today's mission first, then the rest with ✓ or ○ and the optional bonus.
 * Replaces the first-steps checklist while the plan is visible; the finish card takes over once all seven are done.
 */
export function FirstWeekCard({ plan, className }: { plan: FirstWeek; className?: string }) {
  const t = useT(firstWeekMessages)
  if (plan.state === "finished") return <FinishCard plan={plan} className={className} />
  const rest = plan.missions.filter((mission) => mission !== plan.focus)
  return (
    <SectionCard
      title={t("title")}
      description={t("description")}
      action={
        <>
          <span className="text-xs whitespace-nowrap text-muted-foreground num">
            {t("done_count", { done: plan.doneCount, total: FIRST_WEEK_DAYS })}
          </span>
          <HideButton />
        </>
      }
      className={className}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @3xl:items-start">
        <FocusMission plan={plan} t={t} />
        <ol className="flex min-w-0 flex-col divide-y">
          {rest.map((mission) => (
            <MissionRow key={mission.key} mission={mission} t={t} />
          ))}
          <MissionRow mission={plan.bonus} t={t} />
        </ol>
      </div>
    </SectionCard>
  )
}
