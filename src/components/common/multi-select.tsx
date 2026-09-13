"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { useState } from "react"
import { chipVariants, Token } from "@/components/common/chip"
import { ColorDot } from "@/components/common/color"
import type { ControlSize, IconComponent } from "@/components/common/types"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { CategoricalColor, TagColor } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Visual checkbox for list rows whose role already carries the checked state. */
export function CheckboxIndicator({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background dark:bg-input/30",
        className
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  )
}

/** Case-insensitive match on option keywords (labels), never on raw ids. */
export function keywordFilter(_value: string, search: string, keywords?: string[]): number {
  const q = search.trim().toLowerCase().replace(/^#/, "")
  if (!q) return 1
  return keywords?.some((k) => k.toLowerCase().includes(q)) ? 1 : 0
}

export interface MultiSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
  color?: CategoricalColor | TagColor
  keywords?: string[]
}

/** Popover multi-select with search, checkboxes and selected chips in the trigger. */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchable = true,
  max,
  maxChips = 3,
  emptyText = "No matches",
  size = "default",
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchable?: boolean
  /** Maximum number of selections. */
  max?: number
  /** Chips shown in the trigger before collapsing into "+N". */
  maxChips?: number
  emptyText?: string
  size?: ControlSize
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}) {
  const [open, setOpen] = useState(false)
  // Count only values that still exist as options (a deleted entity must not hold a slot).
  const selected = options.filter((o) => value.includes(o.value))
  const atMax = max !== undefined && selected.length >= max

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) onChange(value.filter((v) => v !== optionValue))
    else if (!atMax) onChange([...value, optionValue])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          // aria-invalid isn't valid on a button role; style via data-invalid (pair with FormField `error`).
          data-invalid={ariaInvalid || undefined}
          disabled={disabled}
          className={cn(
            "flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-input bg-transparent py-1 pr-2 pl-1.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50 dark:data-invalid:border-destructive/50 dark:data-invalid:ring-destructive/40",
            size === "sm" ? "min-h-7" : "min-h-8",
            className
          )}
        >
          {selected.length ? (
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {selected.slice(0, maxChips).map((option) => (
                <Token key={option.value} className="max-w-40">
                  {option.color ? <ColorDot color={option.color} className="size-1.5" /> : option.icon}
                  <span className="truncate">{option.label}</span>
                </Token>
              ))}
              {selected.length > maxChips ? (
                <span className="px-0.5 text-xs text-muted-foreground">+{selected.length - maxChips}</span>
              ) : null}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate pl-1 text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 gap-0 p-0">
        <Command filter={keywordFilter}>
          {searchable ? <CommandInput placeholder="Search…" /> : null}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = value.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, ...(option.keywords ?? [])]}
                    disabled={!checked && atMax}
                    aria-checked={checked}
                    onSelect={() => toggle(option.value)}
                  >
                    <CheckboxIndicator checked={checked} />
                    {option.color ? <ColorDot color={option.color} /> : option.icon}
                    <span className="min-w-0 truncate">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          {value.length || max ? (
            <div className="flex items-center justify-between gap-2 border-t px-2.5 py-1.5 text-xs text-muted-foreground">
              <span className="num">
                {selected.length}
                {max ? ` / ${max}` : ""} selected
              </span>
              {value.length ? (
                <Button type="button" variant="ghost" size="xs" onClick={() => onChange([])}>
                  Clear
                </Button>
              ) : null}
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ---------------------------- Chip toggle group --------------------------- */

export interface ChipOption<T extends string = string> {
  value: T
  label: string
  icon?: IconComponent
  color?: CategoricalColor
}

interface ChipToggleGroupBase<T extends string> {
  options: ChipOption<T>[]
  size?: "xs" | "sm" | "default"
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export type ChipToggleGroupProps<T extends string> = ChipToggleGroupBase<T> &
  (
    | { multiple: true; value: T[]; onChange: (value: T[]) => void }
    | { multiple?: false; value: T | null; onChange: (value: T | null) => void; /** Disallow deselecting. */ required?: boolean }
  )

/** Small enum sets as chips — single (radio-like) or multiple. Arrow keys move between chips. */
export function ChipToggleGroup<T extends string>(props: ChipToggleGroupProps<T>) {
  const { options, size = "sm", disabled, className, "aria-label": ariaLabel } = props
  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v)

  const items = options.map((option) => {
    const Icon = option.icon
    return (
      <ToggleGroupPrimitive.Item
        key={option.value}
        value={option.value}
        className={chipVariants({ size, selected: isSelected(option.value) })}
      >
        {option.color ? <ColorDot color={option.color} /> : Icon ? <Icon aria-hidden /> : null}
        {option.label}
      </ToggleGroupPrimitive.Item>
    )
  })
  const rootClass = cn("flex flex-wrap items-center gap-1.5", className)

  if (props.multiple) {
    const { onChange } = props
    return (
      <ToggleGroupPrimitive.Root
        type="multiple"
        aria-label={ariaLabel}
        disabled={disabled}
        value={props.value}
        onValueChange={(next) => {
          const set = new Set(next)
          onChange(options.map((o) => o.value).filter((v) => set.has(v)))
        }}
        className={rootClass}
      >
        {items}
      </ToggleGroupPrimitive.Root>
    )
  }

  const { onChange, required } = props
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      aria-label={ariaLabel}
      disabled={disabled}
      value={props.value ?? ""}
      onValueChange={(next) => {
        if (!next) {
          if (!required) onChange(null)
          return
        }
        onChange(next as T)
      }}
      className={rootClass}
    >
      {items}
    </ToggleGroupPrimitive.Root>
  )
}
