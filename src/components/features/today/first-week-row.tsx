"use client"

import { ArrowRight, Sprout } from "lucide-react"
import { StepActionButton } from "@/components/features/dashboard/first-steps-card"
import { FIRST_WEEK_DAYS, type FirstWeek } from "@/components/features/dashboard/first-week"
import { firstWeekMessages } from "@/components/features/dashboard/messages"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * "Your first week" on Today: one compact row with the mission to do now — today's, a catch-up, or a head
 * start when today's is done. Gone once the plan is finished, hidden or retired (Home keeps the finish card).
 */
export function FirstWeekRow({ plan, className }: { plan: FirstWeek; className?: string }) {
  const t = useT(firstWeekMessages)
  const mission = plan.focus
  if (plan.state !== "active" || !mission) return null
  const day = mission.day ?? plan.day
  const lead =
    plan.focusReason === "today"
      ? t("row_today", { day: plan.day, total: FIRST_WEEK_DAYS })
      : plan.focusReason === "catch_up"
        ? t("row_catch_up", { day })
        : t("row_ahead", { day })
  return (
    <section
      aria-label={t("row_label")}
      className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2.5 @3xl:px-4", className)}
    >
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2.5 text-sm">
        <Sprout className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 text-pretty">
          <span className="text-muted-foreground">
            <span className="hidden @xl:inline">{t("row_label")} · </span>
            {lead} ·{" "}
          </span>
          <span className="font-medium">{mission.label}</span>
        </span>
      </p>
      <StepActionButton action={mission.action} variant={plan.focusReason === "ahead" ? "outline" : "default"} className="ml-auto">
        {mission.cta}
        <ArrowRight aria-hidden />
      </StepActionButton>
    </section>
  )
}
