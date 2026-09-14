import { CalendarRange, CircleCheck, CircleDashed, PenLine, type LucideIcon } from "lucide-react"
import { StatusPill } from "@/components/common"
import type { ReviewState } from "./review-model"

const COPY: Record<ReviewState, { label: string; icon: LucideIcon; tone: "good" | "neutral"; title: string }> = {
  final: { label: "Final", icon: CircleCheck, tone: "good", title: "Saved as final" },
  draft: { label: "Draft", icon: PenLine, tone: "neutral", title: "Saved as a draft" },
  plan: { label: "Plan only", icon: CalendarRange, tone: "neutral", title: "Planned in the Weekly Planner — no review written yet" },
  unsaved: { label: "Not saved", icon: CircleDashed, tone: "neutral", title: "No saved review for this period yet" },
}

export function ReviewStatusBadge({ state, className }: { state: ReviewState; className?: string }) {
  const copy = COPY[state]
  return (
    <StatusPill tone={copy.tone} icon={copy.icon} title={copy.title} className={className}>
      {copy.label}
    </StatusPill>
  )
}
