import { SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { InfoHint, TIER_ICONS } from "@/components/common"
import { useT, useUiLang } from "@/lib/i18n"
import type { AppSettings } from "@/lib/types"
import { winnersMessages } from "./messages"
import { detectionBasis, minComparisonPosts, thresholdSteps } from "./winners-model"

/** The tier thresholds as chips; the rule itself waits in the ⓘ (Calm UI), always from the current settings. */
export function DetectionRule({ settings }: { settings: AppSettings }) {
  const t = useT(winnersMessages)
  const lang = useUiLang()
  const min = minComparisonPosts(settings)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      <ul className="flex flex-wrap items-center gap-1.5" aria-label={t("thresholds_aria")}>
        {thresholdSteps(settings).map((step) => {
          const Icon = TIER_ICONS[step.tier]
          return (
            <li key={step.tier} className="inline-flex h-5 items-center gap-1 rounded-md border px-1.5 font-medium whitespace-nowrap num">
              <Icon className="size-3 text-muted-foreground" aria-hidden />
              {step.label}
            </li>
          )
        })}
      </ul>
      <InfoHint title={t("rule_title")}>
        <p>{detectionBasis(settings, lang)}.</p>
        <p>
          {t.plural("tiers_start", min)} {t("pinned_stay")}
        </p>
        <p>
          <Link href="/settings?tab=performance" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {t("edit_thresholds")}
          </Link>
        </p>
      </InfoHint>
    </div>
  )
}
