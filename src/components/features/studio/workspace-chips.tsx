"use client"

import { AlarmClock, CalendarCheck, CalendarClock, CalendarDays, ChevronsDown, UserRound, UserRoundX } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  FormatSelect,
  FunnelSelect,
  GoalSelect,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  PrioritySelect,
  StageSelect,
  TimeInput,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { BUFFER_STAGES, PUBLISHED_STAGES } from "@/lib/constants"
import { combineDateTime, daysBetween, formatDate, formatRelativeDay, parseDate, toISODate } from "@/lib/dates"
import { dataActions, moveItemToStage, scheduleItem, uiActions, unscheduleItem, useSettings, useTable } from "@/lib/store"
import type { ContentItem, PipelineStage, UpdateRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { knownOwners } from "./studio-utils"

/** Select triggers restyled as compact property chips (chevron hidden, width follows the value). */
const SELECT_CHIP = "w-auto max-w-56 pr-2 pl-2 text-[0.8rem] [&>svg:last-child]:hidden"
/** Popover chips share the outline look of the select chips. */
const BUTTON_CHIP = "max-w-64 justify-start border-input px-2 font-normal dark:bg-input/30"

/**
 * Hover hint naming the property. A native `title` on purpose: a Radix Tooltip around a Select or
 * Popover trigger opens during the click and becomes the top dismissable layer, swallowing the first Esc.
 */
function ChipTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span title={label} className="inline-flex min-w-0">
      {children}
    </span>
  )
}

export function publishedToast(itemId: string, title = "Marked as published") {
  toast.success(title, {
    description: "Log the numbers once they come in — winners and reports learn from them.",
    action: { label: "Add analytics", onClick: () => uiActions.openDialog({ type: "add-metrics", itemId }) },
  })
}

/* -------------------------------- Due date -------------------------------- */

