"use client"

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import type { ControlSize, IconComponent } from "@/components/common/types"
import { cn } from "@/lib/utils"

export interface ViewOption<T extends string = string> {
  value: T
  label: string
  icon?: IconComponent
}

/**
 * Segmented control for switching views (Board / List / Calendar…). Arrow keys move
 * between options. Labels collapse to icons below `sm` when icons are provided.
 */
export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  iconOnly = false,
  className,
  "aria-label": ariaLabel = "View",
}: {
  value: T
  onChange: (value: T) => void
  options: ViewOption<T>[]
  size?: ControlSize
  iconOnly?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5 dark:bg-input/40",
        size === "sm" ? "h-7" : "h-8",
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            aria-label={option.label}
            title={iconOnly ? option.label : undefined}
            className={cn(
              "inline-flex h-full items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs dark:data-[state=on]:bg-card",
              iconOnly && "aspect-square px-0"
            )}
          >
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            {iconOnly ? null : <span className={cn(Icon && "hidden sm:inline")}>{option.label}</span>}
          </ToggleGroupPrimitive.Item>
        )
      })}
    </ToggleGroupPrimitive.Root>
  )
}
