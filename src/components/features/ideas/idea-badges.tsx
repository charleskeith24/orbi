"use client"

import { IDEA_STATUS_ICONS, PlatformIcon, StatusPill } from "@/components/common"
import { IDEA_STATUS_MAP, PLATFORMS } from "@/lib/constants"
import { formatDate, formatRelativeDay } from "@/lib/dates"
import { priorityFromScore } from "@/lib/scoring"
import type { IdeaStatus, ISODateTime, PlatformId, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"

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
  if (score === null) {
    return (
      <span title="Not scored yet" className={cn("text-xs text-muted-foreground", className)}>
        —<span className="sr-only">Not scored</span>
      </span>
    )
  }
  const band = priorityFromScore(score)
  return (
    <span
      title={`Idea Score ${score} / 100 · ${SCORE_BAND_LABEL[band]}`}
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
    >
      <span aria-hidden className="relative h-1 w-5 overflow-hidden rounded-full bg-muted dark:bg-input/60">
        <span className="absolute inset-y-0 left-0 rounded-full bg-foreground/55" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      <span className="font-medium text-foreground num">{score}</span>
      <span className="sr-only">Idea Score out of 100</span>
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

/** "Today", "3 days ago", "Aug 20" with the full date on hover. */
export function CapturedDate({ value, now, className }: { value: ISODateTime; now: Date; className?: string }) {
  return (
    <span title={`Captured ${formatDate(value, "MMM d, yyyy · h:mm a")}`} className={cn("text-xs whitespace-nowrap text-muted-foreground", className)}>
      {formatRelativeDay(value, now)}
    </span>
  )
}
