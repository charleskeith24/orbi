"use client"

import { ChevronsUpDown, Globe } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const offsetCache = new Map<string, string>()

/** "GMT+8" for a zone at `now` ("" when the zone is unknown to this browser). Cached per zone and day. */
function offsetLabel(timeZone: string, now: Date): string {
  const key = `${timeZone}|${now.toDateString()}`
  const cached = offsetCache.get(key)
  if (cached !== undefined) return cached
  let label = ""
  try {
    label =
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value ?? ""
  } catch {
    label = ""
  }
  offsetCache.set(key, label)
  return label
}

function listTimeZones(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf("timeZone")
  } catch {
    zones = []
  }
  return current && !zones.includes(current) ? [current, ...zones] : zones
}

const prettyZone = (zone: string) => zone.replace(/_/g, " ")

/** Searchable IANA timezone picker with UTC offsets. */
export function TimezoneSelect({
  id,
  value,
  onChange,
  now,
  invalid,
}: {
  id?: string
  value: string
  onChange: (timeZone: string) => void
  now: Date
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const zones = useMemo(() => listTimeZones(value), [value])
  // Offsets for ~400 zones are only worth computing while the list is open.
  const offsets = useMemo(() => (open ? new Map(zones.map((z) => [z, offsetLabel(z, now)])) : null), [open, zones, now])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="w-full max-w-sm justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe className="text-muted-foreground" aria-hidden />
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? prettyZone(value) : "Choose a timezone"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {value ? <span className="text-xs text-muted-foreground num">{offsetLabel(value, now)}</span> : null}
            <ChevronsUpDown className="text-muted-foreground" aria-hidden />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 gap-0 p-0">
        <Command>
          <CommandInput placeholder="Search city or region…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  keywords={[prettyZone(zone), offsets?.get(zone) ?? ""]}
                  data-checked={zone === value}
                  onSelect={() => {
                    onChange(zone)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 truncate">{prettyZone(zone)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground num">{offsets?.get(zone)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
