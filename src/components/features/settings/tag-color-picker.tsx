"use client"

import { Check } from "lucide-react"
import { catVar } from "@/components/common"
import { CATEGORICAL_COLOR_LABELS, CATEGORICAL_COLORS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { TagColor } from "@/lib/types"
import { cn } from "@/lib/utils"
import { tagsMessages } from "./tags-messages"

const TAG_COLORS: TagColor[] = ["gray", ...CATEGORICAL_COLORS]
const LABELS: Record<TagColor, string> = { gray: "Gray", ...CATEGORICAL_COLOR_LABELS }

/** Radio group of tag colours: gray plus the 8 categorical slots. Arrow keys move and select. */
export function TagColorPicker({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: TagColor
  onChange: (color: TagColor) => void
  /** Defaults to "Tag colour". */
  "aria-label"?: string
}) {
  const t = useT(tagsMessages)
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const step = steps[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = (TAG_COLORS.indexOf(value) + step + TAG_COLORS.length) % TAG_COLORS.length
    onChange(TAG_COLORS[next])
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel ?? t("colour_aria")} onKeyDown={onKeyDown} className="flex flex-wrap items-center gap-2">
      {TAG_COLORS.map((color) => {
        const selected = color === value
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LABELS[color]}
            title={LABELS[color]}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
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
