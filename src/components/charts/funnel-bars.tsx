import { ordinalColor, seriesColor, type ChartColor } from "@/components/charts/colors"
import { EmptyChart } from "@/components/charts/empty-chart"
import { defaultValueFormatter, formatShare } from "@/components/charts/utils"
import { cn, sum } from "@/lib/utils"

export interface FunnelStageDatum {
  id: string
  label: string
  value: number
  /** Override the ordinal ramp only when the stage has a real identity color. */
  color?: ChartColor
  /** Secondary line under the label, e.g. "Awareness". */
  sublabel?: string
}

export interface FunnelBarsProps {
  /** In order (first stage first). */
  stages: FunnelStageDatum[]
  valueFormatter?: (value: number) => string
  /** Share of the total next to each value (default on). */
  showShare?: boolean
  emptyMessage?: string
  className?: string
  "aria-label"?: string
}

/** Ordinal horizontal steps (TOFU → MOFU → BOFU, pipeline groups) on a one-hue ramp. */
export function FunnelBars({
  stages,
  valueFormatter = defaultValueFormatter,
  showShare = true,
  emptyMessage = "No stages to show yet.",
  className,
  "aria-label": ariaLabel,
}: FunnelBarsProps) {
  if (!stages.length) return <EmptyChart message={emptyMessage} height={120} className={className} />

  const max = Math.max(0, ...stages.map((s) => s.value))
  const total = sum(stages.map((s) => Math.max(0, s.value)))

  return (
    <ol aria-label={ariaLabel} className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      {stages.map((stage, i) => {
        const pct = max > 0 ? (Math.max(0, stage.value) / max) * 100 : 0
        const fill = stage.color ? seriesColor(stage.color) : ordinalColor(i, stages.length)
        return (
          <li
            key={stage.id}
            className={cn(
              "grid items-center gap-3",
              showShare
                ? "grid-cols-[minmax(4.5rem,8rem)_minmax(0,1fr)_5.5rem]"
                : "grid-cols-[minmax(4.5rem,8rem)_minmax(0,1fr)_4rem]"
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-sm leading-5">{stage.label}</div>
              {stage.sublabel ? <div className="truncate text-xs text-muted-foreground">{stage.sublabel}</div> : null}
            </div>
            <div aria-hidden className="h-5">
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${pct}%`, minWidth: stage.value > 0 ? 2 : 0, background: fill }}
              />
            </div>
            <div className="flex items-baseline justify-end gap-2 text-right">
              <span className="num text-sm font-medium">{valueFormatter(stage.value)}</span>
              {showShare ? (
                <span className="num w-8 text-xs text-muted-foreground">{formatShare(stage.value, total)}</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
