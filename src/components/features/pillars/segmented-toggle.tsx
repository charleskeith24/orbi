"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { pillarMessages } from "./pillar-messages"

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/** Small single-choice switch for toolbars (window, metric, scope). Never deselects. */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  className?: string
  "aria-label": string
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next)
        if (option) onChange(option.value)
      }}
      aria-label={ariaLabel}
      className={cn("shrink-0", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="px-2.5 text-xs">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export type MixWindow = "30" | "90"

export const windowDays = (window: MixWindow): number => (window === "90" ? 90 : 30)

/** 30 / 90 day window for mix and performance numbers. */
export function WindowToggle({
  value,
  onChange,
  className,
}: {
  value: MixWindow
  onChange: (value: MixWindow) => void
  className?: string
}) {
  const t = useT(pillarMessages)
  const options: SegmentOption<MixWindow>[] = [
    { value: "30", label: t("days_30") },
    { value: "90", label: t("days_90") },
  ]
  return <SegmentedToggle value={value} options={options} onChange={onChange} aria-label={t("time_window")} className={className} />
}