function DueChip({ item, now }: { item: ContentItem; now: Date }) {
  const [open, setOpen] = useState(false)
  const due = parseDate(item.due_date)
  const live = PUBLISHED_STAGES.includes(item.stage)
  const overdue = Boolean(due) && !live && !BUFFER_STAGES.includes(item.stage) && (daysBetween(now, due) ?? 0) < 0

  function save(value: string | null) {
    dataActions.update("content_items", item.id, { due_date: value })
    setOpen(false)
  }

  const relative = due ? formatRelativeDay(due, now) : ""
  const label = !due
    ? "Due date"
    : overdue
      ? `Overdue · ${formatDate(due, "MMM d")}`
      : `Due ${/^(Today|Tomorrow|Yesterday)$/.test(relative) ? relative.toLowerCase() : relative.startsWith("in ") ? relative : formatDate(due, "MMM d")}`
  const Icon = overdue ? AlarmClock : CalendarDays
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ChipTip label={due ? `Production deadline · ${formatDate(due, "EEE, MMM d, yyyy")}` : "Production deadline"}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={due ? `Due date: ${formatDate(due)}` : "Set due date"}
            className={cn(BUTTON_CHIP, !due && "text-muted-foreground", overdue && "font-medium text-critical-fg")}
          >
            <Icon aria-hidden />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
      </ChipTip>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          selected={due ?? undefined}
          defaultMonth={due ?? now}
          autoFocus
          onSelect={(date) => (date ? save(toISODate(date)) : setOpen(false))}
        />
        <div className="flex items-center justify-between gap-2 border-t p-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={() => save(toISODate(now))}>
            Today
          </Button>
          {due ? (
            <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => save(null)}>
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------- Schedule -------------------------------- */

function ScheduleChip({
  item,
  now,
  open,
  onOpenChange,
}: {
  item: ContentItem
  now: Date
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const live = PUBLISHED_STAGES.includes(item.stage)
  const value = parseDate(live ? (item.published_at ?? item.scheduled_at) : item.scheduled_at)
  const time = value ? formatDate(value, "HH:mm") : null

  function save(date: Date, nextTime: string) {
    const wasReady = item.stage === "ready_to_post"
    const hadDate = Boolean(item.scheduled_at)
    const iso = combineDateTime(date, nextTime)
    scheduleItem(item.id, iso)
    if (!live && (wasReady || !hadDate)) {
      toast.success(`Scheduled for ${formatDate(iso, "EEE, MMM d · h:mm a")}`, {
        description: wasReady ? "Moved from Ready to Post to Scheduled." : undefined,
      })
    }
  }

  function clear() {
    const wasScheduled = item.stage === "scheduled"
    unscheduleItem(item.id)
    onOpenChange(false)
    toast.success("Removed from the schedule", { description: wasScheduled ? "Back in Ready to Post." : undefined })
  }

  const label = live
    ? value
      ? `Published ${formatDate(value, "MMM d · h:mm a")}`
      : "Published"
    : value
      ? formatDate(value, "EEE, MMM d · h:mm a")
      : "Schedule"
  const Icon = live ? CalendarCheck : CalendarClock
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <ChipTip label={live ? "Publish date — edit it if the post went live at another time" : "Planned publish date and time"}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={live ? `Published: ${label}` : value ? `Scheduled: ${label}` : "Schedule publish date"}
            className={cn(BUTTON_CHIP, !value && "text-muted-foreground")}
          >
            <Icon aria-hidden />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
      </ChipTip>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          defaultMonth={value ?? now}
          autoFocus
          onSelect={(date) => {
            if (date) save(date, time ?? "09:00")
          }}
        />
        <div className="flex items-center gap-2 border-t p-2">
          <span className="text-xs text-muted-foreground">Time</span>
          <TimeInput size="sm" value={time ?? "09:00"} onChange={(next) => (next ? save(value ?? now, next) : undefined)} />
          {!live && value ? (
            <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={clear}>
              Unschedule
            </Button>
          ) : null}
          <Button type="button" size="xs" className="ml-auto" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---------------------------------- Owner --------------------------------- */

function OwnerChip({ item }: { item: ContentItem }) {
  const items = useTable("content_items")
  const settings = useSettings()
  const owners = useMemo(() => knownOwners(items, settings.default_owner), [items, settings.default_owner])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const clean = search.replace(/\s+/g, " ").trim()
  const exists = owners.some((o) => o.toLowerCase() === clean.toLowerCase())

  function assign(owner: string) {
    if (owner !== item.owner) dataActions.update("content_items", item.id, { owner })
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <ChipTip label="Owner">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={item.owner ? `Owner: ${item.owner}` : "Assign owner"}
            className={cn(BUTTON_CHIP, !item.owner && "text-muted-foreground")}
          >
            <UserRound aria-hidden />
            <span className="truncate">{item.owner || "Owner"}</span>
          </Button>
        </PopoverTrigger>
      </ChipTip>
      <PopoverContent align="start" className="w-60 gap-0 p-0">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Assign to…" />
          <CommandList>
            {exists || !clean ? <CommandEmpty>No one by that name yet.</CommandEmpty> : null}
            {owners.length ? (
              <CommandGroup heading="People">
                {owners.map((owner) => (
                  <CommandItem key={owner} value={owner} data-checked={owner === item.owner ? "true" : undefined} onSelect={() => assign(owner)}>
                    <UserRound className="text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate">{owner}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {clean && !exists ? (
              <CommandGroup forceMount>
                <CommandItem forceMount value={`__assign__${clean}`} onSelect={() => assign(clean)}>
                  <UserRound className="text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate">
                    Assign to <span className="font-medium">{clean}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {item.owner ? (
              <CommandGroup forceMount>
                <CommandItem forceMount value="__unassign__" onSelect={() => assign("")}>
                  <UserRoundX className="text-muted-foreground" aria-hidden />
                  Unassign
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------- Property bar ------------------------------ */

/**
 * The item's properties as compact chips in two rows: production (stage, priority, platform,
 * format, owner, deadline, schedule) and strategy (pillar, persona, funnel, goal). Phones show
 * the essentials until "All properties" is pressed.
 */
export function PropertyBar({ item, now }: { item: ContentItem; now: Date }) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const update = (patch: UpdateRow<"content_items">) => dataActions.update("content_items", item.id, patch)
  const compact = isMobile && !expanded

  function changeStage(stage: PipelineStage) {
    const wasLive = PUBLISHED_STAGES.includes(item.stage)
    moveItemToStage(item.id, stage)
    if (PUBLISHED_STAGES.includes(stage) && !wasLive) publishedToast(item.id)
    else if (stage === "scheduled" && !item.scheduled_at) {
      toast.info("Pick a publish date", { description: "Scheduled content needs a date and time." })
      setScheduleOpen(true)
    }
  }

  return (
    <div role="group" aria-label="Properties" className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ChipTip label="Stage">
          <StageSelect value={item.stage} onChange={(stage) => stage && changeStage(stage)} size="sm" aria-label="Stage" className={SELECT_CHIP} />
        </ChipTip>
        {compact ? null : (
          <ChipTip label="Priority">
            <PrioritySelect value={item.priority} onChange={(priority) => priority && update({ priority })} size="sm" aria-label="Priority" className={SELECT_CHIP} />
          </ChipTip>
        )}
        <ChipTip label="Platform">
          <PlatformSelect value={item.platform} onChange={(platform) => platform && update({ platform })} size="sm" aria-label="Platform" className={SELECT_CHIP} />
        </ChipTip>
        {compact ? null : (
          <>
            <ChipTip label="Format">
              <FormatSelect value={item.format_id} onChange={(format_id) => update({ format_id })} allowNone size="sm" aria-label="Format" className={SELECT_CHIP} />
            </ChipTip>
            <OwnerChip item={item} />
          </>
        )}
        <DueChip item={item} now={now} />
        <ScheduleChip item={item} now={now} open={scheduleOpen} onOpenChange={setScheduleOpen} />
        {compact ? (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setExpanded(true)}>
            <ChevronsDown aria-hidden />
            All properties
          </Button>
        ) : null}
      </div>
      {compact ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <ChipTip label="Content pillar">
            <PillarSelect value={item.pillar_id} onChange={(pillar_id) => update({ pillar_id })} allowNone size="sm" aria-label="Content pillar" className={SELECT_CHIP} />
          </ChipTip>
          <ChipTip label="Target audience (persona)">
            <PersonaSelect value={item.persona_id} onChange={(persona_id) => update({ persona_id })} allowNone size="sm" aria-label="Persona" className={SELECT_CHIP} />
          </ChipTip>
          <ChipTip label="Content Funnel stage">
            <FunnelSelect value={item.funnel_stage} onChange={(funnel_stage) => update({ funnel_stage })} allowNone size="sm" aria-label="Funnel stage" className={SELECT_CHIP} />
          </ChipTip>
          <ChipTip label="Goal">
            <GoalSelect value={item.goal_id} onChange={(goal_id) => update({ goal_id })} allowNone size="sm" aria-label="Goal" className={SELECT_CHIP} />
          </ChipTip>
        </div>
      )}
    </div>
  )
}
