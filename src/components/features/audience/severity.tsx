"use client"

import { ChipToggleGroup, type ChipOption } from "@/components/common"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { clampSeverity, SEVERITY_LEVELS, severityLabel } from "./audience-model"
import { problemMessages } from "./problem-messages"

const BAR_HEIGHTS = ["h-1.5", "h-2", "h-2.5", "h-3", "h-3.5"]

/** Five ascending bars in neutral ink (severity 1–5); the label carries the meaning. */
export function SeverityMeter({
  value,
  showLabel = false,
  className,
}: {
  value: number
  showLabel?: boolean
  className?: string
}) {
  const t = useT(problemMessages)
  const level = clampSeverity(value)
  const label = severityLabel(level)
  return (
    <span title={t("severity_title", { level, label })} className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className={cn("w-[3px] rounded-full", height, index < level ? "bg-foreground/70" : "bg-foreground/15")}
          />
        ))}
      </span>
      {showLabel ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : (
        <span className="sr-only">{t("severity_sr", { level, label })}</span>
      )}
    </span>
  )
}

type SeverityValue = "1" | "2" | "3" | "4" | "5"

const OPTIONS: ChipOption<SeverityValue>[] = SEVERITY_LEVELS.map((level) => ({
  value: String(level.value) as SeverityValue,
  label: String(level.value),
}))

/** 1–5 chips with the selected level's name; always saves an integer. */
export function SeverityPicker({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (value: number) => void
  className?: string
}) {
  const t = useT(problemMessages)
  const level = clampSeverity(value)
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ChipToggleGroup
        required
        size="sm"
        aria-label={t("severity")}
        options={OPTIONS}
        value={String(level) as SeverityValue}
        onChange={(next) => {
          if (next) onChange(clampSeverity(Number(next)))
        }}
      />
      <span className="text-xs text-muted-foreground">{severityLabel(level)}</span>
    </div>
  )
}
