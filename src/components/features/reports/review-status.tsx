"use client"

import { CalendarRange, CircleCheck, CircleDashed, PenLine, type LucideIcon } from "lucide-react"
import { StatusPill } from "@/components/common"
import { useT } from "@/lib/i18n"
import { reportMessages } from "./messages"
import type { ReviewState } from "./review-model"

const COPY: Record<ReviewState, { icon: LucideIcon; tone: "good" | "neutral" }> = {
  final: { icon: CircleCheck, tone: "good" },
  draft: { icon: PenLine, tone: "neutral" },
  plan: { icon: CalendarRange, tone: "neutral" },
  unsaved: { icon: CircleDashed, tone: "neutral" },
}

export function ReviewStatusBadge({ state, className }: { state: ReviewState; className?: string }) {
  const t = useT(reportMessages)
  const copy = COPY[state]
  return (
    <StatusPill tone={copy.tone} icon={copy.icon} title={t(`status_${state}_title`)} className={className}>
      {t(`status_${state}`)}
    </StatusPill>
  )
}
