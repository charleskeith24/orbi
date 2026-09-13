"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const TEXT_STYLES = {
  h1: "text-lg leading-7 font-semibold tracking-tight",
  h2: "text-base leading-6 font-semibold",
  span: "text-sm leading-5",
} as const

/** Shared box so display and edit modes line up pixel-for-pixel. */
const BOX = "-mx-1.5 -my-0.5 rounded-md px-1.5 py-0.5"

/**
 * Click-to-edit text. Enter saves (multiline: ⌘/Ctrl+Enter), Esc cancels, blur saves.
 * `onSave` only fires when the trimmed value changed. `required` rejects empty values.
 */
export function InlineText({
  value,
  onSave,
  placeholder = "Untitled",
  as = "span",
  multiline = false,
  required = false,
  maxLength,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  as?: "h1" | "h2" | "span"
  multiline?: boolean
  required?: boolean
  maxLength?: number
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const displayRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const restoreFocus = useRef(false)
  // Guards against a second finish() — e.g. a blur fired while the field unmounts after Enter/Esc,
  // which would otherwise save twice or save a cancelled draft.
  const active = useRef(false)

  useEffect(() => {
    if (editing) {
      const field = inputRef.current ?? areaRef.current
      field?.focus()
      field?.select()
    } else if (restoreFocus.current) {
      restoreFocus.current = false
      displayRef.current?.focus()
    }
  }, [editing])

  function start() {
    if (disabled) return
    active.current = true
    setDraft(value)
    setEditing(true)
  }

  function finish(save: boolean, fromKeyboard: boolean) {
    if (!active.current) return
    active.current = false
    restoreFocus.current = fromKeyboard
    setEditing(false)
    if (!save) return
    const next = multiline ? draft.trim() : draft.replace(/\s+/g, " ").trim()
    if (required && !next) return
    if (next !== value) onSave(next)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      finish(false, true)
    } else if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      finish(true, true)
    }
  }

  const textStyle = TEXT_STYLES[as]
  const label = ariaLabel ?? (typeof placeholder === "string" ? placeholder : "Text")

  if (editing) {
    const fieldClass = cn(
      textStyle,
      BOX,
      "block w-[calc(100%+0.75rem)] min-w-0 bg-background outline-none ring-2 ring-ring/50 dark:bg-input/30",
      className
    )
    return multiline ? (
      <textarea
        ref={areaRef}
        value={draft}
        maxLength={maxLength}
        aria-label={label}
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={onKeyDown}
        className={cn(fieldClass, "field-sizing-content min-h-12 resize-none")}
      />
    ) : (
      <input
        ref={inputRef}
        value={draft}
        maxLength={maxLength}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={onKeyDown}
        className={fieldClass}
      />
    )
  }

  const Tag = as
  return (
    <Tag className={cn(textStyle, "min-w-0", className)}>
      <button
        ref={displayRef}
        type="button"
        onClick={start}
        disabled={disabled}
        title={disabled ? undefined : "Click to edit"}
        className={cn(
          BOX,
          "inline max-w-full text-left break-words whitespace-pre-wrap outline-none enabled:hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default",
          !value && "text-muted-foreground"
        )}
      >
        {value || placeholder}
        <span className="sr-only"> (edit)</span>
      </button>
    </Tag>
  )
}
