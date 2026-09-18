import { Info, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { TIER_ICONS } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, useUiLang } from "@/lib/i18n"
import type { AppSettings } from "@/lib/types"
import { winnersMessages } from "./messages"
import { detectionBasis, minComparisonPosts, thresholdSteps } from "./winners-model"

/** The winner-detection rule in plain language, always from the current settings. */
export function DetectionRule({ settings }: { settings: AppSettings }) {
  const t = useT(winnersMessages)
  const lang = useUiLang()
  const min = minComparisonPosts(settings)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2 text-xs">
      <p className="flex min-w-0 flex-1 basis-80 items-start gap-2 text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <span className="text-pretty">
          <span className="text-foreground">{detectionBasis(settings, lang)}</span> · {t.plural("tiers_start", min)} · {t("pinned_stay")}
        </span>
      </p>
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
      <Button asChild variant="ghost" size="xs" className="-mr-1 text-muted-foreground">
        <Link href="/settings?tab=performance">
          <SlidersHorizontal aria-hidden />
          {t("edit_thresholds")}
        </Link>
      </Button>
    </div>
  )
}
