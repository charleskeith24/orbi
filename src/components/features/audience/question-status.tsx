import { CircleCheck, CircleDashed, CircleMinus, Lightbulb, type LucideIcon } from "lucide-react"
import { StatusPill, type StatusTone } from "@/components/common"
import { QUESTION_STATUS_MAP } from "@/lib/constants"
import type { QuestionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const META: Record<QuestionStatus, { tone: StatusTone; icon: LucideIcon }> = {
  new: { tone: "neutral", icon: CircleDashed },
  idea_created: { tone: "neutral", icon: Lightbulb },
  answered: { tone: "good", icon: CircleCheck },
  dismissed: { tone: "neutral", icon: CircleMinus },
}

/** Sort order for the status column: open work first. */
export const QUESTION_STATUS_ORDER: Record<QuestionStatus, number> = { new: 0, idea_created: 1, answered: 2, dismissed: 3 }

export function questionStatusLabel(status: QuestionStatus): string {
  return QUESTION_STATUS_MAP[status]?.label ?? status
}

/** New · Idea created · Answered in content · Dismissed — icon + label. */
export function QuestionStatusBadge({ status, className }: { status: QuestionStatus; className?: string }) {
  const meta = META[status] ?? META.new
  return (
    <StatusPill tone={meta.tone} icon={meta.icon} className={cn(status === "dismissed" && "text-muted-foreground", className)}>
      {questionStatusLabel(status)}
    </StatusPill>
  )
}
