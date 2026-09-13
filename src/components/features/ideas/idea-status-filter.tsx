"use client"

import { CircleDashed } from "lucide-react"
import { useState } from "react"
import { CheckboxIndicator, IDEA_STATUS_ICONS } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { IDEA_STATUSES } from "@/lib/constants"
import type { IdeaStatus } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { SHORT_STATUS_LABEL } from "./idea-badges"
import { ACTIVE_STATUSES, ALL_STATUSES, sameSet } from "./idea-model"

function RadioIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
        checked ? "border-primary" : "border-input bg-background dark:bg-input/30"
      )}
    >
      {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
    </span>
  )
}

const Count = ({ value }: { value: number }) => (
  <span className="ml-auto pl-2 text-xs text-muted-foreground num">{formatNumber(value)}</span>
)

export function statusFilterSummary(value: IdeaStatus[]): string {
  if (sameSet(value, ACTIVE_STATUSES)) return "Active"
  if (sameSet(value, ALL_STATUSES)) return "All"
  return value.length <= 2 ? value.map((s) => SHORT_STATUS_LABEL[s]).join(", ") : `${value.length} statuses`
}

/**
 * Status filter: "Active" (default — hides converted and archived), "All", or any set of statuses.
 * Counts respect the search and every other filter.
 */
export function IdeaStatusFilter({
  value,
  counts,
  onChange,
}: {
  value: IdeaStatus[]
  counts: Record<IdeaStatus, number>
  onChange: (next: IdeaStatus[]) => void
}) {
  const [open, setOpen] = useState(false)
  const isActive = sameSet(value, ACTIVE_STATUSES)
  const isAll = sameSet(value, ALL_STATUSES)
  const summary = statusFilterSummary(value)
  const total = (statuses: IdeaStatus[]) => statuses.reduce((acc, s) => acc + (counts[s] ?? 0), 0)

  function toggle(status: IdeaStatus) {
    const set = new Set(value)
    if (set.has(status)) set.delete(status)
    else set.add(status)
    const next = ALL_STATUSES.filter((s) => set.has(s))
    onChange(next.length ? next : ACTIVE_STATUSES)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Status: ${summary}`} className="max-w-full">
          <CircleDashed className="text-muted-foreground" aria-hidden />
          Status
          <Separator orientation="vertical" className="mx-0.5 data-vertical:h-3.5" />
          <span className="max-w-32 truncate rounded-sm bg-muted px-1 text-xs font-medium">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-0">
        <Command>
          <CommandList>
            <CommandGroup heading="Show">
              <CommandItem value="active" aria-checked={isActive} onSelect={() => onChange(ACTIVE_STATUSES)} className="[&>svg:last-child]:hidden">
                <RadioIndicator checked={isActive} />
                <span className="flex min-w-0 flex-col">
                  <span>Active</span>
                  <span className="text-xs text-muted-foreground">Hides converted and archived</span>
                </span>
                <Count value={total(ACTIVE_STATUSES)} />
              </CommandItem>
              <CommandItem value="all" aria-checked={isAll} onSelect={() => onChange(ALL_STATUSES)} className="[&>svg:last-child]:hidden">
                <RadioIndicator checked={isAll} />
                All statuses
                <Count value={total(ALL_STATUSES)} />
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Statuses">
              {IDEA_STATUSES.map((status) => {
                const Icon = IDEA_STATUS_ICONS[status.id]
                const checked = value.includes(status.id)
                return (
                  <CommandItem
                    key={status.id}
                    value={status.id}
                    keywords={[status.label]}
                    aria-checked={checked}
                    onSelect={() => toggle(status.id)}
                    className="[&>svg:last-child]:hidden"
                  >
                    <CheckboxIndicator checked={checked} />
                    <Icon className="text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate">{status.label}</span>
                    <Count value={counts[status.id] ?? 0} />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
