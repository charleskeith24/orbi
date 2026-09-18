"use client"

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { useRef, useState } from "react"
import { Token } from "@/components/common/chip"
import { listEditorMessages } from "@/components/common/messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cn, splitList } from "@/lib/utils"

export interface ListEditorProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  /** Button label for the `lines` variant. */
  addLabel?: string
  /** `chips` for short tokens (keywords, phrases); `lines` for sentences (talking points). */
  variant?: "chips" | "lines"
  maxItems?: number
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * Edit a string list. Enter adds; chips also split on commas and pasted lines.
 * Lines support inline edit (Enter/blur saves, Esc reverts), reorder (buttons or Alt+↑/↓) and remove.
 */
export function ListEditor({ variant = "chips", ...props }: ListEditorProps) {
  return variant === "chips" ? <ChipsEditor {...props} /> : <LinesEditor {...props} />
}

function MaxNote({ max }: { max: number }) {
  const t = useT(listEditorMessages)
  return <p className="text-xs text-muted-foreground">{t("max_reached", { max })}</p>
}

/* ---------------------------------- Chips --------------------------------- */

function ChipsEditor({
  value,
  onChange,
  placeholder,
  maxItems,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: Omit<ListEditorProps, "variant">) {
  const t = useT(listEditorMessages)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const full = maxItems !== undefined && value.length >= maxItems

  function add(raw: string) {
    const parts = splitList(raw)
    setDraft("")
    if (!parts.length) return
    const seen = new Set(value.map((v) => v.toLowerCase()))
    const next = [...value]
    for (const part of parts) {
      if (maxItems !== undefined && next.length >= maxItems) break
      if (seen.has(part.toLowerCase())) continue
      seen.add(part.toLowerCase())
      next.push(part)
    }
    if (next.length !== value.length) onChange(next)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
      event.preventDefault()
      add(draft)
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text")
    if (!/[\n,]/.test(text)) return
    event.preventDefault()
    add(`${draft},${text}`)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-0.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          disabled && "pointer-events-none opacity-50",
          className
        )}
      >
        {value.map((item, index) => (
          <Token key={`${item}-${index}`} className="pr-0.5">
            <span className="truncate">{item}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation()
                onChange(value.filter((_, i) => i !== index))
              }}
              aria-label={t("remove_named", { item })}
              className="flex size-4 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X aria-hidden />
            </button>
          </Token>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={disabled || full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={full ? "" : value.length ? t("add_more") : (placeholder ?? t("chips_placeholder"))}
          aria-label={ariaLabel}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        />
      </div>
      {full && maxItems !== undefined ? <MaxNote max={maxItems} /> : null}
    </div>
  )
}

/* ---------------------------------- Lines --------------------------------- */

function LinesEditor({
  value,
  onChange,
  placeholder: placeholderProp,
  addLabel,
  maxItems,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: Omit<ListEditorProps, "variant">) {
  const t = useT(listEditorMessages)
  const c = useT(commonMessages)
  const placeholder = placeholderProp ?? t("lines_placeholder")
  const [draft, setDraft] = useState("")
  const listRef = useRef<HTMLOListElement>(null)
  const full = maxItems !== undefined && value.length >= maxItems

  function focusRow(index: number, action?: "up" | "down") {
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${index}"]`)
      const button = action ? row?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`) : null
      if (button && !button.disabled) button.focus()
      else row?.querySelector<HTMLInputElement>("input")?.focus()
    })
  }

  function commit(index: number, text: string) {
    const clean = text.trim()
    if (!clean) onChange(value.filter((_, i) => i !== index))
    else if (clean !== value[index]) onChange(value.map((v, i) => (i === index ? clean : v)))
  }

  function move(index: number, direction: -1 | 1, from: "input" | "button", text?: string) {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    if (text !== undefined && text.trim()) next[index] = text.trim()
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    focusRow(target, from === "button" ? (direction < 0 ? "up" : "down") : undefined)
  }

  function addDraft() {
    const clean = draft.trim()
    if (!clean || full) return
    onChange([...value, clean])
    setDraft("")
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value.length ? (
        <ol ref={listRef} aria-label={ariaLabel} className="flex flex-col divide-y rounded-lg border bg-card dark:bg-input/20">
          {value.map((item, index) => (
            <LineRow
              key={index}
              index={index}
              item={item}
              itemLabel={ariaLabel ?? t("item")}
              count={value.length}
              disabled={disabled}
              onCommit={(text) => commit(index, text)}
              onMove={(direction, from, text) => move(index, direction, from, text)}
              onRemove={() => {
                onChange(value.filter((_, i) => i !== index))
                if (value.length > 1) focusRow(Math.min(index, value.length - 2))
              }}
            />
          ))}
        </ol>
      ) : null}
      {full && maxItems !== undefined ? (
        <MaxNote max={maxItems} />
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel ? t("new_item", { label: ariaLabel.toLowerCase() }) : placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addDraft()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addDraft} disabled={disabled || !draft.trim()}>
            <Plus aria-hidden />
            {addLabel ?? c("add")}
          </Button>
        </div>
      )}
    </div>
  )
}

function LineRow({
  index,
  item,
  itemLabel,
  count,
  disabled,
  onCommit,
  onMove,
  onRemove,
}: {
  index: number
  item: string
  itemLabel: string
  count: number
  disabled?: boolean
  onCommit: (text: string) => void
  onMove: (direction: -1 | 1, from: "input" | "button", text?: string) => void
  onRemove: () => void
}) {
  const t = useT(listEditorMessages)
  const [draft, setDraft] = useState(item)
  const [source, setSource] = useState(item)
  // Re-sync the draft when the underlying item changes (reorder, external edit).
  if (source !== item) {
    setSource(item)
    setDraft(item)
  }

  return (
    <li data-row={index} className="group/row flex items-center gap-1 py-1 pr-1 pl-2.5">
      <span aria-hidden className="w-4 shrink-0 text-right text-xs text-muted-foreground num">
        {index + 1}
      </span>
      <input
        value={draft}
        disabled={disabled}
        aria-label={`${itemLabel} ${index + 1}`}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onCommit(draft)
          } else if (event.key === "Escape" && draft !== item) {
            event.stopPropagation()
            setDraft(item)
          } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault()
            onMove(event.key === "ArrowUp" ? -1 : 1, "input", draft)
          }
        }}
        className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-base outline-none hover:bg-muted/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
      />
      <div className="flex shrink-0 items-center transition-opacity sm:opacity-0 sm:group-focus-within/row:opacity-100 sm:group-hover/row:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-action="up"
          aria-label={t("move_up", { n: index + 1 })}
          disabled={disabled || index === 0}
          onClick={() => onMove(-1, "button")}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-action="down"
          aria-label={t("move_down", { n: index + 1 })}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(1, "button")}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("remove_item", { n: index + 1 })}
          disabled={disabled}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      </div>
    </li>
  )
}
