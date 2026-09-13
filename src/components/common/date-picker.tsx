"use client"

import { CalendarClock, CalendarIcon, X } from "lucide-react"
import { useState } from "react"
import type { Matcher } from "react-day-picker"
import type { ControlSize } from "@/components/common/types"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { combineDateTime, formatDate, parseDate, toISODate } from "@/lib/dates"
import type { ISODate, ISODateTime } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PickerBaseProps {
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  id?: string
  className?: string
  size?: ControlSize
  /** Earliest / latest selectable day (inclusive). */
  minDate?: ISODate
  maxDate?: ISODate
  "aria-label"?: string
  "aria-invalid"?: boolean
}

function dayBounds(minDate?: ISODate, maxDate?: ISODate): Matcher[] | undefined {
  const matchers: Matcher[] = []
  const min = parseDate(minDate)
  const max = parseDate(maxDate)
  if (min) matchers.push({ before: min })
  if (max) matchers.push({ after: max })
  return matchers.length ? matchers : undefined
}

/** Outline trigger + absolutely-positioned clear button (never nested inside the trigger). */
function PickerShell({
  icon: Icon,
  label,
  empty,
  showClear,
  onClear,
  open,
  onOpenChange,
  children,
  id,
  size,
  disabled,
  className,
  ariaLabel,
  ariaInvalid,
}: {
  icon: typeof CalendarIcon
  label: string
  empty: boolean
  showClear: boolean
  onClear: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  id?: string
  size: ControlSize
  disabled?: boolean
  className?: string
  ariaLabel?: string
  ariaInvalid?: boolean
}) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size={size === "sm" ? "sm" : "default"}
            disabled={disabled}
            aria-label={ariaLabel ? `${ariaLabel}: ${label}` : undefined}
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full justify-start border-input bg-transparent font-normal",
              empty && "text-muted-foreground",
              showClear && "pr-8"
            )}
          >
            <Icon className="text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto gap-0 p-0">
          {children}
        </PopoverContent>
      </Popover>
      {showClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear date"
          onClick={onClear}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
        >
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

/** Local calendar day picker (`YYYY-MM-DD`, no timezone shift). */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = true,
  disabled,
  id,
  className,
  size = "default",
  minDate,
  maxDate,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: PickerBaseProps & { value: ISODate | null; onChange: (value: ISODate | null) => void }) {
  const [open, setOpen] = useState(false)
  const selected = parseDate(value) ?? undefined
  const today = toISODate(new Date())
  const todayAllowed = (!minDate || today >= minDate) && (!maxDate || today <= maxDate)

  function pick(date: Date | null) {
    onChange(date ? toISODate(date) : null)
    setOpen(false)
  }

  return (
    <PickerShell
      icon={CalendarIcon}
      label={selected ? formatDate(selected, "EEE, MMM d, yyyy") : placeholder}
      empty={!selected}
      showClear={clearable && Boolean(selected) && !disabled}
      onClear={() => onChange(null)}
      open={open}
      onOpenChange={setOpen}
      id={id}
      size={size}
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel}
      ariaInvalid={ariaInvalid}
    >
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected ?? new Date()}
        disabled={dayBounds(minDate, maxDate)}
        autoFocus
        onSelect={(date) => {
          // Re-clicking the selected day just closes — clearing is explicit (Clear / ×).
          if (date) pick(date)
          else setOpen(false)
        }}
      />
      <div className="flex items-center justify-between gap-2 border-t p-1.5">
        <Button type="button" variant="ghost" size="xs" disabled={!todayAllowed} onClick={() => pick(new Date())}>
          Today
        </Button>
        {clearable && selected ? (
          <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => pick(null)}>
            Clear
          </Button>
        ) : null}
      </div>
    </PickerShell>
  )
}

/** Native `HH:mm` time field. */
export function TimeInput({
  value,
  onChange,
  id,
  disabled,
  size = "default",
  className,
  "aria-label": ariaLabel = "Time",
}: {
  value: string | null
  onChange: (value: string | null) => void
  id?: string
  disabled?: boolean
  size?: ControlSize
  className?: string
  "aria-label"?: string
}) {
  return (
    <Input
      id={id}
      type="time"
      value={value ?? ""}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn("w-32 num dark:[color-scheme:dark]", size === "sm" && "h-7", className)}
    />
  )
}

/** Day + time picker producing a full ISO timestamp from local wall-clock time. */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  clearable = true,
  defaultTime = "09:00",
  disabled,
  id,
  className,
  size = "default",
  minDate,
  maxDate,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: PickerBaseProps & {
  value: ISODateTime | null
  onChange: (value: ISODateTime | null) => void
  /** Time applied when a day is picked before any time is set. */
  defaultTime?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseDate(value) ?? undefined
  const time = selected ? formatDate(selected, "HH:mm") : null

  return (
    <PickerShell
      icon={CalendarClock}
      label={selected ? formatDate(selected, "EEE, MMM d · h:mm a") : placeholder}
      empty={!selected}
      showClear={clearable && Boolean(selected) && !disabled}
      onClear={() => onChange(null)}
      open={open}
      onOpenChange={setOpen}
      id={id}
      size={size}
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel}
      ariaInvalid={ariaInvalid}
    >
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected ?? new Date()}
        disabled={dayBounds(minDate, maxDate)}
        autoFocus
        onSelect={(date) => {
          if (date) onChange(combineDateTime(date, time ?? defaultTime))
        }}
      />
      <div className="flex items-center gap-2 border-t p-2">
        <span className="text-xs text-muted-foreground">Time</span>
        <TimeInput
          size="sm"
          value={time ?? defaultTime}
          onChange={(next) => {
            if (next) onChange(combineDateTime(selected ?? new Date(), next))
          }}
        />
        <Button type="button" size="xs" className="ml-auto" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
    </PickerShell>
  )
}
