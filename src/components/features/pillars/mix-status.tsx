import { ArrowDown, ArrowUp } from "lucide-react"
import { StatusPill } from "@/components/common"
import { MIN_MIX_SAMPLE, type MixStatus } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { pillarMessages } from "./pillar-messages"

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
  const t = useT(pillarMessages)
  if (!enoughData || !status) {
    return (
      <StatusPill tone="neutral" className={className} title={t("mix_warnings_start", { count: MIN_MIX_SAMPLE })}>
        {t("not_enough_data")}
      </StatusPill>
    )
  }
  if (status === "on_target") {
    return (
      <StatusPill tone="good" className={className}>
        {t("on_target")}
      </StatusPill>
    )
  }
  const pts = Math.max(1, Math.abs(Math.round(deviation)))
  return (
    <StatusPill
      tone="warning"
      icon={status === "under" ? ArrowDown : ArrowUp}
      className={className}
      title={status === "under" ? t("under_title") : t("over_title")}
    >
      {t(status === "under" ? "pts_under" : "pts_over", { pts })}
    </StatusPill>
  )
}
