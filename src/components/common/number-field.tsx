"use client"

import { useState } from "react"
import type { ControlSize } from "@/components/common/types"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { clamp, cn } from "@/lib/utils"

const displayFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 })

/**
 * "12,300" → 12300, "12.3k" → 12300, "1.2m" → 1200000, "" → null, garbage → undefined.
 * A trailing "%" is ignored so percentage fields accept "7.5%".
 */
export function parseNumberInput(text: string): number | null | undefined {
  const clean = text.trim().replace(/[,\s_]/g, "").toLowerCase()
  if (!clean) return null
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))([km]?)%?$/.exec(clean)
  if (!match) return undefined
  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1
  const n = Number(match[1]) * multiplier
  return Number.isFinite(n) ? n : undefined
}

function display(value: number | null): string {
  return value === null || Number.isNaN(value) ? "" : displayFormatter.format(value)
}

/**
 * Numeric text field with thousands separators. Accepts "12,300" and k/m shorthand;
 * clamps to min/max on blur; ↑/↓ step (Shift ×10).
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  integer = false,
  prefix,
  suffix,
  placeholder,
  size = "default",
  id,
  disabled,
  className,
  onBlur,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  /** Round to whole numbers (counts). */
  integer?: boolean
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  placeholder?: string
  size?: ControlSize
  id?: string
  disabled?: boolean
  className?: string
  onBlur?: () => void
  "aria-label"?: string
  "aria-invalid"?: boolean
}) {
  const [text, setText] = useState(() => display(value))
  const [focused, setFocused] = useState(false)
  const [synced, setSynced] = useState(value)
  // Adopt external value changes while the user isn't typing (Object.is so NaN can't loop).
  if (!focused && !Object.is(value, synced)) {
    setSynced(value)
    setText(display(value))
  }

  const invalid = parseNumberInput(text) === undefined
  const normalize = (n: number) => {
    const rounded = integer ? Math.round(n) : Number(n.toFixed(6))
    return clamp(rounded, min ?? -Infinity, max ?? Infinity)
  }

  function emit(next: number | null) {
    setSynced(next)
    if (next !== value) onChange(next)
  }

  return (
    <InputGroup className={cn(size === "sm" ? "h-7" : "h-8", className)}>
      {prefix ? (
        <InputGroupAddon>
          <InputGroupText>{prefix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        id={id}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || invalid || undefined}
        className="h-full num"
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setText(event.target.value)
          const parsed = parseNumberInput(event.target.value)
          if (parsed === undefined) return
          emit(parsed === null ? null : integer ? Math.round(parsed) : parsed)
        }}
        onBlur={() => {
          setFocused(false)
          const parsed = parseNumberInput(text)
          if (parsed === undefined) {
            setText(display(value))
          } else {
            const next = parsed === null ? null : normalize(parsed)
            emit(next)
            setText(display(next))
          }
          onBlur?.()
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
          event.preventDefault()
          const base = parseNumberInput(text) ?? value ?? min ?? 0
          const delta = (event.key === "ArrowUp" ? step : -step) * (event.shiftKey ? 10 : 1)
          const next = normalize(base + delta)
          emit(next)
          setText(display(next))
        }}
      />
      {suffix ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
