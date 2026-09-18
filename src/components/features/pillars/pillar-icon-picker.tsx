"use client"

import { catWash } from "@/components/common"
import type { CategoricalColor } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PILLAR_ICON_OPTIONS } from "./pillar-icons"

/** Radio grid of the curated pillar icons (their names stay English). Arrow keys move and select; the choice wears the pillar colour. */
export function PillarIconPicker({
  value,
  onChange,
  color,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (name: string) => void
  color: CategoricalColor
  className?: string
  "aria-label": string
}) {
  const selectedIndex = PILLAR_ICON_OPTIONS.findIndex((o) => o.name === value)
  const focusIndex = Math.max(0, selectedIndex)

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const step = steps[event.key]
    if (step === undefined && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const count = PILLAR_ICON_OPTIONS.length
    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : (focusIndex + (step ?? 0) + count) % count
    onChange(PILLAR_ICON_OPTIONS[next].name)
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1", className)}
    >
      {PILLAR_ICON_OPTIONS.map((option, index) => {
        const Icon = option.icon
        const selected = index === selectedIndex
        return (
          <button
            key={option.name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => onChange(option.name)}
            className={cn(
              "flex h-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "border-foreground/30 text-foreground hover:text-foreground"
            )}
            style={selected ? { backgroundColor: catWash(color, 18) } : undefined}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
