"use client"

import { Circle, CircleCheck, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import type { Translator } from "@/lib/i18n/core"
import { updateSettings } from "@/lib/store"
import { cn, formatNumber } from "@/lib/utils"
import { StepActionButton } from "./first-steps-card"
import type { FirstWeek, Mission } from "./first-week"
import { firstWeekMessages } from "./messages"

type T = Translator<typeof firstWeekMessages.en>

/**
 * "Your first week" pieces for Home's focus hero (`FocusHero`): hide for good, a mission's progress, the full
 * mission list (behind "All missions") and the finish numbers.
 */

/** Hide for good (stored on `app_settings`, so it follows the account); the toast offers Undo. */
export function HideButton() {
  const t = useT(firstWeekMessages)
  const hide = () => {
    updateSettings({ first_week_dismissed: true })
    toast.success(t("hidden"), {
      description: t("hidden_description"),
      action: { label: t("undo"), onClick: () => updateSettings({ first_week_dismissed: false }) },
    })
  }
  return (
    <Button type="button" size="xs" variant="ghost" className="text-muted-foreground" aria-label={t("hide_aria")} onClick={hide}>
      <EyeOff aria-hidden />
      <span className="hidden @md:inline">{t("hide")}</span>
    </Button>
  )
}

/** Day 1's idea count as three dots, or day 4's two parts, each with its own tick. */
export function MissionProgress({ mission, t }: { mission: Mission; t: T }) {
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

/** The other six missions and the optional bonus, each ticked from the workspace. */
export function MissionList({ plan }: { plan: FirstWeek }) {
  const t = useT(firstWeekMessages)
  const rest = plan.missions.filter((mission) => mission !== plan.focus)
  return (
    <ol className="flex min-w-0 flex-col divide-y">
      {rest.map((mission) => (
        <MissionRow key={mission.key} mission={mission} t={t} />
      ))}
      <MissionRow mission={plan.bonus} t={t} />
    </ol>
  )
}

/** The finish card's real counts: ideas, content, posts and first views. */
export function FinishStats({ plan }: { plan: FirstWeek }) {
  const t = useT(firstWeekMessages)
  const stats = [
    { key: "ideas", label: t("stat_ideas"), value: plan.totals.ideas },
    { key: "content", label: t("stat_content"), value: plan.totals.content },
    { key: "posts", label: t("stat_posts"), value: plan.totals.posts },
    { key: "views", label: t("stat_views"), value: plan.totals.views },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 @xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.key} className="flex min-w-0 flex-col">
          <dt className="truncate text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="text-xl leading-7 font-semibold tracking-tight num">{formatNumber(stat.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
