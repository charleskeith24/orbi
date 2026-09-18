"use client"

import { useState } from "react"
import { onColorTextClass, seriesColor, type ChartColor } from "@/components/charts/colors"
import { EmptyChart } from "@/components/charts/empty-chart"
import { chartMessages } from "@/components/charts/messages"
import {
  anchorFor,
  ChartTooltipCard,
  FloatingTooltip,
  SeriesKey,
  useElementWidth,
  type TooltipAnchor,
  type TooltipRow,
} from "@/components/charts/primitives"
import { defaultValueFormatter, estimateTextWidth, formatShare } from "@/components/charts/utils"
import { useT, type Translator } from "@/lib/i18n"
import { cn, sum } from "@/lib/utils"

export interface MixSegment {
  id: string
  label: string
  value: number
  color: ChartColor
}

/** Target share of the whole for one segment, 0–100 (e.g. a pillar's `target_percentage`). */
export interface MixTarget {
  id: string
  value: number
}

export interface MixBarProps {
  segments: MixSegment[]
  /**
   * Drawn as a slim target lane under the bar (same colors, same order) so widths compare per segment.
   * Shares of 100 — an unallocated remainder shows as a muted track.
   */
  targets?: MixTarget[]
  /** Bar height in px; share labels sit inside segments only when they fit (from 18px). */
  height?: number
  showLegend?: boolean
  valueFormatter?: (value: number) => string
  /** Measure name in the tooltip, e.g. "Posts". */
  valueLabel?: string
  emptyMessage?: string
  className?: string
  "aria-label"?: string
}

const GAP = 2

function formatPoints(delta: number, t: Translator<(typeof chartMessages)["en"]>): string {
  const rounded = Math.round(delta)
  if (rounded === 0) return t("on_target")
  return t("points", { sign: rounded > 0 ? "+" : "−", count: Math.abs(rounded) })
}

/** 100% stacked bar (part-to-whole) with 2px surface gaps, optional targets and a value legend. */
export function MixBar({
  segments,
  targets,
  height = 24,
  showLegend = true,
  valueFormatter = defaultValueFormatter,
  valueLabel: valueLabelProp,
  emptyMessage,
  className,
  "aria-label": ariaLabel,
}: MixBarProps) {
  const t = useT(chartMessages)
  const valueLabel = valueLabelProp ?? t("value")
  const { measure: measureTrack, width: trackWidth } = useElementWidth<HTMLDivElement>()
  const { measure: measureWrap, width: wrapWidth, node: wrapNode } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<{ id: string; anchor: TooltipAnchor } | null>(null)

  const total = sum(segments.map((s) => Math.max(0, s.value)))
  if (!(total > 0)) return <EmptyChart message={emptyMessage ?? t("nothing_to_show")} height={96} className={className} />

  const targetById = new Map((targets ?? []).map((target) => [target.id, target.value]))
  const hasTargets = targetById.size > 0
  const filled = segments.filter((s) => s.value > 0)
  const targetFilled = segments.filter((s) => (targetById.get(s.id) ?? 0) > 0)
  // Targets are shares of 100: a remainder stays visible as a muted track instead of stretching the rest.
  const unallocated = Math.max(0, 100 - sum(targetFilled.map((s) => targetById.get(s.id) ?? 0)))
  const usable = Math.max(0, trackWidth - GAP * (filled.length - 1))
  const activeSegment = active ? segments.find((s) => s.id === active.id) : undefined

  const show = (id: string, el: Element) => {
    const anchor = anchorFor(el, wrapNode)
    if (anchor) setActive({ id, anchor })
  }
  const hide = () => setActive(null)

  const tooltipRows = (segment: MixSegment): TooltipRow[] => {
    const rows: TooltipRow[] = [
      { key: "share", label: t("of_total"), value: formatShare(segment.value, total), color: segment.color },
      { key: "value", label: valueLabel, value: valueFormatter(segment.value) },
    ]
    const target = targetById.get(segment.id)
    if (target !== undefined) {
      rows.push({ key: "target", label: t("target"), value: `${Math.round(target)}%` })
      rows.push({ key: "delta", label: t("vs_target"), value: formatPoints((segment.value / total) * 100 - target, t) })
    }
    return rows
  }

  return (
    <div ref={measureWrap} className={cn("relative flex min-w-0 flex-col gap-3", className)}>
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "grid items-center gap-x-3 gap-y-1.5",
          hasTargets ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1"
        )}
      >
        {hasTargets ? <span className="text-[11px] leading-none text-muted-foreground">{t("lane_actual")}</span> : null}
        <div ref={measureTrack} className="flex min-w-0" style={{ height, gap: GAP }}>
          {filled.map((segment, i) => {
            const share = formatShare(segment.value, total)
            const fits = height >= 18 && estimateTextWidth(share) + 12 <= (segment.value / total) * usable
            const target = targetById.get(segment.id)
            return (
              <div
                key={segment.id}
                role="img"
                tabIndex={0}
                aria-label={`${segment.label}: ${share} (${valueFormatter(segment.value)})${
                  target !== undefined ? t("segment_target", { pct: Math.round(target) }) : ""
                }`}
                onPointerEnter={(event) => show(segment.id, event.currentTarget)}
                onPointerLeave={hide}
                onFocus={(event) => show(segment.id, event.currentTarget)}
                onBlur={hide}
                className={cn(
                  "flex min-w-[2px] items-center justify-center outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  i === 0 && "rounded-l-[4px]",
                  i === filled.length - 1 && "rounded-r-[4px]",
                  onColorTextClass(segment.color)
                )}
                style={{ flex: `${segment.value} 1 0px`, background: seriesColor(segment.color) }}
              >
                {fits ? <span className="num text-[11px] leading-none font-medium">{share}</span> : null}
              </div>
            )
          })}
        </div>
        {hasTargets ? (
          <>
            <span className="text-[11px] leading-none text-muted-foreground">{t("lane_target")}</span>
            <div aria-hidden className="flex h-1.5 min-w-0" style={{ gap: GAP }}>
              {targetFilled.map((segment, i) => (
                <div
                  key={segment.id}
                  className={cn(
                    "min-w-[2px]",
                    i === 0 && "rounded-l-[3px]",
                    i === targetFilled.length - 1 && unallocated === 0 && "rounded-r-[3px]"
                  )}
                  style={{ flex: `${targetById.get(segment.id) ?? 0} 1 0px`, background: seriesColor(segment.color) }}
                />
              ))}
              {unallocated > 0 ? (
                <div
                  className={cn("rounded-r-[3px] bg-muted", targetFilled.length === 0 && "rounded-l-[3px]")}
                  style={{ flex: `${unallocated} 1 0px` }}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {showLegend ? (
        <ul role="list" className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {segments.map((segment) => {
            const target = targetById.get(segment.id)
            return (
              <li key={segment.id} className="flex min-w-0 items-center gap-1.5">
                <SeriesKey color={segment.color} />
                <span className="truncate text-muted-foreground">{segment.label}</span>
                <span className="num font-medium text-foreground">{formatShare(segment.value, total)}</span>
                <span className="num text-muted-foreground">({valueFormatter(segment.value)})</span>
                {target !== undefined ? (
                  <span className="num text-muted-foreground">{t("legend_target", { pct: Math.round(target) })}</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <FloatingTooltip anchor={active?.anchor ?? null} containerWidth={wrapWidth}>
        {activeSegment ? <ChartTooltipCard title={activeSegment.label} rows={tooltipRows(activeSegment)} /> : null}
      </FloatingTooltip>
    </div>
  )
}
