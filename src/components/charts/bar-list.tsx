"use client"

import Link from "next/link"
import { useState } from "react"
import { seriesColor, type ChartColor } from "@/components/charts/colors"
import { EmptyChart } from "@/components/charts/empty-chart"
import { defaultValueFormatter } from "@/components/charts/utils"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface BarListItem {
  id: string
  label: string
  value: number
  /** Identity color (pillar, campaign…). Omit for a plain ranking — one series, one color. */
  color?: ChartColor
  secondary?: string
  href?: string
}

export interface BarListProps {
  items: BarListItem[]
  valueFormatter?: (value: number) => string
  /** Scale maximum (default: the largest value). Pass a shared max to compare lists. */
  max?: number
  /** Color for items without an identity color. */
  color?: ChartColor
  /** Rankings sort largest first; pass "none" to keep the given order. */
  sort?: "desc" | "none"
  /** Show the first N rows with a "Show all" toggle. */
  limit?: number
  emptyMessage?: string
  className?: string
  "aria-label"?: string
}

/** Horizontal ranking in HTML/CSS: label, 8px bar anchored at the baseline, tabular value. */
export function BarList({
  items,
  valueFormatter = defaultValueFormatter,
  max,
  color = "blue",
  sort = "desc",
  limit,
  emptyMessage = "Nothing to rank yet.",
  className,
  "aria-label": ariaLabel,
}: BarListProps) {
  const [expanded, setExpanded] = useState(false)
  if (!items.length) return <EmptyChart message={emptyMessage} height={120} className={className} />

  const ordered = sort === "desc" ? [...items].sort((a, b) => b.value - a.value) : items
  const scaleMax = max ?? Math.max(0, ...ordered.map((item) => item.value))
  const visible = limit && !expanded ? ordered.slice(0, limit) : ordered

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <ul role="list" aria-label={ariaLabel} className="flex flex-col">
        {visible.map((item) => {
          const pct = scaleMax > 0 ? (Math.max(0, item.value) / scaleMax) * 100 : 0
          return (
            <li
              key={item.id}
              className="relative -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md px-2 py-1.5 has-[a:focus-visible]:bg-muted/60 has-[a:hover]:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem]"
            >
              <div className="min-w-0">
                {item.href ? (
                  <Link
                    href={item.href}
                    title={item.label}
                    className="block truncate text-sm outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span title={item.label} className="block truncate text-sm">
                    {item.label}
                  </span>
                )}
                {item.secondary ? <span className="block truncate text-xs text-muted-foreground">{item.secondary}</span> : null}
              </div>
              <div aria-hidden className="col-span-2 row-start-2 h-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{
                    width: `${pct}%`,
                    minWidth: item.value > 0 ? 2 : 0,
                    background: seriesColor(item.color ?? color),
                  }}
                />
              </div>
              <span className="num col-start-2 row-start-1 text-right text-sm font-medium sm:col-start-3">
                {valueFormatter(item.value)}
              </span>
            </li>
          )
        })}
      </ul>
      {limit && ordered.length > limit ? (
        <Button
          variant="ghost"
          size="xs"
          className="self-start text-muted-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : `Show all ${ordered.length}`}
        </Button>
      ) : null}
    </div>
  )
}
