import { Check } from "lucide-react"
import { CATEGORICAL_COLOR_LABELS, CATEGORICAL_COLORS } from "@/lib/constants"
import type { CategoricalColor, TagColor } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Identity colour → CSS variable. Gray / missing fall back to muted ink. */
export function catVar(color: CategoricalColor | TagColor | null | undefined): string {
  if (!color || color === "gray") return "var(--muted-foreground)"
  return `var(--cat-${color})`
}

/** Soft wash of an identity colour over a surface (tiles, thumbnails). */
export function catWash(
  color: CategoricalColor | TagColor | null | undefined,
  percent = 12,
  surface = "var(--card)"
): string {
  if (!color || color === "gray") return `color-mix(in oklch, var(--muted-foreground) ${Math.round(percent / 2)}%, ${surface})`
  return `color-mix(in oklch, ${catVar(color)} ${percent}%, ${surface})`
}

/** Small identity swatch placed next to text (text itself never wears the colour). */
export function ColorDot({
  color,
  className,
  shape = "circle",
}: {
  color: CategoricalColor | TagColor | null | undefined
  className?: string
  shape?: "circle" | "square"
}) {
  return (
    <span
      aria-hidden
      data-slot="color-dot"
      className={cn("inline-block size-2 shrink-0", shape === "circle" ? "rounded-full" : "rounded-[3px]", className)}
      style={{ backgroundColor: catVar(color) }}
    />
  )
}

/** Radio group of the 8 categorical colours. Arrow keys move and select. */
export function ColorSwatchPicker({
  value,
  onChange,
  colors = CATEGORICAL_COLORS,
  disabled,
  className,
  "aria-label": ariaLabel = "Color",
}: {
  value: CategoricalColor | null
  onChange: (color: CategoricalColor) => void
  colors?: CategoricalColor[]
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const focusIndex = Math.max(0, value ? colors.indexOf(value) : 0)

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const step = keys[event.key]
    if (step === undefined && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const current = value ? colors.indexOf(value) : -1
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? colors.length - 1
          : (current + (step ?? 0) + colors.length) % colors.length
    onChange(colors[next])
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {colors.map((color, index) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={CATEGORICAL_COLOR_LABELS[color]}
            title={CATEGORICAL_COLOR_LABELS[color]}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50",
              selected && "ring-2 ring-foreground/70 focus-visible:ring-foreground/70"
            )}
            style={{ backgroundColor: catVar(color) }}
          >
            {selected ? <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}
