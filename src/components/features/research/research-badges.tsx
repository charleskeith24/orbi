"use client"

import {
  Archive,
  Bookmark,
  CheckCheck,
  FileText,
  Hash,
  ImageIcon,
  Newspaper,
  Quote,
  ScanSearch,
  Swords,
  TrendingUp,
  Video,
  type LucideIcon,
} from "lucide-react"
import { StatusPill, type SelectOption } from "@/components/common"
import { RESEARCH_STATUSES, RESEARCH_TYPES } from "@/lib/constants"
import type { ResearchStatus, ResearchType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { researchStatusLabel, researchTypeLabel } from "./research-model"

export const RESEARCH_TYPE_ICONS: Record<ResearchType, LucideIcon> = {
  competitor: Swords,
  post: Newspaper,
  trend: TrendingUp,
  quote: Quote,
  video: Video,
  topic: Hash,
  article: FileText,
  screenshot: ImageIcon,
}

export const RESEARCH_STATUS_ICONS: Record<ResearchStatus, LucideIcon> = {
  saved: Bookmark,
  analyzed: ScanSearch,
  adapted: CheckCheck,
  archived: Archive,
}

export const RESEARCH_TYPE_OPTIONS: SelectOption<ResearchType>[] = RESEARCH_TYPES.map((type) => {
  const Icon = RESEARCH_TYPE_ICONS[type.id]
  return { value: type.id, label: type.label, icon: <Icon className="text-muted-foreground" aria-hidden /> }
})

export const RESEARCH_STATUS_OPTIONS: SelectOption<ResearchStatus>[] = RESEARCH_STATUSES.map((status) => {
  const Icon = RESEARCH_STATUS_ICONS[status.id]
  return { value: status.id, label: status.label, icon: <Icon className="text-muted-foreground" aria-hidden /> }
})

/** Neutral reference-type label with its glyph. */
export function ResearchTypeBadge({ type, className }: { type: ResearchType; className?: string }) {
  const Icon = RESEARCH_TYPE_ICONS[type] ?? Newspaper
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit max-w-full shrink-0 items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium whitespace-nowrap text-foreground/85 dark:bg-input/30",
        className
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{researchTypeLabel(type)}</span>
    </span>
  )
}

/** Saved → Analyzed → Adapted (good) · Archived (muted). Icon + label, never colour alone. */
export function ResearchStatusBadge({ status, className }: { status: ResearchStatus; className?: string }) {
  return (
    <StatusPill
      tone={status === "adapted" ? "good" : "neutral"}
      icon={RESEARCH_STATUS_ICONS[status]}
      className={cn(status === "archived" && "text-muted-foreground", className)}
    >
      {researchStatusLabel(status)}
    </StatusPill>
  )
}
