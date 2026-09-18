"use client"

import { NumberField } from "@/components/common"
import { METRIC_FIELDS, RATE_FIELDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { MetricKey, RateKey } from "@/lib/types"
import { cn, formatPercent } from "@/lib/utils"
import { captureMessages } from "./capture-messages"
import { draftRates, isCountKey, METRIC_GROUPS, type MetricDraft } from "./capture-utils"

/** Constants carry the unit in the label ("Watch time (sec)"); here the unit is the field suffix. */
const LABELS: Record<MetricKey, string> = {
  ...(Object.fromEntries(METRIC_FIELDS.map((field) => [field.key, field.label])) as Record<MetricKey, string>),
  watch_time_seconds: "Watch time",
  avg_retention: "Avg. retention",
}

const SUFFIX: Partial<Record<MetricKey, string>> = { watch_time_seconds: "sec", avg_retention: "%" }

const RATE_SHORT: Record<RateKey, string> = {
  engagement_rate: "Engagement",
  share_rate: "Share rate",
  save_rate: "Save rate",
  lead_conversion_rate: "Lead conv.",
  follower_conversion_rate: "Follower conv.",
}

/**
 * Snapshot inputs grouped Reach · Engagement · Conversion (· Video for video formats).
 * Two columns on phones; counters open the numeric keyboard and save as whole numbers.
 */
export function MetricFields({
  values,
  onChange,
  showVideo,
  idPrefix,
}: {
  values: MetricDraft
  onChange: (key: MetricKey, value: number | null) => void
  showVideo: boolean
  idPrefix: string
}) {
  const groups = METRIC_GROUPS.filter((group) => showVideo || group.id !== "video")
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <fieldset key={group.id} className="min-w-0">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {group.keys.map((key) => {
              const fieldId = `${idPrefix}-${key}`
              return (
                <div key={key} className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor={fieldId} className="truncate text-xs text-foreground/85">
                    {LABELS[key]}
                  </label>
                  <NumberField
                    id={fieldId}
                    integer={isCountKey(key)}
                    min={0}
                    max={key === "avg_retention" ? 100 : undefined}
                    value={values[key]}
                    placeholder="0"
                    suffix={SUFFIX[key]}
                    onChange={(value) => onChange(key, value)}
                  />
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

/** Engagement, share, save, lead and follower conversion — recomputed on every keystroke. */
export function RatesPreview({ values, className }: { values: MetricDraft; className?: string }) {
  const t = useT(captureMessages)
  const rates = draftRates(values)
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-3 py-2.5 dark:bg-muted/15", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{t("rates")}</span>
        <span className="text-[11px] text-muted-foreground">{t("rates_live")}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 min-[480px]:grid-cols-3 sm:grid-cols-5">
        {RATE_FIELDS.map((rate) => (
          <div key={rate.key} className="min-w-0" title={`${rate.label} = ${rate.formula}`}>
            <dt className="truncate text-[11px] text-muted-foreground">{RATE_SHORT[rate.key]}</dt>
            <dd className="text-sm font-medium num">{formatPercent(rates[rate.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
