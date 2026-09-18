"use client"

import { CirclePlus, Search, X } from "lucide-react"
import { useState } from "react"
import { filterMessages } from "@/components/common/messages"
import { CheckboxIndicator, keywordFilter } from "@/components/common/multi-select"
import type { ControlSize, IconComponent } from "@/components/common/types"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"

/** Toolbar row for search + facet filters; `actions` align right (view toggles, sort). */
export function FilterBar({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {children}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Search box with a clear button. Esc clears. */
export function SearchInput({
  value,
  onChange,
  placeholder: placeholderProp,
  size = "sm",
  autoFocus,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  size?: ControlSize
  autoFocus?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}) {
  const t = useT(filterMessages)
  const placeholder = placeholderProp ?? t("search_placeholder")
  return (
    <InputGroup className={cn("w-full sm:w-60", size === "sm" ? "h-7" : "h-8", className)}>
      <InputGroupAddon>
        <Search className="size-3.5" aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder.replace(/…$/, "")}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault()
            event.stopPropagation()
            onChange("")
          }
        }}
        className="h-full [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label={t("clear_search")} onClick={() => onChange("")}>
            <X aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}

export interface FacetOption {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
}

/** Popover multi-select filter with per-option counts and a selection summary on the trigger. */
export function FacetFilter({
  title,
  options,
  value,
  onChange,
  icon: Icon = CirclePlus,
  searchable,
  size = "sm",
  className,
}: {
  title: string
  options: FacetOption[]
  value: string[]
  onChange: (value: string[]) => void
  icon?: IconComponent
  /** Defaults to true when there are more than 7 options. */
  searchable?: boolean
  size?: ControlSize
  className?: string
}) {
  const t = useT(filterMessages)
  const [open, setOpen] = useState(false)
  const selected = new Set(value)
  const selectedOptions = options.filter((o) => selected.has(o.value))
  const showSearch = searchable ?? options.length > 7

  function toggle(optionValue: string) {
    onChange(selected.has(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className={cn("max-w-full", !value.length && "border-dashed", className)}
          aria-label={value.length ? `${title}: ${selectedOptions.map((o) => o.label).join(", ")}` : undefined}
        >
          <Icon className="text-muted-foreground" aria-hidden />
          {title}
          {value.length ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 data-vertical:h-3.5" />
              <span className="rounded-sm bg-muted px-1 text-xs font-medium num lg:hidden">{value.length}</span>
              <span className="hidden min-w-0 gap-1 lg:flex">
                {value.length > 2 ? (
                  <span className="rounded-sm bg-muted px-1 text-xs font-medium">{t("selected", { count: value.length })}</span>
                ) : (
                  selectedOptions.map((o) => (
                    <span key={o.value} className="max-w-28 truncate rounded-sm bg-muted px-1 text-xs font-medium">
                      {o.label}
                    </span>
                  ))
                )}
              </span>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 gap-0 p-0">
        <Command filter={keywordFilter}>
          {showSearch ? <CommandInput placeholder={title} /> : null}
          <CommandList label={t("options_label")}>
            <CommandEmpty>{t("no_results")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    aria-checked={checked}
                    onSelect={() => toggle(option.value)}
                    className="[&>svg:last-child]:hidden"
                  >
                    <CheckboxIndicator checked={checked} />
                    {option.icon}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.count !== undefined ? (
                      <span className="ml-auto pl-2 text-xs text-muted-foreground num">{formatNumber(option.count)}</span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {value.length ? (
              <>
                <CommandSeparator alwaysRender />
                <CommandGroup forceMount>
                  <CommandItem
                    value="__clear__"
                    forceMount
                    onSelect={() => onChange([])}
                    className="justify-center text-muted-foreground [&>svg:last-child]:hidden"
                  >
                    {t("clear_filter")}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Clears every filter. Renders nothing when `show` is false. */
export function ResetFiltersButton({
  onClick,
  show = true,
  label,
  size = "sm",
  className,
}: {
  onClick: () => void
  show?: boolean
  label?: string
  size?: ControlSize
  className?: string
}) {
  const t = useT(filterMessages)
  if (!show) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size={size === "sm" ? "sm" : "default"}
      onClick={onClick}
      className={cn("text-muted-foreground", className)}
    >
      <X aria-hidden />
      {label ?? t("reset")}
    </Button>
  )
}
