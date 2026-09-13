"use client"

import { Fragment, useEffect, useState, type ReactNode } from "react"
import { resolveColor, type ColorInput } from "@/components/charts/colors"
import { cn } from "@/lib/utils"

export type SeriesMark = "line" | "rect" | "dot"

/** Identity key beside text — a short stroke for lines, a swatch for bars/areas, a dot for points. */
export function SeriesKey({ color, mark = "rect", className }: { color: ColorInput; mark?: SeriesMark; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0",
        mark === "line" && "h-0.5 w-3 rounded-full",
        mark === "rect" && "size-2.5 rounded-[3px]",
        mark === "dot" && "size-2 rounded-full",
        className
      )}
      style={{ background: resolveColor(color) }}
    />
  )
}

export interface TooltipRow {
  key: string
  label: string
  value: string
  color?: ColorInput
  mark?: SeriesMark
}

/** Tooltip body shared by every chart: values lead (strong, tabular), series names follow. */
export function ChartTooltipCard({
  title,
  rows,
  footer,
  className,
}: {
  title?: ReactNode
  rows: TooltipRow[]
  footer?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-32 max-w-72 rounded-md border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md",
        className
      )}
    >
      {title ? <div className="mb-1.5 truncate font-medium text-muted-foreground">{title}</div> : null}
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
        {rows.map((row) => (
          <Fragment key={row.key}>
            {row.color ? <SeriesKey color={row.color} mark={row.mark ?? "line"} /> : <span aria-hidden />}
            <span className="num text-right font-semibold text-foreground">{row.value}</span>
            <span className="truncate text-muted-foreground">{row.label}</span>
          </Fragment>
        ))}
      </div>
      {footer ? <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">{footer}</div> : null}
    </div>
  )
}

export interface LegendEntry {
  key: string
  label: string
  color: ColorInput
  value?: string
  detail?: string
}

/** HTML legend row — always shown for 2+ series so identity never rides on color alone. */
export function SeriesLegend({
  items,
  mark = "rect",
  className,
}: {
  items: LegendEntry[]
  mark?: SeriesMark
  className?: string
}) {
  return (
    <ul role="list" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-1.5">
          <SeriesKey color={item.color} mark={mark} />
          <span className="truncate">{item.label}</span>
          {item.value ? <span className="num font-medium text-foreground">{item.value}</span> : null}
          {item.detail ? <span className="num">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** `measure` is a callback ref; `width` tracks the element's content width (re-observes when the node changes). */
export function useElementWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0))
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return { measure: setNode, width, node }
}

export interface TooltipAnchor {
  x: number
  y: number
}

/** Top-center of `target`, relative to `container`. */
export function anchorFor(target: Element, container: Element | null): TooltipAnchor | null {
  if (!container) return null
  const t = target.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  return { x: t.left + t.width / 2 - c.left, y: t.top - c.top }
}

/** Tooltip for the HTML charts; render inside a `relative` container. Content is mirrored in aria-labels. */
export function FloatingTooltip({
  anchor,
  containerWidth,
  children,
}: {
  anchor: TooltipAnchor | null
  containerWidth: number
  children: ReactNode
}) {
  if (!anchor || !children) return null
  // Keeps a typical tooltip (~180px) inside the chart; w-max stops the card shrinking near the right edge.
  const edge = 90
  const left = containerWidth > edge * 2 ? Math.min(Math.max(anchor.x, edge), containerWidth - edge) : anchor.x
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 w-max -translate-x-1/2 -translate-y-full pb-2"
      style={{ left, top: anchor.y }}
    >
      {children}
    </div>
  )
}
