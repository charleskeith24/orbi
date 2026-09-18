import { Ban, CalendarClock, CircleCheck, CircleHelp, FlaskConical, Trophy, type LucideIcon } from "lucide-react"
import { StatusPill } from "@/components/common"
import { EXPERIMENT_STATUS_MAP } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { ExperimentStatus, ExperimentWinner } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { Variant } from "./experiment-model"
import { experimentsMessages } from "./messages"

export const STATUS_ICONS: Record<ExperimentStatus, LucideIcon> = {
  planned: CalendarClock,
  running: FlaskConical,
  completed: CircleCheck,
  cancelled: Ban,
}

export function ExperimentStatusPill({ status, className }: { status: ExperimentStatus; className?: string }) {
  return (
    <StatusPill tone={status === "completed" ? "good" : "neutral"} icon={STATUS_ICONS[status]} className={className}>
      {EXPERIMENT_STATUS_MAP[status]?.label ?? status}
    </StatusPill>
  )
}

/** Declared (or suggested) outcome: a winning variant, or an honest "Inconclusive". */
export function WinnerPill({ winner, className }: { winner: ExperimentWinner; className?: string }) {
  const t = useT(experimentsMessages)
  if (winner === "inconclusive") {
    return (
      <StatusPill tone="warning" icon={CircleHelp} className={className}>
        {t("inconclusive")}
      </StatusPill>
    )
  }
  return (
    <StatusPill tone="good" icon={Trophy} className={className}>
      {t("variant_won", { letter: winner.toUpperCase() })}
    </StatusPill>
  )
}

/** Square "A" / "B" marker used wherever variants are listed. */
export function VariantMark({ variant, className }: { variant: Variant; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border bg-card text-xs font-semibold text-muted-foreground dark:bg-input/30",
        className
      )}
    >
      {variant.toUpperCase()}
    </span>
  )
}
