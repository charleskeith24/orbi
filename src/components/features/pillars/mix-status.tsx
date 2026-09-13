import { ArrowDown, ArrowUp } from "lucide-react"
import { StatusPill } from "@/components/common"
import { MIN_MIX_SAMPLE, type MixStatus } from "@/lib/analytics"

/** Mix status as icon + label: "6 pts under", "On target", or "Not enough data" below the sample size. */
export function MixStatusPill({
  status,
  deviation,
  enoughData,
  className,
}: {
  status: MixStatus | null | undefined
  deviation: number
  enoughData: boolean
  className?: string
}) {
  if (!enoughData || !status) {
    return (
      <StatusPill tone="neutral" className={className} title={`Mix warnings start once ${MIN_MIX_SAMPLE} or more items are in the window`}>
        Not enough data
      </StatusPill>
    )
  }
  if (status === "on_target") {
    return (
      <StatusPill tone="good" className={className}>
        On target
      </StatusPill>
    )
  }
  const pts = Math.max(1, Math.abs(Math.round(deviation)))
  return (
    <StatusPill
      tone="warning"
      icon={status === "under" ? ArrowDown : ArrowUp}
      className={className}
      title={status === "under" ? "Under-represented vs its target" : "Over-represented vs its target"}
    >
      {pts} pts {status}
    </StatusPill>
  )
}
