"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { PeriodOption } from "./report-periods"

/** Previous / pick / next for a report period (weeks or months). */
export function PeriodNav({
  unit,
  options,
  value,
  prev,
  next,
  onChange,
  className,
}: {
  unit: "week" | "month"
  options: PeriodOption[]
  value: string
  prev: string | null
  next: string | null
  onChange: (value: string) => void
  className?: string
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Previous ${unit}`}
        disabled={!prev}
        onClick={() => prev && onChange(prev)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" aria-label={`Choose ${unit}`} className="w-48 min-w-0 justify-between sm:w-52">
          <SelectValue>
            <span className="truncate num">{selected?.label ?? value}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span className="num">{o.label}</span>
              {o.hint ? <span className="text-xs text-muted-foreground">{o.hint}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Next ${unit}`}
        disabled={!next}
        onClick={() => next && onChange(next)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )
}
