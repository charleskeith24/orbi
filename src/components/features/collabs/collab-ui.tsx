"use client"

import {
  ArrowLeftRight,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleX,
  Gift,
  Handshake,
  Lightbulb,
  Mic,
  Radio,
  Send,
  Shapes,
  Split,
  Star,
  RotateCcw,
  ThumbsUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { useMemo } from "react"
import type { SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { AiError } from "@/lib/ai"
import { COLLAB_STATUS_IDS, COLLAB_TYPE_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { collabStatusMessages, collabTypeMessages } from "@/lib/i18n/messages/collabs"
import type { Collab, CollabStatus, CollabType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { collabsMessages } from "./messages"

export const COLLAB_STATUS_ICONS: Record<CollabStatus, LucideIcon> = {
  idea: Lightbulb,
  reached_out: Send,
  agreed: ThumbsUp,
  scheduled: CalendarClock,
  published: CircleCheck,
  reviewed: Star,
  declined: CircleX,
}

export const COLLAB_TYPE_ICONS: Record<CollabType, LucideIcon> = {
  duet_stitch: Split,
  guesting: Mic,
  joint_live: Radio,
  shoutout_swap: ArrowLeftRight,
  giveaway: Gift,
  co_created: UsersRound,
  group_brand_deal: Handshake,
  other: Shapes,
}

const PILL =
  "inline-flex h-5 w-fit max-w-full shrink-0 items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium whitespace-nowrap text-foreground/85 dark:bg-input/30 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"

export function CollabStatusIcon({ status, className }: { status: CollabStatus; className?: string }) {
  const Icon = COLLAB_STATUS_ICONS[status]
  return <Icon className={cn("size-3.5 shrink-0 text-muted-foreground", className)} aria-hidden />
}

export function CollabStatusBadge({ status, className }: { status: CollabStatus; className?: string }) {
  const label = useT(collabStatusMessages)
  const Icon = COLLAB_STATUS_ICONS[status]
  return (
    <span className={cn(PILL, className)}>
      <Icon aria-hidden />
      <span className="truncate">{label(status)}</span>
    </span>
  )
}

export function CollabTypeBadge({ type, className }: { type: CollabType; className?: string }) {
  const label = useT(collabTypeMessages)
  const Icon = COLLAB_TYPE_ICONS[type]
  return (
    <span className={cn(PILL, "font-normal text-muted-foreground", className)}>
      <Icon aria-hidden />
      <span className="truncate">{label(type)}</span>
    </span>
  )
}

export function useCollabStatusOptions(): SelectOption<CollabStatus>[] {
  const label = useT(collabStatusMessages)
  return useMemo(() => COLLAB_STATUS_IDS.map((s) => ({ value: s, label: label(s), icon: <CollabStatusIcon status={s} /> })), [label])
}

export function useCollabTypeOptions(): SelectOption<CollabType>[] {
  const label = useT(collabTypeMessages)
  return useMemo(
    () =>
      COLLAB_TYPE_IDS.map((type) => {
        const Icon = COLLAB_TYPE_ICONS[type]
        return { value: type, label: label(type), icon: <Icon className="text-muted-foreground" aria-hidden /> }
      }),
    [label]
  )
}

/** Title, else "Collab with @handle", else "Untitled collab". */
export function useCollabName() {
  const t = useT(collabsMessages)
  return useMemo(
    () => (collab: Pick<Collab, "title" | "partner_handle" | "partner_name">) => {
      const partner = collab.partner_handle.trim() || collab.partner_name.trim()
      return collab.title.trim() || (partner ? t("collab_with", { partner }) : t("untitled"))
    },
    [t]
  )
}

/** Read-only stars (cards, table). */
export function RatingStars({ rating, className }: { rating: number | null; className?: string }) {
  const t = useT(collabsMessages)
  if (rating === null) return null
  return (
    <span className={cn("inline-flex items-center gap-px", className)} role="img" aria-label={t("rating_aria", { rating })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3", n <= rating ? "fill-current text-foreground/70" : "text-muted-foreground/40")} aria-hidden />
      ))}
    </span>
  )
}

/** 1–5 rating as a radio group; clicking the current rating clears it. */
export function RatingInput({ value, onChange, className }: { value: number | null; onChange: (rating: number | null) => void; className?: string }) {
  const t = useT(collabsMessages)
  return (
    <div role="radiogroup" aria-label={t("rating_label")} className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value !== null && n <= value
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t("rating_option", { rating: n })}
            onClick={() => onChange(value === n ? null : n)}
            className="rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Star className={cn("size-5", active && "fill-current text-foreground/80")} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/** Inline AI failure with a retry — never a dead end. */
export function AiErrorNotice({ error, onRetry, pending = false, className }: { error: AiError | null; onRetry: () => void; pending?: boolean; className?: string }) {
  const t = useT(collabsMessages)
  if (!error) return null
  return (
    <div
      role="alert"
      className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-sm dark:bg-critical/10", className)}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
      <p className="min-w-0 flex-1 text-pretty">
        <span className="font-medium text-critical-fg">{t("generation_failed")}</span> <span className="text-muted-foreground">{error.message}</span>
      </p>
      <Button type="button" variant="outline" size="xs" onClick={onRetry} disabled={pending}>
        <RotateCcw aria-hidden />
        {t("retry")}
      </Button>
    </div>
  )
}
