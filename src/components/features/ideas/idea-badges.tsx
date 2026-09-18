"use client"

import { IDEA_STATUS_ICONS, PlatformIcon, StatusPill } from "@/components/common"
import { IDEA_STATUS_MAP, PLATFORMS } from "@/lib/constants"
import { daysBetween, formatDate, formatRelativeDay } from "@/lib/dates"
import { priorityFromScore } from "@/lib/scoring"
import { useT, useUiLang, type Translator, type UiLang } from "@/lib/i18n"
import type { IdeaStatus, ISODateTime, PlatformId, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ideaBankMessages } from "./messages"

/** Short status labels for dense rows (the full label stays in the tooltip). */
export const SHORT_STATUS_LABEL: Record<IdeaStatus, string> = {
  inbox: "Inbox",
  researching: "Researching",
  validated: "Validated",
  selected: "Selected",
  converted: "Converted",
  archived: "Archived",
}

export const SCORE_BAND_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" }

export function IdeaStatusChip({ status, className }: { status: IdeaStatus; className?: string }) {
  const meta = IDEA_STATUS_MAP[status]
  return (
    <StatusPill
      tone={status === "converted" ? "good" : "neutral"}
      icon={IDEA_STATUS_ICONS[status]}
      title={meta ? `${meta.label} — ${meta.description}` : undefined}
      className={cn(status === "archived" && "text-muted-foreground", className)}
    >
      {SHORT_STATUS_LABEL[status] ?? status}
    </StatusPill>
  )
}

/** Idea Score 0–100 as a number with a hairline bar; "—" when the idea hasn't been scored. */
export function IdeaScoreBadge({ score, className }: { score: number | null; className?: string }) {
  const t = useT(ideaBankMessages)
  if (score === null) {
    return (
      <span title={t("not_scored_title")} className={cn("text-xs text-muted-foreground", className)}>
        —<span className="sr-only">{t("not_scored")}</span>
      </span>
    )
  }
  const band = priorityFromScore(score)
  return (
    <span
      title={t("score_title", { score, band: SCORE_BAND_LABEL[band] })}
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
    >
      <span aria-hidden className="relative h-1 w-5 overflow-hidden rounded-full bg-muted dark:bg-input/60">
        <span className="absolute inset-y-0 left-0 rounded-full bg-foreground/55" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      <span className="font-medium text-foreground num">{score}</span>
      <span className="sr-only">{t("score_out_of")}</span>
    </span>
  )
}

/** Platform glyphs with a "+N" overflow. */
export function PlatformIcons({ platforms, max = 3, className }: { platforms: PlatformId[]; max?: number; className?: string }) {
  if (!platforms.length) return <span className="text-xs text-muted-foreground">—</span>
  const shown = platforms.slice(0, max)
  const hidden = platforms.slice(max)
  const label = platforms.map((p) => PLATFORMS[p]?.label ?? p).join(", ")
  return (
    <span title={label} className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}>
      {shown.map((p) => (
        <PlatformIcon key={p} platform={p} className="size-3.5" />
      ))}
      {hidden.length ? <span className="text-xs num">+{hidden.length}</span> : null}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** `formatRelativeDay` in the UI language ("Kahapon", "3 araw na nakaraan"); dates past two weeks stay "Aug 20". */
function relativeDay(value: ISODateTime, now: Date, t: Translator<(typeof ideaBankMessages)["en"]>, lang: UiLang): string {
  const diff = lang === "en" ? null : daysBetween(now, value)
  if (diff === null) return formatRelativeDay(value, now)
  if (diff === 0) return t("day_today")
  if (diff === 1) return t("day_tomorrow")
  if (diff === -1) return t("day_yesterday")
  if (diff > 1 && diff <= 14) return t("day_in_days", { count: diff })
  if (diff < -1 && diff >= -14) return t("day_days_ago", { count: -diff })
  return formatRelativeDay(value, now)
}

/** "Today", "3 days ago", "Aug 20" with the full date on hover. */
export function CapturedDate({ value, now, className }: { value: ISODateTime; now: Date; className?: string }) {
  const t = useT(ideaBankMessages)
  const lang = useUiLang()
  return (
    <span title={t("captured_on", { date: formatDate(value, "MMM d, yyyy · h:mm a") })} className={cn("text-xs whitespace-nowrap text-muted-foreground", className)}>
      {relativeDay(value, now, t, lang)}
    </span>
  )
}
